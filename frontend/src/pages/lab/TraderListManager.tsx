import { useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  useTraderLists,
  useTraderListDetail,
  useCreateList,
  useDeleteList,
  useRenameList,
  useAddMembers,
  useRemoveMembers,
} from "../../hooks/useTraderLists";
import {
  shortenAddress,
  timeAgo,
  polymarketAddress,
  polygonscanAddress,
} from "../../lib/format";
import { panelVariants, tapScale } from "../../lib/motion";
import { SectionHeader } from "./shared";

/* ── tiny inline SVGs ── */
const IconPencil = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25a1.75 1.75 0 0 1 .445-.758l8.61-8.61Zm1.414 1.06a.25.25 0 0 0-.354 0L3.463 11.1a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.25.25 0 0 0 .108-.064l8.61-8.61a.25.25 0 0 0 0-.354L12.427 2.487Z" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM6.5 1.75V3h3V1.75a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25ZM3.613 5.5l.7 8.398A1.75 1.75 0 0 0 6.06 15.5h3.88a1.75 1.75 0 0 0 1.747-1.602l.7-8.398H3.613Z" />
  </svg>
);
const IconExternal = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
    <path d="M3.75 2h3.5a.75.75 0 0 1 0 1.5h-3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25v-3.5a.75.75 0 0 1 1.5 0v3.5A1.75 1.75 0 0 1 12.25 14h-8.5A1.75 1.75 0 0 1 2 12.25v-8.5C2 2.784 2.784 2 3.75 2Zm6.854-1h4.146a.25.25 0 0 1 .25.25v4.146a.25.25 0 0 1-.427.177L13.03 4.03 9.28 7.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.75-3.75-1.543-1.543A.25.25 0 0 1 10.604 1Z" />
  </svg>
);

