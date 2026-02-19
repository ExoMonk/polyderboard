use axum::{routing::{get, post}, Router};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

use super::{alerts, markets, routes};

#[derive(Clone)]
pub struct AppState {
    pub db: clickhouse::Client,
    pub http: reqwest::Client,
    pub market_cache: markets::MarketCache,
    pub alert_tx: broadcast::Sender<alerts::Alert>,
}

pub async fn run(client: clickhouse::Client, port: u16) {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let (alert_tx, _) = broadcast::channel::<alerts::Alert>(256);

    let state = AppState {
        db: client,
        http: reqwest::Client::new(),
        market_cache: markets::new_cache(),
        alert_tx,
    };

    // Pre-warm the market name cache in the background, then refresh periodically
    {
        let http = state.http.clone();
        let db = state.db.clone();
        let cache = state.market_cache.clone();
        tokio::spawn(async move {
            markets::warm_cache(&http, &db, &cache).await;
            markets::populate_resolved_prices(&db, &cache).await;
            // Re-warm every 10 minutes to catch new markets + resolutions
            let mut interval = tokio::time::interval(std::time::Duration::from_secs(600));
            interval.tick().await; // skip immediate tick
            loop {
                interval.tick().await;
                tracing::info!("Refreshing market cache...");
                markets::warm_cache(&http, &db, &cache).await;
                markets::populate_resolved_prices(&db, &cache).await;
            }
        });
    }

    let app = Router::new()
        .route("/api/leaderboard", get(routes::leaderboard))
        .route("/api/trader/{address}", get(routes::trader_stats))
        .route("/api/trader/{address}/trades", get(routes::trader_trades))
        .route("/api/trader/{address}/positions", get(routes::trader_positions))
        .route("/api/trader/{address}/pnl-chart", get(routes::pnl_chart))
        .route("/api/markets/hot", get(routes::hot_markets))
        .route("/api/trades/recent", get(routes::recent_trades))
        .route("/api/health", get(routes::health))
        .route("/api/market/resolve", get(routes::resolve_market))
        .route("/api/webhooks/rindexer", post(alerts::webhook_handler))
        .route("/api/ws/alerts", get(alerts::ws_handler))
        .layer(cors)
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("Failed to bind");

    tracing::info!("API server listening on port {port}");
    axum::serve(listener, app).await.expect("Server failed");
}
