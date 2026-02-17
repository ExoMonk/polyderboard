-- Poly-Dearboard ClickHouse Schema
-- Pre-creates rindexer raw event tables + normalized trades table + materialized views.
-- rindexer's CREATE TABLE IF NOT EXISTS will safely skip tables that already exist.
--
-- NOTE: ClickHouse does NOT support UNION ALL in materialized views.
-- Each MV has a single SELECT; multiple MVs write to the same target table.

-- =============================================================================
-- 1. rindexer raw event databases and tables
-- =============================================================================

-- CTF Exchange
CREATE DATABASE IF NOT EXISTS poly_dearboard_ctf_exchange;

CREATE TABLE IF NOT EXISTS poly_dearboard_ctf_exchange.order_filled (
    contract_address  FixedString(42),
    order_hash        String,
    maker             FixedString(42),
    taker             FixedString(42),
    maker_asset_id    String,
    taker_asset_id    String,
    maker_amount_filled String,
    taker_amount_filled String,
    fee               String,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    block_hash        FixedString(66),
    network           String,
    tx_index          UInt64,
    log_index         UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index);

-- NegRisk CTF Exchange
CREATE DATABASE IF NOT EXISTS poly_dearboard_neg_risk_ctf_exchange;

CREATE TABLE IF NOT EXISTS poly_dearboard_neg_risk_ctf_exchange.order_filled (
    contract_address  FixedString(42),
    order_hash        String,
    maker             FixedString(42),
    taker             FixedString(42),
    maker_asset_id    String,
    taker_asset_id    String,
    maker_amount_filled String,
    taker_amount_filled String,
    fee               String,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    block_hash        FixedString(66),
    network           String,
    tx_index          UInt64,
    log_index         UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index);

-- Conditional Tokens
CREATE DATABASE IF NOT EXISTS poly_dearboard_conditional_tokens;

CREATE TABLE IF NOT EXISTS poly_dearboard_conditional_tokens.payout_redemption (
    contract_address  FixedString(42),
    redeemer          FixedString(42),
    collateral_token  FixedString(42),
    parent_collection_id String,
    condition_id      String,
    index_sets        Array(String),
    payout            String,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    block_hash        FixedString(66),
    network           String,
    tx_index          UInt64,
    log_index         UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index);

-- =============================================================================
-- 2. Normalized trades target table
-- =============================================================================

CREATE DATABASE IF NOT EXISTS poly_dearboard;

CREATE TABLE IF NOT EXISTS poly_dearboard.trades (
    exchange          String,
    trader            FixedString(42),
    side              String,
    asset_id          String,
    amount            Decimal128(6),
    price             Decimal128(10),
    usdc_amount       Decimal128(6),
    fee               Decimal128(6),
    order_hash        String,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    log_index         UInt64,
    network           String
) ENGINE = ReplacingMergeTree
ORDER BY (trader, block_number, tx_hash, log_index, side);

-- =============================================================================
-- 3. Materialized views: OrderFilled → normalized trades
--    Each case is a separate MV (ClickHouse doesn't allow UNION ALL in MVs).
--    All MVs write to the same poly_dearboard.trades target table.
-- =============================================================================

-- ── CTF Exchange ─────────────────────────────────────────────────────────────

-- Case 1a: maker_asset_id == '0' → maker buys (provides USDC)
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_maker_buy
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    maker AS trader,
    'buy' AS side,
    taker_asset_id AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE maker_asset_id = '0';

-- Case 1b: maker_asset_id == '0' → taker sells (receives USDC)
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_taker_sell
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    taker AS trader,
    'sell' AS side,
    taker_asset_id AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128(fee, 6) / 1000000 AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE maker_asset_id = '0';

-- Case 2a: taker_asset_id == '0' → maker sells
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_maker_sell
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    maker AS trader,
    'sell' AS side,
    maker_asset_id AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE taker_asset_id = '0';

-- Case 2b: taker_asset_id == '0' → taker buys (provides USDC)
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_taker_buy
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    taker AS trader,
    'buy' AS side,
    maker_asset_id AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128(fee, 6) / 1000000 AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE taker_asset_id = '0';

-- ── NegRisk Exchange ─────────────────────────────────────────────────────────

-- Case 1a: maker_asset_id == '0' → maker buys
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_maker_buy
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    maker AS trader,
    'buy' AS side,
    taker_asset_id AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE maker_asset_id = '0';

-- Case 1b: maker_asset_id == '0' → taker sells
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_taker_sell
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    taker AS trader,
    'sell' AS side,
    taker_asset_id AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128(fee, 6) / 1000000 AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE maker_asset_id = '0';

-- Case 2a: taker_asset_id == '0' → maker sells
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_maker_sell
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    maker AS trader,
    'sell' AS side,
    maker_asset_id AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE taker_asset_id = '0';

-- Case 2b: taker_asset_id == '0' → taker buys
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_taker_buy
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    taker AS trader,
    'buy' AS side,
    maker_asset_id AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128(fee, 6) / 1000000 AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE taker_asset_id = '0';
