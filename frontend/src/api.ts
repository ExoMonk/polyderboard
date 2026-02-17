import type {
  LeaderboardResponse,
  TraderSummary,
  TradesResponse,
  HealthResponse,
  SortColumn,
  SortOrder,
} from "./types";

const BASE = "/api";

export async function fetchLeaderboard(params: {
  sort?: SortColumn;
  order?: SortOrder;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardResponse> {
  const sp = new URLSearchParams();
  if (params.sort) sp.set("sort", params.sort);
  if (params.order) sp.set("order", params.order);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset !== undefined) sp.set("offset", String(params.offset));
  const res = await fetch(`${BASE}/leaderboard?${sp}`);
  if (!res.ok) throw new Error(`Leaderboard fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTrader(address: string): Promise<TraderSummary> {
  const res = await fetch(`${BASE}/trader/${address}`);
  if (!res.ok) throw new Error(`Trader fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTraderTrades(
  address: string,
  params: { limit?: number; offset?: number; side?: string },
): Promise<TradesResponse> {
  const sp = new URLSearchParams();
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset !== undefined) sp.set("offset", String(params.offset));
  if (params.side) sp.set("side", params.side);
  const res = await fetch(`${BASE}/trader/${address}/trades?${sp}`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error(`Health fetch failed: ${res.status}`);
  return res.json();
}
