use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

const PREFIX_LEN: usize = 15;

#[derive(Clone, Debug)]
pub struct MarketInfo {
    pub question: String,
    pub outcome: String,
    pub category: String,
    pub active: bool,
}

/// Cache keyed by the first 15 significant digits of the token ID.
/// This handles both full-precision decimal IDs and f64-truncated
/// scientific notation IDs from ClickHouse.
pub type MarketCache = Arc<RwLock<HashMap<String, MarketInfo>>>;

pub fn new_cache() -> MarketCache {
    Arc::new(RwLock::new(HashMap::new()))
}

/// Extract the significant digits from a token ID string.
/// "8.715511933644157e75" → "8715511933644157"
/// "51797304566750985981..." → "51797304566750985981..."
fn significant_digits(id: &str) -> String {
    let e_pos = match id.find('e').or_else(|| id.find('E')) {
        Some(pos) => pos,
        None => return id.to_string(),
    };
    let mantissa = &id[..e_pos];
    mantissa.replace('.', "")
}

/// Build a cache key: first 15 significant digits.
fn cache_key(token_id: &str) -> String {
    let sig = significant_digits(token_id);
    if sig.len() >= PREFIX_LEN {
        sig[..PREFIX_LEN].to_string()
    } else {
        sig
    }
}

/// Pre-warm the cache by batch-fetching events from the Gamma API.
/// Uses the events endpoint (not markets) because it includes `tags`
/// for category — the market-level `category` field is empty on modern markets.
pub async fn warm_cache(http: &reqwest::Client, cache: &MarketCache) {
    let mut offset = 0u32;
    let batch = 100u32; // events endpoint returns nested markets, so smaller batches
    let mut total_markets = 0u32;

    loop {
        let url = format!(
            "https://gamma-api.polymarket.com/events?limit={batch}&offset={offset}&order=volume24hr&ascending=false"
        );

        let resp = match http
            .get(&url)
            .timeout(std::time::Duration::from_secs(15))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Market cache warm failed at offset {offset}: {e}");
                break;
            }
        };

        let events: Vec<GammaEvent> = match resp.json().await {
            Ok(e) => e,
            Err(e) => {
                tracing::warn!("Market cache parse failed: {e}");
                break;
            }
        };

        let count = events.len();

        {
            let mut c = cache.write().await;
            for event in &events {
                let category = event.first_tag();
                for market in &event.markets {
                    let ids = market.parsed_token_ids();
                    let outcomes = market.parsed_outcomes();
                    let active = market.is_active();
                    for (i, id) in ids.iter().enumerate() {
                        let outcome = outcomes.get(i).cloned().unwrap_or_default();
                        c.insert(
                            cache_key(id),
                            MarketInfo {
                                question: market.question.clone().unwrap_or_default(),
                                outcome,
                                category: category.clone(),
                                active,
                            },
                        );
                        total_markets += 1;
                    }
                }
            }
        }

        if count < batch as usize {
            break;
        }
        offset += batch;

        if total_markets >= 50000 {
            break;
        }
    }

    tracing::info!("Warmed market cache with {total_markets} token entries");
}

/// Resolve token IDs to market info.
///
/// Lookup strategy:
/// 1. Prefix match against the pre-warmed cache (handles f64 precision loss)
/// 2. For cache misses with full-precision IDs, try individual Gamma API calls
pub async fn resolve_markets(
    http: &reqwest::Client,
    cache: &MarketCache,
    token_ids: &[String],
) -> HashMap<String, MarketInfo> {
    let mut result = HashMap::new();
    let mut uncached: Vec<String> = Vec::new();

    {
        let c = cache.read().await;
        for id in token_ids {
            let key = cache_key(id);
            if let Some(info) = c.get(&key) {
                result.insert(id.clone(), info.clone());
            } else if !id.contains('e') && !id.contains('E') {
                // Only try individual API calls for full-precision decimal IDs
                // (scientific notation IDs would fail anyway — precision is lost)
                uncached.push(id.clone());
            }
        }
    }

    if uncached.is_empty() {
        return result;
    }

    // Resolve uncached full-precision IDs via Gamma API
    let sem = Arc::new(tokio::sync::Semaphore::new(10));
    let mut handles = Vec::new();

    for id in &uncached {
        let http = http.clone();
        let id = id.clone();
        let sem = sem.clone();

        handles.push(tokio::spawn(async move {
            let _permit = sem.acquire().await.ok()?;
            fetch_market_info(&http, &id).await
        }));
    }

    let mut new_entries = Vec::new();
    for (i, handle) in handles.into_iter().enumerate() {
        if let Ok(Some(info)) = handle.await {
            new_entries.push((uncached[i].clone(), info));
        }
    }

    if !new_entries.is_empty() {
        let mut c = cache.write().await;
        for (id, info) in &new_entries {
            c.insert(cache_key(id), info.clone());
            result.insert(id.clone(), info.clone());
        }
    }

    result
}

async fn fetch_market_info(http: &reqwest::Client, token_id: &str) -> Option<MarketInfo> {
    let url = format!(
        "https://gamma-api.polymarket.com/markets?clob_token_ids={}",
        token_id
    );

    let resp = http
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
        .ok()?;

    let markets: Vec<GammaMarket> = resp.json().await.ok()?;
    let market = markets.into_iter().next()?;

    let ids = market.parsed_token_ids();
    let outcomes = market.parsed_outcomes();
    let outcome = ids
        .iter()
        .position(|id| id == token_id)
        .and_then(|idx| outcomes.get(idx).cloned())
        .unwrap_or_default();

    let active = market.is_active();
    Some(MarketInfo {
        question: market.question.unwrap_or_default(),
        outcome,
        category: String::new(),
        active,
    })
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GammaEvent {
    markets: Vec<GammaMarket>,
    #[serde(default)]
    tags: Vec<GammaTag>,
}

impl GammaEvent {
    fn first_tag(&self) -> String {
        self.tags
            .iter()
            .map(|t| t.label.as_str())
            .find(|l| *l != "Parent For Derivative")
            .unwrap_or("")
            .to_string()
    }
}

#[derive(serde::Deserialize)]
struct GammaTag {
    label: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GammaMarket {
    question: Option<String>,
    /// JSON-encoded string array, e.g. "[\"Yes\", \"No\"]"
    outcomes: Option<String>,
    /// JSON-encoded string array of token IDs
    clob_token_ids: Option<String>,
    #[serde(default)]
    active: Option<bool>,
    #[serde(default)]
    closed: Option<bool>,
}

impl GammaMarket {
    fn is_active(&self) -> bool {
        // Market is active if not explicitly closed and not explicitly inactive
        !self.closed.unwrap_or(false) && self.active.unwrap_or(true)
    }

    fn parsed_outcomes(&self) -> Vec<String> {
        self.outcomes
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default()
    }

    fn parsed_token_ids(&self) -> Vec<String> {
        self.clob_token_ids
            .as_deref()
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or_default()
    }
}
