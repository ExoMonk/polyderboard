# Poly Dearboard

[![rindexer](https://img.shields.io/badge/Powered%20by-rindexer-6C5CE7)](https://github.com/joshstevens19/rindexer)

On-chain Polymarket leaderboard built from ground-truth trade data.
Indexes `OrderFilled`, `ConditionResolution`, and `PayoutRedemption` events directly from the CTF Exchange, NegRisk Exchange, and ConditionalTokens contracts on Polygon — no reliance on Polymarket's API for trade data.

## Features

**Leaderboard** — Rank traders by mark-to-market PnL, volume, or trade count. Scatter chart visualizes efficiency (Return on Volume %) vs performance.

**Trader Detail** — Per-trader stats, open positions valued at live market prices, trade activity chart, and full trade history.

**Hot Markets** — Most active markets by volume (1h / 24h / 7d) with category tags and trader counts.

**Market Live Feed** — Per-market real-time trade feed with live price chart (TradingView Lightweight Charts), Polymarket WSS streaming, and on-chain trade markers.

**Smart Money** — Surfaces markets where top-performing traders have concentrated positions, with long/short exposure breakdown.

**Alerting System** — Real-time on-chain alerting via WebSocket on whale trades (`OrderFilled`), market resolutions (`ConditionResolution`), and failed settlements.

## Stack

| Layer | Technology |
| --- | --- |
| Indexer | [rindexer](https://github.com/joshstevens19/rindexer) (no-code mode) |
| Storage | ClickHouse (columnar OLAP) |
| Normalization | ClickHouse materialized views |
| API | Rust / Axum |
| Frontend | React + TypeScript + Lightweight Charts + Tailwind |
| Chain | Polygon (chain_id: 137) |

## Architecture

```
Polygon (2s blocks)
  ↓ eth_getLogs
rindexer no-code indexer
  ↓ raw events
ClickHouse (OrderFilled, PayoutRedemption, ConditionResolution tables)
  ↓ materialized views
ClickHouse (normalized trades: trader, side, asset, price, amount)
  ↓ CTE queries
Axum REST API ← React frontend
```

## PnL Methodology

Uses **mark-to-market** PnL rather than pure cash-flow:

```
PnL = sum_per_asset(cash_flow + net_tokens × latest_market_price)
```

This values open positions at the current market price, producing meaningful PnL even with a partial indexing window. Closed positions (net_tokens = 0) reduce to pure cash-flow PnL.

**Known limitation**: Market resolution redemptions (`PayoutRedemption` events) are not included in PnL because the event lacks an `asset_id` field, making per-position matching impossible without deriving token IDs from `keccak256(parentCollectionId, conditionId, indexSet)`. Mark-to-market approximates this well since winning tokens trade near $1.00 before resolution.

## Run

| Command | What it does |
| --- | --- |
| `make indexer` | Starts ClickHouse + rindexer |
| `make live` | Starts from current block (no backfill) |
| `FROM=80000000 make backfill` | Backfills from block to first indexed block |
| `make serve` | Starts the Axum API on port 3001 |
| `make query` | Runs E2E leaderboard queries |
| `make clean` | Tears down Docker containers + volumes |
| `make frontend` | Runs Polydearboard frontend |

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/leaderboard` | Paginated trader rankings (sort: PnL, volume, trades) |
| `GET /api/trader/{address}` | Single trader aggregate stats |
| `GET /api/trader/{address}/trades` | Trade history with side filter + pagination |
| `GET /api/trader/{address}/positions` | Open positions with market prices |
| `GET /api/markets/hot` | Hot markets by volume (1h/24h/7d) |
| `GET /api/trades/recent` | Live trade feed, filterable by token ID |
| `GET /api/smart-money` | Markets with concentrated smart trader positions |
| `GET /api/market/resolve` | Resolve market metadata by token ID |
| `GET /api/health` | Health check with trade/trader/block counts |
| `WS /ws/alerts` | Real-time whale trades + market resolutions stream |
| `WS /ws/trades` | Per-market live trade stream (filterable by token ID) |

## Indexed Events

| Contract | Address | Events |
| --- | --- | --- |
| CTF Exchange | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | `OrderFilled` |
| NegRisk CTF Exchange | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | `OrderFilled` |
| ConditionalTokens | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | `PayoutRedemption`, `ConditionResolution` |

`OrderFilled` — Every trade on Polymarket (both standard and NegRisk markets). Feeds the leaderboard, PnL, and live trade stream.

`ConditionResolution` — Market resolution by the oracle. Triggers real-time alerts and resolves market metadata.

`PayoutRedemption` — Token redemption after resolution. Stored in ClickHouse for future PnL refinement.

## Data Lake

| Database | Table | Source |
| --- | --- | --- |
| `poly_dearboard_ctf_exchange` | `order_filled` | CTF Exchange OrderFilled events |
| `poly_dearboard_neg_risk_ctf_exchange` | `order_filled` | NegRisk Exchange OrderFilled events |
| `poly_dearboard_conditional_tokens` | `payout_redemption` | ConditionalTokens PayoutRedemption events |
| `poly_dearboard_conditional_tokens` | `condition_resolution` | ConditionalTokens ConditionResolution events |
| `poly_dearboard` | `trades` | Normalized trades (via materialized views) |
