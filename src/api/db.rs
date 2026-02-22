use rusqlite::Connection;
use std::path::Path;

/// Opens (or creates) the SQLite user database and runs migrations.
/// Panics on failure — intended to be called once at startup.
pub fn init_user_db(path: &str) -> Connection {
    if let Some(parent) = Path::new(path).parent() {
        std::fs::create_dir_all(parent).expect("failed to create data directory");
    }
    let conn = Connection::open(path).expect("failed to open SQLite user DB");
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            address     TEXT PRIMARY KEY,
            nonce       TEXT NOT NULL,
            issued_at   TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            last_login  TEXT NOT NULL
        )",
    )
    .expect("failed to create users table");
    tracing::info!("SQLite user DB initialized at {path}");
    conn
}

/// Returns `(nonce, issued_at)` for the given address, creating the user if needed.
pub fn get_or_create_user(
    conn: &Connection,
    address: &str,
) -> Result<(String, String), rusqlite::Error> {
    let addr = address.to_lowercase();
    let nonce = generate_nonce();
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO users (address, nonce, issued_at, created_at, last_login)
         VALUES (?1, ?2, ?3, ?3, ?3)
         ON CONFLICT(address) DO UPDATE SET nonce = ?2, issued_at = ?3, last_login = ?3",
        rusqlite::params![addr, nonce, now],
    )?;

    Ok((nonce, now))
}

/// Verifies the nonce and issued_at match the stored values, then rotates the nonce.
pub fn verify_and_rotate_nonce(
    conn: &Connection,
    address: &str,
    nonce: &str,
    issued_at: &str,
) -> Result<bool, rusqlite::Error> {
    let addr = address.to_lowercase();

    let stored: Option<(String, String)> = conn
        .query_row(
            "SELECT nonce, issued_at FROM users WHERE address = ?1",
            rusqlite::params![addr],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();

    match stored {
        Some((stored_nonce, stored_issued_at))
            if stored_nonce == nonce && stored_issued_at == issued_at =>
        {
            let new_nonce = generate_nonce();
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE users SET nonce = ?1, last_login = ?2 WHERE address = ?3",
                rusqlite::params![new_nonce, now, addr],
            )?;
            Ok(true)
        }
        _ => Ok(false),
    }
}

fn generate_nonce() -> String {
    use rand::Rng;
    let bytes: [u8; 32] = rand::rng().random();
    hex::encode(bytes)
}
