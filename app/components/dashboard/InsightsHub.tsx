// components/dashboard/InsightsHub.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Columns3, History, MoreHorizontal, Pencil, Telescope, Trash2, Wand2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { NewPortfolioDialog } from "./PortfolioBar";
import { realEstateHolderItem } from "../preview/RealEstateCard";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { PreviewBadge } from "../preview/PreviewKit";
import { VIRTUAL_COLOR } from "./BacktestMarks";
import { FeaturedCard, PortfolioHolder, portfolioHolderItem, type HolderItem } from "./PortfolioHolder";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// The virtual portfolios' cards in their holder: shades of VIRTUAL_COLOR, one per card.
const VIRTUAL_SHADES = [VIRTUAL_COLOR, "#0e7490", "#1d4ed8", "#0891b2", "#3b82f6", "#0369a1"];

/**
 * INVESTMENTS HUB — Assets / Investments: every portfolio on one row, in three columns. First the
 * real portfolio with the most money invested, on a big card as tall as the row
 * (FeaturedPortfolioCard); then the other real ones (the default first) and, for a demo account,
 * the sample real estate (a preview), gathered in a card holder (PortfolioHolder), which pulls
 * each one out on hover to show its return and the curve behind it, with at its front the card that
 * creates a portfolio (NewPortfolioDialog); then the virtual ones ("All portfolios", every real portfolio
 * together, there with two or more, and the strategies backtested with Strategy, see
 * models/Strategy) in a holder of their own, in their blue (BacktestMarks), or the way to
 * backtest one while there are none. The sleeves sit on one line, each stack rising from it. A
 * card opens its portfolio's page, where it's renamed or deleted. Under them, Compare, Strategy
 * and Discovery (searching for new assets; coming soon). A demo
 * account (see lib/demo) can't create anything. The figures for every card come from one call
 * (GET /v1/portfolios/comparison with no portfolio listed returns all of them), refetched when a
 * portfolio is added or removed.
 */
