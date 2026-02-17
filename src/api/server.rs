use axum::{routing::get, Router};
use tower_http::cors::{Any, CorsLayer};

use super::routes;

pub async fn run(client: clickhouse::Client, port: u16) {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/leaderboard", get(routes::leaderboard))
        .route("/api/trader/{address}", get(routes::trader_stats))
        .route("/api/trader/{address}/trades", get(routes::trader_trades))
        .route("/api/health", get(routes::health))
        .layer(cors)
        .with_state(client);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{port}"))
        .await
        .expect("Failed to bind");

    tracing::info!("API server listening on port {port}");
    axum::serve(listener, app).await.expect("Server failed");
}
