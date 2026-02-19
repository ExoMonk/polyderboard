import { useState, useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  LineSeries,
  createSeriesMarkers,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { motion } from "motion/react";
import type { PricePoint, MarketWsStatus, BidAsk } from "../types";
import { panelVariants } from "../lib/motion";

interface Props {
  priceHistory: PricePoint[];
  tradeMarkers: Set<number>;
  status: MarketWsStatus;
  bidAsk: BidAsk;
}

const WINDOWS = { "1m": 60, "5m": 300 } as const;
type TimeWindow = keyof typeof WINDOWS;

function toSec(ms: number): UTCTimestamp {
  return Math.floor(ms / 1000) as UTCTimestamp;
}

/** Deduplicate price points into {time (seconds), value (cents)}, optionally filtering by a timestamp set. */
function buildSeries(
  points: PricePoint[],
  filter?: Set<number>,
): { time: UTCTimestamp; value: number }[] {
  const map = new Map<number, number>();
  for (const p of points) {
    if (filter && !filter.has(p.timestamp)) continue;
    const sec = Math.floor(p.timestamp / 1000);
    map.set(sec, p.yesPrice * 100); // keep latest per second
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ time: t as UTCTimestamp, value: v }));
}

export default function LivePriceChart({
  priceHistory,
  tradeMarkers,
  status,
  bidAsk,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const polyRef = useRef<ISeriesApi<"Area"> | null>(null);
  const chainRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ReturnType<typeof createSeriesMarkers> | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const latestRef = useRef(50); // latest yes price in cents
  const windowRef = useRef<TimeWindow>("5m");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("5m");

  windowRef.current = timeWindow;

  // Keep latest price in ref for interval access
  useEffect(() => {
    if (priceHistory.length > 0) {
      latestRef.current = priceHistory[priceHistory.length - 1].yesPrice * 100;
    }
  }, [priceHistory]);

  // ─── Create chart (mount only) ────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 280,
      layout: {
        background: { type: "solid", color: "transparent" },
        textColor: "rgba(148, 163, 184, 0.8)",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(59, 130, 246, 0.06)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(59, 130, 246, 0.3)",
          labelBackgroundColor: "rgba(10, 18, 40, 0.9)",
        },
        horzLine: {
          color: "rgba(59, 130, 246, 0.3)",
          labelBackgroundColor: "rgba(10, 18, 40, 0.9)",
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderVisible: false,
        rightOffset: 3,
      },
      rightPriceScale: { borderVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    // Series 1 — Polymarket price (green area)
    const poly = chart.addSeries(AreaSeries, {
      topColor: "rgba(0, 255, 136, 0.15)",
      bottomColor: "rgba(0, 255, 136, 0.02)",
      lineColor: "#00ff88",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}\u00a2` },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: "#00ff88",
      crosshairMarkerBackgroundColor: "rgba(10, 18, 40, 0.9)",
    });

    // Series 2 — On-chain indexed trades (blue line)
    const chain = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 2,
      priceFormat: { type: "custom", formatter: (p: number) => `${p.toFixed(1)}\u00a2` },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "#3b82f6",
      crosshairMarkerBackgroundColor: "rgba(10, 18, 40, 0.9)",
    });

    const markers = createSeriesMarkers(chain, []);

    chartRef.current = chart;
    polyRef.current = poly;
    chainRef.current = chain;
    markersRef.current = markers;

    // ─── Custom tooltip ──────────────────────────────────────────────
    const tip = document.createElement("div");
    tip.style.cssText = [
      "position:absolute", "display:none", "z-index:10", "pointer-events:none",
      "background:rgba(10,18,40,0.95)", "border:1px solid rgba(59,130,246,0.2)",
      "border-radius:8px", "padding:10px 14px", "font-size:12px",
      "box-shadow:0 4px 20px rgba(0,0,0,0.5)",
    ].join(";");
    el.style.position = "relative";
    el.appendChild(tip);
    tooltipRef.current = tip;

    chart.subscribeCrosshairMove((param) => {
      if (!param.point || param.time === undefined) {
        tip.style.display = "none";
        return;
      }
      const pVal = (param.seriesData.get(poly) as { value?: number } | undefined)?.value;
      const cVal = (param.seriesData.get(chain) as { value?: number } | undefined)?.value;
      const yes = pVal ?? cVal;
      if (yes == null) { tip.style.display = "none"; return; }

      const no = 100 - yes;
      const d = new Date((param.time as number) * 1000);
      const ts = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

      tip.style.display = "block";
      tip.innerHTML =
        `<div style="color:var(--accent-blue);margin-bottom:6px;font-size:11px;font-family:monospace">${ts}</div>` +
        `<div style="display:grid;grid-template-columns:auto auto;gap:2px 12px">` +
        `<span style="color:#00ff88">Yes</span><span style="color:#00ff88;font-family:monospace">${yes.toFixed(1)}\u00a2</span>` +
        `<span style="color:#ff3366">No</span><span style="color:#ff3366;font-family:monospace">${no.toFixed(1)}\u00a2</span>` +
        `</div>` +
        (cVal != null ? `<div style="color:#3b82f6;font-size:10px;margin-top:4px">On-chain trade</div>` : "");

      const left = param.point.x > el.clientWidth * 0.6
        ? param.point.x - tip.offsetWidth - 15
        : param.point.x + 15;
      tip.style.left = `${Math.max(0, left)}px`;
      tip.style.top = `${Math.max(0, param.point.y - 30)}px`;
    });

    // ─── Resize ──────────────────────────────────────────────────────
    const ro = new ResizeObserver((entries) => {
      chart.applyOptions({ width: entries[0].contentRect.width });
    });
    ro.observe(el);

    // ─── 1-second tick: extend line + slide window ───────────────────
    const tickId = setInterval(() => {
      const now = toSec(Date.now());
      polyRef.current?.update({ time: now, value: latestRef.current });
      const sec = WINDOWS[windowRef.current];
      chart.timeScale().setVisibleRange({
        from: (now - sec) as UTCTimestamp,
        to: (now + 3) as UTCTimestamp,
      });
    }, 1000);

    return () => {
      clearInterval(tickId);
      ro.disconnect();
      tip.remove();
      chart.remove();
    };
  }, []); // mount only

  // ─── Update data when priceHistory / tradeMarkers change ──────────
  useEffect(() => {
    if (!polyRef.current || !chainRef.current || !markersRef.current) return;

    // All data → green area (continuous)
    const allData = buildSeries(priceHistory);
    polyRef.current.setData(allData);

    // On-chain only → blue line
    const chainData = buildSeries(priceHistory, tradeMarkers);
    chainRef.current.setData(chainData);

    // Markers on on-chain trades
    markersRef.current.setMarkers(
      chainData.map((d) => ({
        time: d.time,
        position: "inBar" as const,
        shape: "circle" as const,
        color: "#3b82f6",
        size: 1,
      })),
    );

    // Extend polymarket line to "now"
    const now = toSec(Date.now());
    if (allData.length > 0 && allData[allData.length - 1].time < now) {
      polyRef.current.update({ time: now, value: latestRef.current });
    }
  }, [priceHistory, tradeMarkers]);

  // ─── Snap visible range on time-window change ─────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    const now = toSec(Date.now());
    chartRef.current.timeScale().setVisibleRange({
      from: (now - WINDOWS[timeWindow]) as UTCTimestamp,
      to: (now + 3) as UTCTimestamp,
    });
  }, [timeWindow]);

  // Header price
  const currentYes =
    priceHistory.length > 0
      ? priceHistory[priceHistory.length - 1].yesPrice * 100
      : null;

  return (
    <motion.div
      variants={panelVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.4 }}
      className="glass p-5 gradient-border-top"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] uppercase tracking-wider">
            Price
          </h3>
          {currentYes != null && (
            <span className="text-lg font-bold font-mono text-[var(--neon-green)]">
              {currentYes.toFixed(1)}&cent;
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {(Object.keys(WINDOWS) as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  timeWindow === w
                    ? "bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          {bidAsk.spread != null && (
            <span className="text-xs font-mono text-[var(--text-secondary)]">
              Spread: {(bidAsk.spread * 100).toFixed(1)}&cent;
            </span>
          )}
          <span
            className={`flex items-center gap-1.5 text-xs ${
              status === "connected"
                ? "text-[var(--neon-green)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === "connected"
                  ? "bg-[var(--neon-green)] neon-pulse shadow-[0_0_6px_var(--neon-green)]"
                  : status === "connecting"
                    ? "bg-[var(--accent-orange)] animate-pulse"
                    : "bg-[var(--neon-red)]"
              }`}
            />
            {status === "connected"
              ? "Polymarket Live"
              : status === "connecting"
                ? "Connecting"
                : "Offline"}
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 280 }}>
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{
            opacity: priceHistory.length < 2 ? 0 : 1,
            transition: "opacity 0.3s",
          }}
        />
        {priceHistory.length < 2 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[var(--text-secondary)] text-sm">
              Waiting for price data...
            </p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-4 h-0.5 bg-[var(--neon-green)] rounded" />
          <span className="text-[var(--text-secondary)]">Polymarket</span>
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <span className="w-4 h-0.5 bg-[#3b82f6] rounded" />
          <span className="text-[var(--text-secondary)]">On-chain Trades</span>
        </span>
      </div>
    </motion.div>
  );
}
