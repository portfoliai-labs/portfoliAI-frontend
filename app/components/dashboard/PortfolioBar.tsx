// components/dashboard/PortfolioBar.tsx
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, Check, Loader2, Layers, Columns3, X, Settings2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfolioColorMap } from "../../lib/chartColors";

// More columns than this stop fitting a comparison table a person can read across.
export const MAX_COMPARED = 4;

/** Opens Settings on its Portfolios tab (via the URL hash SettingsSection reads on mount). */
export function openPortfolioSettings(onNavigate: (section: string) => void) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#portfolios`);
  onNavigate("settings");
}

/**
 * PORTFOLIO BAR — "which portfolio" at the top of the portfolio pages (Insights,
 * Transactions), kept apart from the sidebar, which only says "which page". One pill per
 * portfolio, in its colour (portfolioColorMap, the same as in every chart).
 *
 * Two modes, one control:
 * - single: the pills pick the selected portfolio (PortfolioContext), and "+" creates one;
 * - compare (Insights only, once there are 2+ standard portfolios): the same pills become
 *   toggles for up to MAX_COMPARED portfolios, the aggregate included if picked.
 * Rename/delete aren't here — they're management, not navigation (Settings → Portfolios,
 * which the gear opens).
 */
export function PortfolioBar({
  comparing = false, compareSelection = [], onToggleCompare, onEnterCompare, onExitCompare, onManage,
}: {
  comparing?: boolean;
  compareSelection?: string[];
  onToggleCompare?: (uuid: string) => void;
  // Omitted where comparing makes no sense (Transactions): no Compare button then.
  onEnterCompare?: () => void;
  onExitCompare?: () => void;
  onManage?: () => void;
}) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const canCompare = onEnterCompare !== undefined && portfolios.filter((p) => !p.isAggregate).length >= 2;
  const full = compareSelection.length >= MAX_COMPARED;

  if (!current) return null;

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* The pills scroll sideways on a narrow screen; the actions stay put at the end. */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-1 -mb-1">
          {portfolios.map((p) => {
            const on = comparing ? compareSelection.includes(p.uuid) : p.uuid === current.uuid;
            const disabled = comparing && !on && full;
            return (
              <button
                key={p.uuid}
                onClick={() => (comparing ? onToggleCompare?.(p.uuid) : selectPortfolio(p.uuid))}
                disabled={disabled}
                aria-pressed={on}
                className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full border text-[13px] font-bold transition-colors ${
                  on
                    ? "bg-[#1c1917] border-[#1c1917] text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                {comparing ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: on ? colorOf(p.uuid) : "transparent", border: `2px solid ${p.isAggregate ? "#a8a29e" : colorOf(p.uuid)}` }}
                  >
                    {on && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
                  </span>
                ) : p.isAggregate ? (
                  <Layers className={`h-3.5 w-3.5 shrink-0 ${on ? "text-[#C49A3C]" : "text-slate-400"}`} />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(p.uuid) }} />
                )}
                <span className="whitespace-nowrap">{p.name}</span>
              </button>
            );
          })}
          {!comparing && <NewPortfolioButton />}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {comparing ? (
            <button
              onClick={onExitCompare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold bg-[#C49A3C] text-white hover:bg-[#b08930] transition-colors"
            >
              <X className="h-3.5 w-3.5" /> Compare
            </button>
          ) : canCompare && (
            <button
              onClick={onEnterCompare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-bold text-slate-600 border border-slate-200 bg-white hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
            >
              <Columns3 className="h-3.5 w-3.5" /> Compare
            </button>
          )}
          {onManage && !comparing && (
            <button
              onClick={onManage}
              aria-label="Manage portfolios"
              title="Manage portfolios"
              className="p-2 rounded-full text-slate-400 border border-transparent hover:text-slate-700 hover:border-slate-200 hover:bg-white transition-colors"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {comparing && (
        <p className="text-xs text-slate-400 mt-2">
          {full
            ? `Up to ${MAX_COMPARED} at a time — deselect one to pick another.`
            : "Pick the portfolios to compare."}
        </p>
      )}
    </div>
  );
}

/**
 * NEW PORTFOLIO — "+" at the end of the pills, opening an inline name field. Creating one
 * selects it (see PortfolioContext.createPortfolio).
 */
function NewPortfolioButton() {
  const { createPortfolio } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setName("");
        setError(null);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

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
        onClick={() => setOpen(true)}
        aria-label="New portfolio"
        title="New portfolio"
        className="shrink-0 p-2 rounded-full border border-dashed border-slate-300 text-slate-400 hover:text-[#C49A3C] hover:border-[#C49A3C] transition-colors"
      >
        <Plus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={rootRef} className="shrink-0 flex items-center gap-1.5">
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
        title={error ?? undefined}
        className={`w-44 px-3.5 py-2 rounded-full bg-white text-sm text-slate-900 outline-none border placeholder:text-slate-400 ${
          error ? "border-rose-400" : "border-[#C49A3C]/50 focus:ring-4 focus:ring-[#C49A3C]/10"
        }`}
      />
      <button
        onClick={handleCreate}
        disabled={busy || !name.trim()}
        aria-label="Create portfolio"
        className="p-2 rounded-full text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </button>
      {error && <span className="text-xs font-medium text-rose-600 whitespace-nowrap">{error}</span>}
    </div>
  );
}
