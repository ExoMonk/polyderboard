import { useTraderLists } from "../../hooks/useTraderLists";

interface Props {
  selectedId: string | null;
  onSelect: (listId: string | null) => void;
}

export default function ListSelector({ selectedId, onSelect }: Props) {
  const { data: lists, isLoading } = useTraderLists();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
        Source
      </span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={isLoading}
        className="px-3 py-2 text-sm rounded-lg bg-[var(--bg-deep)] border border-[var(--border-glow)] text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none focus:shadow-[0_0_12px_rgba(59,130,246,0.2)] transition-all cursor-pointer appearance-none min-w-[160px]"
      >
        <option value="">Top N (default)</option>
        {(lists ?? []).map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.member_count})
          </option>
        ))}
      </select>
    </div>
  );
}
