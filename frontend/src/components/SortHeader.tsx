import { AnimatePresence, motion } from "motion/react";
import type { SortColumn, SortOrder } from "../types";

interface Props {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentOrder: SortOrder;
  onSort: (col: SortColumn) => void;
  align?: "left" | "right";
}

export default function SortHeader({ label, column, currentSort, currentOrder, onSort, align = "right" }: Props) {
  const active = currentSort === column;

  return (
    <th
      onClick={() => onSort(column)}
      className={`px-4 py-3 cursor-pointer select-none transition-all duration-200 ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-[var(--accent-blue)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
      style={active ? { textShadow: "0 0 8px rgba(59, 130, 246, 0.3)" } : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <AnimatePresence mode="wait">
          {active && (
            <motion.span
              key={currentOrder}
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs"
            >
              {currentOrder === "desc" ? "↓" : "↑"}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </th>
  );
}
