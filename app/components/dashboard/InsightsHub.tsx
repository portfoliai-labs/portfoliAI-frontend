// components/dashboard/InsightsHub.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BellRing, Columns3, Compass, FileText, History, Receipt, Settings2, Telescope, Wand2 } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { realEstateHolderItem } from "../preview/RealEstateCard";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { useUser } from "../../context/UserContext";
import { PreviewBadge } from "../preview/PreviewKit";
import { VIRTUAL_COLOR, VirtualBadge } from "./BacktestMarks";
import { FeaturedCard, PortfolioHolder, portfolioHolderItem, type HolderItem } from "./PortfolioHolder";
import type { Portfolio } from "../../models/Portfolio";
import type { InvestmentsPage } from "./InsightsSection";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// The virtual portfolios' cards in their holder: shades of VIRTUAL_COLOR, one per card.
const VIRTUAL_SHADES = [VIRTUAL_COLOR, "#0e7490", "#1d4ed8", "#0891b2", "#3b82f6", "#0369a1"];

/**
 * INVESTMENTS HUB — Manage / Investments: every portfolio on one row, in three columns. First
 * "All portfolios" (the aggregate: every real portfolio together, there with two or more) on a big
 * card as tall as the row (FeaturedPortfolioCard), or the only real portfolio while there's just
 * one, two columns wide when there's nothing else to hold; then the real portfolios (the default
 * first) and, for a demo account, the sample real estate (a preview), gathered in a card holder
 * (PortfolioHolder), which pulls each one out on hover to show its return and the curve behind it;
 * then the strategies backtested with Strategy (models/Strategy) in a holder of their own, in their
 * blue (BacktestMarks), or the way to backtest one while there are none. The sleeves sit on one
 * line, each stack rising from it. A card opens its portfolio's Insights. Portfolios are added
 * only under Manage portfolios (every portfolio in one list, to rename, delete or add:
 * ManagePortfolios), the first of the cards under them; then Transactions, Reports and Alerts (each
 * picking a portfolio at its top), Compare, Strategy, Explore (portfolios other investors share; a
 * demo account's preview) and Discovery (searching for new assets; coming soon). The figures for
 * every card come from one call (GET /v1/portfolios/comparison with no portfolio listed returns all
 * of them), refetched when a portfolio is added or removed.
 */
export function InsightsHub({
  trail, onOpenPortfolio, onCompare, onOpenRealEstate, onStrategy, onExplore, onOpenPage,
}: {
  // The pages above it ("Manage").
  trail: Crumb[];
  onOpenPortfolio: (uuid: string) => void;
  onCompare: () => void;
  onOpenRealEstate: () => void;
  onStrategy: () => void;
  onExplore: () => void;
  onOpenPage: (page: InvestmentsPage) => void;
}) {
  const { portfolios } = usePortfolio();
  const { isDemo } = useUser();
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
  // "All portfolios" gets the big card; without it (a single real portfolio) that one does.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const featured = aggregate ?? real[0];
  const held = aggregate ? real : [];
  const realItems: HolderItem[] = [
    ...held.map((p) => portfolioHolderItem(p, colorOf(p.uuid), entryOf(p.uuid), () => onOpenPortfolio(p.uuid))),
    ...(isDemo ? [realEstateHolderItem(onOpenRealEstate)] : []),
  ];
  // Nothing to hold (one real portfolio, not a demo account): its card takes the room instead.
  const holdsAny = realItems.length > 0;
  const virtualItems = portfolios.filter((p) => p.isVirtual && !p.isAggregate).map((p, i) =>
    portfolioHolderItem(p, VIRTUAL_SHADES[i % VIRTUAL_SHADES.length], entryOf(p.uuid), () => onOpenPortfolio(p.uuid)));

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Investments" />
      {/* One row: all portfolios together as tall as the row, then the holders, their sleeves on one
          line and each stack rising from it as high as its cards go. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-end">
        {featured && (
          <FeaturedPortfolioCard
            portfolio={featured}
            color={colorOf(featured.uuid)}
            entry={entryOf(featured.uuid)}
            onOpen={() => onOpenPortfolio(featured.uuid)}
            alone={!holdsAny}
          />
        )}
        {holdsAny && <PortfolioHolder items={realItems} label={held.length > 0 ? `${held.length} portfolios` : "Portfolios"} />}
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
          icon={<Settings2 className="h-5 w-5" />}
          title="Manage portfolios"
          text="Rename, delete or add portfolios, all in one list."
          onClick={() => onOpenPage("portfolios")}
        />
        <ActionCard
          icon={<Receipt className="h-5 w-5" />}
          title="Transactions"
          text="Every portfolio's buys, sells and dividends: add, import or edit them, one portfolio or all at once."
          onClick={() => onOpenPage("transactions")}
        />
        <ActionCard
          icon={<FileText className="h-5 w-5" />}
          title="Reports"
          text="Full-history PDF reports for each portfolio, generated on demand."
          onClick={() => onOpenPage("reports")}
        />
        <ActionCard
          icon={<BellRing className="h-5 w-5" />}
          title="Alerts"
          text="Get notified when a portfolio or one of its holdings moves past your limits."
          onClick={() => onOpenPage("alerts")}
        />
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
        {/* A preview on sample data (components/preview): demo accounts only. */}
        {isDemo && (
          <ActionCard
            icon={<Compass className="h-5 w-5" />}
            title="Explore"
            badge={<PreviewBadge dark />}
            text="Browse portfolios other investors share: what they hold, how they did, how many copied them."
            onClick={onExplore}
          />
        )}
        {/* Not built yet: there's no asset search to back it (only GET /v1/assets/{ticker}). */}
        <ActionCard
          icon={<Telescope className="h-5 w-5" />}
          title="Discovery"
          badge={<PreviewBadge dark label="Soon" />}
          text="Search and explore new assets — stocks, ETFs, bonds, crypto — before adding them to a portfolio."
        />
      </div>
    </div>
  );
}

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const formatSigned = (amount: number, currency: string) => `${amount >= 0 ? "+" : ""}${formatCurrency(amount, currency, 0)}`;

/**
 * FEATURED PORTFOLIO CARD — the hub's "All portfolios" (or its only real portfolio) on the row's
 * FeaturedCard: its value, return since inception and a year, what went in and the gain on what's
 * still held, and the return curve. `entry` undefined while loading, null when there's nothing yet.
 */
function FeaturedPortfolioCard({ portfolio, color, entry, onOpen, alone = false }: {
  portfolio: Portfolio;
  color: string;
  entry: PortfolioComparisonEntry | null | undefined;
  onOpen: () => void;
  // The only real portfolio: two columns wide, where the holder would be.
  alone?: boolean;
}) {
  const value = entry?.value ?? null;
  const performance = entry?.performance ?? null;
  const totalReturn = performance?.totalReturnPct ?? null;
  const points = useMemo(() => (performance?.cumulativeReturnPct ? toChartPoints(performance.cumulativeReturnPct) : []), [performance]);

  return (
    <FeaturedCard
      className={alone ? "sm:col-span-2" : ""}
      eyebrow={portfolio.isAggregate ? "Every portfolio together" : "Your portfolio"}
      name={portfolio.name}
      badge={portfolio.isAggregate ? <VirtualBadge portfolio={portfolio} /> : portfolio.isDefault ? (
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

/** ACTION CARD — a way out of a hub page: dark, so it reads apart from the portfolio cards. */
// `children`: a line of live detail under the text (the real estate preview's "2 active"…).
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
