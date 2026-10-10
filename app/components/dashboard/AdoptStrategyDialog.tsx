// components/dashboard/AdoptStrategyDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowUpRight, Bell, Layers, Loader2, Mail, Target } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { adoptionService } from "../../services/adoptionService";
import { ApiError } from "../../services/apiClient";
import { isBacktest, type Portfolio } from "../../models/Portfolio";
import { Toggle } from "./Toggle";

// The destination select's last option: a portfolio made for it.
const NEW_PORTFOLIO = "__new__";

/**
 * ADOPT STRATEGY DIALOG — a backtest's "Adopt this strategy" (its page, and Plan's Strategy): puts
 * its strategy on a portfolio the user picks — a standard one or All portfolios, never a backtest
 * — or, last in the list, a new one created for it (POST /v1/portfolios, then the adoption). Each
 * target becomes an alert on that portfolio, saying where it stands against its range (see
 * models/AdoptedStrategy). A portfolio that already has one gets it replaced, which the dialog
 * says. Off by default, "watch each security as its asset class" adopts the strategy in
 * categories: a security without a category then fails (422), and the dialog offers to assign it
 * (`onOpenCategories`) or to adopt without converting.
 */
export function AdoptStrategyDialog({ strategyUuid, strategyName, onClose, onAdopted, onOpenCategories }: {
  strategyUuid: string;
  strategyName: string;
  onClose: () => void;
  // The portfolio that adopted it.
  onAdopted: (portfolioUuid: string) => void;
  onOpenCategories: () => void;
}) {
  const { portfolios, createPortfolio } = usePortfolio();
  // All portfolios first, then the default, then the others: the order of the list elsewhere.
  const destinations = portfolios.filter((p) => !isBacktest(p));
  const [target, setTarget] = useState(() => (destinations.find((p) => p.isDefault) ?? destinations[0])?.uuid ?? NEW_PORTFOLIO);
  const [newName, setNewName] = useState("");
  const [inCategories, setInCategories] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A security without a category, refused while adopting in categories.
  const [uncategorized, setUncategorized] = useState<string | null>(null);
  // The destination's current adoption's origin, when it has one: adopting replaces it.
  const [replacing, setReplacing] = useState<{ uuid: string; origin: string | null } | null>(null);

  const creating = target === NEW_PORTFOLIO;
  useEffect(() => {
    if (creating) return;
    let cancelled = false;
    adoptionService.get(target)
      .then((a) => { if (!cancelled) setReplacing(a ? { uuid: target, origin: a.originPortfolioUuid } : null); })
      .catch(() => { if (!cancelled) setReplacing(null); });
    return () => { cancelled = true; };
  }, [target, creating]);
  const replaced = !creating && replacing?.uuid === target ? replacing : null;
  const replacedOrigin = replaced?.origin ? portfolios.find((p) => p.uuid === replaced.origin)?.name : undefined;

  const adopt = async (convert: boolean) => {
    if (creating && !newName.trim()) return;
    setBusy(true);
    setError(null);
    setUncategorized(null);
    let destination: Portfolio | undefined;
    try {
      destination = creating ? await createPortfolio(newName.trim()) : portfolios.find((p) => p.uuid === target);
      if (!destination) return;
      await adoptionService.adopt(destination.uuid, {
        originPortfolioUuid: strategyUuid,
        inCategories: convert,
        notifyEmail,
        notifyInApp,
      });
      onAdopted(destination.uuid);
    } catch (err) {
      // The new portfolio stays, empty: the next try adopts into it.
      if (creating && destination) setTarget(destination.uuid);
      const kept = creating && destination ? ` “${destination.name}” was created, empty: you can try again on it.` : "";
      if (convert && err instanceof ApiError && err.errorType === "InvalidFieldError") {
        setUncategorized(`${err.message}${kept}`);
      } else {
        setError(`${err instanceof Error ? err.message : "Unable to adopt this strategy."}${kept}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !busy && onClose()}>
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 md:p-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
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
          Each of its targets becomes a range on the portfolio you pick, with an alert that says where the portfolio stands
          against it. Nothing is bought or sold.
        </p>

        <label className="block">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adopt on</span>
          <select
            value={target}
            onChange={(e) => { setTarget(e.target.value); setError(null); setUncategorized(null); }}
            disabled={busy}
            className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-sky-500/60 focus:ring-4 focus:ring-sky-500/10"
          >
            {destinations.map((p) => <option key={p.uuid} value={p.uuid}>{p.name}</option>)}
            <option value={NEW_PORTFOLIO}>+ New portfolio…</option>
          </select>
        </label>
        {creating && (
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") adopt(inCategories); }}
            placeholder="New portfolio name"
            maxLength={80}
            aria-label="New portfolio name"
            className="w-full h-11 px-3.5 rounded-xl bg-white text-sm font-semibold text-slate-900 outline-none border border-slate-200 placeholder:text-slate-400 focus:border-sky-500/60 focus:ring-4 focus:ring-sky-500/10"
          />
        )}
        {replaced && (
          <p className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-xs font-semibold text-amber-800">
            This portfolio already follows {replacedOrigin ? `“${replacedOrigin}”` : "an adopted strategy"}: adopting this one replaces it, and its
            alerts with it.
          </p>
        )}

        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 px-4">
          <div className="flex items-start justify-between gap-4 py-3">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Layers className="h-4 w-4 text-slate-400" /> Watch each security as its asset class</span>
              <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                A security&apos;s weight counts towards its asset class, as your asset categories have it, instead of on its own.
              </span>
            </span>
            <Toggle checked={inCategories} onChange={setInCategories} label="Watch each security as its asset class" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Bell className="h-4 w-4 text-slate-400" /> In-app notification</span>
            <Toggle checked={notifyInApp} onChange={setNotifyInApp} label="Notify in the app" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900"><Mail className="h-4 w-4 text-slate-400" /> Email</span>
            <Toggle checked={notifyEmail} onChange={setNotifyEmail} label="Notify by email" />
          </div>
        </div>

        {uncategorized && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
            <p className="flex items-start gap-2 text-xs font-semibold text-amber-800">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>A security in this strategy has no asset class, so it can&apos;t be watched as one. {uncategorized}</span>
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-5">
              <button type="button" onClick={onOpenCategories} className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-900 underline underline-offset-2">
                Assign its category <ArrowUpRight className="h-3 w-3" />
              </button>
              <button type="button" onClick={() => adopt(false)} disabled={busy} className="text-xs font-bold text-amber-900 underline underline-offset-2 disabled:opacity-50">
                Adopt without converting
              </button>
            </div>
          </div>
        )}
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={busy} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => adopt(inCategories)}
            disabled={busy || (creating && !newName.trim())}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-sky-700 transition-colors disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {creating ? "Create and adopt" : "Adopt"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
