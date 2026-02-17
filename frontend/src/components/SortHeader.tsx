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
      className={`px-3 py-2 cursor-pointer select-none hover:text-white transition-colors ${
        align === "right" ? "text-right" : "text-left"
      } ${active ? "text-white" : "text-gray-400"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-xs">{currentOrder === "desc" ? "↓" : "↑"}</span>}
      </span>
    </th>
  );
}
