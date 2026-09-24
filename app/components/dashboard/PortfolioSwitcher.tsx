// components/dashboard/PortfolioSwitcher.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronsUpDown, Plus, Pencil, Trash2, Check, Loader2, Briefcase } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PORTFOLIO SWITCHER — sits at the top of the investor sidebar (see Sidebar.tsx; not shown for
 * ADVISOR, whose flows pick a client's portfolio locally instead — see
 * useClientDefaultPortfolio). Lists every portfolio, default first, lets the user switch,
 * rename or delete one inline, and create a new one. The default portfolio can't be deleted
 * (no delete button on it) — matches the backend's own 409.
 */
export function PortfolioSwitcher() {
  const { portfolios, current, loading, selectPortfolio, createPortfolio, renamePortfolio, deletePortfolio } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingUuid, setRenamingUuid] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Closing the menu (by any route) always clears whatever inline edit was mid-flight, so
  // reopening it never resumes a stale rename/create field.
  useEffect(() => {
    if (open) return;
    setCreating(false);
    setNewName("");
    setRenamingUuid(null);
    setError(null);
  }, [open]);

  if (loading) {
    return (
      <div className="px-5 pt-5">
        <div className="h-[46px] rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }
  if (!current) return null;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await createPortfolio(name);
      setNewName("");
      setCreating(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this portfolio.");
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (uuid: string) => {
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await renamePortfolio(uuid, name);
      setRenamingUuid(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deletePortfolio(toDelete.uuid);
      setToDelete(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-5 pt-5" ref={rootRef}>
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-[#C49A3C]/30 transition-colors text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Briefcase className="h-4 w-4 text-[#C49A3C] shrink-0" />
            <span className="text-sm font-bold text-white truncate">{current.name}</span>
          </div>
          <ChevronsUpDown className="h-4 w-4 text-[#a8a29e] shrink-0" />
        </button>

        {open && (
          <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl bg-[#131210] border border-white/10 shadow-xl overflow-hidden">
            <ul className="max-h-64 overflow-y-auto py-1.5">
              {portfolios.map((p) => (
                <li key={p.uuid} className="group px-2">
                  {renamingUuid === p.uuid ? (
                    <div className="flex items-center gap-1.5 py-1.5 px-1">
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRename(p.uuid);
                          if (e.key === "Escape") setRenamingUuid(null);
                        }}
                        maxLength={80}
                        className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white/10 text-white text-sm outline-none border border-[#C49A3C]/40"
                      />
                      <button
                        onClick={() => handleRename(p.uuid)}
                        disabled={busy || !renameValue.trim()}
                        aria-label="Save name"
                        className="p-1.5 rounded-lg text-emerald-400 hover:bg-white/10 disabled:opacity-40"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 rounded-lg hover:bg-white/5">
                      <button
                        onClick={() => { selectPortfolio(p.uuid); setOpen(false); }}
                        className="flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-2.5 text-left"
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${p.uuid === current.uuid ? "bg-[#C49A3C]" : "bg-transparent"}`} />
                        <span className={`text-sm truncate ${p.uuid === current.uuid ? "text-white font-bold" : "text-[#a8a29e]"}`}>
                          {p.name}
                        </span>
                        {p.isDefault && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#78716c] shrink-0">Default</span>
                        )}
                      </button>
                      <button
                        onClick={() => { setRenamingUuid(p.uuid); setRenameValue(p.name); }}
                        aria-label={`Rename ${p.name}`}
                        className="p-1.5 rounded-lg text-[#78716c] hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!p.isDefault && (
                        <button
                          onClick={() => setToDelete(p)}
                          aria-label={`Delete ${p.name}`}
                          className="p-1.5 mr-1 rounded-lg text-[#78716c] hover:text-rose-400 hover:bg-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-white/10 p-2">
              {creating ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreate();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder="Portfolio name"
                    maxLength={80}
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-white/10 text-white text-sm outline-none border border-[#C49A3C]/40 placeholder:text-[#78716c]"
                  />
                  <button
                    onClick={handleCreate}
                    disabled={busy || !newName.trim()}
                    aria-label="Create portfolio"
                    className="p-2 rounded-lg text-emerald-400 hover:bg-white/10 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-bold text-[#C49A3C] hover:bg-white/5 transition-colors"
                >
                  <Plus className="h-4 w-4" /> New portfolio
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-medium text-rose-400">{error}</p>}

      {toDelete && (
        <ConfirmDialog
          title={`Delete "${toDelete.name}"?`}
          description="This permanently deletes this portfolio and every transaction, alert and report in it. This can't be undone."
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
