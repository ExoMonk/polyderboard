import { useState } from "react";
import useAlerts from "../hooks/useAlerts";
import type { Alert } from "../types";
import { formatUsd, shortenAddress, polygonscanTx, polygonscanAddress, timeAgo } from "../lib/format";

type AlertFilter = "all" | "whale" | "resolution";

const FILTERS: { value: AlertFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "whale", label: "Whale Trades" },
  { value: "resolution", label: "Resolutions" },
];

export default function Alerts() {
  const { alerts, connected } = useAlerts();
  const [filter, setFilter] = useState<AlertFilter>("all");

  const filtered = alerts.filter((a) => {
    if (filter === "whale") return a.kind === "WhaleTrade";
    if (filter === "resolution") return a.kind === "MarketResolution";
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-black gradient-text tracking-tight">Alerts</h1>
          <span
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              connected
                ? "text-[var(--neon-green)] border-[var(--neon-green)]/30 bg-[var(--neon-green)]/5"
                : "text-[var(--neon-red)] border-[var(--neon-red)]/30 bg-[var(--neon-red)]/5"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected
                  ? "bg-[var(--neon-green)] animate-pulse shadow-[0_0_6px_var(--neon-green)]"
                  : "bg-[var(--neon-red)]"
              }`}
            />
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 text-xs rounded-full font-medium transition-all duration-200 ${
                filter === f.value
                  ? "bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] border border-[var(--accent-cyan)]/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]"
                  : "text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-glow)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass p-16 text-center">
          <div className="text-[var(--text-secondary)] text-sm">
            {alerts.length === 0
              ? "Listening for alerts..."
              : "No alerts match this filter"}
          </div>
          <div className="text-[var(--text-secondary)]/50 text-xs mt-2">
            Whale trades (&ge;$50k) and market resolutions appear here in real time
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert, i) => (
            <AlertCard key={`${alert.tx_hash}-${i}`} alert={alert} />
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  if (alert.kind === "WhaleTrade") {
    return <WhaleTradeCard alert={alert} />;
  }
  return <MarketResolutionCard alert={alert} />;
}

function WhaleTradeCard({ alert }: { alert: Extract<Alert, { kind: "WhaleTrade" }> }) {
  const isBuy = alert.side === "buy";

  return (
    <div className="glass p-4 gradient-border-top">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
              isBuy
                ? "bg-[var(--neon-green)]/10 text-[var(--neon-green)] shadow-[0_0_6px_rgba(0,255,136,0.15)]"
                : "bg-[var(--neon-red)]/10 text-[var(--neon-red)] shadow-[0_0_6px_rgba(255,51,102,0.15)]"
            }`}
          >
            {isBuy ? "BUY" : "SELL"}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold text-lg ${isBuy ? "glow-green" : "glow-red"}`}>
                {formatUsd(alert.usdc_amount)}
              </span>
              <span className="text-[var(--text-secondary)] text-xs">
                {alert.exchange === "neg_risk" ? "NegRisk" : "CTF"}
              </span>
            </div>
            {alert.question && (
              <div className="text-sm text-[var(--text-secondary)] truncate mt-1" title={alert.question}>
                {alert.question}
                {alert.outcome && (
                  <span className="text-[var(--accent-purple)] ml-1">({alert.outcome})</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="text-right shrink-0 text-xs space-y-1">
          <a
            href={polygonscanAddress(alert.trader)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent-cyan)]/50 hover:text-[var(--accent-cyan)] font-mono transition-colors duration-200"
          >
            {shortenAddress(alert.trader)}
          </a>
          <div>
            <a
              href={polygonscanTx(alert.tx_hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] font-mono transition-colors duration-200"
            >
              tx {shortenAddress(alert.tx_hash)}
            </a>
          </div>
          {alert.timestamp && (
            <div className="text-[var(--text-secondary)]/60">{timeAgo(alert.timestamp)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketResolutionCard({ alert }: { alert: Extract<Alert, { kind: "MarketResolution" }> }) {
  return (
    <div className="glass p-4 gradient-border-top">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0 bg-[var(--accent-purple)]/10 text-[var(--accent-purple)] border border-[var(--accent-purple)]/20">
            RESOLVED
          </span>
          <div className="min-w-0">
            <div className="text-sm text-[var(--text-primary)]">
              {alert.question || `Condition ${shortenAddress(alert.condition_id)}`}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Payouts: [{alert.payout_numerators.join(", ")}]
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 text-xs space-y-1">
          <a
            href={polygonscanTx(alert.tx_hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] font-mono transition-colors duration-200"
          >
            tx {shortenAddress(alert.tx_hash)}
          </a>
          {alert.timestamp && (
            <div className="text-[var(--text-secondary)]/60">{timeAgo(alert.timestamp)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