export function InsightsHub({
  trail, onOpenPortfolio, onCompare, onOpenRealEstate, onStrategy,
}: {
  // The pages above it ("Assets").
  trail: Crumb[];
  onOpenPortfolio: (uuid: string) => void;
  onCompare: () => void;
  onOpenRealEstate: () => void;
  onStrategy: () => void;
}) {
  const { portfolios } = usePortfolio();
  const { isDemo } = useUser();
  const [creating, setCreating] = useState(false);
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

  // Still loading until the answer for the current list of portfolios is in; the previous figures
  // stay up meanwhile.
  const loaded = entries.key === uuidsKey;
  const entryOf = (uuid: string) => entries.byUuid?.get(uuid) ?? (loaded ? null : undefined);
  const canCompare = portfolios.filter((p) => !p.isAggregate).length >= 2;

  // The default portfolio leads (the list already puts it first among the real ones).
  const real = portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  // The one with the most money invested gets the big card; the default until the figures are in.
  const invested = (uuid: string) => entries.byUuid?.get(uuid)?.value?.investedCapital ?? -1;
  const featured = real.reduce<typeof real[number] | undefined>((best, p) => (!best || invested(p.uuid) > invested(best.uuid) ? p : best), undefined);
  const others = real.filter((p) => p !== featured);
  const realItems: HolderItem[] = [
    ...others.map((p) => portfolioHolderItem(p, colorOf(p.uuid), entryOf(p.uuid), () => onOpenPortfolio(p.uuid))),
    ...(isDemo ? [realEstateHolderItem(onOpenRealEstate)] : []),
    // At the front, the way to add one: a dialog for its name. A demo account can't.
    {
      key: "new-portfolio",
      name: "New portfolio",
      color: "",
      add: true,
      value: null,
      headline: null,
      points: [],
      empty: isDemo ? DEMO_DISABLED_TITLE : "Start another portfolio: its own transactions, insights, reports and alerts.",
      cta: isDemo ? "Not available" : "Create",
      onOpen: () => { if (!isDemo) setCreating(true); },
    },
  ];
  const portfolioCount = others.length;
  const virtualItems = portfolios.filter((p) => p.isVirtual).map((p, i) =>
    portfolioHolderItem(p, VIRTUAL_SHADES[i % VIRTUAL_SHADES.length], entryOf(p.uuid), () => onOpenPortfolio(p.uuid)));

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Investments" />
      {/* One row: the largest portfolio as tall as the row, then the holders, their sleeves on one
          line and each stack rising from it as high as its cards go. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-end">
        {featured && (
          <FeaturedPortfolioCard
            portfolio={featured}
            color={colorOf(featured.uuid)}
            entry={entryOf(featured.uuid)}
            onOpen={() => onOpenPortfolio(featured.uuid)}
          />
        )}
        <PortfolioHolder items={realItems} label={portfolioCount > 0 ? `${portfolioCount} more` : "Portfolios"} />
        {virtualItems.length > 0 ? (
          <PortfolioHolder items={virtualItems} label={`${virtualItems.length} virtual`} tone="virtual" />
        ) : (
          <button
            type="button"
            onClick={onStrategy}
            className="min-h-44 w-full rounded-3xl border-2 border-dashed border-sky-300 bg-sky-50/40 flex flex-col items-center justify-center gap-2 px-6 text-center text-sky-700 hover:border-sky-500 transition-colors"
          >
            <History className="h-6 w-6" />
            <span className="text-[13px] font-bold">No virtual portfolios yet</span>
            <span className="text-[11px] font-semibold text-sky-700/70">Backtest a strategy and it shows up here.</span>
          </button>
        )}
      </div>

      {/* The ways on from here, in a row of their own under the portfolios: same columns as above. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <ActionCard
          icon={<Columns3 className="h-5 w-5" />}
          title="Compare"
          text={canCompare ? "Your portfolios side by side, up to four at once." : "Needs at least two portfolios."}
          onClick={canCompare ? onCompare : undefined}
        />
        <ActionCard
          icon={<Wand2 className="h-5 w-5" />}
          title="Strategy"
          text="Set target weights, rebalancing, PAC and costs, then backtest them on historical prices into a virtual portfolio."
          onClick={onStrategy}
        />
        {/* Not built yet: there's no asset search to back it (only GET /v1/assets/{ticker}). */}
        <ActionCard
          icon={<Telescope className="h-5 w-5" />}
          title="Discovery"
          badge={<PreviewBadge dark label="Soon" />}
          text="Search and explore new assets — stocks, ETFs, bonds, crypto — before adding them to a portfolio."
        />
      </div>
      {creating && <NewPortfolioDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const formatSigned = (amount: number, currency: string) => `${amount >= 0 ? "+" : ""}${formatCurrency(amount, currency, 0)}`;

/**
 * FEATURED PORTFOLIO CARD — the hub's largest real portfolio (by money invested) on the row's
 * FeaturedCard: its value, return since inception and a year, what went in and the gain on what's
 * still held, and the return curve. `entry` undefined while loading, null when there's nothing yet.
 */
function FeaturedPortfolioCard({ portfolio, color, entry, onOpen }: {
  portfolio: Portfolio;
  color: string;
  entry: PortfolioComparisonEntry | null | undefined;
  onOpen: () => void;
}) {
  const value = entry?.value ?? null;
  const performance = entry?.performance ?? null;
  const totalReturn = performance?.totalReturnPct ?? null;
  const points = useMemo(() => (performance?.cumulativeReturnPct ? toChartPoints(performance.cumulativeReturnPct) : []), [performance]);

  return (
    <FeaturedCard
      eyebrow="Largest portfolio"
      name={portfolio.name}
      badge={portfolio.isDefault ? (
        <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">Default</span>
      ) : undefined}
      color={color}
      value={entry === undefined ? undefined : value ? formatCurrency(value.marketValue, value.currency, 0) : null}
      line={totalReturn !== null && (
        <>
          <span className={totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(totalReturn)}</span>
          <span className="text-slate-400 font-semibold"> since inception</span>
          {performance?.annualizedReturnPct != null && (
            <span className="text-slate-400 font-semibold"> · {formatPct(performance.annualizedReturnPct)} a year</span>
          )}
        </>
      )}
      figures={value ? [
        { label: "Invested", value: formatCurrency(value.investedCapital, value.currency, 0) },
        { label: "Unrealized", value: formatSigned(value.unrealizedPnl, value.currency), tone: value.unrealizedPnl >= 0 ? "gain" : "loss" },
      ] : []}
      points={points}
      empty="No figures yet — add transactions to get started."
      onOpen={onOpen}
    />
  );
}

/**
 * PORTFOLIO CARD MENU — the "…" with Rename and Delete, at the top of a portfolio's page. Its clicks stop at the menu, so they never open the portfolio underneath. Closes on a pick, a click outside or Escape.
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
