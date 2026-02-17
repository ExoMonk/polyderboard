import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { TradeRecord } from "../types";
import { formatUsd } from "../lib/format";

interface Props {
  trades: TradeRecord[];
}

export default function TradeActivity({ trades }: Props) {
  // Group trades by day, sum buy/sell USDC volumes
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
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Trade Activity</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => formatUsd(String(v))}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 13 }}
            formatter={(value: number | undefined, name?: string) => [formatUsd(String(value ?? 0)), name === "buy" ? "Buy" : "Sell"]}
          />
          <Area type="monotone" dataKey="buy" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
          <Area type="monotone" dataKey="sell" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-600 mt-2">Based on loaded trades</p>
    </div>
  );
}
