import { motion, AnimatePresence } from "motion/react";
import useSignalFeed from "../../hooks/useSignalFeed";
import ListSelector from "./ListSelector";
import { useState } from "react";
import { Link } from "react-router-dom";
import { shortenAddress, formatUsd, timeAgo } from "../../lib/format";
import { panelVariants, alertCardVariants } from "../../lib/motion";
import { SectionHeader } from "./shared";

const DEFAULT_TOP_N = 20;

export default function SignalFeed() {
  const [listId, setListId] = useState<string | null>(null);
  const { trades, alerts, connected, isLagging } = useSignalFeed({
    listId,
    topN: listId ? undefined : DEFAULT_TOP_N,
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <motion.div
        variants={panelVariants}
        initial="initial"
        animate="animate"
        className="glass p-5 gradient-border-top"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <ListSelector selectedId={listId} onSelect={setListId} />
          <div className="flex items-center gap-3">
            {isLagging && (
              <span className="text-xs font-semibold text-[var(--accent-orange)] bg-[var(--accent-orange)]/10 px-2 py-1 rounded-full">
                Signal lag — some trades may be delayed
              </span>
            )}
            <span
              className={`w-2 h-2 rounded-full ${connected ? "bg-[var(--neon-green)] shadow-[0_0_6px_var(--neon-green)]" : "bg-[var(--text-secondary)]"}`}
            />
            <span className="text-xs text-[var(--text-secondary)]">
              {connected ? "Live" : "Connecting..."}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trade stream — 2/3 width */}
          <div className="lg:col-span-2 space-y-2">
            <SectionHeader dot="bg-[var(--accent-blue)] shadow-[0_0_6px_var(--accent-blue)]">
              Live Trades ({trades.length})
            </SectionHeader>
            {trades.length === 0 ? (
              <div className="glass p-8 text-center">
                <p className="text-[var(--text-secondary)] text-sm">Waiting for trades...</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {trades.map((t) => (
                    <motion.div
                      key={t.tx_hash}
                      variants={alertCardVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="glass px-4 py-3 flex items-center gap-3 text-sm"
                    >
                      <span
                        className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                          t.side === "Buy"
                            ? "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
                            : "text-[var(--neon-red)] bg-[var(--neon-red)]/10"
                        }`}
                      >
                        {t.side}
                      </span>
                      <Link
                        to={`/trader/${t.trader}`}
                        className="font-mono text-[var(--accent-blue)] hover:text-white transition-colors"
                      >
                        {shortenAddress(t.trader)}
                      </Link>
                      <span className="text-[var(--text-secondary)] truncate flex-1 min-w-0">
                        {t.question ?? t.asset_id.slice(0, 12)}
                        {t.outcome && (
                          <span className="text-[var(--text-secondary)]/60 ml-1">· {t.outcome}</span>
                        )}
                      </span>
                      <span className="font-mono font-bold text-[var(--text-primary)]">
                        {formatUsd(t.usdc_amount)}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        {timeAgo(t.block_timestamp)}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Convergence alerts — 1/3 width */}
          <div className="space-y-2">
            <SectionHeader dot="bg-[var(--accent-orange)] shadow-[0_0_6px_var(--accent-orange)]">
              Convergence Alerts ({alerts.length})
            </SectionHeader>
            {alerts.length === 0 ? (
              <div className="glass p-8 text-center">
                <p className="text-[var(--text-secondary)] text-sm">
                  Alerts fire when multiple watched traders enter the same market.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {alerts.map((a, i) => (
                    <motion.div
                      key={`${a.asset_id}-${i}`}
                      variants={alertCardVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      className="glass px-4 py-3 border border-[var(--accent-orange)]/20 shadow-[0_0_12px_rgba(249,115,22,0.08)]"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-[var(--accent-orange)] uppercase">
                          Convergence
                        </span>
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            a.side === "Buy"
                              ? "text-[var(--neon-green)] bg-[var(--neon-green)]/10"
                              : "text-[var(--neon-red)] bg-[var(--neon-red)]/10"
                          }`}
                        >
                          {a.side}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--text-primary)] mb-2 line-clamp-2">
                        {a.question ?? a.asset_id.slice(0, 20)}
                        {a.outcome && <span className="text-[var(--text-secondary)]"> · {a.outcome}</span>}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {a.traders.map((addr) => (
                          <Link
                            key={addr}
                            to={`/trader/${addr}`}
                            className="text-xs font-mono text-[var(--accent-blue)] hover:text-white transition-colors"
                          >
                            {shortenAddress(addr)}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
