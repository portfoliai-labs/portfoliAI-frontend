// components/dashboard/PortfolioActions.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Pencil } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { PortfolioCardMenu } from "./InsightsHub";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PORTFOLIO ACTIONS — a portfolio's "…" with Rename and Delete, at the top right of its Insights
 * (a card on Investments opens straight there). "All portfolios", built automatically, has
 * neither, and a demo account (see lib/demo) can't change anything, so both get nothing.
 */
export function PortfolioActions({ portfolio, onDeleted }: { portfolio: Portfolio; onDeleted: () => void }) {
  const { deletePortfolio } = usePortfolio();
  const { isDemo } = useUser();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (portfolio.isAggregate || isDemo) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deletePortfolio(portfolio.uuid);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      <PortfolioCardMenu canDelete={!portfolio.isDefault} onRename={() => setRenaming(true)} onDelete={() => setConfirmDelete(true)} />
      {renaming && <RenamePortfolioDialog portfolio={portfolio} onClose={() => setRenaming(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${portfolio.name}"?`}
          description="This permanently deletes this portfolio and every transaction, alert and report in it. This can't be undone."
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/**
 * RENAME PORTFOLIO DIALOG — PortfolioActions' Rename: a small dialog with the name, in the
 * same shell as ConfirmDialog.
 */
function RenamePortfolioDialog({ portfolio, onClose }: { portfolio: Portfolio; onClose: () => void }) {
  const { renamePortfolio } = usePortfolio();
  const [name, setName] = useState(portfolio.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === portfolio.name) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renamePortfolio(portfolio.uuid, trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0">
            <Pencil className="h-5 w-5 text-[#C49A3C]" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Rename portfolio</h3>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          maxLength={80}
          aria-label="Portfolio name"
          className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
