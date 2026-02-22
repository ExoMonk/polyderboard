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
import { shortenAddress } from "../../lib/format";
import { panelVariants, tapScale } from "../../lib/motion";
import { SectionHeader } from "./shared";

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
          {lists.map((list) => (
            <div
              key={list.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                selectedListId === list.id
                  ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/30"
                  : "border-[var(--border-glow)] hover:border-[var(--accent-blue)]/20 hover:bg-[var(--accent-blue)]/5"
              }`}
              onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
            >
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
              <span className="text-xs text-[var(--text-secondary)] font-mono">
                {list.member_count} traders
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenamingId(list.id);
                  setRenameValue(list.name);
                }}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors cursor-pointer"
              >
                Rename
              </button>
              {confirmDeleteId === list.id ? (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleDelete(list.id)}
                    className="text-xs text-[var(--neon-red)] font-semibold cursor-pointer"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="text-xs text-[var(--text-secondary)] cursor-pointer"
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
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--neon-red)] transition-colors cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
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
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {detail.members.map((m) => (
                    <div
                      key={m.address}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--accent-blue)]/5 transition-colors"
                    >
                      <Link
                        to={`/trader/${m.address}`}
                        className="font-mono text-sm text-[var(--text-primary)] hover:text-[var(--accent-blue)] transition-colors"
                      >
                        {shortenAddress(m.address)}
                      </Link>
                      <button
                        onClick={() => handleRemoveMember(m.address)}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--neon-red)] transition-colors cursor-pointer"
                      >
                        Remove
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
