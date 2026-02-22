-- Poly-Dearboard ClickHouse Schema
-- Pre-creates rindexer raw event tables + normalized trades table + materialized views.
-- rindexer's CREATE TABLE IF NOT EXISTS will safely skip tables that already exist.
--
-- IMPORTANT: uint256 fields MUST use UInt256 (not String) to match rindexer's
-- generated schema. Unquoted large integer literals inserted into String columns
-- go through Float64, losing precision (e.g. 76-digit token IDs → scientific notation).
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
    maker_asset_id    UInt256,
    taker_asset_id    UInt256,
    maker_amount_filled UInt256,
    taker_amount_filled UInt256,
    fee               UInt256,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    block_hash        FixedString(66),
    network           String,
    tx_index          UInt64,
    log_index         UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE minmax GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index)
TTL ifNull(block_timestamp, toDateTime('1970-01-01')) + INTERVAL 1 DAY;

-- NegRisk CTF Exchange
CREATE DATABASE IF NOT EXISTS poly_dearboard_neg_risk_ctf_exchange;

CREATE TABLE IF NOT EXISTS poly_dearboard_neg_risk_ctf_exchange.order_filled (
    contract_address  FixedString(42),
    order_hash        String,
    maker             FixedString(42),
    taker             FixedString(42),
    maker_asset_id    UInt256,
    taker_asset_id    UInt256,
    maker_amount_filled UInt256,
    taker_amount_filled UInt256,
    fee               UInt256,
    tx_hash           FixedString(66),
    block_number      UInt64,
    block_timestamp   Nullable(DateTime('UTC')),
    block_hash        FixedString(66),
    network           String,
    tx_index          UInt64,
    log_index         UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE minmax GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index)
TTL ifNull(block_timestamp, toDateTime('1970-01-01')) + INTERVAL 1 DAY;

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
    INDEX idx_timestamp (block_timestamp) TYPE minmax GRANULARITY 1,
    INDEX idx_network (network) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index);

CREATE TABLE IF NOT EXISTS poly_dearboard_conditional_tokens.condition_resolution (
    contract_address    FixedString(42),
    condition_id        String,
    oracle              FixedString(42),
    question_id         String,
    outcome_slot_count  String,
    payout_numerators   Array(String),
    tx_hash             FixedString(66),
    block_number        UInt64,
    block_timestamp     Nullable(DateTime('UTC')),
    block_hash          FixedString(66),
    network             String,
    tx_index            UInt64,
    log_index           UInt64,

    INDEX idx_block_num (block_number) TYPE minmax GRANULARITY 1,
    INDEX idx_timestamp (block_timestamp) TYPE minmax GRANULARITY 1,
    INDEX idx_condition_id (condition_id) TYPE bloom_filter GRANULARITY 1,
    INDEX idx_tx_hash (tx_hash) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (network, block_number, tx_hash, log_index);

-- =============================================================================
-- 2. Normalized trades target table
-- =============================================================================

CREATE DATABASE IF NOT EXISTS poly_dearboard;

CREATE TABLE IF NOT EXISTS poly_dearboard.trades (
    exchange          LowCardinality(String),
    trader            FixedString(42),
    side              LowCardinality(String),
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
    network           LowCardinality(String),

    INDEX idx_block_ts (block_timestamp) TYPE minmax GRANULARITY 1,
    INDEX idx_asset_id (asset_id) TYPE bloom_filter GRANULARITY 1
) ENGINE = ReplacingMergeTree
ORDER BY (trader, block_number, tx_hash, log_index, side);

-- =============================================================================
-- 3. Materialized views: OrderFilled → normalized trades
--
--    CTF/NegRisk exchanges emit N+1 OrderFilled per match:
--      - N "maker fills": (maker=real_maker, taker=real_taker, ...)
--      - 1 "taker summary": (maker=real_taker, taker=exchange_contract, ...)
--
--    We ONLY record the `maker` field as the trader, because:
--      - In maker fills, `maker` = the real maker
--      - In taker summary, `maker` = takerOrder.maker = the real taker
--      - The exchange contract only appears in the `taker` field, never `maker`
--
--    This avoids double-counting, incorrect side attribution in MINT scenarios,
--    and volume inflation. See: Paradigm "Polymarket Volume Is Being Double-Counted"
--
--    Fee note: per-fill fees are charged to the taker but recorded in maker fill
--    events. The taker summary has fee=0. We set fee=0 for all rows to avoid
--    misattribution; fee tracking can be added separately later.
-- =============================================================================

-- ── CTF Exchange ─────────────────────────────────────────────────────────────

-- maker_asset_id == 0 → maker provides USDC → BUY
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_buy
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    maker AS trader,
    'buy' AS side,
    toString(taker_asset_id) AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE maker_asset_id = 0;

-- taker_asset_id == 0 → maker provides tokens → SELL
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_ctf_sell
TO poly_dearboard.trades
AS SELECT
    'ctf' AS exchange,
    maker AS trader,
    'sell' AS side,
    toString(maker_asset_id) AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_ctf_exchange.order_filled
WHERE taker_asset_id = 0;

-- ── NegRisk Exchange ─────────────────────────────────────────────────────────

-- maker_asset_id == 0 → maker provides USDC → BUY
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_buy
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    maker AS trader,
    'buy' AS side,
    toString(taker_asset_id) AS asset_id,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(maker_amount_filled, 6) / toDecimal128(taker_amount_filled, 6), 10) AS price,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE maker_asset_id = 0;

