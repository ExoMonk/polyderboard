import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { TraderSummary } from "../types";
import { shortenAddress, formatUsd } from "../lib/format";

interface Props {
  traders: TraderSummary[];
}

export default function PnlDistribution({ traders }: Props) {
  const data = traders.map((t) => ({
    name: shortenAddress(t.address),
    pnl: parseFloat(t.realized_pnl),
  }));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3">PnL Distribution</h3>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            tickFormatter={(v: number) => formatUsd(String(v))}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            width={80}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 13 }}
            labelStyle={{ color: "#d1d5db" }}
            formatter={(value: number | undefined) => [formatUsd(String(value ?? 0)), "PnL"]}
          />
          <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
