export interface TraderSummary {
  address: string;
  total_volume: string;
  trade_count: number;
  markets_traded: number;
  realized_pnl: string;
  total_fees: string;
  first_trade: string;
  last_trade: string;
}

export interface LeaderboardResponse {
  traders: TraderSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface TradeRecord {
  tx_hash: string;
  block_number: number;
  block_timestamp: string;
  exchange: string;
  side: string;
  asset_id: string;
  amount: string;
  price: string;
  usdc_amount: string;
  fee: string;
}

export interface TradesResponse {
  trades: TradeRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface HealthResponse {
  status: string;
  trade_count: number;
  trader_count: number;
  latest_block: number;
}

export type SortColumn = "realized_pnl" | "total_volume" | "trade_count";
export type SortOrder = "asc" | "desc";
