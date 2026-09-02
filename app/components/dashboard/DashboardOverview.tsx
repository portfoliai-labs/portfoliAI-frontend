// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { portfolioService } from "../../services/portfolioService";
import { userService } from "../../services/userService";
import type { PortfolioSummary, PortfolioSnapshot, CurrencyBreakdown, Holding, AssetRealizedTrade } from "../../models/Portfolio";
import { formatCurrency, formatQuantity } from "../../lib/format";

// Below this many closed sells, a win rate is more noise than signal — this is a
// long-horizon investing product, not a trading platform, so the metric is withheld
// rather than shown with false precision on a handful of trades.
const MIN_SELLS_FOR_WIN_RATE = 20;

export default function DashboardOverview() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [preferredCurrency, setPreferredCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [data, profile] = await Promise.all([
          portfolioService.getPortfolioOverview(),
          userService.getUserProfile(),
        ]);
        setPortfolio(data.summary);
        setSnapshots(data.snapshots);
        setPreferredCurrency(profile.currency ?? null);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const holdings = portfolio?.holdings ?? [];
  const byCurrency = portfolio?.byCurrency ?? [];
  const realizedTradesByAsset = portfolio?.realizedTradesByAsset ?? [];

  // Snapshots are always tagged with the user's reference-currency preference — sorted
  // oldest→newest since the backend doesn't guarantee ordering.
  const sortedSnapshots = [...snapshots].sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime());
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

  // The multi-currency apparatus (tabs, breakdowns, the "in your own currency" note) only
  // earns its place when there's something to disambiguate — i.e. either more than one
  // native currency, or a single native currency that isn't the reference currency.
  const isSingleCurrencyMatchingReference = !!latestSnapshot
    && byCurrency.length === 1
    && byCurrency[0].currency === latestSnapshot.currency;
  const showCurrencyDisclosure = !isSingleCurrencyMatchingReference;

  return (
    <div className="px-0 py-6 space-y-8">

      {/* MASTHEAD */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">Portfolio</p>
          <h1
            className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Dashboard Overview
          </h1>
          <p className="text-slate-500 font-medium mt-1">Track your portfolio performance.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white text-xs text-slate-500 font-medium">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            Positions below come from your recorded transactions — live value updates once a day
          </div>
        </div>
      </div>

      {/* BLOCK 1 — YOUR PORTFOLIO TODAY. Answers "what's it all worth?" — the one place
          currencies are summed together, because that's the only way to answer that question. */}
      <PortfolioTodayModule snapshots={sortedSnapshots} byCurrency={byCurrency} showInvestedBreakdown={showCurrencyDisclosure} />

      {/* BLOCK 2 — COMPOSITION. Answers "where does the money sit?" */}
      <PerCurrencyModule
        byCurrency={byCurrency}
        holdings={holdings}
        preferredCurrency={preferredCurrency}
        title="Composition"
        renderDesc={compositionDesc}
        renderBody={CompositionBody}
      />

      {/* BLOCK 3 — YOUR ACTIVITY. Answers "what did I actually do, and what did it cost?" */}
      <div className="space-y-5">
        {/* COSTS — commented out for now, not removed: undecided whether to keep it.
        <PerCurrencyModule
          byCurrency={byCurrency}
          holdings={holdings}
          preferredCurrency={preferredCurrency}
          title="Costs"
          renderDesc={costsDesc}
          renderRight={costsRight}
          renderBody={CostsBody}
        />
        */}
        <PerCurrencyModule
          byCurrency={byCurrency}
          holdings={holdings}
          trades={realizedTradesByAsset}
          preferredCurrency={preferredCurrency}
          title="Realized P&L"
          renderDesc={realizedPlDesc}
          renderRight={realizedPlRight}
          renderBody={RealizedPLBody}
        />
      </div>

      {/* POSITIONS — detail table, every currency together, since nothing here is summed */}
      <HoldingsExplorer holdings={holdings} />

    </div>
  );
}

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * PER-CURRENCY MODULE — one Module/card whose head (currency label, description, right-side
 * content) and body independently page through every native currency present. A single
 * currency renders with no nav chrome at all (nothing to switch between). With more than
 * one, the currency switcher lives inside this card's own head — no shared selector above
 * multiple cards, and each card's carousel position is independent of the others'. When
 * `renderBody` is given, the body is a native scroll-snap track (swipe/scroll, or use the
 * arrows/dots) that scrolls in sync with the head; when omitted (a card with no body, e.g.
 * Realized P&L below), only the head's arrows/dots page through currencies.
 */
