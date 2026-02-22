import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { tapScale } from "../lib/motion";
import { useAuth } from "../context/AuthContext";
import Backtester from "./lab/Backtester";
import CopyPortfolio from "./lab/CopyPortfolio";
import SignalFeed from "./lab/SignalFeed";
import TraderListManager from "./lab/TraderListManager";

type LabModule = "backtest" | "copy-portfolio" | "signals";

const MODULES: { key: LabModule; label: string }[] = [
  { key: "backtest", label: "Backtester" },
  { key: "copy-portfolio", label: "Copy Portfolio" },
  { key: "signals", label: "Signal Feed" },
];

export default function Lab() {
  const [activeModule, setActiveModule] = useState<LabModule>("backtest");
  const [showListManager, setShowListManager] = useState(false);
  const { isAuthenticated } = useAuth();

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-black gradient-text tracking-tight glitch-text">PolyLab</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Research tools for copy-trading the smartest Polymarket traders
        </p>
      </motion.div>

      {/* Module Tabs + Manage Lists */}
      <div className="flex items-center gap-2">
        {MODULES.map((mod) => (
          <motion.button
            key={mod.key}
            onClick={() => setActiveModule(mod.key)}
            whileTap={tapScale}
            whileHover={{ scale: 1.03 }}
            className={`px-4 py-2 text-sm rounded-lg font-semibold transition-all duration-200 cursor-pointer ${
              activeModule === mod.key
                ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                : "text-[var(--text-secondary)] border border-transparent hover:text-[var(--text-primary)] hover:border-[var(--border-glow)] hover:bg-[var(--accent-blue)]/5"
            }`}
          >
            {mod.label}
          </motion.button>
        ))}
        {isAuthenticated && (
          <motion.button
            whileTap={tapScale}
            whileHover={{ scale: 1.03 }}
            onClick={() => setShowListManager(!showListManager)}
            className={`ml-auto px-4 py-2 text-sm rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
              showListManager
                ? "bg-[var(--accent-orange)]/25 text-[var(--accent-orange)] border border-[var(--accent-orange)]/40 shadow-[0_0_12px_rgba(251,146,60,0.15)]"
                : "bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] border border-[var(--accent-orange)]/25 hover:bg-[var(--accent-orange)]/20 hover:border-[var(--accent-orange)]/40 hover:shadow-[0_0_10px_rgba(251,146,60,0.1)]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            Manage Lists
          </motion.button>
        )}
      </div>

      {/* List Manager Panel */}
      <AnimatePresence>
        {showListManager && (
          <TraderListManager onClose={() => setShowListManager(false)} />
        )}
      </AnimatePresence>

      {/* Active Module */}
      {activeModule === "backtest" ? (
        <Backtester />
      ) : activeModule === "signals" ? (
        <SignalFeed />
      ) : (
        <CopyPortfolio />
      )}
    </div>
  );
}
