use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use alloy_primitives::B256;
use alloy_sol_types::{sol, SolEvent};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message;

use super::alerts::{Alert, LiveTrade};
use super::markets;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CTF_EXCHANGE: &str = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEGRISK_EXCHANGE: &str = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
const RECONNECT_BASE_DELAY: Duration = Duration::from_secs(2);
const RECONNECT_MAX_DELAY: Duration = Duration::from_secs(60);
const WHALE_THRESHOLD_RAW: u128 = 25_000_000_000; // 25k USDC at 6 decimals
const HEALTH_LOG_INTERVAL: Duration = Duration::from_secs(60);

// ---------------------------------------------------------------------------
// ABI
// ---------------------------------------------------------------------------

sol! {
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 makerAssetId,
        uint256 takerAssetId,
        uint256 makerAmountFilled,
        uint256 takerAmountFilled,
        uint256 fee
    );
}

// ---------------------------------------------------------------------------
// JSON-RPC types for eth_subscribe
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct SubscriptionResponse {
    result: Option<String>,
    error: Option<serde_json::Value>,
}

#[derive(Deserialize)]
struct SubscriptionNotification {
    params: Option<SubscriptionParams>,
}

#[derive(Deserialize)]
struct SubscriptionParams {
    result: LogEntry,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LogEntry {
    address: String,
    topics: Vec<String>,
    data: String,
    transaction_hash: String,
    block_number: String,
    #[serde(default)]
    removed: bool,
}

// ---------------------------------------------------------------------------
// RPC helper for eth_getBlockByNumber (block timestamp resolution)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct RpcResponse<T> {
    result: Option<T>,
}

#[derive(Deserialize)]
struct BlockResult {
    timestamp: String,
}

async fn get_block_timestamp(
    http: &reqwest::Client,
    rpc_url: &str,
    block_hex: &str,
) -> Option<u64> {
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBlockByNumber",
        "params": [block_hex, false],
        "id": 1
    });
    let resp = http
        .post(rpc_url)
        .json(&body)
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .ok()?;
    let rpc: RpcResponse<BlockResult> = resp.json().await.ok()?;
    let ts_hex = rpc.result?.timestamp;
    u64::from_str_radix(ts_hex.trim_start_matches("0x"), 16).ok()
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