-- taker_asset_id == 0 → maker provides tokens → SELL
CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_neg_risk_sell
TO poly_dearboard.trades
AS SELECT
    'neg_risk' AS exchange,
    maker AS trader,
    'sell' AS side,
    toString(maker_asset_id) AS asset_id,
    toDecimal128(maker_amount_filled, 6) / 1000000 AS amount,
    round(toDecimal128(taker_amount_filled, 6) / toDecimal128(maker_amount_filled, 6), 10) AS price,
    toDecimal128(taker_amount_filled, 6) / 1000000 AS usdc_amount,
    toDecimal128('0', 6) AS fee,
    order_hash, tx_hash, block_number, block_timestamp, log_index, network
FROM poly_dearboard_neg_risk_ctf_exchange.order_filled
WHERE taker_asset_id = 0;

-- =============================================================================
-- 4. Resolved prices: on-chain ConditionResolution → exact price per asset
-- =============================================================================

CREATE TABLE IF NOT EXISTS poly_dearboard.resolved_prices (
    asset_id       String,
    resolved_price String,
    condition_id   String,
    block_number   UInt64
) ENGINE = ReplacingMergeTree
ORDER BY (asset_id);

-- =============================================================================
-- 4b. Market metadata: persisted Gamma API data for query-time enrichment
--
--     Populated by the API server at startup (from warm_cache) and incrementally
--     on each webhook ingestion for new tokens.
--     ReplacingMergeTree deduplicates by asset_id; `updated_at` is the version.
-- =============================================================================

