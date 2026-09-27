// components/dashboard/PortfolioBar.tsx — the portfolio pickers: Compare's toggles and the
// hub's "New portfolio" card.
"use client";

import { useState, useMemo } from "react";
import { Plus, Check, Loader2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfolioColorMap } from "../../lib/chartColors";

// More columns than this stop fitting a comparison table a person can read across.
export const MAX_COMPARED = 4;

/**
 * COMPARE PICKER — which portfolios Compare puts side by side: one toggle pill per portfolio,
 * in its colour (portfolioColorMap, the same as in every chart), up to MAX_COMPARED at once,
 * the aggregate included if picked. Sits in Compare's header panel (PortfolioPageHeader).
 */
export function ComparePicker({
  selection, onToggle,
}: { selection: string[]; onToggle: (uuid: string) => void }) {
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const full = selection.length >= MAX_COMPARED;

  return (
    // The pills scroll sideways on a narrow screen.
    <div className="flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
      {portfolios.map((p) => {
        const on = selection.includes(p.uuid);
        const disabled = !on && full;
        return (
          <button
            key={p.uuid}
            onClick={() => onToggle(p.uuid)}
            disabled={disabled}
            aria-pressed={on}
            className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-bold transition-colors ${
              on
                ? "bg-[#1c1917] border-[#1c1917] text-white"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
            } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
          >
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
              style={{
                background: on ? colorOf(p.uuid) : "transparent",
                border: `2px solid ${p.isAggregate ? "#a8a29e" : colorOf(p.uuid)}`,
              }}
            >
              {on && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
            </span>
            <span className="whitespace-nowrap">{p.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * NEW PORTFOLIO CARD — the last card of the Insights hub's portfolio grid: a dashed "New
 * portfolio" tile that turns into a name field. Creating one selects it (see
 * PortfolioContext.createPortfolio) and its card joins the grid.
 */
export function NewPortfolioCard() {
  const { createPortfolio } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await createPortfolio(trimmed);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this portfolio.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-44 h-full w-full rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#C49A3C] hover:border-[#C49A3C] transition-colors"
      >
        <Plus className="h-6 w-6" />
        <span className="text-[13px] font-bold">New portfolio</span>
      </button>
    );
  }

  return (
    <div className="min-h-44 h-full rounded-3xl border-2 border-dashed border-[#C49A3C]/50 bg-white p-5 flex flex-col justify-center gap-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCreate();
          if (e.key === "Escape") close();
        }}
        placeholder="Portfolio name"
        maxLength={80}
        aria-label="New portfolio name"
        aria-invalid={error !== null}
        className={`w-full px-3.5 py-2.5 rounded-xl bg-white text-sm text-slate-900 outline-none border placeholder:text-slate-400 ${
          error ? "border-rose-400" : "border-slate-200 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        }`}
      />
      {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={close} className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || !name.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Create
        </button>
      </div>
    </div>
  );
}
