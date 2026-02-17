import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { TradeRecord } from "../types";
import { formatUsd } from "../lib/format";

interface Props {
  trades: TradeRecord[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(12, 12, 30, 0.95)",
  border: "1px solid rgba(6, 182, 212, 0.2)",
  borderRadius: 8,
  fontSize: 13,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
};

export default function TradeActivity({ trades }: Props) {
  const byDay = new Map<string, { buy: number; sell: number }>();
  for (const t of trades) {
    const day = t.block_timestamp ? t.block_timestamp.slice(0, 10) : "unknown";
    const entry = byDay.get(day) ?? { buy: 0, sell: 0 };
    const usdc = parseFloat(t.usdc_amount) || 0;
    if (t.side === "buy") entry.buy += usdc;
    else entry.sell += usdc;
    byDay.set(day, entry);
  }

  const data = Array.from(byDay.entries())
    .filter(([k]) => k !== "unknown")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vol]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      buy: vol.buy,
      sell: vol.sell,
    }));

  if (data.length === 0) return null;

  return (
    <div className="glass p-5 gradient-border-top shimmer-border">
      <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4 uppercase tracking-wider">
        Trade Activity
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ left: 10, right: 10, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="buyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00ff88" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00ff88" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="sellGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3366" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#ff3366" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.06)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v: number) => formatUsd(String(v))}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: "var(--accent-cyan)" }}
            formatter={(value: number | undefined, name?: string) => [formatUsd(String(value ?? 0)), name === "buy" ? "Buy" : "Sell"]}
          />
          <Area
            type="monotone"
            dataKey="buy"
            stackId="1"
            stroke="var(--neon-green)"
            strokeWidth={2}
            fill="url(#buyGrad)"
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="sell"
            stackId="1"
            stroke="var(--neon-red)"
            strokeWidth={2}
            fill="url(#sellGrad)"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-[var(--text-secondary)] mt-3 opacity-50">Based on loaded trades</p>
    </div>
  );
}
