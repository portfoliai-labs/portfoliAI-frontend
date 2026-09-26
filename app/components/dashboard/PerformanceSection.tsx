// components/dashboard/PerformanceSection.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Sun,
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Receipt, Activity,
  Loader2, AlertCircle, FileText, ExternalLink, ArrowLeft, LayoutGrid, Scale, Gauge, Info,
  Search, ChevronDown, Percent,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ReferenceDot, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { portfolioService } from "../../services/portfolioService";
import { formatCurrency, formatQuantity } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";
import { NoDataEmptyState } from "./NoDataEmptyState";
import type {
  PeriodDashboard, FullHistoryDashboard, PortfolioSnapshot, PortfolioSummary, TodayDashboard,
  AssetRealizedTrade, MonthlyMarketEffectEntry, Holding, CurrencyBreakdown,
} from "../../models/Portfolio";
import type {
  ExposureEntryResponse, RiskModelResponse, RiskPortfolioEntry, RiskModelUnavailableReason, WeightGapEntry,
  BenchmarkResponse, BenchmarkComponentEntry, VolatilityResponse, TimeSeries,
} from "../../models/PortfolioData";

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const monthYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Portfolio-vs-benchmark colours, shared by the chart lines, the Total Return card's markers
// and the composition bars so one colour always means the same series. The benchmark grey is
// deliberately dark enough (slate-500) to stay visible on the white card and against the
// slate-100 bar tracks.
const PORTFOLIO_COLOR = "#C49A3C";
const BENCHMARK_COLOR = "#64748b";

// Axis tick labels (months, dates, values) on every chart in this file — slate-500, since the
// lighter slate-400 they used to have washed out against the white card.
const AXIS_TICK_COLOR = "#64748b";

// How often to refetch a document that came back `isStale: true` (a transaction edit triggered
// a rebuild that hasn't landed yet), and how long to keep trying before giving up and showing
// the possibly-mixed data anyway with a hint instead of polling forever. See useAnalytics.
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

// Shared recharts tooltip box. The text colour is set explicitly: recharts leaves the date
// label uncoloured, so it inherits the page's text colour — near-white in dark mode (see
// globals.css) — on the tooltip's white background, making it unreadable.
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155",
};

/**
 * INSIGHTS SECTION — lifetime portfolio figures: performance since inception, a month-by-month
 * returns heatmap (drilled into per-month via /monthly?year=), risk, benchmark comparison and
 * current composition, as sub-tabs of one page (see HISTORY_SUB_TABS below) rather than a
 * Today/All Time switcher — Today's own figures moved to the Dashboard (PortfolioTodayModule)
 * once composition stopped depending on the today dashboard for its data (GET
 * /v1/portfolio/summary, not /today's own `summary` field anymore), which was the only reason
 * this page ever needed Today's data in the first place. /history returns null rather than a
 * zeroed-out object when there isn't enough history yet, and (via useAnalytics) polls while
 * `isStale` — see HistoryPage's `historyUpdating` for how that's shown.
 */
