#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $ROOT/deployments/polyderboard-dev/docker-compose.yml"
YAML="$ROOT/indexer/polywatcher.yaml"
BACKFILL_YAML="$ROOT/indexer/polywatcher_backfill.yaml"
CONTAINER="poly-backfill"

FROM="${FROM:?Usage: FROM=<block_number> make backfill}"
TO="${TO:-}"

CH() { $COMPOSE exec -T clickhouse clickhouse-client --query "$1" 2>/dev/null; }

# ── Ensure ClickHouse + eRPC are running ────────────────────────────────────
echo "Starting ClickHouse + eRPC..."
$COMPOSE up -d clickhouse erpc

echo -n "Waiting for ClickHouse"
until CH "SELECT 1" >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo " ready"

echo -n "Waiting for eRPC"
until curl -s http://localhost:4000 >/dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo " ready"

# ── Determine end_block from existing data ──────────────────────────────────
if [ -z "$TO" ]; then
    TO=$(CH "SELECT min(block_number) FROM poly_dearboard.trades WHERE block_number > 0" | tr -d '[:space:]')
fi

if [ -z "$TO" ] || [ "$TO" = "0" ]; then
    echo "Error: No existing data in ClickHouse. Run 'make indexer' first."
    exit 1
fi

if [ "$FROM" -ge "$TO" ]; then
    echo "Error: FROM block ($FROM) must be before end block ($TO)"
    exit 1
fi

echo ""
echo "Backfill range: block $FROM → $TO"
echo ""

# ── Generate backfill YAML ──────────────────────────────────────────────────
# Use a different project name so rindexer creates separate internal sync
# state tables — otherwise it reads the live instance's progress and skips.
# After indexing, we copy raw events into the main tables (where MVs fire).
cp "$YAML" "$BACKFILL_YAML"
sed -i.bak "s/^name: .*/name: PolyDearboardBackfill/" "$BACKFILL_YAML"
sed -i.bak "s/start_block: \"[0-9]*\"/start_block: \"$FROM\"/" "$BACKFILL_YAML"
sed -i.bak "/start_block:/a\\
        end_block: \"$TO\"" "$BACKFILL_YAML"
rm -f "${BACKFILL_YAML}.bak"

trap 'rm -f "$BACKFILL_YAML"' EXIT

# ── Get compose network name ────────────────────────────────────────────────
NETWORK=$($COMPOSE network ls --format '{{.Name}}' 2>/dev/null | grep -m1 '_default' || echo "polyderboard-dev_default")

# ── Stop any existing backfill container ────────────────────────────────────
docker stop "$CONTAINER" 2>/dev/null || true
docker rm "$CONTAINER" 2>/dev/null || true

# ── Run backfill rindexer ───────────────────────────────────────────────────
echo "Starting backfill indexer..."
docker run \
    --name "$CONTAINER" \
    --network "$NETWORK" \
    --platform linux/amd64 \
    -e CLICKHOUSE_URL=http://clickhouse:8123 \
    -e CLICKHOUSE_USER=default \
    -e CLICKHOUSE_PASSWORD="" \
    -e CLICKHOUSE_DB=poly_dearboard \
    -v "$BACKFILL_YAML:/app/rindexer.yaml:ro" \
    -v "$ROOT/indexer/abi:/app/abi:ro" \
    ghcr.io/joshstevens19/rindexer:latest \
    start --path /app all

# ── Copy raw events from backfill tables → main tables (triggers MVs) ──────
echo ""
echo "Copying backfill data to main tables..."

CH "INSERT INTO poly_dearboard_ctf_exchange.order_filled
    SELECT * FROM poly_dearboard_backfill_ctf_exchange.order_filled"
echo "  CTF Exchange: done"

CH "INSERT INTO poly_dearboard_neg_risk_ctf_exchange.order_filled
    SELECT * FROM poly_dearboard_backfill_neg_risk_ctf_exchange.order_filled"
echo "  NegRisk Exchange: done"

CH "INSERT INTO poly_dearboard_conditional_tokens.payout_redemption
    SELECT * FROM poly_dearboard_backfill_conditional_tokens.payout_redemption"
echo "  ConditionalTokens: done"

# ── Cleanup backfill databases ──────────────────────────────────────────────
echo "Cleaning up backfill tables..."
CH "DROP DATABASE IF EXISTS poly_dearboard_backfill_ctf_exchange"
CH "DROP DATABASE IF EXISTS poly_dearboard_backfill_neg_risk_ctf_exchange"
CH "DROP DATABASE IF EXISTS poly_dearboard_backfill_conditional_tokens"
CH "DROP DATABASE IF EXISTS poly_dearboard_backfill"

echo ""
echo "Backfill complete! Range $FROM → $TO filled."
