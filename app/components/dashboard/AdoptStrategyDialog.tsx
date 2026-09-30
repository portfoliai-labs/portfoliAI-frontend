// components/dashboard/AdoptStrategyDialog.tsx
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Target } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";

/**
 * ADOPT STRATEGY DIALOG — a backtest's "Adopt" in Manage portfolios: names a new portfolio and
 * creates it, empty, with the strategy as its policy (POST .../strategy/adopt, see models/Policy).
 * Each of the policy's ranges is an alert of the new portfolio's, which says where it stands
 * against it. It joins the list, selected.
 */
export function AdoptStrategyDialog({ strategyUuid, strategyName, onClose, onAdopted }: {
  strategyUuid: string;
  strategyName: string;
  onClose: () => void;
  onAdopted: (portfolioUuid: string) => void;
}) {
  const { adoptStrategy } = usePortfolio();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdopt = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const created = await adoptStrategy(strategyUuid, trimmed);
      onAdopted(created.uuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to adopt this strategy.");
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-sky-50 rounded-xl shrink-0">
            <Target className="h-5 w-5 text-sky-700" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">Adopt this strategy</h3>
            <p className="text-xs text-slate-500 truncate">{strategyName}</p>
          </div>
        </div>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          A new, empty portfolio, with this strategy&apos;s weights as its ranges. As you add transactions, its alerts
          show where it stands against each one.
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdopt();
            if (e.key === "Escape" && !busy) onClose();
          }}
          placeholder="New portfolio name"
          maxLength={80}
          aria-label="New portfolio name"
          aria-invalid={error !== null}
          className={`w-full h-11 px-3.5 rounded-xl bg-white text-sm font-semibold text-slate-900 outline-none border placeholder:text-slate-400 ${
            error ? "border-rose-400" : "border-slate-200 focus:border-sky-500/60 focus:ring-4 focus:ring-sky-500/10"
          }`}
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handleAdopt}
            disabled={busy || !name.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-sky-700 transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Create portfolio
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
