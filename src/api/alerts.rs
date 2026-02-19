use std::env;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use super::{markets, server::AppState};

// ---------------------------------------------------------------------------
// Alert types
// ---------------------------------------------------------------------------

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "kind")]
pub enum Alert {
    WhaleTrade {
        timestamp: String,
        exchange: String,
        side: String,
        trader: String,
        asset_id: String,
        usdc_amount: String,
        token_amount: String,
        tx_hash: String,
        block_number: u64,
        question: Option<String>,
        outcome: Option<String>,
    },
    MarketResolution {
        timestamp: String,
        condition_id: String,
        oracle: String,
        question_id: String,
        payout_numerators: Vec<String>,
        tx_hash: String,
        block_number: u64,
        question: Option<String>,
    },
}

// ---------------------------------------------------------------------------
// rindexer webhook payload
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub(crate) struct WebhookPayload {
    event_name: String,
    event_data: Vec<serde_json::Value>,
    #[allow(dead_code)]
    network: String,
}

#[derive(Deserialize)]
struct TxInfo {
    #[serde(default)]
    transaction_hash: String,
    #[serde(default)]
    block_number: u64,
    #[serde(default)]
    block_timestamp: String,
}

// ---------------------------------------------------------------------------
// POST /api/webhooks/rindexer
// ---------------------------------------------------------------------------

pub async fn webhook_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<WebhookPayload>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Validate shared secret
    let expected = env::var("RINDEXER_WEBHOOK_SECRET").unwrap_or_default();
    if !expected.is_empty() {
        let provided = headers
            .get("x-rindexer-shared-secret")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if provided != expected {
            return Err((StatusCode::UNAUTHORIZED, "Invalid shared secret".into()));
        }
    }

    let cache = state.market_cache.read().await;

    for event in &payload.event_data {
        let alert = match payload.event_name.as_str() {
            "OrderFilled" => parse_order_filled(event, &cache),
            "ConditionResolution" => parse_condition_resolution(event, &cache),
            _ => None,
        };

        if let Some(alert) = alert {
            // Ignore send errors — just means no WebSocket subscribers
            let _ = state.alert_tx.send(alert);
        }
    }

    Ok(StatusCode::OK)
}

fn parse_order_filled(
    event: &serde_json::Value,
    cache: &std::collections::HashMap<String, markets::MarketInfo>,
) -> Option<Alert> {
    let tx_info: TxInfo = serde_json::from_value(
        event.get("transaction_information")?.clone(),
    )
    .ok()?;

    let maker_asset_id = event.get("makerAssetId")?.as_str()?;
    let taker_asset_id = event.get("takerAssetId")?.as_str()?;
    let maker_amount = event.get("makerAmountFilled")?.as_str()?;
    let taker_amount = event.get("takerAmountFilled")?.as_str()?;
    let maker = event.get("maker")?.as_str()?;

    // Determine side + amounts
    let (side, asset_id, usdc_raw, token_raw) = if maker_asset_id == "0" {
        // Maker provided USDC → BUY
        ("buy", taker_asset_id, maker_amount, taker_amount)
    } else if taker_asset_id == "0" {
        // Maker provided tokens → SELL
        ("sell", maker_asset_id, taker_amount, maker_amount)
    } else {
        return None; // MINT — not a whale trade alert
    };

    // Whale threshold: $50k USDC = 50_000_000_000 raw (6 decimals)
    let usdc_raw_n: u128 = usdc_raw.parse().unwrap_or(0);
    if usdc_raw_n < 50_000_000_000 {
        return None;
    }

    // Convert raw amounts (6 decimals for USDC)
    let usdc_amount = format_usdc(usdc_raw);
    let token_amount = format_usdc(token_raw);

    // Determine exchange from contract address
    let contract = event
        .get("contract_address")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let exchange = if contract.eq_ignore_ascii_case("0xC5d563A36AE78145C45a50134d48A1215220f80a") {
        "neg_risk"
    } else {
        "ctf"
    };

    // Enrich from market cache
    let key = markets::cache_key(asset_id);
    let info = cache.get(&key);

    Some(Alert::WhaleTrade {
        timestamp: tx_info.block_timestamp,
        exchange: exchange.into(),
        side: side.into(),
        trader: maker.into(),
        asset_id: asset_id.into(),
        usdc_amount,
        token_amount,
        tx_hash: tx_info.transaction_hash,
        block_number: tx_info.block_number,
        question: info.map(|i| i.question.clone()),
        outcome: info.map(|i| i.outcome.clone()),
    })
}

fn parse_condition_resolution(
    event: &serde_json::Value,
    cache: &std::collections::HashMap<String, markets::MarketInfo>,
) -> Option<Alert> {
    let tx_info: TxInfo = serde_json::from_value(
        event.get("transaction_information")?.clone(),
    )
    .ok()?;

    let condition_id = event.get("conditionId")?.as_str()?;
    let oracle = event.get("oracle")?.as_str().unwrap_or("");
    let question_id = event.get("questionId")?.as_str().unwrap_or("");
    let numerators: Vec<String> = event
        .get("payoutNumerators")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();

    // Find question from cache by matching condition_id
    let question = cache
        .values()
        .find(|info| info.condition_id.as_deref() == Some(condition_id))
        .map(|info| info.question.clone());

    Some(Alert::MarketResolution {
        timestamp: tx_info.block_timestamp,
        condition_id: condition_id.into(),
        oracle: oracle.into(),
        question_id: question_id.into(),
        payout_numerators: numerators,
        tx_hash: tx_info.transaction_hash,
        block_number: tx_info.block_number,
        question,
    })
}

fn format_usdc(raw: &str) -> String {
    let n: u128 = raw.parse().unwrap_or(0);
    let whole = n / 1_000_000;
    let frac = n % 1_000_000;
    format!("{whole}.{frac:06}")
}

// ---------------------------------------------------------------------------
// GET /api/ws/alerts — WebSocket upgrade
// ---------------------------------------------------------------------------

pub async fn ws_handler(
    State(state): State<AppState>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state.alert_tx.subscribe()))
}

async fn handle_ws(mut socket: WebSocket, mut rx: broadcast::Receiver<Alert>) {
    loop {
        tokio::select! {
            result = rx.recv() => {
                match result {
                    Ok(alert) => {
                        let json = match serde_json::to_string(&alert) {
                            Ok(j) => j,
                            Err(_) => continue,
                        };
                        if socket.send(Message::Text(json.into())).await.is_err() {
                            break; // Client disconnected
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        tracing::warn!("WebSocket client lagged, skipped {n} alerts");
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
            // Handle incoming messages (ping/pong/close)
            msg = socket.recv() => {
                match msg {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Err(_)) => break,
                    _ => {} // Ignore text/binary from client
                }
            }
        }
    }
}
