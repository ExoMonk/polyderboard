import { motion } from "motion/react";
import { tapScale } from "../../lib/motion";

export const TOP_N_OPTIONS = [5, 10, 25, 50] as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "rgba(10, 18, 40, 0.95)",
  border: "1px solid rgba(59, 130, 246, 0.2)",
  borderRadius: 8,
  fontSize: 13,
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.5)",
};

export function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={tapScale}
      whileHover={{
        scale: 1.05,
        boxShadow: active
          ? "0 0 14px rgba(59,130,246,0.25)"
          : "0 0 10px rgba(59,130,246,0.1)",
      }}
      className={`px-3.5 py-1.5 text-xs rounded-full font-semibold transition-all duration-200 cursor-pointer ${
        active
          ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/40 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
          : "text-[var(--text-secondary)] border border-[var(--border-glow)] hover:text-[var(--text-primary)] hover:border-[var(--accent-blue)]/30 hover:bg-[var(--accent-blue)]/5"
      }`}
    >
      {children}
    </motion.button>
  );
}

export function SectionHeader({
  dot,
  children,
}: {
  dot: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
        {children}
      </h3>
    </div>
  );
}

export function rankClass(rank: number): string {
  if (rank === 1) return "rank-gold font-bold";
  if (rank === 2) return "rank-silver font-bold";
  if (rank === 3) return "rank-bronze font-bold";
  return "text-[var(--text-secondary)]";
}