pub async fn run(
    active_flag: Arc<AtomicBool>,
    trade_tx: broadcast::Sender<LiveTrade>,
    alert_tx: broadcast::Sender<Alert>,
    market_cache: markets::MarketCache,
    http: reqwest::Client,
    rpc_url: String,
) {
    let ws_url = std::env::var("POLYGON_WS_URL").unwrap_or_else(|_| {
        "wss://polygon-mainnet.g.alchemy.com/v2/Nj9NIo0-mbjkAl7aE9IgBhHEWHB4m8jq".into()
    });

    // Wait for market cache to warm before subscribing
    tokio::time::sleep(Duration::from_secs(10)).await;

    let mut backoff = RECONNECT_BASE_DELAY;

    loop {
        tracing::info!("WS subscriber connecting to {}", &ws_url[..ws_url.len().min(60)]);

        match tokio_tungstenite::connect_async(&ws_url).await {
            Ok((ws_stream, _)) => {
                backoff = RECONNECT_BASE_DELAY; // reset on successful connect
                let (mut write, mut read) = ws_stream.split();

                // Send eth_subscribe for OrderFilled logs on both exchanges
                let topic0 = format!("0x{}", hex::encode(OrderFilled::SIGNATURE_HASH));
                let subscribe_msg = serde_json::json!({
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": "eth_subscribe",
                    "params": ["logs", {
                        "address": [CTF_EXCHANGE, NEGRISK_EXCHANGE],
                        "topics": [topic0]
                    }]
                });

                if let Err(e) = write.send(Message::Text(subscribe_msg.to_string().into())).await {
                    tracing::warn!("WS subscriber: failed to send subscribe: {e}");
                    active_flag.store(false, Ordering::SeqCst);
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(RECONNECT_MAX_DELAY);
                    continue;
                }

                // Wait for subscription confirmation
                let sub_id = match read.next().await {
                    Some(Ok(Message::Text(text))) => {
                        match serde_json::from_str::<SubscriptionResponse>(&text) {
                            Ok(resp) if resp.result.is_some() => {
                                let id = resp.result.unwrap();
                                tracing::info!("WS subscriber active (subscription_id={id})");
                                active_flag.store(true, Ordering::SeqCst);
                                id
                            }
                            Ok(resp) => {
                                tracing::warn!(
                                    "WS subscriber: subscription rejected: {:?}",
                                    resp.error
                                );
                                active_flag.store(false, Ordering::SeqCst);
                                tokio::time::sleep(backoff).await;
                                backoff = (backoff * 2).min(RECONNECT_MAX_DELAY);
                                continue;
                            }
                            Err(e) => {
                                tracing::warn!("WS subscriber: unexpected response: {e} — {text}");
                                active_flag.store(false, Ordering::SeqCst);
                                tokio::time::sleep(backoff).await;
                                backoff = (backoff * 2).min(RECONNECT_MAX_DELAY);
                                continue;
                            }
                        }
                    }
                    other => {
                        tracing::warn!("WS subscriber: no subscription response: {other:?}");
                        active_flag.store(false, Ordering::SeqCst);
                        tokio::time::sleep(backoff).await;
                        backoff = (backoff * 2).min(RECONNECT_MAX_DELAY);
                        continue;
                    }
                };

                // Inner message loop
                let connected_at = Instant::now();
                let mut event_count: u64 = 0;
                let mut last_health_log = Instant::now();
                let mut cached_block: Option<(u64, u64)> = None; // (block_number, timestamp)

                loop {
                    match read.next().await {
                        Some(Ok(Message::Text(text))) => {
                            // Health log
                            if last_health_log.elapsed() >= HEALTH_LOG_INTERVAL {
                                tracing::info!(
                                    "WS subscriber health: {event_count} events, uptime={}s, sub={sub_id}",
                                    connected_at.elapsed().as_secs()
                                );
                                last_health_log = Instant::now();
                            }

                            let notification: SubscriptionNotification =
                                match serde_json::from_str(&text) {
                                    Ok(n) => n,
                                    Err(_) => continue, // non-notification message (e.g. ping)
                                };

                            let Some(params) = notification.params else {
                                continue;
                            };
                            let log_entry = params.result;

                            // Skip reorged logs
                            if log_entry.removed {
                                tracing::debug!("WS subscriber: skipping removed log");
                                continue;
                            }

                            event_count += 1;

                            // Decode the log
                            if let Some((trade, usdc_raw)) = decode_order_filled(
                                &log_entry,
                                &market_cache,
                                &http,
                                &rpc_url,
                                &mut cached_block,
                            )
                            .await
                            {
                                // Broadcast trade
                                let _ = trade_tx.send(trade.clone());

                                // Whale alert
                                if usdc_raw >= WHALE_THRESHOLD_RAW {
                                    let cache = market_cache.read().await;
                                    let info = cache.get(&trade.cache_key);
                                    let alert = Alert::WhaleTrade {
                                        timestamp: trade.block_timestamp.clone(),
                                        exchange: if log_entry.address.eq_ignore_ascii_case(NEGRISK_EXCHANGE) {
                                            "neg_risk".into()
                                        } else {
                                            "ctf".into()
                                        },
                                        side: trade.side.clone(),
                                        trader: trade.trader.clone(),
                                        asset_id: trade.asset_id.clone(),
                                        usdc_amount: trade.usdc_amount.clone(),
                                        token_amount: trade.amount.clone(),
                                        tx_hash: trade.tx_hash.clone(),
                                        block_number: trade.block_number,
                                        question: info.map(|i| i.question.clone()),
                                        outcome: info.map(|i| i.outcome.clone()),
                                    };
                                    let _ = alert_tx.send(alert);
                                }
                            }
                        }
                        Some(Ok(Message::Ping(data))) => {
                            let _ = write.send(Message::Pong(data)).await;
                        }
                        Some(Ok(Message::Close(_))) | None => {
                            tracing::warn!(
                                "WS subscriber disconnected (uptime={}s, events={event_count})",
                                connected_at.elapsed().as_secs()
                            );
                            break;
                        }
                        Some(Err(e)) => {
                            tracing::warn!(
                                "WS subscriber error: {e} (uptime={}s, events={event_count})",
                                connected_at.elapsed().as_secs()
                            );
                            break;
                        }
                        _ => {} // Binary, Pong — ignore
                    }
                }

                active_flag.store(false, Ordering::SeqCst);
            }
            Err(e) => {
                tracing::warn!("WS subscriber: connection failed: {e}");
                active_flag.store(false, Ordering::SeqCst);
            }
        }

        tracing::info!("WS subscriber: reconnecting in {}s", backoff.as_secs());
        tokio::time::sleep(backoff).await;
        backoff = (backoff * 2).min(RECONNECT_MAX_DELAY);
    }
}

