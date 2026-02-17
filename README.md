# poly-dearboard

Polymarket's official leaderboard API data isn't 100% reliable. We're building our own leaderboard by indexing on-chain trade events directly from the CTF Exchange and NegRisk Exchange contracts on Polygon, giving us ground-truth data for trader PnL, volume, and rankings.

## Stack

- **Indexer**: custom rindexer
- **Storage**: ClickHouse (columnar OLAP)
- **Normalization**: ClickHouse materialized views (trade splitting, buy/sell logic)
- **API**: Thin axum REST server querying ClickHouse directly
- **Chain**: Polygon (chain_id: 137)
- **Real-time**: ~2-4s block-to-query latency via rindexer polling

```text
Polygon Chain (2s blocks)
    ↓ eth_getLogs (rindexer polls every ~500ms)
rindexer no-code indexer
    ↓ auto-insert raw events
ClickHouse (raw event tables)
    ↓ materialized views
ClickHouse (normalized trades, leaderboard aggregates)
    ↓ SQL queries
Axum REST API → Frontend
```




**How Close to Real-Time?**
-----------------------

**~2-4 seconds end-to-end** with optimal config on Polygon:

| Stage | Latency | Notes |
| --- | --- | --- |
| Polygon block time | 2s | Fixed --- block produced |
| RPC propagation | 0-500ms | Depends on RPC quality |
| rindexer polling | 50ms | `block_poll_frequency: "rapid"` |
| eth_getLogs RPC call | 100-300ms | Single block, few events |
| Event processing + ClickHouse insert | 15-35ms | Batch of ≤1000 rows |
| Queryable | ~instant | ClickHouse, no WAL delay |
| **Total** | **~2.2-3s** | From block to queryable data |

**Polling modes available:**

-   `"rapid"` --- 50ms (aggressive, for paid RPCs)
-   `"/3"` --- 1/3 of block time (~666ms for Polygon)
-   `"optimized"` --- RPC-friendly (1/3, min 500ms)
-   `"1000"` --- fixed ms interval

With a public RPC at 30 CU/s, `"/3"` (~666ms) is safer. With a paid RPC, `"rapid"` gets you sub-second after block.

Multi-Output Streams
--------------------

Custom indexer can simultaneously output to **webhooks, Kafka, RabbitMQ, Redis Streams, SNS, Cloudflare Queues** --- all configurable in YAML alongside ClickHouse storage. This means we can push events to a WebSocket server for real-time frontend updates too.

## Future Iterations (not in MVP scope)

- Full historical backfill from contract deployment
- Market metadata enrichment (question text, outcome names via Polymarket API)
- Unrealized PnL (requires live CLOB prices)
- Win/loss rate tracking
- Frontend dashboard
- Real-time streaming via rindexer streams (webhooks/Kafka/Redis)

-----

## DataLake

- Schema names (database.schema):

```
poly_dearboard_ctf_exchange
poly_dearboard_neg_risk_ctf_exchange
poly_dearboard_conditional_tokens
```

- Table names:

```
poly_dearboard_ctf_exchange.order_filled
poly_dearboard_neg_risk_ctf_exchange.order_filled
poly_dearboard_conditional_tokens.payout_redemption
```

- **Schema**: `{snake_case(indexer_name)}_{snake_case(contract_name)}` → e.g. `poly_dearboard_ctf_exchange`
- **Table**: `{schema}.{snake_case(event_name)}` → e.g. `poly_dearboard_ctf_exchange.order_filled`
- **Engine**: `ReplacingMergeTree`, ORDER BY `(network, block_number, tx_hash, log_index)`
- **Type mapping**: `address → FixedString(42)`, `uint256 → String`, `bytes32 → String`
