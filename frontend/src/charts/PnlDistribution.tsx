import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import type { TraderSummary } from "../types";
import { shortenAddress, formatUsd } from "../lib/format";

interface Props {
  traders: TraderSummary[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "rgba(12, 12, 30, 0.95)",
  border: "1px solid rgba(6, 182, 212, 0.2)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
  padding: "10px 14px",
};

interface DataPoint {
  name: string;
  rov: number;
  pnl: number;
  trades: number;
  volume: number;
  positive: boolean;
}

function prepareData(traders: TraderSummary[]): { positive: DataPoint[]; negative: DataPoint[] } {
  const positive: DataPoint[] = [];
  const negative: DataPoint[] = [];

  for (const t of traders) {
    const pnl = parseFloat(t.realized_pnl);
    const vol = parseFloat(t.total_volume);
    if (vol === 0) continue;

    const point: DataPoint = {
      name: shortenAddress(t.address),
      rov: (pnl / vol) * 100,
      pnl,
      trades: t.trade_count,
      volume: vol,
      positive: pnl >= 0,
    };

    if (pnl >= 0) positive.push(point);
    else negative.push(point);
  }

  return { positive, negative };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DataPoint }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ color: "var(--accent-cyan)", fontFamily: "monospace", marginBottom: 6 }}>{d.name}</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 12px", fontSize: 12 }}>
        <span style={{ color: "var(--text-secondary)" }}>PnL</span>
        <span style={{ color: d.positive ? "var(--neon-green)" : "var(--neon-red)", fontFamily: "monospace" }}>
          {formatUsd(String(d.pnl))}
        </span>
        <span style={{ color: "var(--text-secondary)" }}>ROV</span>
        <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{d.rov.toFixed(2)}%</span>
        <span style={{ color: "var(--text-secondary)" }}>Volume</span>
        <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{formatUsd(String(d.volume))}</span>
        <span style={{ color: "var(--text-secondary)" }}>Trades</span>
        <span style={{ color: "var(--text-primary)", fontFamily: "monospace" }}>{d.trades.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function PnlDistribution({ traders }: Props) {
  const { positive, negative } = prepareData(traders);
  const maxTrades = Math.max(...traders.map((t) => t.trade_count), 1);

  return (
    <div className="glass p-5 gradient-border-top shimmer-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
          Efficiency vs Performance
        </h3>
        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--neon-green)] shadow-[0_0_4px_var(--neon-green)]" />
            Profitable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--neon-red)] shadow-[0_0_4px_var(--neon-red)]" />
            Losing
          </span>
          <span className="opacity-60">Bubble size = trade count</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ left: 10, right: 20, top: 10, bottom: 10 }}>
          <defs>
            <filter id="greenGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="redGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(6, 182, 212, 0.06)" />
          <XAxis
            type="number"
            dataKey="rov"
            name="ROV"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            axisLine={false}
            tickLine={false}
            label={{ value: "Return on Volume %", position: "insideBottom", offset: -5, fill: "var(--text-secondary)", fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="pnl"
            name="PnL"
            tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
            tickFormatter={(v: number) => formatUsd(String(v))}
            axisLine={false}
            tickLine={false}
          />
          <ZAxis type="number" dataKey="trades" range={[40, Math.min(400, maxTrades)]} />
          <ReferenceLine y={0} stroke="rgba(6, 182, 212, 0.15)" strokeDasharray="4 4" />
          <ReferenceLine x={0} stroke="rgba(6, 182, 212, 0.15)" strokeDasharray="4 4" />
          <Tooltip content={<CustomTooltip />} />
          <Scatter
            data={positive}
            fill="var(--neon-green)"
            fillOpacity={0.6}
            stroke="var(--neon-green)"
            strokeWidth={1}
            strokeOpacity={0.8}
            filter="url(#greenGlow)"
            animationDuration={800}
          />
          <Scatter
            data={negative}
            fill="var(--neon-red)"
            fillOpacity={0.6}
            stroke="var(--neon-red)"
            strokeWidth={1}
            strokeOpacity={0.8}
            filter="url(#redGlow)"
            animationDuration={800}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
