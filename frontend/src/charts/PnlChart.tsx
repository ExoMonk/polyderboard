import { memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { motion } from "motion/react";
import type { PnlChartPoint, PnlTimeframe } from "../types";
import { formatUsd } from "../lib/format";
import { panelVariants, tapScale } from "../lib/motion";

interface Props {
  points: PnlChartPoint[];
  timeframe: PnlTimeframe;
  onTimeframeChange: (tf: PnlTimeframe) => void;
}

const TIMEFRAMES: { value: PnlTimeframe; label: string }[] = [
  { value: "24h", label: "24H" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(10, 18, 40, 0.95)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  borderRadius: 8,
  fontSize: 13,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
};

function formatDateLabel(dateStr: string, timeframe: PnlTimeframe): string {
  const isHourly = dateStr.includes(" ");
  const d = new Date(isHourly ? dateStr.replace(" ", "T") : dateStr);
  if (isNaN(d.getTime())) return dateStr;

  if (isHourly || timeframe === "24h") {
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default memo(function PnlChart({ points, timeframe, onTimeframeChange }: Props) {
  const data = points.map((p) => ({
    date: formatDateLabel(p.date, timeframe),
    pnl: parseFloat(p.pnl),
  }));

  const pnlValues = data.map((d) => d.pnl);
  const maxPnl = Math.max(...pnlValues, 0);
  const minPnl = Math.min(...pnlValues, 0);
  const range = maxPnl - minPnl;
  const zeroOffset = range > 0 ? maxPnl / range : 0.5;

  return (
    <motion.div
      variants={panelVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.4 }}
      className="glass p-5 gradient-border-top"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          P&L
        </h3>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <motion.button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              whileTap={tapScale}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-all duration-200 ${
                timeframe === tf.value
                  ? "bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                  : "text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-glow)]"
              }`}
            >
              {tf.label}
            </motion.button>
          ))}
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-center py-16 text-sm">No trades in this period</p>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={data}
            margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
          >
            <defs>
              <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#00ff88" stopOpacity={0.25} />
                <stop offset={zeroOffset} stopColor="#00ff88" stopOpacity={0.03} />
                <stop offset={zeroOffset} stopColor="#ff3366" stopOpacity={0.03} />
                <stop offset={1} stopColor="#ff3366" stopOpacity={0.25} />
              </linearGradient>
              <linearGradient id="pnlStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={0} stopColor="#00ff88" />
                <stop offset={zeroOffset} stopColor="#00ff88" />
                <stop offset={zeroOffset} stopColor="#ff3366" />
                <stop offset={1} stopColor="#ff3366" />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(59, 130, 246, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
              tickFormatter={(v: number) => formatUsd(String(v))}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={{ color: "var(--accent-blue)" }}
              formatter={(value: number | undefined) => [formatUsd(String(value ?? 0)), "P&L"]}
            />
            <ReferenceLine y={0} stroke="rgba(100, 116, 139, 0.3)" />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="url(#pnlStroke)"
              strokeWidth={2}
              fill="url(#pnlFill)"
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
});