function PerCurrencyModule({
  byCurrency, holdings, trades = [], preferredCurrency, title, renderDesc, renderRight, renderBody,
}: {
  byCurrency: CurrencyBreakdown[];
  holdings: Holding[];
  trades?: AssetRealizedTrade[];
  preferredCurrency: string | null;
  title: string;
  renderDesc?: (data: CurrencyBreakdown) => string | undefined;
  renderRight?: (data: CurrencyBreakdown) => React.ReactNode;
  renderBody?: (data: CurrencyBreakdown, holdings: Holding[], trades: AssetRealizedTrade[]) => React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const preferredIndex = Math.max(0, byCurrency.findIndex(cb => cb.currency === preferredCurrency));
  const [activeIndex, setActiveIndex] = useState(preferredIndex);

  // Land on the preferred currency's slide immediately on mount, no animation — this is
  // establishing the initial view, not a user-triggered navigation.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || preferredIndex === 0) return;
    track.scrollLeft = preferredIndex * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (byCurrency.length === 0) return null;

  const multi = byCurrency.length > 1;
  const active = byCurrency[activeIndex] ?? byCurrency[0];
  const activeHoldings = holdings.filter(h => h.currency === active.currency);
  const activeTrades = trades.filter(t => t.currency === active.currency);

  const scrollToIndex = (i: number) => {
    const clamped = Math.max(0, Math.min(byCurrency.length - 1, i));
    setActiveIndex(clamped);
    const track = trackRef.current;
    if (track) track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <Module>
      <ModuleHead
        eyebrow={active.currency}
        title={title}
        desc={renderDesc?.(active)}
        right={
          <div className="flex items-center gap-3">
            {renderRight?.(active)}
            {multi && (
              <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                <button
                  onClick={() => scrollToIndex(activeIndex - 1)}
                  disabled={activeIndex === 0}
                  aria-label="Previous currency"
                  className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <div className="flex items-center gap-1">
                  {byCurrency.map((cb, i) => (
                    <button
                      key={cb.currency}
                      onClick={() => scrollToIndex(i)}
                      aria-label={`Go to ${cb.currency}`}
                      className={`h-1.5 rounded-full transition-all ${i === activeIndex ? "w-4 bg-slate-900" : "w-1.5 bg-slate-300"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => scrollToIndex(activeIndex + 1)}
                  disabled={activeIndex === byCurrency.length - 1}
                  aria-label="Next currency"
                  className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 disabled:opacity-30 hover:bg-slate-50 transition-colors"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        }
      />
      {renderBody && (
        multi ? (
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {byCurrency.map((cb) => (
              <div key={cb.currency} className="w-full shrink-0 snap-center">
                {renderBody(cb, holdings.filter(h => h.currency === cb.currency), trades.filter(t => t.currency === cb.currency))}
              </div>
            ))}
          </div>
        ) : (
          renderBody(active, activeHoldings, activeTrades)
        )
      )}
    </Module>
  );
}

const compositionDesc = (data: CurrencyBreakdown) =>
  `${data.holdingsCount} ${data.holdingsCount === 1 ? "holding" : "holdings"}, weighted by invested capital.`;

function CompositionBody(data: CurrencyBreakdown, holdings: Holding[]) {
  const { currency } = data;
  const byAssetItems = holdings.map(h => ({ label: h.ticker ?? h.isin ?? h.name, value: h.investedValue }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
      <AllocPanel title="By asset" subtitle="Individual positions">
        <CompositionDonut items={byAssetItems} currency={currency} />
      </AllocPanel>
      <AllocPanel title="By category" subtitle="Asset class">
        <CompositionDonut
          items={data.purchasesByAssetClass.map(a => ({ label: a.assetClass, value: a.totalInvested }))}
          currency={currency}
        />
      </AllocPanel>
      <AllocPanel title="By broker" subtitle="Where your orders were placed">
        <CompositionDonut
          items={data.purchasesByBroker.map(b => ({ label: b.broker, value: b.totalInvested }))}
          currency={currency}
        />
      </AllocPanel>
    </div>
  );
}

// COSTS — commented out for now alongside its call site above, not removed: undecided
// whether to keep this section.
// const costsDesc = () => "Commissions and fees from your recorded transactions.";
//
// const costsRight = (data: CurrencyBreakdown) => (
//   <Scoreboard items={[{ label: "Total Paid", value: formatCurrency(data.totalFeesPaid, data.currency, 2) }]} />
// );
//
// function CostsBody(data: CurrencyBreakdown, holdings: Holding[]) {
//   const { currency } = data;
//   if (data.totalFeesPaid <= 0) {
//     return <p className="text-sm text-slate-400 p-6 md:p-7">No fees recorded yet.</p>;
//   }
//
//   // Not returned pre-aggregated by the backend (unlike feesByBroker) — derived here from
//   // each holding's own `fees`, grouped by assetClass.
//   const feesByAssetClassMap = new Map<string, number>();
//   for (const h of holdings) {
//     feesByAssetClassMap.set(h.assetClass, (feesByAssetClassMap.get(h.assetClass) ?? 0) + h.fees);
//   }
//   const feesByAssetClass = [...feesByAssetClassMap.entries()].map(([assetClass, totalFees]) => ({ assetClass, totalFees }));
//
//   return (
//     <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
//       <AllocPanel title="By broker" subtitle="Where the costs came from">
//         <BarListBody items={data.feesByBroker.map(f => ({ label: f.broker, value: f.totalFees }))} currency={currency} />
//       </AllocPanel>
//       <AllocPanel title="By asset class" subtitle="What drove the costs">
//         <BarListBody items={feesByAssetClass.map(f => ({ label: f.assetClass, value: f.totalFees }))} currency={currency} />
//       </AllocPanel>
//     </div>
//   );
// }

const realizedPlDesc = () => "From closed positions, based on recorded buy and sell prices.";

// Win rate withheld below MIN_SELLS_FOR_WIN_RATE — on a handful of trades it reads as a
// precise statistic when it isn't one, and this product isn't a trading platform.
const realizedPlRight = (data: CurrencyBreakdown) => {
  const items: { label: string; value: string; tone?: "good" | "bad" }[] = [
    {
      label: "Total P&L",
      value: `${data.totalRealizedPl >= 0 ? "+" : ""}${formatCurrency(data.totalRealizedPl, data.currency, 2)}`,
      tone: data.totalRealizedPl >= 0 ? "good" : "bad",
    },
    { label: "Sell Transactions", value: data.sellCount.toString() },
  ];
  if (data.sellCount >= MIN_SELLS_FOR_WIN_RATE) {
    items.push({ label: "Win Rate", value: `${(data.winRate * 100).toFixed(0)}%` });
  }
  return <Scoreboard items={items} />;
};

/**
 * REALIZED P&L BODY — the trade-by-trade detail: each closed asset, its P&L, and the
 * buy/sell amounts it came from, in the currency it was actually traded in (confirmed
 * native per-trade currency, not a reference-currency conversion — see
 * transactions_summary_builder). Trades are grouped by (currency, assetId) upstream, so the
 * same ticker can legitimately appear once per currency it was traded in; nothing here
 * needs to dedupe by assetId alone.
 */
function RealizedPLBody(_data: CurrencyBreakdown, _holdings: Holding[], trades: AssetRealizedTrade[]) {
  if (trades.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">No closed positions yet.</p>;
  }

  const maxAbsPL = Math.max(0, ...trades.map(t => Math.abs(t.realizedPl)));

  return (
    <div className="p-6 md:p-7">
      <div className="space-y-5">
        {trades.map((t) => {
          const isGain = t.realizedPl >= 0;
          const halfWidthPct = maxAbsPL > 0 ? (Math.abs(t.realizedPl) / maxAbsPL) * 50 : 0;
          const label = t.ticker ? `${t.name} (${t.ticker})` : t.name;
          return (
            <div key={`${t.currency}::${t.assetId}`}>
              <div className="flex items-baseline justify-between gap-4 mb-1.5">
                <span className="text-sm font-bold text-slate-900 truncate">{label}</span>
                <span className={`text-sm font-bold shrink-0 ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
                  {isGain ? "+" : ""}{formatCurrency(t.realizedPl, t.currency, 2)}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
                {isGain ? (
                  <div
                    className="absolute left-1/2 top-0 h-full rounded-r-full bg-emerald-500"
                    style={{ width: `${halfWidthPct}%` }}
                  />
                ) : (
                  <div
                    className="absolute right-1/2 top-0 h-full rounded-l-full bg-rose-500"
                    style={{ width: `${halfWidthPct}%` }}
                  />
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-slate-400">
                  {formatQuantity(t.quantitySold)} units · {t.sellCount} {t.sellCount === 1 ? "sale" : "sales"}
                  {t.sellCount > 1 && ` · ${(t.winRate * 100).toFixed(0)}% win rate`}
                </span>
                <span className="text-[11px] text-slate-400">{formatCurrency(t.totalCost, t.currency)} → {formatCurrency(t.totalProceeds, t.currency)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * PORTFOLIO TODAY MODULE — Block 1. The four numbers that only make sense combined across
 * every currency: market value, invested capital, unrealized P&L, dividends. Always in the
 * user's reference currency (a profile-level preference, independent of what currencies the
 * holdings themselves are in) and always dated, since a converted figure without a date is
 * meaningless — see the "As of ..." line below.
 */
function PortfolioTodayModule({
  snapshots, byCurrency, showInvestedBreakdown,
}: {
  snapshots: PortfolioSnapshot[]; byCurrency: CurrencyBreakdown[]; showInvestedBreakdown: boolean;
}) {
  if (snapshots.length === 0) return null;

  const latest = snapshots[snapshots.length - 1];
  const currency = latest.currency;
  const pnlIsGain = latest.totalUnrealizedPnl >= 0;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Your portfolio today"
        desc={`As of ${chartDateLabel(latest.snapshotAt)} — from daily market prices.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <InvestedStat latest={latest} byCurrency={byCurrency} showBreakdown={showInvestedBreakdown} />
        <Stat
          title="Market Value"
          value={formatCurrency(latest.totalMarketValue, currency, 0)}
          icon={<Coins className="h-4 w-4 text-[#C49A3C]" />}
          description="What your positions are worth today"
          color="gold"
        />
        <Stat
          title="Unrealized P&L"
          value={`${pnlIsGain ? "+" : ""}${formatCurrency(latest.totalUnrealizedPnl, currency, 0)}`}
          icon={pnlIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          description="Vs your invested capital"
          color={pnlIsGain ? "emerald" : "red"}
        />
        <Stat
          title="Dividend Income"
          value={formatCurrency(latest.totalDividendIncome, currency, 0)}
          icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
          description="Received to date"
          color="blue"
        />
      </div>
    </Module>
  );
}

/**
 * INVESTED STAT — Total Invested lives here exclusively (removed from the per-currency
 * detail below). It's the only Block 1 figure with a native-currency counterpart to expand
 * into (byCurrency[].totalInvested), so it's the only one that gets the breakdown affordance.
 * A rate is only shown when there's exactly one native currency — with more than one, this
 * app has no way to know how much of the converted total came from each (that split would
 * need the backend to convert per-currency, which it doesn't do for this endpoint), so the
 * native amounts are shown without a fabricated rate rather than guessing.
 */
function InvestedStat({
  latest, byCurrency, showBreakdown,
}: {
  latest: PortfolioSnapshot; byCurrency: CurrencyBreakdown[]; showBreakdown: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currency = latest.currency;
  const impliedRate = byCurrency.length === 1 ? latest.totalInvestedCapital / byCurrency[0].totalInvested : null;

  return (
    <div className="p-6 md:p-7 flex flex-col gap-2.5">
      <div className="w-9 h-9 rounded-xl border flex items-center justify-center bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20">
        <Wallet className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Invested</p>
      <p
        className="font-black text-slate-900 text-xl md:text-2xl"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {formatCurrency(latest.totalInvestedCapital, currency, 0)}
      </p>
      {showBreakdown ? (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1 text-[13px] font-medium text-slate-500 hover:text-slate-700 transition-colors -ml-0.5 w-fit"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
            Breakdown by currency
          </button>
          {open && (
            <div className="flex flex-col gap-1 pl-4.5">
              {byCurrency.map(cb => (
                <div key={cb.currency} className="flex items-center justify-between gap-3 text-[12px] text-slate-500">
                  <span>{formatCurrency(cb.totalInvested, cb.currency, 0)}</span>
                  {impliedRate !== null && <span className="font-mono text-slate-400">rate {impliedRate.toFixed(3)}</span>}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-[13px] font-medium text-slate-500 leading-relaxed">Capital deployed to date</p>
      )}
    </div>
  );
}


/**
 * MODULE — the card shell every group of related content lives in.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({
  eyebrow, title, desc, right,
}: {
  eyebrow: string; title: string; desc?: string; right?: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2
          className="text-lg md:text-xl font-black text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * SCOREBOARD — inline stat badges in a module head. Numbers stay neutral ink unless the
 * value itself carries a sign (gain/loss).
 */
function Scoreboard({ items }: { items: { label: string; value: string; tone?: "good" | "bad" }[] }) {
  return (
    <div className="flex gap-6 flex-wrap shrink-0">
      {items.map((it) => (
        <div key={it.label} className="text-right">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{it.label}</p>
          <p
            className={`text-xl font-black tabular-nums ${it.tone === "good" ? "text-emerald-600" : it.tone === "bad" ? "text-rose-600" : "text-slate-900"}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * STAT — one segment of a Module's stat strip.
 */
interface StatProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "emerald" | "violet" | "red" | "gold";
}

function Stat({ title, value, icon, description, color }: StatProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    red: "bg-red-50 text-red-600 border-red-100",
    gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  };

  return (
    <div className="p-6 md:p-7 flex flex-col gap-2.5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p
        className="font-black text-slate-900 text-xl md:text-2xl"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

/**
 * ALLOC PANEL — one column of a multi-column Module body.
 */
function AllocPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>
      {children}
    </div>
  );
}

// BAR LIST BODY — only used by the commented-out Costs section above; commented out
// alongside it, not removed, so it comes back with everything else if Costs is reinstated.
// function BarListBody({ items, currency }: { items: { label: string; value: number }[]; currency: string }) {
//   const max = Math.max(0, ...items.map(i => i.value));
//
//   if (items.length === 0) {
//     return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
//   }
//
//   return (
//     <div className="space-y-4">
//       {items.map((item) => {
//         const widthPct = max > 0 ? (item.value / max) * 100 : 0;
//         return (
//           <div key={item.label}>
//             <div className="flex items-baseline justify-between gap-4 mb-1">
//               <span className="text-xs font-bold text-slate-900">{item.label}</span>
//               <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(item.value, currency, 0)}</span>
//             </div>
//             <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
//               <div className="h-full rounded-r-full bg-[#C49A3C]" style={{ width: `${widthPct}%` }} />
//             </div>
//           </div>
//         );
//       })}
//     </div>
//   );
// }

// Shades of the brand gold, ordered for adjacent-slice contrast; long tails collapse into
// a single muted "Other" slice rather than a 9th near-indistinguishable color.
const DONUT_COLORS = ["#C49A3C", "#E8C97A", "#8A6A28", "#D4B96A", "#B8935A", "#A67C3D"];
const DONUT_OTHER_COLOR = "#CBD5E1";
const DONUT_MAX_SLICES = 5;

/**
 * COMPOSITION DONUT — percentage-first composition view, replacing a column of stacked bars
 * that didn't scale past a couple of items (8 individual holdings in one narrow column read
 * as noise). A donut + compact legend reads at a glance regardless of item count; anything
 * past DONUT_MAX_SLICES collapses into "Other" so the chart and legend both stay legible.
 * All items must already share one currency — percentages from mixed currencies would
 * silently treat e.g. 1 EUR and 1 USD as equal weight.
 */
function CompositionDonut({ items, currency }: { items: { label: string; value: number }[]; currency: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  const total = items.reduce((sum, i) => sum + i.value, 0);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const grouped = sorted.length <= DONUT_MAX_SLICES
    ? sorted
    : [
        ...sorted.slice(0, DONUT_MAX_SLICES),
        { label: "Other", value: sorted.slice(DONUT_MAX_SLICES).reduce((sum, i) => sum + i.value, 0) },
      ];

  return (
    <div className="flex items-center gap-5">
      <div className="w-24 h-24 shrink-0">
        <PieChart width={96} height={96}>
          <Pie data={grouped} dataKey="value" nameKey="label" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none">
            {grouped.map((entry, i) => (
              <Cell key={entry.label} fill={entry.label === "Other" ? DONUT_OTHER_COLOR : DONUT_COLORS[i % DONUT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const num = Number(value) || 0;
              const pct = total > 0 ? ((num / total) * 100).toFixed(1) : "0";
              return [`${formatCurrency(num, currency, 0)} (${pct}%)`, name];
            }}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
          />
        </PieChart>
      </div>
      <div className="flex-1 min-w-0 space-y-1.5">
        {grouped.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: item.label === "Other" ? DONUT_OTHER_COLOR : DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                <span className="font-bold text-slate-900 truncate">{item.label}</span>
              </span>
              <span className="font-bold text-slate-500 shrink-0 tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * HOLDINGS EXPLORER — the one place all currencies appear together. Deliberately a plain
 * filterable table rather than a bar chart: bar length would encode invested value, and a
 * USD bar next to a EUR bar of the same length would visually claim they're equal, which
 * isn't true without a live FX rate. A table just lists the numbers with their own currency.
 */
function HoldingsExplorer({ holdings }: { holdings: Holding[] }) {
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("all");
  const [currency, setCurrency] = useState("all");

  const assetClasses = useMemo(() => [...new Set(holdings.map(h => h.assetClass))].sort(), [holdings]);
  const currencies = useMemo(() => [...new Set(holdings.map(h => h.currency))].sort(), [holdings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holdings
      .filter(h => assetClass === "all" || h.assetClass === assetClass)
      .filter(h => currency === "all" || h.currency === currency)
      .filter(h => !q || h.ticker?.toLowerCase().includes(q) || h.name.toLowerCase().includes(q))
      // Grouped by currency first so ordering never implies a cross-currency size comparison.
      .sort((a, b) => a.currency.localeCompare(b.currency) || b.investedValue - a.investedValue);
  }, [holdings, search, assetClass, currency]);

  return (
    <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-5 md:p-6 border-b border-slate-200">
        <div className="relative flex-1 min-w-0">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticker or name…"
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all"
          />
        </div>
        <FilterSelect label="Asset class" value={assetClass} onChange={setAssetClass} options={assetClasses} />
        <FilterSelect label="Currency" value={currency} onChange={setCurrency} options={currencies} />
      </div>

      {filtered.length === 0 ? (
        <div className="py-14 flex flex-col items-center justify-center text-center px-6">
          <div className="p-4 bg-slate-50 rounded-2xl mb-3">
            <Wallet className="h-6 w-6 text-slate-300" />
          </div>
          <p className="text-slate-600 font-semibold">{holdings.length === 0 ? "No holdings yet" : "No holdings match your filters"}</p>
          <p className="text-slate-400 text-sm mt-1">
            {holdings.length === 0 ? "Upload or add transactions to see your holdings here." : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-5 md:px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Asset</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Class</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Quantity</th>
                <th className="px-3 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Invested</th>
                <th className="px-3 md:px-6 py-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Broker</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((h, i) => (
                <tr key={`${h.currency}::${h.ticker ?? h.isin ?? i}::${h.broker ?? ""}`} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-5 md:px-6 py-3.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-bold text-slate-900 shrink-0">{h.ticker ?? h.isin ?? "—"}</span>
                      <span className="text-xs text-slate-400 truncate">{h.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                      {h.assetClass}
                    </span>
                  </td>
                  <td className="px-3 py-3.5 text-sm font-semibold text-slate-600 text-right tabular-nums">{formatQuantity(h.quantity)}</td>
                  <td className="px-3 py-3.5 text-sm font-bold text-slate-900 text-right tabular-nums">
                    {formatCurrency(h.investedValue, h.currency, 2)}
                  </td>
                  <td className="px-3 md:px-6 py-3.5 text-sm font-medium text-slate-500">{h.broker ?? "Unknown"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-3.5 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-slate-100 focus:border-slate-300 transition-all appearance-none cursor-pointer"
      >
        <option value="all">All {label.toLowerCase()}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
