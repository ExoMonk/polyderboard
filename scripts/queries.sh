#!/usr/bin/env bash
set -euo pipefail

API="http://localhost:3001"

# Colors
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RESET="\033[0m"

header() {
    echo ""
    echo -e "${BOLD}${CYAN}── $1 ──${RESET}"
    echo ""
}

query() {
    local url="$1"
    echo -e "${YELLOW}GET ${url}${RESET}"
    local response
    response=$(curl -s -w "\n%{http_code}" "$url")
    local http_code
    http_code=$(echo "$response" | tail -1)
    local body
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo -e "${GREEN}${http_code}${RESET}"
        echo "$body" | jq .
    else
        echo -e "\033[31m${http_code}\033[0m"
        echo "$body" | jq . 2>/dev/null || echo "$body"
    fi
}

# ── Health ───────────────────────────────────────────────────────────────────
header "Health Check"
query "$API/api/health"

# ── Leaderboard: Top 10 by PnL ──────────────────────────────────────────────
header "Top 10 Traders by Realized PnL"
query "$API/api/leaderboard?sort=realized_pnl&order=desc&limit=10"

# ── Leaderboard: Top 10 by Volume ───────────────────────────────────────────
header "Top 10 Traders by Volume"
query "$API/api/leaderboard?sort=total_volume&order=desc&limit=10"

# ── Leaderboard: Top 10 by Trade Count ──────────────────────────────────────
header "Top 10 Traders by Trade Count"
query "$API/api/leaderboard?sort=trade_count&order=desc&limit=10"

# ── Trader Detail + Recent Trades ────────────────────────────────────────────
header "Trader Detail (top PnL trader)"

# Grab the first trader address from the PnL leaderboard
TOP_TRADER=$(curl -s "$API/api/leaderboard?sort=realized_pnl&order=desc&limit=1" \
    | jq -r '.traders[0].address // empty')

if [ -n "$TOP_TRADER" ]; then
    echo -e "Address: ${BOLD}${TOP_TRADER}${RESET}"
    echo ""
    query "$API/api/trader/$TOP_TRADER"

    header "Recent Trades for $TOP_TRADER"
    query "$API/api/trader/$TOP_TRADER/trades?limit=5"
else
    echo "No traders found yet. Wait for rindexer to index some blocks."
fi

echo ""
echo -e "${GREEN}Done.${RESET}"
