import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { fetchTrader, fetchTraderTrades } from "../api";
import Spinner from "../components/Spinner";
import Pagination from "../components/Pagination";
import TradeActivity from "../charts/TradeActivity";
import { formatUsd, formatNumber, formatDate, formatTimestamp, shortenAddress, polygonscanAddress, polygonscanTx } from "../lib/format";

const PAGE_SIZE = 50;

export default function TraderDetail() {
  const { address } = useParams<{ address: string }>();
  const [sideFilter, setSideFilter] = useState("");
  const [offset, setOffset] = useState(0);

  const { data: trader, isLoading: loadingTrader, error: traderError } = useQuery({
    queryKey: ["trader", address],
    queryFn: () => fetchTrader(address!),
    enabled: !!address,
  });

  const { data: tradesData, isLoading: loadingTrades } = useQuery({
    queryKey: ["trades", address, sideFilter, offset],
    queryFn: () => fetchTraderTrades(address!, { limit: PAGE_SIZE, offset, side: sideFilter || undefined }),
    enabled: !!address,
    placeholderData: keepPreviousData,
  });

  if (loadingTrader) return <Spinner />;
  if (traderError) return <div className="text-red-400 text-center py-10">Trader not found</div>;
  if (!trader) return null;

  const pnl = parseFloat(trader.realized_pnl);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to="/" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
          ← Back to Leaderboard
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-xl font-bold font-mono">{shortenAddress(address!)}</h1>
          <button
            onClick={() => navigator.clipboard.writeText(address!)}
            className="text-gray-500 hover:text-gray-300 transition-colors"
            title="Copy address"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <a
            href={polygonscanAddress(address!)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            Polygonscan ↗
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Realized PnL" value={formatUsd(trader.realized_pnl)} color={pnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        <StatCard label="Total Volume" value={formatUsd(trader.total_volume)} />
        <StatCard label="Trades" value={formatNumber(trader.trade_count)} />
        <StatCard label="Markets" value={formatNumber(trader.markets_traded)} />
        <StatCard label="Total Fees" value={formatUsd(trader.total_fees)} />
        <StatCard label="Active Since" value={formatDate(trader.first_trade)} />
      </div>

      {/* Trade Activity Chart */}
      {tradesData && tradesData.trades.length > 0 && <TradeActivity trades={tradesData.trades} />}

      {/* Trades Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Trade History</h2>
          <div className="flex gap-1">
            {["", "buy", "sell"].map((s) => (
              <button
                key={s}
                onClick={() => { setSideFilter(s); setOffset(0); }}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  sideFilter === s ? "bg-gray-700 text-white" : "bg-gray-800/50 text-gray-400 hover:text-gray-200"
                }`}
              >
                {s === "" ? "All" : s === "buy" ? "Buy" : "Sell"}
              </button>
            ))}
          </div>
        </div>

        {loadingTrades ? (
          <Spinner />
        ) : tradesData && tradesData.trades.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-3 py-2 text-right">Block</th>
                    <th className="px-3 py-2 text-center">Side</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3 py-2 text-right">USDC</th>
                    <th className="px-3 py-2 text-right">Fee</th>
                    <th className="px-3 py-2 text-right">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {tradesData.trades.map((t, i) => (
                    <tr key={`${t.tx_hash}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{formatTimestamp(t.block_timestamp)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500 text-xs">{formatNumber(t.block_number)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                          t.side === "buy" ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"
                        }`}>
                          {t.side.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{formatNumber(t.amount)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{formatUsd(t.price)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-300">{formatUsd(t.usdc_amount)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-500">{formatUsd(t.fee)}</td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={polygonscanTx(t.tx_hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400/60 hover:text-blue-400 font-mono text-xs transition-colors"
                        >
                          {shortenAddress(t.tx_hash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={tradesData.total} limit={PAGE_SIZE} offset={offset} onPageChange={setOffset} />
          </>
        ) : (
          <p className="text-gray-500 text-center py-8">No trades found</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold font-mono ${color ?? "text-gray-100"}`}>{value}</div>
    </div>
  );
}
