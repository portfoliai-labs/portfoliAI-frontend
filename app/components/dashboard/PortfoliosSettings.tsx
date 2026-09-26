// components/dashboard/PortfoliosSettings.tsx
"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Loader2, Layers } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfolioColorMap } from "../../lib/chartColors";
import { ConfirmDialog } from "./ConfirmDialog";
import type { Portfolio } from "../../models/Portfolio";

/**
 * PORTFOLIOS SETTINGS — Settings → Portfolios: create, rename and delete the investor's
 * portfolios (the PortfolioBar on the portfolio pages only picks one, and creates). The
 * default portfolio can't be deleted (the backend's 409), and the automatic "All portfolios"
 * aggregate can be neither renamed nor deleted — it's listed, read-only, so the user sees
 * where it comes from.
 */
export function PortfoliosSettings() {
  const { portfolios, createPortfolio, renamePortfolio, deletePortfolio } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);

  const [renamingUuid, setRenamingUuid] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await createPortfolio(name);
      setNewName("");
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this portfolio.");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const inputClass = "flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-[#F7F5EF] border border-[#C49A3C]/40 text-[#1c1917] text-sm font-semibold outline-none focus:ring-4 focus:ring-[#C49A3C]/10";

  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-black text-[#1c1917]">Your portfolios</h2>
        <p className="text-sm text-[#78716c] mt-1">
          Rename or delete a portfolio. With two or more, &ldquo;All portfolios&rdquo; combines them automatically.
        </p>
      </div>

      <ul className="divide-y divide-[rgba(196,154,60,0.12)]">
        {portfolios.map((p) => (
          <li key={p.uuid} className="py-3 flex items-center gap-3">
            {p.isAggregate ? (
              <Layers className="h-4 w-4 shrink-0 text-[#a8a29e]" />
            ) : (
              <span className="w-4 flex justify-center shrink-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colorOf(p.uuid) }} />
              </span>
            )}

            {renamingUuid === p.uuid ? (
              <>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(p.uuid);
                    if (e.key === "Escape") setRenamingUuid(null);
                  }}
                  maxLength={80}
                  aria-label="Portfolio name"
                  className={inputClass}
                />
                <button
                  onClick={() => handleRename(p.uuid)}
                  disabled={busy || !renameValue.trim()}
                  aria-label="Save name"
                  className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setRenamingUuid(null)}
                  aria-label="Cancel"
                  className="p-2 rounded-lg text-[#78716c] hover:bg-[#F7F5EF]"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate text-sm font-bold text-[#1c1917]">{p.name}</span>
                {p.isDefault && <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Default</span>}
                {p.isAggregate ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#78716c]">Automatic</span>
                ) : (
                  <>
                    <button
                      onClick={() => { setRenamingUuid(p.uuid); setRenameValue(p.name); setError(null); }}
                      aria-label={`Rename ${p.name}`}
                      className="p-2 rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#F7F5EF]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {!p.isDefault && (
                      <button
                        onClick={() => setToDelete(p)}
                        aria-label={`Delete ${p.name}`}
                        className="p-2 rounded-lg text-[#78716c] hover:text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {creating ? (
        <div className="flex items-center gap-2">
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
            aria-label="New portfolio name"
            className={inputClass}
          />
          <button
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
            aria-label="Create portfolio"
            className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            onClick={() => { setCreating(false); setNewName(""); }}
            aria-label="Cancel"
            className="p-2 rounded-lg text-[#78716c] hover:bg-[#F7F5EF]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setCreating(true); setError(null); }}
          className="flex items-center gap-2 text-sm font-bold text-[#C49A3C] hover:text-[#b08930] transition-colors"
        >
          <Plus className="h-4 w-4" /> New portfolio
        </button>
      )}

      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

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