// ---------------------------------------------------------------------------
// Decode a raw log entry into a LiveTrade
// ---------------------------------------------------------------------------

async fn decode_order_filled(
    log_entry: &LogEntry,
    market_cache: &markets::MarketCache,
    http: &reqwest::Client,
    rpc_url: &str,
    cached_block: &mut Option<(u64, u64)>,
) -> Option<(LiveTrade, u128)> {
    // Parse topics from hex strings to B256
    let topics: Vec<B256> = log_entry
        .topics
        .iter()
        .filter_map(|t| t.parse::<B256>().ok())
        .collect();

    if topics.len() < 4 {
        tracing::debug!("WS subscriber: log has {} topics, expected 4", topics.len());
        return None;
    }

    // Parse data from hex string
    let data_bytes = hex::decode(log_entry.data.trim_start_matches("0x")).ok()?;

    // Decode using alloy sol! generated type
    let decoded = OrderFilled::decode_raw_log(topics.iter().copied(), &data_bytes).ok()?;

    let maker_asset_id = decoded.makerAssetId;
    let taker_asset_id = decoded.takerAssetId;
    let maker_amount = decoded.makerAmountFilled;
    let taker_amount = decoded.takerAmountFilled;
    let maker = decoded.maker;

    // Determine side (same logic as alerts.rs parse_trade_data)
    let (side, asset_id, usdc_raw, token_raw) = if maker_asset_id.is_zero() {
        ("buy", taker_asset_id, maker_amount, taker_amount)
    } else if taker_asset_id.is_zero() {
        ("sell", maker_asset_id, taker_amount, maker_amount)
    } else {
        tracing::debug!("WS subscriber: both asset IDs non-zero, skipping");
        return None;
    };

    let usdc_raw_u128: u128 = usdc_raw.try_into().ok()?;
    let token_raw_u128: u128 = token_raw.try_into().ok()?;

    // Resolve block timestamp
    let block_number = u64::from_str_radix(
        log_entry.block_number.trim_start_matches("0x"),
        16,
    )
    .unwrap_or(0);

    let block_timestamp = match cached_block {
        Some((cached_num, cached_ts)) if *cached_num == block_number => *cached_ts,
        _ => {
            let ts = get_block_timestamp(http, rpc_url, &log_entry.block_number)
                .await
                .unwrap_or_else(|| chrono::Utc::now().timestamp() as u64);
            *cached_block = Some((block_number, ts));
            ts
        }
    };

    // Format amounts (matches format_usdc in alerts.rs)
    let usdc_whole = usdc_raw_u128 / 1_000_000;
    let usdc_frac = usdc_raw_u128 % 1_000_000;
    let usdc_str = format!("{usdc_whole}.{usdc_frac:06}");

    let token_whole = token_raw_u128 / 1_000_000;
    let token_frac = token_raw_u128 % 1_000_000;
    let token_str = format!("{token_whole}.{token_frac:06}");

    let price = if token_raw_u128 > 0 {
        usdc_raw_u128 as f64 / token_raw_u128 as f64
    } else {
        0.0
    };

    // Enrich from market cache
    let asset_id_str = asset_id.to_string();
    let cache_key = markets::cache_key(&asset_id_str);
    let cache = market_cache.read().await;
    let info = cache.get(&cache_key);

    let trade = LiveTrade {
        tx_hash: log_entry.transaction_hash.clone(),
        block_timestamp: block_timestamp.to_string(),
        trader: format!("{:?}", maker),
        side: side.into(),
        asset_id: info
            .map(|i| i.gamma_token_id.clone())
            .unwrap_or_else(|| markets::to_integer_id(&asset_id_str)),
        amount: token_str,
        price: format!("{price:.6}"),
        usdc_amount: usdc_str,
        question: info.map(|i| i.question.clone()).unwrap_or_default(),
        outcome: info.map(|i| i.outcome.clone()).unwrap_or_default(),
        category: info.map(|i| i.category.clone()).unwrap_or_default(),
        block_number,
        cache_key,
    };

    Some((trade, usdc_raw_u128))
}
