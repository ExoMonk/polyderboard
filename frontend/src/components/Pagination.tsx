import { AnimatePresence, motion } from "motion/react";
import { tapScale } from "../lib/motion";

interface Props {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
}

export default function Pagination({ total, limit, offset, onPageChange }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex items-center justify-between pt-5 text-sm">
      <span className="text-[var(--text-secondary)] font-mono text-xs">{total.toLocaleString()} results</span>
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-4 py-1.5 rounded-lg text-[var(--text-secondary)] border border-[var(--border-glow)] hover:border-[var(--accent-blue)]/30 hover:text-[var(--accent-blue)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(59,130,246,0.2)" }}
          whileTap={tapScale}
        >
          Prev
        </motion.button>
        <span className="text-[var(--text-secondary)] font-mono text-xs">
          <AnimatePresence mode="wait">
            <motion.span
              key={page}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.15 }}
              className="glow-blue inline-block"
            >
              {page}
            </motion.span>
          </AnimatePresence>
          {" "}/ {totalPages}
        </span>
        <motion.button
          onClick={() => onPageChange(offset + limit)}
          disabled={offset + limit >= total}
          className="px-4 py-1.5 rounded-lg text-[var(--text-secondary)] border border-[var(--border-glow)] hover:border-[var(--accent-blue)]/30 hover:text-[var(--accent-blue)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
          whileHover={{ scale: 1.05, boxShadow: "0 0 12px rgba(59,130,246,0.2)" }}
          whileTap={tapScale}
        >
          Next
        </motion.button>
      </div>
    </div>
  );
}
