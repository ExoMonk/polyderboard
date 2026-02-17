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
      } ${active ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
      style={active ? { textShadow: "0 0 8px rgba(34, 211, 238, 0.3)" } : undefined}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-xs">{currentOrder === "desc" ? "↓" : "↑"}</span>}
      </span>
    </th>
  );
}
