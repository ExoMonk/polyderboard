import { useState } from "react";
import { motion } from "motion/react";
import { tapScale } from "../lib/motion";
import Backtester from "./lab/Backtester";
import CopyPortfolio from "./lab/CopyPortfolio";

type LabModule = "backtest" | "copy-portfolio";

const MODULES: { key: LabModule; label: string }[] = [
  { key: "backtest", label: "Backtester" },
  { key: "copy-portfolio", label: "Copy Portfolio" },
];

export default function Lab() {
  const [activeModule, setActiveModule] = useState<LabModule>("backtest");

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

      {/* Module Tabs */}
      <div className="flex gap-2">
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
      </div>

      {/* Active Module */}
      {activeModule === "backtest" ? <Backtester /> : <CopyPortfolio />}
    </div>
  );
}
