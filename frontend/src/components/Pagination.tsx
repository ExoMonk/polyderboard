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
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={offset === 0}
          className="px-4 py-1.5 rounded-lg text-[var(--text-secondary)] border border-[var(--border-glow)] hover:border-[var(--accent-cyan)]/30 hover:text-[var(--accent-cyan)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
        >
          Prev
        </button>
        <span className="text-[var(--text-secondary)] font-mono text-xs">
          <span className="glow-cyan">{page}</span> / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={offset + limit >= total}
          className="px-4 py-1.5 rounded-lg text-[var(--text-secondary)] border border-[var(--border-glow)] hover:border-[var(--accent-cyan)]/30 hover:text-[var(--accent-cyan)] disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-200"
        >
          Next
        </button>
      </div>
    </div>
  );
}
