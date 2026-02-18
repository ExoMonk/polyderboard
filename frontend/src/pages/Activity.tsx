import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchHotMarkets } from "../api";
import Spinner from "../components/Spinner";
import { formatUsd, formatNumber, timeAgo } from "../lib/format";

const PERIODS = [
  { label: "1H", value: "1h" },
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
] as const;

export default function Activity() {
  const [period, setPeriod] = useState("24h");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black gradient-text tracking-tight">Activity</h1>
      </div>
      <HotMarkets period={period} setPeriod={setPeriod} />
    </div>
  );
}

function HotMarkets({ period, setPeriod }: { period: string; setPeriod: (p: string) => void }) {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["hotMarkets", period],
    queryFn: () => fetchHotMarkets({ period, limit: 20 }),
    refetchInterval: 10_000,
  });

  const maxVolume = data?.markets.reduce((max, m) => Math.max(max, parseFloat(m.volume)), 0) ?? 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold gradient-text">Hot Markets</h2>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-1.5 text-xs rounded-full font-medium transition-all duration-200 ${
                period === p.value
                  ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                  : "text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-glow)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : error ? (
        <div className="text-[var(--neon-red)] text-center py-10">Failed to load hot markets</div>
      ) : data && data.markets.length > 0 ? (
        <div className="glass overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)] text-xs uppercase tracking-widest">
                  <th className="px-4 py-3 text-left w-10">#</th>
                  <th className="px-4 py-3 text-left">Market</th>
                  <th className="px-4 py-3 text-right">Volume</th>
                  <th className="px-4 py-3 text-right">Trades</th>
                  <th className="px-4 py-3 text-right hidden md:table-cell">Traders</th>
                  <th className="px-4 py-3 text-left hidden lg:table-cell">Category</th>
                  <th className="px-4 py-3 text-right hidden lg:table-cell">Last Trade</th>
                </tr>
              </thead>
              <tbody>
                {data.markets.map((m, i) => {
                  const vol = parseFloat(m.volume);
                  const pct = maxVolume > 0 ? (vol / maxVolume) * 100 : 0;
                  return (
                    <tr
                      key={m.token_id}
                      onClick={() => navigate(`/market/${encodeURIComponent(m.all_token_ids.join(','))}`)}
                      className="border-b border-[var(--border-subtle)] row-glow cursor-pointer"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-[var(--text-secondary)]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[var(--text-primary)] truncate max-w-md" title={m.question}>
                            {m.question}
                          </span>
                          {m.outcome && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border border-[var(--accent-purple)]/20 w-fit">
                              {m.outcome}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-[var(--text-primary)]">{formatUsd(m.volume)}</span>
                          <div className="w-24 h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500/60 to-purple-500/60"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                        {formatNumber(m.trade_count)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)] hidden md:table-cell">
                        {formatNumber(m.unique_traders)}
                      </td>
                      <td className="px-4 py-3 text-left text-[var(--text-secondary)] hidden lg:table-cell">
                        {m.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)] hidden lg:table-cell">
                        {timeAgo(m.last_trade)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass p-8 text-center text-[var(--text-secondary)]">No market activity found</div>
      )}
    </div>
  );
}