export function PerformanceSection({
  portfolioUuid, portfolioName, onNavigate,
}: { portfolioUuid: string; portfolioName?: string; onNavigate?: (section: string) => void }) {
  const { data: history, loading, failed, updating } = useAnalytics<FullHistoryDashboard>(portfolioService.getFullHistoryDashboard, portfolioUuid);

  // Sub-tab (Overview/Composition/Risk) and month-drilldown state live here rather than in
  // HistoryPage below, even though only HistoryPage's content depends on them: the tab
  // switcher itself sits in the masthead right next to the "Insights" title (see the header
  // below) rather than on its own row, so the title and the tabs need to be siblings in the
  // same returned tree. Kept here rather than duplicating the masthead per HistoryPage branch.
  const [subTab, setSubTab] = useState<HistorySubTabId>("overview");
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null);
  const [monthCache, setMonthCache] = useState<Record<number, PeriodDashboard[]>>({});
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  const handleSelectMonth = async (year: number, month: number) => {
    setSelected({ year, month });
    if (monthCache[year]) return;
    setMonthLoading(true);
    setMonthError(null);
    try {
      const periods = await portfolioService.getMonthlyDashboard(portfolioUuid, year);
      setMonthCache(prev => ({ ...prev, [year]: periods }));
    } catch (err) {
      setMonthError(err instanceof Error ? err.message : "Failed to load that month's detail");
    } finally {
      setMonthLoading(false);
    }
  };

  // Same isStale contract as useAnalytics, applied to the currently-open month's cached
  // /monthly?year= response (same value on every entry of that response, so the first one
  // speaks for all): poll every STALE_POLL_INTERVAL_MS while stale, stop after
  // STALE_TIMEOUT_MS. Keyed off the derived `selectedYearStale` boolean rather than
  // `monthCache` itself so a poll's own setMonthCache call doesn't reset the deadline.
  const selectedYear = selected?.year;
  const selectedYearStale = selectedYear !== undefined ? (monthCache[selectedYear]?.[0]?.isStale ?? false) : false;
  const [monthStaleTimedOut, setMonthStaleTimedOut] = useState(false);

  useEffect(() => {
    if (!selectedYearStale || selectedYear === undefined) {
      setMonthStaleTimedOut(false);
      return;
    }
    let cancelled = false;
    const deadline = Date.now() + STALE_TIMEOUT_MS;
    const timer = setInterval(async () => {
      if (Date.now() >= deadline) {
        clearInterval(timer);
        if (!cancelled) setMonthStaleTimedOut(true);
        return;
      }
      try {
        const fresh = await portfolioService.getMonthlyDashboard(portfolioUuid, selectedYear);
        if (!cancelled) setMonthCache(prev => ({ ...prev, [selectedYear]: fresh }));
      } catch {
        // Transient error while polling — the next tick tries again.
      }
    }, STALE_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [selectedYearStale, selectedYear, portfolioUuid]);

  // Tabs only make sense once there's an actual Overview/Composition/Risk to switch between:
  // hidden while loading/failed/empty (nothing to show in any of them) and while a month
  // drilldown is open (that view has its own "All time" back link instead).
  const showTabs = !loading && !failed && history !== null && !isHistoryEmpty(history) && !selected;

  return (
    <div className="px-0 py-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">{portfolioName ?? "Portfolio"}</p>
          <h1
            className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Insights
          </h1>
          <p className="text-slate-500 font-medium mt-1">Your portfolio&apos;s lifetime performance, risk and composition.</p>
        </div>
        {showTabs && <SubTabSwitcher tabs={HISTORY_SUB_TABS} active={subTab} onChange={setSubTab} />}
      </div>

      {failed && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load portfolio data</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : history === null ? (
        <NoDataEmptyState
          title="No performance data yet"
          message="Add or upload your transactions and this is where you'll track how your portfolio moves over time."
          onNavigate={onNavigate}
        />
      ) : (
        <HistoryPage
          key={portfolioUuid}
          data={history}
          historyUpdating={updating}
          portfolioUuid={portfolioUuid}
          subTab={subTab}
          selected={selected}
          setSelected={setSelected}
          monthCache={monthCache}
          monthLoading={monthLoading}
          monthError={monthError}
          onSelectMonth={handleSelectMonth}
          selectedYearStale={selectedYearStale}
          monthStaleTimedOut={monthStaleTimedOut}
        />
      )}
    </div>
  );
}

/**
 * MODULE — the card shell every page's content lives in, matching the Dashboard
 * Overview's visual language (rounded-4xl white card, Playfair headers, gold eyebrow).
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({
  eyebrow, title, desc, right, icon,
}: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode; icon?: React.ReactNode }) {
  const heading = (
    <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
      {title}
    </h2>
  );

  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        {icon ? <div className="flex items-center gap-2.5">{icon}{heading}</div> : heading}
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * PAGE HEADER — the plain (no card) title block above a page's stat grid, mirroring the
 * section's own masthead further up rather than sitting inside a bordered box. The stat
 * cards below already carry the visual weight; a boxed header on top of boxed cards read
 * as one more layer of nesting for no reason.
 */
function PageHeader({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-1">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2 className="text-xl md:text-2xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

interface StatProps {
  title: string;
  // A string for a single figure, or richer content (see SeriesValue) for a figure that
  // needs more than one line.
  value: React.ReactNode;
  icon: React.ReactNode;
  // Omitted when `info` already covers the same ground — a stat card doesn't need both a
  // caption sitting under the value at all times and the fuller explanation in the icon's
  // hover tooltip (see Benchmark Comparison's cards, which carry only `info`).
  description?: string;
  color: "blue" | "emerald" | "red" | "gold" | "slate";
  // Plain-language explanation of what the figure means, shown in a tooltip when the user
  // hovers (or focuses) the icon.
  info?: string;
}

const STAT_COLOR_MAP: Record<StatProps["color"], string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  red: "bg-red-50 text-red-600 border-red-100",
  gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  slate: "bg-slate-50 text-slate-600 border-slate-100",
};

const INFO_TIP_WIDTH = 256;

/**
 * INFO TIP — wraps an element (a stat's icon) and shows a short explanation while it's hovered
 * or focused. Rendered in a portal with fixed positioning rather than as an absolutely
 * positioned child: the stat strips sit inside cards that clip their overflow, which would cut
 * the tip off. It opens below the anchor, flips above when the viewport has no room below, and
 * is clamped horizontally so it never runs off-screen.
 */
function InfoTip({ text, children }: { text: string; children: React.ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left + rect.width / 2 - INFO_TIP_WIDTH / 2),
      window.innerWidth - INFO_TIP_WIDTH - margin,
    );
    const roomBelow = window.innerHeight - rect.bottom > 160;
    setTip(roomBelow ? { left, top: rect.bottom + margin } : { left, bottom: window.innerHeight - rect.top + margin });
  };

  // A fixed-position tip doesn't follow its anchor, so drop it if anything scrolls under it.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip]);

  return (
    <span
      ref={anchorRef}
      tabIndex={0}
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={() => setTip(null)}
      onFocus={show}
      onBlur={() => setTip(null)}
      className="self-start inline-flex rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      {children}
      {tip && createPortal(
        <div
          role="tooltip"
          style={{ position: "fixed", left: tip.left, top: tip.top, bottom: tip.bottom, width: INFO_TIP_WIDTH }}
          className="z-50 pointer-events-none rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-medium leading-relaxed text-white shadow-xl"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

/**
 * STAT CONTENT — the icon/title/value/description block, with no card shell of its own,
 * meant to share a card with siblings via StatCardGroup, divided by internal borders
 * instead of gaps — reads better than each figure getting its own separate card.
 */
function StatContent({ title, value, icon, description, color, info }: StatProps) {
  const iconBox = (
    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${STAT_COLOR_MAP[color]} ${info ? "cursor-help" : ""}`}>
      {icon}
    </div>
  );

  return (
    <div className="p-5 md:p-6 flex flex-col gap-2.5">
      {info ? <InfoTip text={info}>{iconBox}</InfoTip> : iconBox}
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div className="font-black text-slate-900 text-xl md:text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </div>
      {description && <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>}
    </div>
  );
}

/**
 * STAT CARD GROUP — a handful of StatContent cells sharing one card, divided by internal
 * borders instead of each getting its own card + gap. `gridClassName` carries the
 * grid-cols/divide combination, since that has to match how many children are actually
 * passed in (see call sites) — a fixed column count here would either stretch a shorter
 * group across empty space or wrap a longer one without the row dividers it needs.
 */
function StatCardGroup({ children, gridClassName }: { children: React.ReactNode; gridClassName: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm grid overflow-hidden ${gridClassName}`}>
      {children}
    </div>
  );
}

/**
 * SNAPSHOT CHART — just totalMarketValue over time, rendered inside its own ChartCard
 * Module (see below). The stat cards in the page's other Module already carry the deltas
 * and breakdowns, so this stays a plain, uncluttered trend line.
 */
function SnapshotChart({ chart, currency }: { chart: PortfolioSnapshot[]; currency: string }) {
  // A single point has nothing to draw a line/area between — recharts still plots its dot,
  // which reads as a broken/empty chart rather than "not enough history yet".
  if (chart.length < 2) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>;
  }

  const sorted = [...chart].sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime());
  const data = sorted.map(s => ({ date: s.snapshotAt, value: s.totalMarketValue }));

  return (
    <div className="p-6 md:p-7 h-64">
      {/* initialDimension seeds a real size before the first ResizeObserver callback fires —
          without it, ResponsiveContainer's first render measures width/height as -1 and logs
          a "should be greater than 0" warning even though the chart renders fine a moment later. */}
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        {/* top: 16 leaves room for the topmost Y-axis tick label — its text is vertically
            centered on the tick, so with no top margin the upper half of that top label
            renders past the chart's edge and gets clipped. */}
        <AreaChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#C49A3C" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#C49A3C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={chartDateLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, 0)}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [formatCurrency(Number(value), currency, 0), "Market value"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="value" stroke="#C49A3C" strokeWidth={2} fill="url(#performanceFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * CHART CARD — the history chart's own Module, separate from the stats Module above it.
 * Keeping it in its own card gives it visual room to breathe and makes clear it's a
 * different kind of information — a trend over time vs. point-in-time figures.
 */
function ChartCard({ chart, currency, title, desc }: { chart: PortfolioSnapshot[]; currency: string; title: string; desc: string }) {
  return (
    <Module>
      <ModuleHead eyebrow={currency} title={title} desc={desc} />
      <SnapshotChart chart={chart} currency={currency} />
    </Module>
  );
}

function ViewReportLink({ portfolioUuid, documentId }: { portfolioUuid: string; documentId: string | null }) {
  if (!documentId) return null;
  return (
    <a
      href={`/reports/${portfolioUuid}/${documentId}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-blue-600 transition-colors shrink-0"
    >
      <FileText className="h-3.5 w-3.5" /> View report <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * EMPTY PERIOD STATE — swapped in for a page's stat cards (and its chart) when every
 * figure the backend returned for that period is zero, i.e. there's nothing recorded
 * yet to show. A wall of "0.00 EUR" cards would read as broken data rather than "no
 * activity", so this is dropped in favor of the same dashed-border empty-state card
 * used elsewhere in the dashboard (e.g. "No reports found").
 */
function EmptyPeriodState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white border border-slate-200 border-dashed rounded-4xl">
      <div className="p-4 bg-slate-50 rounded-2xl mb-3">
        <Wallet className="h-6 w-6 text-slate-300" />
      </div>
      <p className="text-slate-600 font-semibold">Nothing to show yet</p>
      <p className="text-slate-400 text-sm mt-1 max-w-sm">{message}</p>
    </div>
  );
}

/**
 * UPDATING NOTE — shown once a document has been `isStale: true` for the full
 * STALE_TIMEOUT_MS polling window (see useAnalytics): the rebuild triggered by a transaction
 * edit is taking longer than the usual few minutes, so polling has stopped and the (possibly
 * still-mixed) numbers are drawn anyway with this heads-up rather than blocking on it forever.
 * The normal case — still within the window — hides the numbers instead (StaleUpdatingState),
 * so reaching this note at all is the unusual path.
 */
function UpdatingNote() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      <p className="text-xs font-bold">Update is taking longer than usual — the figures below may be out of date.</p>
    </div>
  );
}

/**
 * STALE UPDATING STATE — replaces a module's numbers/charts entirely while its document is
 * `isStale: true` and still within the polling window (see useAnalytics): after an edit, the
 * old numbers and the new ones would describe two different portfolios, so nothing here is
 * safe to draw until the rebuild lands. The page keeps refetching in the background; this just
 * says so instead of showing a plain empty module.
 */
function StaleUpdatingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-14 px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
      <p className="text-slate-600 font-semibold">Updating after a recent change</p>
      <p className="text-slate-400 text-sm max-w-sm">
        This usually takes a few minutes — it&apos;ll refresh here on its own once it&apos;s ready.
      </p>
    </div>
  );
}

/** Placeholder line for a module whose analytics can't be drawn (yet). */
function ModuleMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-400 p-6 md:p-7">{children}</p>;
}

const isPeriodEmpty = (data: PeriodDashboard) =>
  data.t0Value === 0 && data.t1Value === 0 && data.deltaValue === 0 && data.marketEffect === 0 &&
  data.netCapitalContributed === 0 && data.tradingCostsInPeriod === 0 && data.dividendsInPeriod === 0;

// A portfolio's very first tracked period has no prior value to diff against — the backend
// signals this with t0Value === 0 rather than a real baseline, and deltaValuePct /
// marketEffectPct both come back as exactly 0 for that one entry (its own division-by-zero
// guard), even though the euro amounts (deltaValue / marketEffect) are still meaningful. A
// literal "0%" there would read as "flat", not "no baseline to compare against" — so every
// percentage display checks this first and falls back to "—".
const hasPeriodBaseline = (data: PeriodDashboard) => data.t0Value !== 0;
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

/**
 * AMOUNT WITH DELTA — an absolute change and its percentage, stacked instead of squeezed into
 * one "€X (+Y%)" string: the amount stays the primary figure, the percentage gets its own
 * colored, directional line underneath so it reads as its own figure rather than an annotation
 * in parentheses. `hasBaseline` covers the one case where the euro amount is meaningful but the
 * percentage isn't (see hasPeriodBaseline above) — the delta line falls back to "—" instead of
 * a misleading 0%.
 */
function AmountWithDelta({ amount, pct, hasBaseline = true }: { amount: string; pct: number; hasBaseline?: boolean }) {
  const isGain = pct >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  return (
    <>
      {amount}
      <div className={`flex items-center gap-1 font-sans text-sm font-bold mt-1 ${
        !hasBaseline ? "text-slate-400" : isGain ? "text-emerald-600" : "text-rose-600"
      }`}>
        {hasBaseline ? (
          <>
            <Icon className="h-3.5 w-3.5" />
            {formatPct(pct)}
          </>
        ) : (
          "—"
        )}
      </div>
    </>
  );
}

const isHistoryEmpty = (data: FullHistoryDashboard) =>
  data.currentValue === 0 && data.totalInvestedCapital === 0 && data.totalRealizedPnl === 0 &&
  data.totalUnrealizedPnl === 0 && data.totalDividendIncome === 0 && data.lifetimeTradingCosts === 0 &&
  data.lifetimeDividends === 0 && data.chart.length === 0;

type HistorySubTabId = "overview" | "composition" | "risk";

const HISTORY_SUB_TABS: SubTab<HistorySubTabId>[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "composition", label: "Composition", icon: LayoutGrid },
  { id: "risk", label: "Risk", icon: Gauge },
];

interface SubTab<T extends string> {
  id: T;
  label: string;
  icon: typeof Sun;
}

/**
 * SUB-TAB SWITCHER — sits in the masthead beside the "Insights" title (see PerformanceSection),
 * not on its own row below it. Underline style rather than the pill/segmented-control look it
 * used to have: a boxed, shadowed control read fine as a standalone row of its own, but next to
 * a serif page title it looked like a form control bolted onto a page header. Plain text with a
 * colored underline on the active tab reads as page-level navigation instead, in keeping with
 * the title next to it.
 */
function SubTabSwitcher<T extends string>({
  tabs, active, onChange,
}: { tabs: SubTab<T>[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex items-center gap-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 pb-1 text-[13px] font-bold border-b-2 transition-colors ${
            active === t.id ? "border-[#C49A3C] text-[#C49A3C]" : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <t.icon className="h-3.5 w-3.5" /> {t.label}
        </button>
      ))}
    </div>
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

function AllocPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>
      {children}
    </div>
  );
}

// Shades of the brand gold, ordered for adjacent-slice contrast; long tails collapse into
// a single muted "Other" slice rather than a 9th near-indistinguishable color.
const DONUT_COLORS = ["#C49A3C", "#E8C97A", "#8A6A28", "#D4B96A", "#B8935A", "#A67C3D"];
const DONUT_OTHER_COLOR = "#CBD5E1";
const DONUT_MAX_SLICES = 5;

/**
 * COMPOSITION DONUT — percentage-first composition view: a donut + compact legend reads at a
 * glance regardless of item count; anything past DONUT_MAX_SLICES collapses into "Other" so
 * the chart and legend both stay legible. All items must already share one currency —
 * percentages from mixed currencies would silently treat e.g. 1 EUR and 1 USD as equal weight.
 */
function CompositionDonut({ items, currency }: { items: { label: string; value: number }[]; currency: string }) {
  // Recomputed only when the underlying items actually change, not on every re-render
  // this component's parent (the currency carousel) triggers while scrolling/snapping.
  const { total, grouped } = useMemo(() => {
    const total = items.reduce((sum, i) => sum + i.value, 0);
    const sorted = [...items].sort((a, b) => b.value - a.value);
    const grouped = sorted.length <= DONUT_MAX_SLICES
      ? sorted
      : [
          ...sorted.slice(0, DONUT_MAX_SLICES),
          { label: "Other", value: sorted.slice(DONUT_MAX_SLICES).reduce((sum, i) => sum + i.value, 0) },
        ];
    return { total, grouped };
  }, [items]);

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  return (
    <div className="flex items-center gap-5">
      <div className="w-24 h-24 shrink-0">
        <PieChart width={96} height={96}>
          <Pie data={grouped} dataKey="value" nameKey="label" innerRadius={30} outerRadius={48} paddingAngle={2} stroke="none" isAnimationActive={false}>
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
            contentStyle={TOOLTIP_STYLE}
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

// "Unknown" collects assets with no known breakdown — a data gap, not a real sector/region —
// so it gets a neutral bar instead of taking a slot in the gold palette.
const UNKNOWN_EXPOSURE_COLOR = "#cbd5e1";

/**
 * EXPOSURE BREAKDOWN — a ranked bar list for a percentage-weighted breakdown (sector/region
 * exposure). Simpler than CompositionDonut: these entries already carry a weightPct
 * (0-100), not a currency amount that needs a percentage computed from a total first.
 */
function ExposureBreakdown({ entries }: { entries: ExposureEntryResponse[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  const sorted = [...entries].sort((a, b) => b.weightPct - a.weightPct);
  const max = Math.max(...sorted.map((e) => e.weightPct), 0.01);
  let colorIndex = 0;

  return (
    <div className="space-y-3">
      {sorted.map((e) => {
        const color = e.label === "Unknown" ? UNKNOWN_EXPOSURE_COLOR : DONUT_COLORS[colorIndex++ % DONUT_COLORS.length];
        return (
          <div key={e.label}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[13px] font-bold text-slate-900 truncate">{e.label}</span>
              <span className="text-[13px] font-bold text-slate-500 tabular-nums shrink-0">{e.weightPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(e.weightPct / max) * 100}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * SECTOR & REGION MODULE — look-through exposure of the held positions as of the last
 * snapshot tick (into funds, at today's fund composition — not at any past date). Both
 * endpoints answer null until the first snapshot tick has run for this user, and carry
 * neither status nor isStale.
 */
function SectorRegionModule({
  sector, region,
}: { sector: ExposureEntryResponse[] | null; region: ExposureEntryResponse[] | null }) {
  return (
    <Module>
      <ModuleHead
        eyebrow="Composition"
        title="Sector & Region"
        desc="Exposure of your current holdings, weighted by market value."
      />
      {sector === null && region === null ? (
        <ModuleMessage>Being prepared — this shows up shortly after your first transactions are processed.</ModuleMessage>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
          <AllocPanel title="By sector" subtitle="Where your holdings' companies operate">
            <ExposureBreakdown entries={sector ?? []} />
          </AllocPanel>
          <AllocPanel title="By region" subtitle="Geographic exposure">
            <ExposureBreakdown entries={region ?? []} />
          </AllocPanel>
        </div>
      )}
    </Module>
  );
}

// Correlation cells share the returns heatmap's emerald/rose scheme (positive/negative) but
// scale intensity linearly over [-1, 1] rather than a capped magnitude — correlation is
// already bounded, unlike a percentage return.
function correlationCellStyle(value: number): React.CSSProperties {
  const intensity = Math.min(Math.abs(value), 1);
  const [r, g, b] = value >= 0 ? [16, 185, 129] : [244, 63, 94]; // emerald-500 / rose-500
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${(0.08 + intensity * 0.72).toFixed(3)})`,
    color: intensity > 0.55 ? "#ffffff" : value >= 0 ? "#047857" : "#be123c",
  };
}

/**
 * CORRELATION MATRIX MODULE — how the held assets' returns moved together over the history
 * they share (from /risk-model, shown in RiskModelTab). Drawn whenever the document carries a
 * matrix of at least two assets, whatever its status; without one, a message stands in for the
 * table. Individual cells can be null and render as a dash.
 */
function CorrelationMatrixModule({ riskModel }: { riskModel: RiskModelResponse }) {
  const correlation = riskModel.correlation;
  const usable = correlation !== null && correlation.tickers.length >= 2;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk"
        title="Correlation Matrix"
        desc="How your holdings moved together, based on past returns."
      />
      {!usable ? (
        <ModuleMessage>Needs at least two assets with a shared price history to compare.</ModuleMessage>
      ) : (
        <div className="p-6 md:p-7 overflow-x-auto custom-scrollbar">
          <table className="border-collapse min-w-150 w-full table-fixed">
            <thead>
              <tr>
                <th className="w-20" />
                {correlation.tickers.map((t, j) => (
                  <th key={`${t}-${j}`} className="text-[10px] font-black uppercase tracking-wider text-slate-400 pb-2 text-center">{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlation.tickers.map((rowTicker, i) => (
                <tr key={`${rowTicker}-${i}`}>
                  <td className="text-xs font-bold text-slate-900 pr-3 py-1 whitespace-nowrap">{rowTicker}</td>
                  {correlation.tickers.map((colTicker, j) => {
                    const value = correlation.matrix[i]?.[j] ?? null;
                    return (
                      <td key={`${colTicker}-${j}`} className="p-1">
                        <div
                          title={`${rowTicker} vs ${colTicker}: ${value === null ? "n/a" : value.toFixed(2)}`}
                          style={value === null ? undefined : correlationCellStyle(value)}
                          className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums ${
                            value === null ? "bg-slate-50 text-slate-300" : ""
                          }`}
                        >
                          {value === null ? "—" : value.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Module>
  );
}

const plainPctOrDash = (pct: number | null) => (pct === null ? "—" : `${pct.toFixed(2)}%`);
const ratioOrDash = (value: number | null) => (value === null ? "—" : value.toFixed(2));

// One colour per mix in the risk-model views, so a mix reads the same on the frontier chart,
// in the comparison table and in the legend. The current allocation keeps the portfolio gold.
const MIX_COLORS = { current: PORTFOLIO_COLOR, maxSharpe: "#0f766e", minVolatility: "#1d4ed8" } as const;

const RISK_UNAVAILABLE_MESSAGES: Record<RiskModelUnavailableReason, string> = {
  too_few_assets: "The risk model needs at least two holdings that share 30 days or more of price history. Yours don't yet, so it will appear once they do.",
  no_positive_returns: "Every one of your holdings has an average past return at or below zero, so the model has no best-return mix to compare against.",
  solver_failed: "The model couldn't work out an allocation from your holdings' data this time. Check back after the next update.",
};

// Fallback for an unavailable model with no reason: a document stored before the backend sent
// unavailableReason keeps null there until it is recomputed, so it lists every possible cause.
const RISK_UNAVAILABLE_GENERIC =
  "The risk model can't be built for your portfolio right now. That happens when fewer than two holdings share at least 30 days of price history, when every holding's average past return is zero or negative, or when no allocation could be worked out from the data.";

/** The one explanation shown in place of the model's modules when it isn't "ok". */
function riskModelUnavailableMessage(model: RiskModelResponse): string {
  if (model.status === "insufficient_history") {
    return "The risk model needs at least a year of history. It will appear once your portfolio has one.";
  }
  return (model.unavailableReason && RISK_UNAVAILABLE_MESSAGES[model.unavailableReason]) || RISK_UNAVAILABLE_GENERIC;
}

/**
 * RISK MODEL TAB — /risk-model as one page, since it is one model: either it was built for the
 * whole portfolio or none of it was. Loads itself when the tab is opened. The state handling:
 * null → "being prepared"; status other than "ok" → a single explanation (the document then has
 * no per-asset estimates, allocations, frontier or gaps), worded by unavailableReason, though a
 * correlation matrix is still drawn if the backend sent one (it does for no_positive_returns and
 * solver_failed, since correlations need only returns); isStale → hide everything below behind
 * StaleUpdatingState (see useAnalytics's `updating`) rather than draw stale numbers.
 * Everything on the page is built from past returns, so it says so up front and avoids
 * recommendation wording.
 */
function RiskModelTab({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<RiskModelResponse>(portfolioService.getRiskModel, portfolioUuid);

  if (loading || failed || data === null || updating) {
    return (
      <Module>
        <ModuleHead eyebrow="Risk" title="Risk Model" desc="How your holdings have behaved together, based on past returns." />
        <AnalyticsPlaceholder
          loading={loading}
          failed={failed}
          hasData={data !== null}
          updating={updating}
          preparingMessage="Being prepared — this shows up after the overnight analysis of your portfolio has run."
        />
      </Module>
    );
  }

  const built = data.status === "ok";

  return (
    <div className="space-y-6">
      {data.isStale && <UpdatingNote />}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p className="text-xs font-medium leading-relaxed">
          Everything on this page is based on the past returns of your holdings, over the history they share. It
          describes what happened, not what will happen, and it isn&apos;t a recommendation.
        </p>
      </div>

      {built ? (
        <>
          <MixComparisonModule current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} />
          <FrontierModule
            frontier={data.frontier}
            current={data.current}
            maxSharpe={data.maxSharpe}
            minVolatility={data.minVolatility}
          />
          <WeightGapsModule gaps={data.weightGaps} />
          <RiskAssetsModule assets={data.assets} />
        </>
      ) : (
        <Module>
          <ModuleHead eyebrow="Risk" title="Risk Model" desc="How your holdings have behaved together, based on past returns." />
          <ModuleMessage>{riskModelUnavailableMessage(data)}</ModuleMessage>
        </Module>
      )}

      {(built || data.correlation !== null) && <CorrelationMatrixModule riskModel={data} />}
    </div>
  );
}

/**
 * MIX COMPARISON — the three allocations the model evaluates on the same past returns: what
 * you hold now, the long-only mix with the best past return per unit of risk (max Sharpe) and
 * the one with the lowest volatility. One card each, with its three figures and its weights as
 * a single segmented bar, so the mixes can be compared at a glance. Every ticker keeps the same
 * colour across the three bars. An entry can be null.
 */
function MixComparisonModule({
  current, maxSharpe, minVolatility,
}: { current: RiskPortfolioEntry | null; maxSharpe: RiskPortfolioEntry | null; minVolatility: RiskPortfolioEntry | null }) {
  const mixes = [
    { label: "Your allocation", hint: "As you hold it today", color: MIX_COLORS.current, entry: current },
    { label: "Max Sharpe", hint: "Best past return per unit of risk", color: MIX_COLORS.maxSharpe, entry: maxSharpe },
    { label: "Min volatility", hint: "Smallest past swings", color: MIX_COLORS.minVolatility, entry: minVolatility },
  ];
  // Colours follow first appearance across the cards (your own holdings first), so a ticker is
  // the same colour in all three bars.
  const tickers = [...new Set(mixes.flatMap((m) => m.entry?.weights.map((w) => w.ticker) ?? []))];
  const colorOf = (ticker: string) => CATEGORICAL_PALETTE[tickers.indexOf(ticker) % CATEGORICAL_PALETTE.length];

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Your Allocation vs. Two Historical Mixes"
        desc="The same holdings, weighted three ways and measured on the same past returns."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        {mixes.map((m) => (
          <div key={m.label} className="p-6 md:p-7 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                <h3 className="text-sm font-black text-slate-900">{m.label}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">{m.hint}</p>
            </div>
            {m.entry === null ? (
              <p className="text-sm text-slate-500">Not available.</p>
            ) : (
              <>
                <dl className="space-y-2">
                  <MixFigure label="Avg. return" value={formatPctOrDash(m.entry.expectedReturnPct)} strong />
                  <MixFigure label="Volatility" value={plainPctOrDash(m.entry.volatilityPct)} />
                  <MixFigure label="Sharpe ratio" value={ratioOrDash(m.entry.sharpeRatio)} />
                </dl>
                <MixWeights weights={m.entry.weights} colorOf={colorOf} />
              </>
            )}
          </div>
        ))}
      </div>
    </Module>
  );
}

function MixFigure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-lg font-black text-slate-900" : "text-sm font-bold text-slate-700"}`}>{value}</dd>
    </div>
  );
}

/** One segmented bar for a mix's weights, with a legend of ticker and weight under it. */
function MixWeights({
  weights, colorOf,
}: { weights: RiskPortfolioEntry["weights"]; colorOf: (ticker: string) => string }) {
  const shown = weights.filter((w) => w.weightPct >= 0.05);
  if (shown.length === 0) return null;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {shown.map((w) => (
          <div
            key={w.ticker}
            title={`${w.ticker}: ${w.weightPct.toFixed(1)}%`}
            className="h-full"
            style={{ width: `${w.weightPct}%`, background: colorOf(w.ticker) }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1">
        {shown.map((w) => (
          <li key={w.ticker} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf(w.ticker) }} />
            {w.ticker} <span className="tabular-nums text-slate-500">{w.weightPct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * FRONTIER MODULE — the efficient frontier: for each level of volatility, the highest past
 * return any long-only mix of your holdings would have had. The three mixes from
 * MixComparisonModule are marked on it (the current allocation normally sits below the curve).
 * Points with a null coordinate are skipped; the dots extend the axes if they fall outside the
 * curve's own range.
 */
function FrontierModule({
  frontier, current, maxSharpe, minVolatility,
}: {
  frontier: { volatilityPct: number | null; expectedReturnPct: number | null }[];
  current: RiskPortfolioEntry | null;
  maxSharpe: RiskPortfolioEntry | null;
  minVolatility: RiskPortfolioEntry | null;
}) {
  const curve = useMemo(
    () => frontier
      .filter((f): f is { volatilityPct: number; expectedReturnPct: number } => f.volatilityPct !== null && f.expectedReturnPct !== null)
      .sort((a, b) => a.volatilityPct - b.volatilityPct),
    [frontier],
  );
  const dots = [
    { label: "Your allocation", color: MIX_COLORS.current, entry: current },
    { label: "Max Sharpe", color: MIX_COLORS.maxSharpe, entry: maxSharpe },
    { label: "Min volatility", color: MIX_COLORS.minVolatility, entry: minVolatility },
  ].filter((d): d is typeof d & { entry: RiskPortfolioEntry & { volatilityPct: number; expectedReturnPct: number } } =>
    d.entry?.volatilityPct != null && d.entry?.expectedReturnPct != null);

  if (curve.length < 2) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Efficient Frontier"
        desc="The highest past return available at each level of volatility, using your current holdings."
      />
      <div className="p-6 md:p-7 pb-3 h-80">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 320 }}>
          <LineChart data={curve} margin={{ top: 16, right: 16, left: 0, bottom: 20 }}>
            <XAxis
              type="number"
              dataKey="volatilityPct"
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
              axisLine={false}
              tickLine={false}
              label={{ value: "Volatility", position: "insideBottom", offset: -12, fontSize: 11, fill: AXIS_TICK_COLOR }}
            />
            <YAxis
              type="number"
              domain={["auto", "auto"]}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
              axisLine={false}
              tickLine={false}
              width={64}
              label={{ value: "Avg. annual return (past)", angle: -90, position: "insideLeft", offset: 4, fontSize: 11, fill: AXIS_TICK_COLOR }}
            />
            <Tooltip
              labelFormatter={(label) => `Volatility ${Number(label).toFixed(2)}%`}
              formatter={(value) => [`${Number(value).toFixed(2)}%`, "Avg. annual return (past)"]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line type="monotone" dataKey="expectedReturnPct" stroke={BENCHMARK_COLOR} strokeWidth={2} dot={false} isAnimationActive={false} />
            {dots.map((d) => (
              <ReferenceDot
                key={d.label}
                x={d.entry.volatilityPct}
                y={d.entry.expectedReturnPct}
                r={6}
                fill={d.color}
                stroke="#ffffff"
                strokeWidth={2}
                ifOverflow="extendDomain"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 md:px-7 pb-6 md:pb-7 text-xs font-bold text-slate-600">
        <span className="flex items-center gap-2">
          <span className="w-4 border-t-2" style={{ borderColor: BENCHMARK_COLOR }} /> Efficient frontier
        </span>
        {dots.map((d) => (
          <span key={d.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} /> {d.label}
          </span>
        ))}
      </div>
    </Module>
  );
}

// The gap is worded against the max-Sharpe mix as a description of the distance, not as advice
// — "above / below" rather than "reduce / add" — and coloured neutrally (amber / blue), not
// red / green, so neither side reads as the good one.
const GAP_COLORS: Record<WeightGapEntry["direction"], string> = {
  overweight: "#d97706",
  underweight: "#2563eb",
  in_line: BENCHMARK_COLOR,
};

const GAP_GRID = "grid grid-cols-[6.5rem_minmax(0,1fr)_4rem] sm:grid-cols-[10rem_minmax(0,1fr)_4.5rem] items-center gap-3";

/**
 * WEIGHT GAPS — for each holding, how far its weight sits from its weight in the max-Sharpe
 * mix, as one bar growing from a centre line: to the right when held above that mix, to the
 * left when below (delta = current − target, in percentage points; the backend has already
 * resolved the direction, so nothing is subtracted here). Bars share one scale. Under each
 * ticker, its weight now → in that mix. Shown to see how far the portfolio sits from that
 * historical mix, not as a suggestion to move towards it.
 */
function WeightGapsModule({ gaps }: { gaps: WeightGapEntry[] }) {
  if (gaps.length === 0) return null;

  const maxAbs = Math.max(...gaps.map((g) => Math.abs(g.deltaPct)), 1);

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Weights vs. the Max-Sharpe Mix"
        desc="How far each holding's weight sits from the mix that had the best past return per unit of risk. Under each ticker: its weight now → in that mix."
      />
      <div className="p-6 md:p-7 space-y-3.5">
        <div className={GAP_GRID}>
          <span />
          <div className="flex justify-between text-[11px] font-bold text-slate-500">
            <span>◀ Below the mix</span>
            <span>Above the mix ▶</span>
          </div>
          <span />
        </div>
        {gaps.map((g) => {
          const above = g.deltaPct >= 0;
          return (
            <div key={g.ticker} className={GAP_GRID} title={g.name}>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">{g.ticker}</p>
                <p className="text-[11px] text-slate-500 tabular-nums truncate">
                  {g.currentWeightPct.toFixed(1)}% → {g.targetWeightPct.toFixed(1)}%
                </p>
              </div>
              <div className="relative h-5 rounded bg-slate-50">
                <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                <span
                  className="absolute inset-y-1 rounded-sm"
                  style={{
                    [above ? "left" : "right"]: "50%",
                    width: `${(Math.abs(g.deltaPct) / maxAbs) * 50}%`,
                    background: GAP_COLORS[g.direction] ?? GAP_COLORS.in_line,
                  }}
                />
              </div>
              <span className="text-right text-[13px] font-bold tabular-nums text-slate-600">
                {above ? "+" : ""}{g.deltaPct.toFixed(1)} pp
              </span>
            </div>
          );
        })}
      </div>
    </Module>
  );
}

/**
 * RISK ASSETS — the per-asset inputs the model works from: each holding's average annual return
 * over the history the holdings share (a historical mean, not a forecast) and its volatility.
 * Only holdings with enough history to be estimated appear.
 */
function RiskAssetsModule({ assets }: { assets: RiskModelResponse["assets"] }) {
  if (assets.length === 0) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Holdings Behind the Model"
        desc="Each holding's average annual return and volatility over the history they share."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 md:p-7">
        {assets.map((a) => (
          <div key={a.ticker} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{a.ticker}</p>
              <p className="text-xs text-slate-500 truncate">{a.name}</p>
            </div>
            <div className="flex gap-5 shrink-0 text-right">
              <div>
                <p className="text-sm font-black text-slate-900 tabular-nums">{formatPctOrDash(a.expectedReturnPct)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Avg. return</p>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 tabular-nums">{plainPctOrDash(a.volatilityPct)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Volatility</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Module>
  );
}

/**
 * HOLDINGS EXPLORER — the one place all currencies appear together. Deliberately a plain
 * filterable table rather than a bar chart: bar length would encode invested value, and a
 * USD bar next to a EUR bar of the same length would visually claim they're equal, which
 * isn't true without a live FX rate. A table just lists the numbers with their own currency.
 */
/**
 * HOLDINGS EXPLORER — the searchable/filterable holdings table, with the currency-composition
 * breakdown (by asset / by category / by broker) folded in as what the Currency filter reveals
 * rather than a separate carousel module above it: pick a currency here and its composition
 * appears below the table, using the exact same holdings the table would show for that
 * currency with no other filter applied. "All currencies" has no single breakdown to show —
 * percentages from mixed currencies would silently treat e.g. 1 EUR and 1 USD as equal weight
 * (the same reason CompositionDonut below requires one currency per call) — so that state
 * prompts picking a currency instead of rendering something misleading.
 */
function HoldingsExplorer({ holdings, byCurrency }: { holdings: Holding[]; byCurrency: CurrencyBreakdown[] }) {
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

  // Composition tracks only the Currency filter, not asset class or search — narrowing to one
  // asset class would make "By category" a single 100% slice, and it answers "what does this
  // currency look like overall", not "what does my current search match".
  const activeBreakdown = currency !== "all" ? byCurrency.find(b => b.currency === currency) : undefined;

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

      {byCurrency.length > 0 && (
        <div className="border-t border-slate-200">
          {activeBreakdown ? (
            <>
              <div className="px-5 md:px-6 pt-5">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#C49A3C]">Composition · {activeBreakdown.currency}</p>
                <p className="text-xs text-slate-500 mt-1">{compositionDesc(activeBreakdown)}</p>
              </div>
              {CompositionBody(activeBreakdown, holdings.filter(h => h.currency === activeBreakdown.currency))}
            </>
          ) : (
            <p className="px-5 md:px-6 py-5 text-xs text-slate-400">
              Select a currency above to see its composition — holdings in different currencies can&apos;t be combined into one percentage breakdown.
            </p>
          )}
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

/**
 * PERIOD HERO — the headline figure atop a month's Performance card: End Value large and
 * prominent, with Total Change as a colored badge beside it, rather than folded in as one
 * more equal-weight tile among Start Value / Market Effect / Dividends below. Gives the
 * card a clear focal point instead of reading as a flat wall of same-size stats.
 */
function PeriodHero({
  currency, endValue, deltaValue, deltaValuePct, isGain, hasBaseline,
}: {
  currency: string; endValue: number; deltaValue: number; deltaValuePct: number; isGain: boolean; hasBaseline: boolean;
}) {
  const DeltaIcon = isGain ? TrendingUp : TrendingDown;
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">End Value</p>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl md:text-4xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {formatCurrency(endValue, currency, 0)}
        </p>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${isGain ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          {isGain ? "+" : ""}{formatCurrency(deltaValue, currency, 0)}
        </span>
      </div>
      {/* The percentage gets its own colored, directional line rather than sitting in
          parentheses next to the amount above — it's a distinct figure, not an annotation. */}
      <div className={`flex items-center gap-1 text-sm font-bold mt-2 ${!hasBaseline ? "text-slate-400" : isGain ? "text-emerald-600" : "text-rose-600"}`}>
        {hasBaseline ? (
          <>
            <DeltaIcon className="h-3.5 w-3.5" />
            {formatPct(deltaValuePct)}
          </>
        ) : (
          "—"
        )}
      </div>
      <p className="text-[13px] text-slate-500 mt-1.5">Total change for the month, including capital added or withdrawn</p>
    </div>
  );
}

/**
 * MONTH DETAIL — a single month's full breakdown, opened by clicking a cell in the returns
 * heatmap: a Performance card led by End Value as the headline figure (Total Change as a
 * badge next to it) with Start Value / Market Effect / Dividends as supporting figures, plus
 * a separate Risk card for Volatility / Max Drawdown — kept apart from Performance since
 * these are risk figures, not performance, and mixing them read as one undifferentiated wall
 * of tiles (see the Monthly/Annual detail view this replaces).
 */
function MonthDetail({ period, portfolioUuid }: { period: PeriodDashboard; portfolioUuid: string }) {
  const isGain = period.deltaValue >= 0;
  const marketIsGain = period.marketEffect >= 0;
  const hasBaseline = hasPeriodBaseline(period);
  const title = monthYearLabel(period.periodStart);
  const rangeLabel = `${fullDateLabel(period.periodStart)} – ${fullDateLabel(period.periodEnd)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={period.currency}
        title={title}
        desc={rangeLabel}
        right={<ViewReportLink portfolioUuid={portfolioUuid} documentId={period.reportDocumentId} />}
      />
      {isPeriodEmpty(period) ? (
        <EmptyPeriodState message="No portfolio activity recorded for this month yet." />
      ) : (
        <>
          <Module>
            <PeriodHero
              currency={period.currency}
              endValue={period.t1Value}
              deltaValue={period.deltaValue}
              deltaValuePct={period.deltaValuePct}
              isGain={isGain}
              hasBaseline={hasBaseline}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
              <StatContent
                title="Start Value"
                value={formatCurrency(period.t0Value, period.currency, 0)}
                icon={<Wallet className="h-4 w-4 text-slate-500" />}
                description="Market value at month start"
                color="slate"
              />
              <StatContent
                title="Market Effect"
                value={<AmountWithDelta amount={`${marketIsGain ? "+" : ""}${formatCurrency(period.marketEffect, period.currency, 0)}`} pct={period.marketEffectPct} hasBaseline={hasBaseline} />}
                icon={marketIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                description="Price movement alone, capital flows excluded"
                color={marketIsGain ? "emerald" : "red"}
              />
              <StatContent
                title="Dividends"
                value={formatCurrency(period.dividendsInPeriod, period.currency, 0)}
                icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
                description="Received this month"
                color="blue"
              />
            </div>
          </Module>
          <Module>
            <ModuleHead
              eyebrow="Risk"
              title="Volatility & Drawdown"
              desc="How choppy this month was, independent of direction."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
              <StatContent
                title="Volatility"
                value={period.volatilityPct !== null ? `${period.volatilityPct.toFixed(2)}%` : "—"}
                icon={<Activity className="h-4 w-4 text-slate-500" />}
                description="Annualized, from daily returns"
                color="slate"
              />
              <StatContent
                title="Max Drawdown"
                value={period.maxDrawdownPct !== null ? `${period.maxDrawdownPct.toFixed(2)}%` : "—"}
                icon={<TrendingDown className="h-4 w-4 text-slate-500" />}
                description="Largest peak-to-trough decline"
                color="slate"
              />
            </div>
          </Module>
        </>
      )}
    </div>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Monthly market-effect swings beyond this magnitude paint at full color intensity — chosen
// so a typical +/-1-3% month still reads clearly rather than everything looking pale.
const HEATMAP_INTENSITY_CAP = 8;

function heatmapCellStyle(pct: number): React.CSSProperties {
  const intensity = Math.min(Math.abs(pct) / HEATMAP_INTENSITY_CAP, 1);
  const [r, g, b] = pct >= 0 ? [16, 185, 129] : [244, 63, 94]; // emerald-500 / rose-500
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, ${(0.12 + intensity * 0.68).toFixed(3)})`,
    color: intensity > 0.5 ? "#ffffff" : pct >= 0 ? "#047857" : "#be123c",
  };
}

/**
 * MONTHLY RETURNS HEATMAP — one row per calendar year (most recent first), one column per
 * calendar month, each cell shaded by that month's market effect (green = gain, rose = loss,
 * intensity scaled by magnitude) and clickable to open MonthDetail. Replaces the old
 * Monthly/Annual tabs' bar chart + card picker: a single grid makes the whole history
 * scannable at once instead of one time horizon at a time. Backed by
 * FullHistoryDashboard.monthlyMarketEffect, a single lightweight all-years fetch — a
 * (year, month) pair simply absent (before inception, or a month too recent to be closed
 * out yet) renders as an empty, non-clickable cell rather than a false zero.
 */
function MonthlyReturnsHeatmap({
  entries, onSelectMonth,
}: {
  entries: MonthlyMarketEffectEntry[]; onSelectMonth: (year: number, month: number) => void;
}) {
  const byYear = useMemo(() => {
    const map = new Map<number, Map<number, number>>();
    for (const e of entries) {
      if (!map.has(e.year)) map.set(e.year, new Map());
      map.get(e.year)!.set(e.month, e.marketEffectPct);
    }
    return map;
  }, [entries]);

  const years = useMemo(() => [...byYear.keys()].sort((a, b) => b - a), [byYear]);

  if (years.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>;
  }

  return (
    <div className="p-6 md:p-7 overflow-x-auto">
      <table className="border-collapse min-w-150 w-full table-fixed">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-black uppercase tracking-widest text-slate-400 pb-3 pr-3 w-16">Year</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="text-[10px] font-black uppercase tracking-widest text-slate-400 pb-3 text-center">{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="text-sm font-bold text-slate-900 pr-3 py-1 tabular-nums">{year}</td>
              {MONTH_LABELS.map((_, i) => {
                const month = i + 1;
                const pct = byYear.get(year)?.get(month);
                if (pct === undefined) {
                  return (
                    <td key={month} className="p-1">
                      <div className="w-full aspect-square rounded-lg bg-slate-50" />
                    </td>
                  );
                }
                return (
                  <td key={month} className="p-1">
                    <button
                      onClick={() => onSelectMonth(year, month)}
                      title={`${MONTH_LABELS[i]} ${year}: ${formatPct(pct)}`}
                      style={heatmapCellStyle(pct)}
                      className="w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums hover:ring-2 hover:ring-offset-1 hover:ring-[#C49A3C] transition-all cursor-pointer"
                    >
                      {Math.round(pct)}%
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CurrencyRealizedGroup {
  currency: string;
  totalPl: number;
  sellCount: number;
  trades: AssetRealizedTrade[];
}

function groupRealizedTradesByCurrency(trades: AssetRealizedTrade[]): CurrencyRealizedGroup[] {
  const byCurrency = new Map<string, AssetRealizedTrade[]>();
  for (const t of trades) {
    if (!byCurrency.has(t.currency)) byCurrency.set(t.currency, []);
    byCurrency.get(t.currency)!.push(t);
  }
  return [...byCurrency.entries()]
    .map(([currency, list]) => ({
      currency,
      totalPl: list.reduce((sum, t) => sum + t.realizedPl, 0),
      sellCount: list.reduce((sum, t) => sum + t.sellCount, 0),
      trades: [...list].sort((a, b) => Math.abs(b.realizedPl) - Math.abs(a.realizedPl)),
    }))
    .sort((a, b) => b.trades.length - a.trades.length);
}

/**
 * REALIZED P&L CARD — lifetime closed-position P&L, moved here from the Dashboard Overview
 * (which now only covers live/open-position figures) since it's a performance figure over
 * the portfolio's full history, same time horizon as the rest of this page. Grouped by each
 * trade's own native currency (not the reference currency the rest of this page's figures
 * are in) — a group's totals are computed locally from its trades rather than relying on a
 * pre-aggregated backend figure, since FullHistoryDashboard only supplies the trade list.
 *
 * With exactly one currency in play, its Total P&L / Sell Transactions move up into the card's
 * own header (right-aligned next to the title, same treatment as VolatilityModule's headline
 * figure) instead of repeating in a row above that single group's trade list — one currency
 * means one unambiguous total. With more than one currency, a single header figure would imply
 * the totals can be summed across them, which they can't (see groupRealizedTradesByCurrency),
 * so each group keeps its own totals row in that case.
 */
function RealizedPnLCard({ trades }: { trades: AssetRealizedTrade[] }) {
  const groups = useMemo(() => groupRealizedTradesByCurrency(trades), [trades]);
  const single = groups.length === 1 ? groups[0] : null;
  const singleIsGain = single !== null && single.totalPl >= 0;

  return (
    <Module>
      <ModuleHead
        eyebrow="Lifetime"
        title="Realized P&L"
        desc="From closed positions, based on recorded buy and sell prices."
        right={single ? (
          <div className="flex gap-6 flex-wrap">
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total P&L</p>
              <p
                className={`text-2xl font-black tabular-nums mt-1 ${singleIsGain ? "text-emerald-600" : "text-rose-600"}`}
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {singleIsGain ? "+" : ""}{formatCurrency(single.totalPl, single.currency, 2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sell Transactions</p>
              <p className="text-2xl font-black tabular-nums text-slate-900 mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {single.sellCount}
              </p>
            </div>
          </div>
        ) : undefined}
      />
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">No closed positions yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map((group) => (
            <RealizedPnLGroup key={group.currency} group={group} showCurrencyLabel={groups.length > 1} showTotals={groups.length > 1} />
          ))}
        </div>
      )}
    </Module>
  );
}

function RealizedPnLGroup({
  group, showCurrencyLabel, showTotals,
}: { group: CurrencyRealizedGroup; showCurrencyLabel: boolean; showTotals: boolean }) {
  const isGain = group.totalPl >= 0;
  const maxAbsPl = Math.max(0, ...group.trades.map(t => Math.abs(t.realizedPl)));

  return (
    <div className="p-6 md:p-7">
      {/* Skipped entirely when there's nothing left to show here — a single currency's Total
          P&L / Sell Transactions already moved up into the card header (see RealizedPnLCard). */}
      {(showCurrencyLabel || showTotals) && (
        <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
          {showCurrencyLabel && <p className="text-xs font-black uppercase tracking-wider text-slate-400">{group.currency}</p>}
          {showTotals && (
            <div className="flex gap-6 flex-wrap ml-auto">
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total P&L</p>
                <p className={`text-lg font-black tabular-nums ${isGain ? "text-emerald-600" : "text-rose-600"}`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {isGain ? "+" : ""}{formatCurrency(group.totalPl, group.currency, 2)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Sell Transactions</p>
                <p className="text-lg font-black tabular-nums text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {group.sellCount}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="space-y-5">
        {group.trades.map((t) => {
          const tradeIsGain = t.realizedPl >= 0;
          const halfWidthPct = maxAbsPl > 0 ? (Math.abs(t.realizedPl) / maxAbsPl) * 50 : 0;
          const label = t.ticker ? `${t.name} (${t.ticker})` : t.name;
          return (
            <div key={`${t.currency}::${t.assetId}`}>
              <div className="flex items-baseline justify-between gap-4 mb-1.5">
                <span className="text-sm font-bold text-slate-900 truncate">{label}</span>
                <span className={`text-sm font-bold shrink-0 ${tradeIsGain ? "text-emerald-600" : "text-rose-600"}`}>
                  {tradeIsGain ? "+" : ""}{formatCurrency(t.realizedPl, t.currency, 2)}
                </span>
              </div>
              <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
                {tradeIsGain ? (
                  <div className="absolute left-1/2 top-0 h-full rounded-r-full bg-emerald-500" style={{ width: `${halfWidthPct}%` }} />
                ) : (
                  <div className="absolute right-1/2 top-0 h-full rounded-l-full bg-rose-500" style={{ width: `${halfWidthPct}%` }} />
                )}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[11px] text-slate-400">
                  {formatQuantity(t.quantitySold)} units · {t.sellCount} {t.sellCount === 1 ? "sale" : "sales"}
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

const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const formatPctOrDash = (pct: number | null) => (pct === null ? "—" : formatPct(pct));

/**
 * Fetches one analytics document for a module. Every analytics endpoint answers 200 with the
 * document or null ("being prepared"), so `data` null with `failed` false means "not computed
 * yet"; `failed` is only for a request that errored. A failed request degrades to the
 * module's own message rather than the page-level error banner, since the other modules on
 * the page are unaffected.
 *
 * `updating` is true while the document came back `isStale: true` and the rebuild it's waiting
 * on hasn't landed: the caller should hide its numbers/charts behind an "updating" state rather
 * than draw them (see StaleUpdatingState). This hook refetches every STALE_POLL_INTERVAL_MS
 * while that's the case, and gives up after STALE_TIMEOUT_MS — at that point `updating` drops
 * back to false (so the caller draws the — possibly still-mixed — data) even though
 * `data.isStale` is still true, which the caller reads as "show the taking-longer-than-usual
 * hint instead of the updating state" (see UpdatingNote's call sites).
 */
function useAnalytics<T extends { isStale: boolean }>(
  load: (portfolioUuid: string) => Promise<T | null>,
  portfolioUuid: string,
) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; failed: boolean; updating: boolean }>({
    data: null, loading: true, failed: false, updating: false,
  });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let staleSince: number | null = null;

    const tick = async (isFirst: boolean) => {
      if (isFirst) setState({ data: null, loading: true, failed: false, updating: false });
      try {
        const data = await load(portfolioUuid);
        if (cancelled) return;
        if (data?.isStale) {
          staleSince ??= Date.now();
          const timedOut = Date.now() - staleSince >= STALE_TIMEOUT_MS;
          setState({ data, loading: false, failed: false, updating: !timedOut });
          if (!timedOut) timer = setTimeout(() => tick(false), STALE_POLL_INTERVAL_MS);
        } else {
          staleSince = null;
          setState({ data, loading: false, failed: false, updating: false });
        }
      } catch {
        if (!cancelled) setState({ data: null, loading: false, failed: true, updating: false });
      }
    };
    tick(true);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [load, portfolioUuid]);

  return state;
}

/**
 * Shared loading / failed / null / updating placeholder for the analytics modules; null when
 * there's a document to draw normally. `updating` (see useAnalytics) takes priority over
 * drawing the module's own content but comes after the other states, which all mean there's no
 * document at all to be stale about.
 */
function AnalyticsPlaceholder({
  loading, failed, hasData, updating, preparingMessage,
}: { loading: boolean; failed: boolean; hasData: boolean; updating: boolean; preparingMessage: string }) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
      </div>
    );
  }
  if (failed) return <ModuleMessage>Unable to load this right now. Try again in a moment.</ModuleMessage>;
  if (!hasData) return <ModuleMessage>{preparingMessage}</ModuleMessage>;
  if (updating) return <StaleUpdatingState />;
  return null;
}

/**
 * ROLLING VOLATILITY CHART — annualized volatility over a rolling window, one point per day
 * from the backend, thinned by toChartPoints before drawing.
 */
function RollingVolatilityChart({ series }: { series: TimeSeries }) {
  const points = useMemo(() => toChartPoints(series), [series]);

  if (points.length < 2) {
    return <ModuleMessage>Not enough data yet to chart.</ModuleMessage>;
  }

  return (
    <div className="p-6 md:p-7 h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <LineChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "Volatility"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line type="monotone" dataKey="value" name="Volatility" stroke="#C49A3C" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * VOLATILITY MODULE — /volatility: the portfolio's annualized volatility as a headline, and
 * the rolling series behind it. The document is null until the first analytics run, and
 * "insufficient_history" (nothing to show but a message) under a year of history.
 */
function VolatilityModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<VolatilityResponse>(portfolioService.getVolatility, portfolioUuid);

  const showFigure = data !== null && !updating && data.status !== "insufficient_history";

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk"
        title="Volatility"
        icon={
          <InfoTip text="How widely your portfolio's daily returns swing, scaled to a year (the standard deviation of daily returns, annualized). A higher figure means bigger ups and downs along the way.">
            <div className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-help bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20">
              <Activity className="h-4 w-4" />
            </div>
          </InfoTip>
        }
        desc={data?.rollingWindowDays ? `The chart uses a rolling ${data.rollingWindowDays}-day window.` : "How much your portfolio's value moves around."}
        right={showFigure ? (
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Annualized volatility</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {data.annualizedVolatilityPct === null ? "—" : `${data.annualizedVolatilityPct.toFixed(2)}%`}
            </p>
          </div>
        ) : undefined}
      />
      <AnalyticsPlaceholder
        loading={loading}
        failed={failed}
        hasData={data !== null}
        updating={updating}
        preparingMessage="Being prepared — this shows up after the overnight analysis of your portfolio has run."
      />
      {data !== null && !updating && (
        <>
          {data.isStale && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {data.status === "insufficient_history" ? (
            <ModuleMessage>Volatility needs at least a year of history — it will appear once your portfolio has one.</ModuleMessage>
          ) : (
            data.rollingVolatilityPct && <RollingVolatilityChart series={data.rollingVolatilityPct} />
          )}
        </>
      )}
    </Module>
  );
}

/**
 * CUMULATIVE RETURN CHART — portfolio vs. benchmark, both in percent with base 0 at the start
 * (not a growth multiple). The backend says both curves share the same dates, but the
 * benchmark is still looked up by date rather than zipped by index so a gap on either side
 * can't misalign the lines.
 */
function CumulativeReturnChart({ portfolio, benchmark }: { portfolio: TimeSeries; benchmark: TimeSeries }) {
  const data = useMemo(() => {
    const benchmarkByDate = new Map(benchmark.dates.map((d, i) => [d, benchmark.values[i]]));
    return toChartPoints(portfolio).map((p) => ({ date: p.date, portfolio: p.value, benchmark: benchmarkByDate.get(p.date) }));
  }, [portfolio, benchmark]);

  if (data.length < 2) {
    return <ModuleMessage>Not enough history yet to chart.</ModuleMessage>;
  }

  return (
    <div className="p-6 md:p-7 h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value, name) => [`${Number(value).toFixed(2)}%`, name]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke={PORTFOLIO_COLOR} strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="benchmark" name="Benchmark" stroke={BENCHMARK_COLOR} strokeWidth={2} dot={false} strokeDasharray="4 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * SERIES VALUE — one labelled figure for a StatContent that compares two series: a marker
 * matching that series' line on the chart (solid gold for the portfolio, dashed grey for the
 * benchmark), its name, and its value. Reads as its own legend, so the two figures can't be
 * mistaken for one another the way a "56% vs 59%" string could.
 */
function SeriesValue({
  label, value, color, dashed = false,
}: { label: string; value: string; color: string; dashed?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span className="w-4 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />
        {label}
      </span>
      <span className="text-lg tabular-nums">{value}</span>
    </div>
  );
}

/**
 * BENCHMARK COMPOSITION — what the dashed benchmark line on the chart is made of: the proxy
 * ETFs the benchmark holds, largest first, with their weights. Sits right under the chart so
 * it reads as the explanation of that line. The backend also lists proxies of closed
 * positions at weight 0; those are dropped so only today's basket is shown.
 */
function BenchmarkComposition({ components }: { components: BenchmarkComponentEntry[] }) {
  const basket = components
    .filter((c): c is BenchmarkComponentEntry & { weightPct: number } => (c.weightPct ?? 0) > 0)
    .sort((a, b) => b.weightPct - a.weightPct);

  if (basket.length === 0) return null;

  const max = Math.max(...basket.map((c) => c.weightPct), 0.01);

  return (
    <div className="px-6 md:px-7 pb-6 md:pb-7">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-5 border-t-2 border-dashed" style={{ borderColor: BENCHMARK_COLOR }} />
        <h3 className="text-sm font-black text-slate-900">What the benchmark is made of</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 max-w-xl leading-relaxed">
        Each of your holdings is matched to a proxy ETF. The benchmark holds them at today&apos;s weights and
        receives the same deposits and withdrawals as your portfolio.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        {basket.map((c, i) => (
          <div key={`${c.ticker ?? c.name}-${i}`}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="min-w-0 truncate">
                <span className="text-[13px] font-bold text-slate-900">{c.ticker ?? c.name}</span>
                {c.ticker && <span className="text-xs text-slate-400 ml-2">{c.name}</span>}
              </span>
              <span className="text-[13px] font-bold text-slate-500 tabular-nums shrink-0">{c.weightPct.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(c.weightPct / max) * 100}%`, background: BENCHMARK_COLOR }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * BENCHMARK MODULE — /benchmark: the portfolio against a synthetic benchmark of proxy ETFs
 * that receives the same cash flows. All figures are already percentages (or plain ratios),
 * over the days the portfolio and benchmark share, and any of them can be null. Its
 * composition is shown under the chart (see BenchmarkComposition).
 */
function BenchmarkModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<BenchmarkResponse>(portfolioService.getBenchmark, portfolioUuid);

  const coverage = data?.yearsCovered != null ? `Over the ${data.yearsCovered.toFixed(1)} years you share with the benchmark` : "Since inception";
  const outperformed = data?.outperformed ?? null;

  return (
    <Module>
      <ModuleHead
        eyebrow="All Time"
        title="Benchmark Comparison"
        desc={data && !updating ? `${coverage}.` : "How your portfolio compares to the market."}
      />
      <AnalyticsPlaceholder
        loading={loading}
        failed={failed}
        hasData={data !== null}
        updating={updating}
        preparingMessage="Being prepared — this shows up after the overnight analysis of your portfolio has run."
      />
      {data !== null && !updating && (
        <>
          {data.isStale && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {data.status !== "ok" ? (
            <ModuleMessage>Not enough overlapping history with the benchmark yet to compare.</ModuleMessage>
          ) : (
            <>
              {data.portfolioCumulativeReturnPct && data.benchmarkCumulativeReturnPct && (
                <CumulativeReturnChart
                  portfolio={data.portfolioCumulativeReturnPct}
                  benchmark={data.benchmarkCumulativeReturnPct}
                />
              )}
              <BenchmarkComposition components={data.components} />
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x border-t border-slate-100">
                <StatContent
                  title="Total Return"
                  value={
                    <div className="space-y-1.5">
                      <SeriesValue label="Portfolio" value={formatPctOrDash(data.portfolioTotalReturnPct)} color={PORTFOLIO_COLOR} />
                      <SeriesValue label="Benchmark" value={formatPctOrDash(data.benchmarkTotalReturnPct)} color={BENCHMARK_COLOR} dashed />
                    </div>
                  }
                  icon={outperformed === false ? <TrendingDown className="h-4 w-4 text-rose-600" /> : <TrendingUp className="h-4 w-4 text-emerald-600" />}
                  color={outperformed === null ? "slate" : outperformed ? "emerald" : "red"}
                  info="How much each grew over the shared period, counting only market moves: deposits and withdrawals are stripped out, so it isn't the gain on your open positions. The benchmark is fed the same cash flows as your portfolio."
                />
                <StatContent
                  title="Excess Return"
                  value={formatPctOrDash(data.excessReturnPct)}
                  icon={<Scale className="h-4 w-4 text-slate-500" />}
                  color="slate"
                  info="The gap between your portfolio's annualized return and the benchmark's, in percentage points. Positive means your portfolio grew faster than the benchmark, negative means slower."
                />
                <StatContent
                  title="Alpha"
                  value={formatPctOrDash(data.alphaPct)}
                  icon={<Activity className="h-4 w-4 text-slate-500" />}
                  color="slate"
                  info="The part of your annualized return that your exposure to the benchmark (beta) doesn't explain, calculated with a risk-free rate of 0. Positive means the portfolio earned more than its market exposure alone would suggest."
                />
                <StatContent
                  title="Beta"
                  value={data.beta === null ? "—" : data.beta.toFixed(2)}
                  icon={<Activity className="h-4 w-4 text-slate-500" />}
                  color="slate"
                  info="How much your portfolio tends to move when the benchmark moves. 1.0 moves in step with it, 0.5 about half as much, and above 1.0 amplifies its moves."
                />
              </div>
            </>
          )}
        </>
      )}
    </Module>
  );
}

// Each is null while the backend hasn't computed it for this user yet; `summary` never is
// (see portfolioService.getPortfolioSummary).
interface PortfolioComposition {
  summary: PortfolioSummary;
  sector: ExposureEntryResponse[] | null;
  region: ExposureEntryResponse[] | null;
}

/**
 * HISTORY PAGE — Insights' entire page now (see PerformanceSection above): lifetime figures +
 * trend chart, a year-by-month returns heatmap, lifetime realized P&L and benchmark comparison
 * under Overview; current holdings/composition under its own tab; volatility and the risk model
 * under Risk. Used to merge what were three separate tabs (Monthly, Annual, Full History) into
 * just Overview. Clicking a heatmap cell swaps the whole page for that month's own detail
 * (MonthDetail) — same "replace, don't stack" pattern the old Monthly/Annual picker used, with
 * a back button to return. Month detail
 * needs the richer per-month figures (t0/t1 value, dividends, volatility, drawdown, report)
 * that monthlyMarketEffect doesn't carry, so it's fetched on demand via /monthly?year=, one
 * request per year, cached in `monthCache` so re-opening a month already visited this
 * session doesn't refetch.
 */
/**
 * MONTH TO DATE MODULE — how the portfolio has moved this month: its value on the 1st, the
 * day-over-day and month-to-date changes, and a bar per day of the day-over-day change. Deltas,
 * not raw values: a stable portfolio's value line is visually flat at this timescale. /today
 * carries isStale like the analytics documents, so useAnalytics polls it the same way.
 */
function MonthToDateModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<TodayDashboard>(portfolioService.getTodayDashboard, portfolioUuid);

  return (
    <Module>
      <ModuleHead
        eyebrow={data?.currency ?? "This month"}
        title="This month"
        desc="Day-over-day and month-to-date moves, from daily market prices."
      />
      {AnalyticsPlaceholder({
        loading, failed, hasData: data !== null, updating,
        preparingMessage: "Not enough history yet to show this month's moves.",
      }) ?? (data && <MonthToDateBody data={data} />)}
    </Module>
  );
}

function MonthToDateBody({ data }: { data: TodayDashboard }) {
  const isDayGain = data.deltaDayValue >= 0;
  const isMtdGain = data.deltaMtdValue >= 0;
  const points = [...data.chart]
    .sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime())
    .map((s) => ({ date: s.snapshotAt, deltaValue: s.deltaValue, deltaValuePct: s.deltaValuePct }));

  return (
    <>
      {data.isStale && <div className="px-6 md:px-7 pt-6"><UpdatingNote /></div>}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <StatContent
          title="Month Start Value"
          value={formatCurrency(data.monthStartValue, data.currency, 0)}
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          info="Market value on the 1st of this month."
          color="blue"
        />
        <StatContent
          title="Day Change"
          value={<AmountWithDelta amount={`${isDayGain ? "+" : ""}${formatCurrency(data.deltaDayValue, data.currency, 0)}`} pct={data.deltaDayValuePct} />}
          icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info="How much the portfolio moved since the previous day."
          color={isDayGain ? "emerald" : "red"}
        />
        <StatContent
          title="Month-to-Date Change"
          value={<AmountWithDelta amount={`${isMtdGain ? "+" : ""}${formatCurrency(data.deltaMtdValue, data.currency, 0)}`} pct={data.deltaMtdValuePct} />}
          icon={isMtdGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info="How much the portfolio moved since the 1st of this month."
          color={isMtdGain ? "emerald" : "red"}
        />
      </div>
      {points.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7 border-t border-slate-100">Not enough history yet to chart.</p>
      ) : (
        <div className="p-6 md:p-7 h-64 border-t border-slate-100">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
            <BarChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tickFormatter={chartDateLabel}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v, data.currency, 0)}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip
                labelFormatter={(label) => fullDateLabel(label as string)}
                formatter={(value, name, props) => [
                  `${formatCurrency(Number(value), data.currency, 0)} (${formatPct(props.payload.deltaValuePct)})`,
                  "Day change",
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="deltaValue" radius={[4, 4, 4, 4]}>
                {points.map((d) => (
                  <Cell key={d.date} fill={d.deltaValue >= 0 ? "#10b981" : "#f43f5e"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );
}

function HistoryPage({
  data, historyUpdating, portfolioUuid, subTab, selected, setSelected,
  monthCache, monthLoading, monthError, onSelectMonth, selectedYearStale, monthStaleTimedOut,
}: {
  data: FullHistoryDashboard; historyUpdating: boolean; portfolioUuid: string;
  subTab: HistorySubTabId;
  selected: { year: number; month: number } | null;
  setSelected: (s: { year: number; month: number } | null) => void;
  monthCache: Record<number, PeriodDashboard[]>;
  monthLoading: boolean;
  monthError: string | null;
  onSelectMonth: (year: number, month: number) => void;
  selectedYearStale: boolean;
  monthStaleTimedOut: boolean;
}) {
  const unrealizedIsGain = data.totalUnrealizedPnl >= 0;

  // Composition (current holdings/currency breakdown plus sector/region exposure) used to live
  // on Insights' own Today page, fetched from the today dashboard's own `summary` field —
  // that endpoint no longer carries it (see GET /v1/portfolio/summary), so this fetches it
  // directly instead. Lazy, same as before: nothing loads until this tab is actually opened,
  // and the result is cached in this component's own state (not re-fetched on switching sub-
  // tabs back and forth) since HistoryPage itself doesn't unmount between them.
  const [composition, setComposition] = useState<PortfolioComposition | null>(null);
  const [compositionLoading, setCompositionLoading] = useState(false);
  const [compositionError, setCompositionError] = useState<string | null>(null);

  useEffect(() => {
    if (subTab !== "composition" || composition !== null) return;
    let cancelled = false;
    const loadComposition = async () => {
      setCompositionLoading(true);
      setCompositionError(null);
      try {
        const [summary, sector, region] = await Promise.all([
          portfolioService.getPortfolioSummary(portfolioUuid),
          portfolioService.getSectorExposure(portfolioUuid),
          portfolioService.getRegionExposure(portfolioUuid),
        ]);
        if (cancelled) return;
        setComposition({ summary, sector: sector?.entries ?? null, region: region?.entries ?? null });
      } catch (err) {
        if (!cancelled) setCompositionError(err instanceof Error ? err.message : "Failed to load portfolio composition");
      } finally {
        if (!cancelled) setCompositionLoading(false);
      }
    };
    loadComposition();
    return () => { cancelled = true; };
  }, [subTab, composition, portfolioUuid]);

  if (selected) {
    const yearData = monthCache[selected.year];
    const period = yearData?.find(p => new Date(p.periodStart).getUTCMonth() + 1 === selected.month);
    const monthUpdating = selectedYearStale && !monthStaleTimedOut;
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#C49A3C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> All time
        </button>
        {monthLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
          </div>
        ) : monthError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{monthError}</p>
          </div>
        ) : monthUpdating ? (
          <Module><StaleUpdatingState /></Module>
        ) : period ? (
          <>
            {period.isStale && <UpdatingNote />}
            <MonthDetail period={period} portfolioUuid={portfolioUuid} />
          </>
        ) : (
          <EmptyPeriodState message="No detail available for this month." />
        )}
      </div>
    );
  }

  if (isHistoryEmpty(data)) {
    return (
      <div className="space-y-6">
        <EmptyPeriodState message="Add or upload transactions to build your full portfolio history." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {subTab === "risk" ? (
        <>
          <VolatilityModule portfolioUuid={portfolioUuid} />
          <RiskModelTab portfolioUuid={portfolioUuid} />
        </>
      ) : subTab === "composition" ? (
        compositionLoading && !composition ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
          </div>
        ) : compositionError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-bold">{compositionError}</p>
          </div>
        ) : composition ? (
          <>
            <HoldingsExplorer holdings={composition.summary.holdings} byCurrency={composition.summary.byCurrency} />
            <SectorRegionModule sector={composition.sector} region={composition.region} />
          </>
        ) : null
      ) : (
        <>
          {/* data.isStale here means the same edit-triggered rebuild covers every /history
              figure on this tab (lifetime totals, chart, heatmap, realized P&L) — hide them
              behind one StaleUpdatingState while historyUpdating, or show them with one hint
              once that window times out, rather than repeating the check per module.
              MonthToDateModule and BenchmarkModule are unaffected: each is its own fetch with
              its own isStale. */}
          {historyUpdating ? (
            <Module><StaleUpdatingState /></Module>
          ) : (
            <>
              {data.isStale && <UpdatingNote />}
              <StatCardGroup gridClassName="grid-cols-1 sm:grid-cols-3 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
                <StatContent
                  title="Invested Capital"
                  value={formatCurrency(data.totalInvestedCapital, data.currency, 0)}
                  icon={<Receipt className="h-4 w-4 text-blue-600" />}
                  description="Capital deployed to date"
                  color="blue"
                />
                <StatContent
                  title="Unrealized P&L"
                  value={`${unrealizedIsGain ? "+" : ""}${formatCurrency(data.totalUnrealizedPnl, data.currency, 0)}`}
                  icon={unrealizedIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                  description="Open positions vs. invested capital"
                  color={unrealizedIsGain ? "emerald" : "red"}
                />
                {/* Same ROI the backend computes for the portfolio and for each holding
                    (unrealized_roi_pct / roiPct): unrealized P&L over the cost basis of the
                    open positions, which is what totalInvestedCapital is. "—" when nothing is
                    held (a fully sold-out portfolio). */}
                <StatContent
                  title="ROI"
                  value={
                    data.totalInvestedCapital > 0
                      ? formatPct((data.totalUnrealizedPnl / data.totalInvestedCapital) * 100)
                      : "—"
                  }
                  icon={<Percent className={`h-4 w-4 ${unrealizedIsGain ? "text-emerald-600" : "text-rose-600"}`} />}
                  description="Return on the capital in your open positions"
                  color={unrealizedIsGain ? "emerald" : "red"}
                />
              </StatCardGroup>
            </>
          )}
          <MonthToDateModule portfolioUuid={portfolioUuid} />
          {!historyUpdating && (
            <ChartCard
              chart={data.chart}
              currency={data.currency}
              title="Value Since Inception"
              desc="Daily portfolio market value across your full history."
            />
          )}
          <BenchmarkModule portfolioUuid={portfolioUuid} />
          {!historyUpdating && (
            <>
              <Module>
                <ModuleHead
                  eyebrow={data.currency}
                  title="Monthly Returns"
                  desc="Market effect by month, since inception. Click a month for its full detail."
                />
                <MonthlyReturnsHeatmap entries={data.monthlyMarketEffect} onSelectMonth={onSelectMonth} />
              </Module>
              <RealizedPnLCard trades={data.realizedTradesByAsset} />
            </>
          )}
        </>
      )}
    </div>
  );
}
