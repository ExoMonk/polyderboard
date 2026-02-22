import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { fetchCopyPortfolio } from "../../api";
import { formatUsd } from "../../lib/format";
import {
  staggerContainer,
  statCardVariants,
  panelVariants,
  tableRowVariants,
  hoverGlow,
} from "../../lib/motion";
import Spinner from "../../components/Spinner";
import { Pill, SectionHeader, TOP_N_OPTIONS } from "./shared";
import ListSelector from "./ListSelector";

export default function CopyPortfolio() {
  const [topN, setTopN] = useState<number>(10);
  const [listId, setListId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["copy-portfolio", listId, topN],
    queryFn: () =>
      fetchCopyPortfolio({
        top: listId ? undefined : topN,
        listId: listId ?? undefined,
      }),
    staleTime: 60_000,
  });

  const positions = data?.positions ?? [];
  const summary = data?.summary;
  const totalPnl = parseFloat(summary?.total_pnl ?? "0");
  const traderCount = listId ? (summary?.top_n ?? 1) : topN;

  return (
    <>
      {/* Config */}
      <motion.div
        variants={panelVariants}
        initial="initial"
        animate="animate"
        className="glass p-6 gradient-border-top"
      >
        <SectionHeader dot="bg-[var(--accent-blue)] shadow-[0_0_6px_var(--accent-blue)]">
          Portfolio Configuration
        </SectionHeader>
        <div className="flex flex-wrap items-center gap-5">
          <ListSelector selectedId={listId} onSelect={setListId} />
          {!listId && (
            <>
              <div className="h-5 w-px bg-[var(--border-glow)] hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Top Traders
                </span>
                <div className="flex gap-1.5">
                  {TOP_N_OPTIONS.map((n) => (
                    <Pill key={n} active={topN === n} onClick={() => setTopN(n)}>
                      {n}
                    </Pill>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>

      {/* Summary Stats */}
      {summary && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          {[
            {
              label: "Positions",
              value: String(summary.total_positions),
              glow: "glow-blue",
              border: "border-[var(--accent-blue)]/15 shadow-[0_0_15px_rgba(59,130,246,0.04)]",
            },
            {
              label: "Markets",
              value: String(summary.unique_markets),
              glow: "glow-blue",
              border: "border-[var(--accent-blue)]/15 shadow-[0_0_15px_rgba(59,130,246,0.04)]",
            },
            {
              label: "Exposure",
              value: formatUsd(summary.total_exposure),
              glow: "text-[var(--text-primary)]",
              border: "border-[var(--accent-blue)]/15 shadow-[0_0_15px_rgba(59,130,246,0.04)]",
            },
            {
              label: "Unrealized PnL",
              value: formatUsd(summary.total_pnl),
              glow: totalPnl >= 0 ? "glow-green" : "glow-red",
              border:
                totalPnl >= 0
                  ? "border-[var(--neon-green)]/20 shadow-[0_0_15px_rgba(0,255,136,0.06)]"
                  : "border-[var(--neon-red)]/20 shadow-[0_0_15px_rgba(255,51,102,0.06)]",
            },
          ].map((stat) => (
            <motion.div
              key={stat.label}
              variants={statCardVariants}
              whileHover={hoverGlow}
              className={`glass p-4 text-center border ${stat.border}`}
            >
              <div className="text-[10px] uppercase tracking-widest text-[var(--text-secondary)] mb-2">
                {stat.label}
              </div>
              <div className={`font-mono font-black text-lg ${stat.glow}`}>{stat.value}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Positions Table */}
      <motion.div
        variants={panelVariants}
        initial="initial"
        animate="animate"
        transition={{ delay: 0.15 }}
        className="glass overflow-hidden gradient-border-top"
      >
        <div className="px-6 py-4">
          <SectionHeader dot="bg-[var(--accent-orange)] shadow-[0_0_6px_var(--accent-orange)]">
            Top Trader Positions
          </SectionHeader>
        </div>
        {isLoading ? (
          <div className="p-6">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="text-[var(--neon-red)] text-center py-16 text-sm">
            Failed to load portfolio
          </p>
        ) : positions.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-16 text-sm">
            No open positions found
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-glow)] text-[var(--text-secondary)] text-xs uppercase tracking-widest">
                  <th className="px-6 py-3 text-left font-medium">Market</th>
                  <th className="px-6 py-3 text-center font-medium">Conviction</th>
                  <th className="px-6 py-3 text-center font-medium">Direction</th>
                  <th className="px-6 py-3 text-right font-medium">Avg Entry</th>
                  <th className="px-6 py-3 text-right font-medium">Price</th>
                  <th className="px-6 py-3 text-right font-medium">Exposure</th>
                  <th className="px-6 py-3 text-right font-medium">Unr. PnL</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => {
                  const pnl = parseFloat(p.total_pnl);
                  const entry = parseFloat(p.avg_entry);
                  const price = parseFloat(p.latest_price);
                  const priceVsEntry = price > entry;

                  return (
                    <motion.tr
                      key={p.token_id}
                      variants={tableRowVariants}
                      initial="initial"
                      animate="animate"
                      transition={{ duration: 0.25, delay: i * 0.03 }}
                      className="border-b border-[var(--border-subtle)] row-glow"
                    >
                      <td className="px-6 py-3 max-w-xs">
                        <Link
                          to={`/market/${p.token_id}`}
                          className="text-[var(--text-primary)] hover:text-[var(--accent-blue)] transition-colors truncate block"
                          title={p.question}
                        >
                          {p.question}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-bold text-[var(--accent-blue)]">
                            {p.convergence}/{traderCount}
                          </span>
                          <div className="w-12 h-1 rounded-full bg-[var(--bg-deep)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent-blue)]"
                              style={{ width: `${(p.convergence / traderCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-[var(--neon-green)] text-xs font-mono">
                            {p.long_count}L
                          </span>
                          <span className="text-[var(--text-secondary)]">/</span>
                          <span className="text-[var(--neon-red)] text-xs font-mono">
                            {p.short_count}S
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-[var(--text-secondary)]">
                        {entry.toFixed(2)}&cent;
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-mono ${
                          priceVsEntry ? "text-[var(--neon-green)]" : "text-[var(--neon-red)]"
                        }`}
                      >
                        {price.toFixed(2)}&cent;
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-[var(--text-primary)]">
                        {formatUsd(p.total_exposure)}
                      </td>
                      <td
                        className={`px-6 py-3 text-right font-mono font-bold ${
                          pnl >= 0 ? "glow-green" : "glow-red"
                        }`}
                      >
                        {formatUsd(p.total_pnl)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </>
  );
}