CREATE TABLE IF NOT EXISTS poly_dearboard.market_metadata (
    asset_id        String,
    question        String,
    outcome         String,
    category        LowCardinality(String),
    condition_id    String          DEFAULT '',
    gamma_token_id  String          DEFAULT '',
    outcome_index   UInt8           DEFAULT 0,
    active          UInt8           DEFAULT 1,
    all_token_ids   Array(String)   DEFAULT [],
    outcomes        Array(String)   DEFAULT [],
    updated_at      DateTime('UTC') DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (asset_id);

-- =============================================================================
-- 5. Pre-aggregated tables + materialized views
--
--    These tables are fed by MVs from the trades table and persist permanently.
--    They enable a 3-day TTL on raw trades while preserving all historical
--    aggregates (PnL, positions, stats).
-- =============================================================================

-- ── Latest price per asset (replaces the `latest_prices` CTE) ───────────────

CREATE TABLE IF NOT EXISTS poly_dearboard.asset_latest_price (
    asset_id     String,
    latest_price Decimal128(10),
    version      UInt64           -- block_number * 1000000 + log_index
) ENGINE = ReplacingMergeTree(version)
ORDER BY (asset_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_asset_latest_price
TO poly_dearboard.asset_latest_price AS
SELECT
    asset_id,
    price AS latest_price,
    block_number * 1000000 + log_index AS version
FROM poly_dearboard.trades;

-- ── Per-trader per-asset positions (replaces the `positions` CTE) ───────────

CREATE TABLE IF NOT EXISTS poly_dearboard.trader_positions (
    trader       FixedString(42),
    asset_id     String,
    buy_amount   SimpleAggregateFunction(sum, Decimal128(6)),
    sell_amount  SimpleAggregateFunction(sum, Decimal128(6)),
    buy_usdc     SimpleAggregateFunction(sum, Decimal128(6)),
    sell_usdc    SimpleAggregateFunction(sum, Decimal128(6)),
    total_volume SimpleAggregateFunction(sum, Decimal128(6)),
    total_fee    SimpleAggregateFunction(sum, Decimal128(6)),
    trade_count  SimpleAggregateFunction(sum, UInt64),
    first_ts     SimpleAggregateFunction(min, Nullable(DateTime('UTC'))),
    last_ts      SimpleAggregateFunction(max, Nullable(DateTime('UTC')))
) ENGINE = AggregatingMergeTree
ORDER BY (trader, asset_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_trader_positions
TO poly_dearboard.trader_positions AS
SELECT
    trader,
    asset_id,
    sumIf(amount, side = 'buy') AS buy_amount,
    sumIf(amount, side = 'sell') AS sell_amount,
    sumIf(usdc_amount, side = 'buy') AS buy_usdc,
    sumIf(usdc_amount, side = 'sell') AS sell_usdc,
    sum(usdc_amount) AS total_volume,
    sum(fee) AS total_fee,
    toUInt64(count()) AS trade_count,
    min(if(block_timestamp = toDateTime('1970-01-01 00:00:00'), NULL, block_timestamp)) AS first_ts,
    max(if(block_timestamp = toDateTime('1970-01-01 00:00:00'), NULL, block_timestamp)) AS last_ts
FROM poly_dearboard.trades
GROUP BY trader, asset_id;

-- ── Global stats (for health endpoint) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS poly_dearboard.global_stats (
    key             UInt8 DEFAULT 1,
    trade_count     SimpleAggregateFunction(sum, UInt64),
    unique_traders  AggregateFunction(uniqExact, FixedString(42)),
    latest_block    SimpleAggregateFunction(max, UInt64)
) ENGINE = AggregatingMergeTree
ORDER BY (key);

CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_global_stats
TO poly_dearboard.global_stats AS
SELECT
    toUInt8(1) AS key,
    toUInt64(count()) AS trade_count,
    uniqExactState(trader) AS unique_traders,
    max(block_number) AS latest_block
FROM poly_dearboard.trades
WHERE trader NOT IN (
    '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    '0xC5d563A36AE78145C45a50134d48A1215220f80a',
    '0x02A86f51aA7B8b1c17c30364748d5Ae4a0727E23'
)
GROUP BY key;

-- ── Daily PnL snapshots (for pnl_chart beyond 3-day window) ─────────────────

CREATE TABLE IF NOT EXISTS poly_dearboard.pnl_daily (
    trader           FixedString(42),
    day              Date,
    asset_id         String,
    buy_amount       SimpleAggregateFunction(sum, Float64),
    sell_amount      SimpleAggregateFunction(sum, Float64),
    buy_usdc         SimpleAggregateFunction(sum, Float64),
    sell_usdc        SimpleAggregateFunction(sum, Float64),
    last_price_state AggregateFunction(argMax, Float64, UInt64)
) ENGINE = AggregatingMergeTree
ORDER BY (trader, day, asset_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_pnl_daily
TO poly_dearboard.pnl_daily AS
SELECT
    trader,
    toDate(block_timestamp) AS day,
    asset_id,
    sumIf(toFloat64(amount), side = 'buy') AS buy_amount,
    sumIf(toFloat64(amount), side = 'sell') AS sell_amount,
    sumIf(toFloat64(usdc_amount), side = 'buy') AS buy_usdc,
    sumIf(toFloat64(usdc_amount), side = 'sell') AS sell_usdc,
    argMaxState(toFloat64(price), block_number * 1000000 + log_index) AS last_price_state
FROM poly_dearboard.trades
WHERE block_timestamp > toDateTime('1970-01-01 00:00:00')
GROUP BY trader, day, asset_id;

-- ── Daily asset stats (for hot_markets beyond 3-day window) ─────────────────

CREATE TABLE IF NOT EXISTS poly_dearboard.asset_stats_daily (
    day              Date,
    asset_id         String,
    volume           SimpleAggregateFunction(sum, Decimal128(6)),
    trade_count      SimpleAggregateFunction(sum, UInt64),
    unique_traders   AggregateFunction(uniqExact, FixedString(42)),
    last_price_state AggregateFunction(argMax, Decimal128(10), UInt64),
    last_trade       SimpleAggregateFunction(max, Nullable(DateTime('UTC')))
) ENGINE = AggregatingMergeTree
ORDER BY (day, asset_id);

CREATE MATERIALIZED VIEW IF NOT EXISTS poly_dearboard.mv_asset_stats_daily
TO poly_dearboard.asset_stats_daily AS
SELECT
    toDate(block_timestamp) AS day,
    asset_id,
    sum(usdc_amount) AS volume,
    toUInt64(count()) AS trade_count,
    uniqExactState(trader) AS unique_traders,
    argMaxState(price, block_number * 1000000 + log_index) AS last_price_state,
    max(block_timestamp) AS last_trade
FROM poly_dearboard.trades
WHERE trader NOT IN (
    '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
    '0xC5d563A36AE78145C45a50134d48A1215220f80a',
    '0x02A86f51aA7B8b1c17c30364748d5Ae4a0727E23'
)
AND block_timestamp > toDateTime('1970-01-01 00:00:00')
GROUP BY day, asset_id;
