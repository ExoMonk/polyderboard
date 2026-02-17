use std::env;

mod api;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    tracing_subscriber::fmt::init();

    let clickhouse_url =
        env::var("CLICKHOUSE_URL").unwrap_or_else(|_| "http://localhost:8123".into());
    let port: u16 = env::var("API_PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3001);

    let client = clickhouse::Client::default()
        .with_url(&clickhouse_url)
        .with_database("poly_dearboard");

    api::server::run(client, port).await;
}