export default function TraderListManager({ onClose }: { onClose: () => void }) {
  const { data: lists, isLoading } = useTraderLists();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newListName, setNewListName] = useState("");
  const [addAddressInput, setAddAddressInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: detail } = useTraderListDetail(selectedListId);
  const createList = useCreateList();
  const deleteList = useDeleteList();
  const renameList = useRenameList();
  const addMembers = useAddMembers();
  const removeMembers = useRemoveMembers();

  function handleCreate() {
    const name = newListName.trim();
    if (!name) return;
    createList.mutate(name, { onSuccess: () => setNewListName("") });
  }

  function handleAddMembers() {
    if (!selectedListId) return;
    const addresses = addAddressInput
      .split(/[\n,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[0-9a-f]{40}$/.test(s));
    if (addresses.length === 0) return;
    addMembers.mutate(
      { id: selectedListId, addresses },
      { onSuccess: () => setAddAddressInput("") },
    );
  }

  function handleRemoveMember(address: string) {
    if (!selectedListId) return;
    removeMembers.mutate({ id: selectedListId, addresses: [address] });
  }

  function handleRename(id: string) {
    const name = renameValue.trim();
    if (!name) return;
    renameList.mutate({ id, name }, { onSuccess: () => setRenamingId(null) });
  }

  function handleDelete(id: string) {
    deleteList.mutate(id, {
      onSuccess: () => {
        setConfirmDeleteId(null);
        if (selectedListId === id) setSelectedListId(null);
      },
    });
  }

  return (
    <motion.div
      variants={panelVariants}
      initial="initial"
      animate="animate"
      exit={{ opacity: 0, x: 50 }}
      className="glass p-6 gradient-border-top"
    >
      <div className="flex items-center justify-between mb-4">
        <SectionHeader dot="bg-[var(--accent-orange)] shadow-[0_0_6px_var(--accent-orange)]">
          Trader Lists
        </SectionHeader>
        <motion.button
          whileTap={tapScale}
          onClick={onClose}
          className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm cursor-pointer"
        >
          Close
        </motion.button>
      </div>

      {/* Create new list */}
      <div className="flex gap-2 mb-5">
        <input
          type="text"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="New list name..."
          maxLength={100}
          className="flex-1 px-3 py-2 text-sm rounded-lg bg-[var(--bg-deep)] border border-[var(--border-glow)] text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none transition-all placeholder:text-[var(--text-secondary)]/50"
        />
        <motion.button
          whileTap={tapScale}
          onClick={handleCreate}
          disabled={!newListName.trim() || createList.isPending}
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] border border-[var(--accent-blue)]/40 hover:bg-[var(--accent-blue)]/25 disabled:opacity-40 cursor-pointer transition-all"
        >
          Create
        </motion.button>
      </div>

      {/* List overview */}
      {isLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : !lists?.length ? (
        <p className="text-sm text-[var(--text-secondary)]">No lists yet. Create one above.</p>
      ) : (
        <div className="space-y-2 mb-5">
          {lists.map((list) => {
            const isSelected = selectedListId === list.id;
            const isDeleting = confirmDeleteId === list.id;

            return (
              <motion.div
                key={list.id}
                layout
                className={`group glass rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? "border-[var(--accent-blue)]/30 shadow-[0_0_12px_rgba(59,130,246,0.1)]"
                    : "hover:border-[var(--accent-blue)]/20"
                }`}
                onClick={() => setSelectedListId(isSelected ? null : list.id)}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Color bar */}
                  <div
                    className={`w-1 self-stretch rounded-full transition-colors ${
                      isSelected ? "bg-[var(--accent-blue)]" : "bg-[var(--border-glow)]"
                    }`}
                  />

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {renamingId === list.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(list.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => setRenamingId(null)}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-0.5 text-sm bg-[var(--bg-deep)] border border-[var(--accent-blue)]/40 rounded text-[var(--text-primary)] focus:outline-none"
                      />
                    ) : (
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                        {list.name}
                      </span>
                    )}
                  </div>

                  {/* Member count pill */}
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      isSelected
                        ? "bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]"
                        : "bg-[var(--text-secondary)]/10 text-[var(--text-secondary)]"
                    }`}
                  >
                    {list.member_count}
                    <span className="hidden sm:inline">
                      {list.member_count === 1 ? "trader" : "traders"}
                    </span>
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingId(list.id);
                        setRenameValue(list.name);
                      }}
                      title="Rename"
                      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors cursor-pointer"
                    >
                      <IconPencil />
                    </button>
                    {isDeleting ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(list.id)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-[var(--neon-red)] bg-[var(--neon-red)]/10 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(list.id);
                        }}
                        title="Delete"
                        className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 transition-colors cursor-pointer"
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Selected list detail */}
      <AnimatePresence>
        {selectedListId && detail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[var(--border-glow)] pt-4">
              <SectionHeader dot="bg-[var(--accent-blue)] shadow-[0_0_6px_var(--accent-blue)]">
                Members — {detail.name}
              </SectionHeader>

              {/* Add address input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={addAddressInput}
                  onChange={(e) => setAddAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMembers()}
                  placeholder="Paste address(es), comma or newline separated..."
                  className="flex-1 px-3 py-2 text-sm font-mono rounded-lg bg-[var(--bg-deep)] border border-[var(--border-glow)] text-[var(--text-primary)] focus:border-[var(--accent-blue)] focus:outline-none transition-all placeholder:text-[var(--text-secondary)]/50"
                />
                <motion.button
                  whileTap={tapScale}
                  onClick={handleAddMembers}
                  disabled={!addAddressInput.trim() || addMembers.isPending}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/30 hover:bg-[var(--neon-green)]/20 disabled:opacity-40 cursor-pointer transition-all"
                >
                  Add
                </motion.button>
              </div>

              {/* Member list */}
              {detail.members.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No members yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {detail.members.map((m, i) => (
                    <div
                      key={m.address}
                      className="group/row flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-[var(--border-glow)] hover:bg-[var(--accent-blue)]/5 transition-all"
                    >
                      {/* Row number */}
                      <span className="text-[11px] font-mono text-[var(--text-secondary)] w-5 text-right shrink-0">
                        {i + 1}
                      </span>

                      {/* Address + label + links — all together on the left */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Link
                          to={`/trader/${m.address}`}
                          className="font-mono text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent-blue)] transition-colors"
                        >
                          {shortenAddress(m.address)}
                        </Link>

                        {m.label && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] truncate max-w-[120px]">
                            {m.label}
                          </span>
                        )}

                        {/* Inline links — always visible */}
                        <a
                          href={polymarketAddress(m.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Polymarket profile"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-[var(--accent-blue)]/60 hover:text-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/10 transition-colors"
                        >
                          PM <IconExternal />
                        </a>
                        <a
                          href={polygonscanAddress(m.address)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Polygonscan"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold text-[var(--neon-green)]/50 hover:text-[var(--neon-green)] hover:bg-[var(--neon-green)]/10 transition-colors"
                        >
                          Scan <IconExternal />
                        </a>
                      </div>

                      {/* Added time */}
                      <span className="text-[11px] text-[var(--text-secondary)] whitespace-nowrap shrink-0">
                        {timeAgo(m.added_at)}
                      </span>

                      {/* Remove — appears on hover */}
                      <button
                        onClick={() => handleRemoveMember(m.address)}
                        title="Remove from list"
                        className="p-1.5 rounded-md text-[var(--text-secondary)] opacity-0 group-hover/row:opacity-100 hover:text-[var(--neon-red)] hover:bg-[var(--neon-red)]/10 transition-all cursor-pointer shrink-0"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
