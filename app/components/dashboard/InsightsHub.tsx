// components/dashboard/InsightsHub.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, Columns3, Compass, Layers, Loader2, MoreHorizontal, Pencil, Trash2, Wand2, X } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { portfolioColorMap } from "../../lib/chartColors";
import { NewPortfolioCard } from "./PortfolioBar";
import { ConfirmDialog } from "./ConfirmDialog";
import { PreviewBadge } from "../preview/PreviewKit";
import { RealEstateCard } from "../preview/RealEstateCard";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

const AGGREGATE_COLOR = "#C49A3C";

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

/**
 * INSIGHTS HUB — where Insights opens, and where portfolios are managed: a card per portfolio
 * ("All portfolios" first), each with its value, its return since inception and the curve
 * behind it, opening that portfolio's page (renamed or deleted from its "…" menu), a card
 * to create one, then the way into Compare. Alongside them sit the previews of what's coming
 * (see components/preview): a sample real estate portfolio, Explore and Strategy, each marked
 * as such. The figures for every card come
 * from one call (GET /v1/portfolios/comparison with no portfolio listed returns all of them),
 * refetched when a portfolio is added or removed.
 */
export function InsightsHub({
  onOpenPortfolio, onCompare, onOpenRealEstate, onExplore, onStrategy,
}: {
  onOpenPortfolio: (uuid: string) => void;
  onCompare: () => void;
  onOpenRealEstate: () => void;
  onExplore: () => void;
  onStrategy: () => void;
}) {
  const { portfolios, deletePortfolio } = usePortfolio();
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePortfolio(toDelete.uuid);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const uuidsKey = portfolios.map((p) => p.uuid).join(",");
  const [entries, setEntries] = useState<{ key: string; byUuid: Map<string, PortfolioComparisonEntry> | null }>({ key: "", byUuid: null });

  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare()
      .then((list) => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map(list.map((e) => [e.portfolio.uuid, e])) }); })
      .catch(() => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map() }); });
    return () => { cancelled = true; };
  }, [uuidsKey]);

  // Still loading until the answer for the current list of portfolios is in.
  const loaded = entries.key === uuidsKey;
  const canCompare = portfolios.filter((p) => !p.isAggregate).length >= 2;

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {portfolios.map((p) => (
          <PortfolioCard
            key={p.uuid}
            portfolio={p}
            color={p.isAggregate ? AGGREGATE_COLOR : colorOf(p.uuid)}
            // The previous figures stay up while a new list of portfolios loads.
            entry={entries.byUuid?.get(p.uuid) ?? (loaded ? null : undefined)}
            onOpen={() => onOpenPortfolio(p.uuid)}
            onDelete={() => setToDelete(p)}
          />
        ))}
        <RealEstateCard onOpen={onOpenRealEstate} />
        <NewPortfolioCard />
      </div>

      {/* Its own row, never beside a portfolio: same columns as above, so it keeps a tile's size. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <ActionCard
          icon={<Columns3 className="h-5 w-5" />}
          title="Compare"
          text={canCompare ? "Your portfolios side by side, up to four at once." : "Needs at least two portfolios."}
          onClick={canCompare ? onCompare : undefined}
        />
        <ActionCard
          icon={<Compass className="h-5 w-5" />}
          title="Explore"
          badge={<PreviewBadge dark />}
          text="Portfolios shared by other investors: browse them and like the ones you find interesting."
          onClick={onExplore}
        />
        <ActionCard
          icon={<Wand2 className="h-5 w-5" />}
          title="Strategy"
          badge={<PreviewBadge dark />}
          text="Set target weights, rebalancing, PAC and costs, then backtest them into a virtual portfolio."
          onClick={onStrategy}
        />
      </div>
      {deleteError && <p className="text-sm font-semibold text-rose-600">{deleteError}</p>}

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

/**
 * PORTFOLIO CARD — one portfolio on the hub, opening its own page (PortfolioHome) on a click. `entry` undefined
 * while loading, null when the backend has nothing for it (no figures computed yet, or the
 * request failed): the card still opens the portfolio, whose own page explains what's missing.
 *
 * A standard portfolio also has a "…" menu in its corner: Rename turns the name into a field
 * right on the card, Delete asks first (InsightsHub's ConfirmDialog). The default portfolio
 * can't be deleted (the backend answers 409), and "All portfolios", which is built
 * automatically, can be neither renamed nor deleted, so it has no menu.
 */
function PortfolioCard({
  portfolio, color, entry, onOpen, onDelete,
}: {
  portfolio: Portfolio;
  color: string;
  entry: PortfolioComparisonEntry | null | undefined;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { renamePortfolio } = usePortfolio();
  const value = entry?.value ?? null;
  const performance = entry?.performance ?? null;
  const totalReturn = performance?.totalReturnPct ?? null;
  const points = useMemo(() => (performance?.cumulativeReturnPct ? toChartPoints(performance.cumulativeReturnPct) : []), [performance]);

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(portfolio.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startRename = () => {
    setName(portfolio.name);
    setError(null);
    setRenaming(true);
  };
  const saveRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === portfolio.name) {
      setRenaming(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renamePortfolio(portfolio.uuid, trimmed);
      setRenaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="button"
      tabIndex={renaming ? -1 : 0}
      onClick={renaming ? undefined : onOpen}
      onKeyDown={(e) => {
        if (renaming || e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group min-h-44 h-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col gap-4 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40 ${
        renaming ? "" : "cursor-pointer hover:border-[#C49A3C]/50 hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {portfolio.isAggregate ? (
            <Layers className="h-4 w-4 shrink-0" style={{ color }} />
          ) : (
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
          )}
          {renaming ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") setRenaming(false);
              }}
              maxLength={80}
              aria-label="Portfolio name"
              className="flex-1 min-w-0 h-9 px-3 rounded-xl bg-white border border-[#C49A3C]/50 text-sm font-bold text-slate-900 outline-none focus:ring-4 focus:ring-[#C49A3C]/10"
            />
          ) : (
            <>
              <span className="text-lg font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {portfolio.name}
              </span>
              {portfolio.isDefault && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">Default</span>
              )}
            </>
          )}
        </div>
        {renaming ? (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={saveRename}
              disabled={saving || !name.trim()}
              aria-label="Save name"
              className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => setRenaming(false)} aria-label="Cancel" className="p-2 rounded-lg text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            {!portfolio.isAggregate && <PortfolioCardMenu canDelete={!portfolio.isDefault} onRename={startRename} onDelete={onDelete} />}
            <span className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#C49A3C] group-hover:text-white transition-colors">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </div>
        )}
      </div>
      {error && <p className="-mt-2 text-xs font-medium text-rose-600">{error}</p>}

      {entry === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
        </div>
      ) : value === null ? (
        <p className="flex-1 flex items-end text-[13px] font-semibold text-slate-400">No figures yet — add transactions to get started.</p>
      ) : (
        <div className="flex-1 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-black text-slate-900 tabular-nums truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {formatCurrency(value.marketValue, value.currency, 0)}
            </p>
            {totalReturn !== null && (
              <p className="text-[13px] font-bold tabular-nums mt-1">
                <span className={totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(totalReturn)}</span>
                <span className="text-slate-400 font-semibold"> since inception</span>
              </p>
            )}
          </div>
          {points.length >= 2 && (
            <div className="w-28 h-12 shrink-0">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 112, height: 48 }}>
                <LineChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PORTFOLIO CARD MENU — the "…" with Rename and Delete, on a portfolio card and at the top of
 * its page. Its clicks stop at the menu, so they never open the portfolio underneath. Closes on a pick, a click outside or Escape.
 */
export function PortfolioCardMenu({ canDelete, onRename, onDelete }: { canDelete: boolean; onRename: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };
  const itemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div ref={rootRef} className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Portfolio actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
          open ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        }`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-48 p-1.5 bg-white rounded-xl border border-slate-200 shadow-xl">
          <button role="menuitem" type="button" onClick={pick(onRename)} className={`${itemClass} text-slate-700 hover:bg-slate-50 hover:text-slate-900`}>
            <Pencil className="h-4 w-4 text-slate-400" /> Rename
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={pick(onDelete)}
            disabled={!canDelete}
            title={canDelete ? undefined : "The default portfolio can't be deleted"}
            className={`${itemClass} text-rose-600 hover:bg-rose-50 disabled:hover:bg-transparent`}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/** ACTION CARD — a way out of a hub page: dark, so it reads apart from the portfolio cards. */
// `children`: a line of live detail under the text (PortfolioHome's "3 rules, 1 triggered"…).
// `badge`: a pill beside the title (the previews' "Preview").
export function ActionCard({
  icon, title, text, onClick, className = "", children, badge,
}: { icon: React.ReactNode; title: string; text: string; onClick?: () => void; className?: string; children?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`group min-h-44 h-full text-left bg-[#1c1917] rounded-3xl p-5 md:p-6 flex flex-col justify-between gap-4 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60 ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center">{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />
      </div>
      <div>
        <p className="flex items-center gap-2 text-lg font-black text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}{badge}</p>
        <p className="text-[13px] text-stone-400 mt-1 leading-relaxed">{text}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </button>
  );
}
