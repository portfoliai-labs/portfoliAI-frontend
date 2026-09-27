// components/dashboard/PerformanceSection.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Activity,
  Loader2, AlertCircle, FileText, ExternalLink, LayoutGrid, Gauge,
  Search, ChevronDown, ChevronRight, Coins, Info, ArrowUpRight, ArrowLeft,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, ReferenceDot, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { portfolioService } from "../../services/portfolioService";
import { ApiError } from "../../services/apiClient";
import { formatCompact, formatCurrency, formatQuantity } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { usePortfolio } from "../../context/PortfolioContext";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { PortfolioPageHeader } from "./PortfolioPageHeader";
import { ExploreView, ExploreHostContext, ExplorePanel, DataTable, type DataColumn, type ExploreHeader } from "./ExploreView";
import type {
  PeriodDashboard, FullHistoryDashboard, PortfolioSnapshot, PortfolioSummary, TodayDashboard,
  AssetRealizedTrade, MonthlyMarketEffectEntry, Holding, CurrencyBreakdown,
} from "../../models/Portfolio";
import type {
  ExposureEntryResponse, RiskModelResponse, RiskPortfolioEntry, RiskModelUnavailableReason, WeightGapEntry,
  BenchmarkResponse, BenchmarkComponentEntry, VolatilityResponse, TimeSeries, CompositionResponse,
  PerformanceResponse, HorizonEntry, DividendsResponse, TradingCostsResponse, AssetDetailResponse, AssetChartRange,
} from "../../models/PortfolioData";

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

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
 * INSIGHTS SECTION — one portfolio's lifetime figures, on one scrolling page split into
 * sections (see HISTORY_SECTIONS below), each answering one question: Composition (what it
 * holds), Income & Costs (what it earned and cost), Performance (how is it doing — returns,
 * value, the monthly heatmap drilled into via /monthly?year=, the benchmark) and Risk (how much
 * it swings).
 * The short-term view (this month) lives on the Dashboard instead. /history returns null rather than a
 * zeroed-out object when there isn't enough history yet, and (via useAnalytics) polls while
 * `isStale` — see HistoryPage's `historyUpdating` for how that's shown.
 */
export function PerformanceSection({
  portfolioUuid, isAggregate = false, onNavigate, portfolioBar,
}: {
  portfolioUuid: string; isAggregate?: boolean; onNavigate?: (section: string) => void;
  // The investor's PortfolioBar (see InsightsSection), in the header panel.
  portfolioBar?: React.ReactNode;
}) {
  const { data: history, loading, failed, updating } = useAnalytics<FullHistoryDashboard>(portfolioService.getFullHistoryDashboard, portfolioUuid);

  // Month-drilldown state lives here rather than in HistoryPage below, even though only
  // HistoryPage's content depends on it: while a month is open, its breadcrumb takes the
  // header's place, and that's rendered here.
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

  // A module's detail view (see ExploreView): the module draws it into `exploreSlot` and
  // reports it here, so the page can hide everything else and show its breadcrumb instead of
  // the header. The scroll position is kept for the way back, like the page itself.
  const [explore, setExplore] = useState<ExploreHeader | null>(null);
  const [exploreSlot, setExploreSlot] = useState<HTMLDivElement | null>(null);
  const scrollBeforeExplore = useRef(0);
  const exploreHost = useMemo(() => ({
    slot: exploreSlot,
    show: (header: ExploreHeader | null) => {
      setExplore((current) => {
        if (header && !current) scrollBeforeExplore.current = window.scrollY;
        return header;
      });
    },
  }), [exploreSlot]);
  const exploring = explore !== null;

  useEffect(() => {
    if (exploring) {
      window.scrollTo({ top: 0 });
      return;
    }
    // After the page has been shown again, so there's something to scroll back down.
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeExplore.current }));
    return () => cancelAnimationFrame(frame);
  }, [exploring]);

  // HistoryPage shows the section timeline only for a full history, not a month's detail.
  const withTimeline = !loading && history !== null && !isHistoryEmpty(history) && !selected;

  const selectedPeriod = selected
    ? monthCache[selected.year]?.find((p) => new Date(p.periodStart).getUTCMonth() + 1 === selected.month)
    : undefined;

  return (
    // --timeline-gutter: the timeline's column plus the gap before it (HistoryPage's grid).
    <div className="space-y-6 pb-12 [--timeline-gutter:3.5rem]">
      {selected ? (
        <MonthBreadcrumb
          year={selected.year}
          month={selected.month}
          onBack={() => setSelected(null)}
          right={<ViewReportLink portfolioUuid={portfolioUuid} documentId={selectedPeriod?.reportDocumentId ?? null} />}
        />
      ) : explore ? (
        <Breadcrumb parent="Insights" current={explore.title} onBack={explore.onClose} />
      ) : (
        // Stops where the cards do while the timeline runs down the right (HistoryPage).
        <div className={withTimeline ? "lg:mr-[var(--timeline-gutter)]" : undefined}>
          <PortfolioPageHeader bar={portfolioBar} />
        </div>
      )}

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
        <ExploreHostContext.Provider value={exploreHost}>
          {/* Never display:none: the detail's charts are drawn here on its very first render,
              before `explore` is set, and a chart measured in a hidden box comes out 0×0. */}
          <div ref={setExploreSlot} className="space-y-6 empty:hidden" />
          {/* Hidden rather than unmounted while a detail is open: the detail lives in its
              module's state, and the page keeps its place for the way back. Collapsed and
              invisible rather than display:none, for the same reason as above: its charts keep
              their width and height, so they don't re-measure as 0×0. */}
          <div className={exploring ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={exploring || undefined} inert={exploring || undefined}>
            <HistoryPage
              key={portfolioUuid}
              data={history}
              historyUpdating={updating}
              portfolioUuid={portfolioUuid}
              selected={selected}
              monthCache={monthCache}
              monthLoading={monthLoading}
              monthError={monthError}
              onSelectMonth={handleSelectMonth}
              selectedYearStale={selectedYearStale}
              monthStaleTimedOut={monthStaleTimedOut}
              isAggregate={isAggregate}
            />
          </div>
        </ExploreHostContext.Provider>
      )}
    </div>
  );
}

/**
 * MONTH BREADCRUMB — stands in for the header while a month from the heatmap is open: "Year /
 * Month", the year leading back to the full history (the portfolio bar is hidden meanwhile,
 * since switching portfolio from inside one month's detail would land on a different history).
 * The month's report link, when it has one, sits at the other end.
 */
function MonthBreadcrumb({
  year, month, onBack, right,
}: { year: number; month: number; onBack: () => void; right?: React.ReactNode }) {
  const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return <Breadcrumb parent={String(year)} current={monthName} onBack={onBack} right={right} />;
}

/**
 * BREADCRUMB — stands in for the header on the pages that drill into Insights: a month's
 * detail (MonthBreadcrumb, "2025 / March") and a module's detail view ("Insights / Dividends",
 * see ExploreView). Same white panel as the portfolio bar it replaces, so the top of the page
 * doesn't jump: a back button, the parent as a small gold line over the current page, which is
 * the panel's title (the parent leads back too).
 */
function Breadcrumb({
  parent, current, onBack, right,
}: { parent: string; current: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${parent}`}
          className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 text-slate-500 hover:text-white hover:bg-[#C49A3C] hover:border-[#C49A3C] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
            <li>
              <button type="button" onClick={onBack} className="text-[#C49A3C] hover:text-[#8A6A28] transition-colors">
                {parent}
              </button>
            </li>
            <li aria-hidden><ChevronRight className="h-3 w-3 text-slate-300" /></li>
          </ol>
          <h1
            aria-current="page"
            className="text-xl md:text-2xl font-black text-slate-900 truncate mt-0.5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {current}
          </h1>
        </nav>
      </div>
      {right}
    </div>
  );
}

/**
 * MODULE — the card shell every page's content lives in, matching the Dashboard
 * Overview's visual language (rounded-4xl white card, Playfair headers, gold eyebrow).
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="h-full bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

const TILE_SPAN = {
  full: "col-span-2 lg:col-span-12",
  half: "col-span-2 lg:col-span-6",
} as const;

/**
 * TILE — one cell of a section's mosaic (see HistorySection): a 12-column grid on wide
 * screens, so a big chart can sit beside a narrow card and two related modules side by side,
 * instead of every module stacked at full width. Below lg everything is full width. A
 * container, so what's inside lays itself out by the tile's width (@md:, @3xl:…) rather than
 * the viewport's. Collapses when its module renders nothing.
 */
function Tile({ span = "full", children }: { span?: keyof typeof TILE_SPAN; children: React.ReactNode }) {
  return <div className={`@container min-w-0 empty:hidden ${TILE_SPAN[span]}`}>{children}</div>;
}

// `onExplore` makes the whole header a way into the module's detail view (ExploreView): clickable, with an
// arrow beside the title that lights up on hover. The title itself is the button, so it can be
// reached from the keyboard; a click anywhere else on the header bubbles to the same handler.
function ModuleHead({
  eyebrow, title, desc, right, icon, onExplore,
}: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode; icon?: React.ReactNode; onExplore?: () => void }) {
  const titleText = (
    <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
      {title}
    </h2>
  );
  const heading = onExplore ? (
    <button type="button" className="flex items-center gap-2 text-left rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40">
      {titleText}
      <ExploreArrow />
    </button>
  ) : titleText;

  return (
    <div
      onClick={onExplore}
      className={`p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6 ${
        onExplore ? "group/explore cursor-pointer hover:bg-slate-50/70 transition-colors" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        {icon ? <div className="flex items-center gap-2.5">{icon}{heading}</div> : heading}
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

// The "there's more behind this" cue, shown next to an explorable module's title (ModuleHead).
// Lights up while its group is hovered.
function ExploreArrow() {
  return (
    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-400 group-hover/explore:bg-[#C49A3C] group-hover/explore:text-white transition-colors">
      <ArrowUpRight className="h-3.5 w-3.5" />
    </span>
  );
}

interface StatProps {
  title: string;
  // A string for a single figure, or richer content (see SeriesValue) for a figure that
  // needs more than one line.
  value: React.ReactNode;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "red" | "gold" | "slate";
  // Plain-language explanation of what the figure means, shown in a tooltip when the user
  // hovers (or focuses) the icon — never as a caption under the value, which would crowd
  // the strip.
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
export function InfoTip({ text, children }: { text: string; children: React.ReactNode }) {
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
          className="z-120 pointer-events-none rounded-xl bg-slate-900 px-3.5 py-3 text-xs font-medium leading-relaxed text-white shadow-xl"
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

/**
 * STAT CONTENT — the icon/title/value block, with no card shell of its own: either one cell
 * of a strip sharing a card with its siblings (divided by internal borders), or a small card
 * of its own in a section's mosaic.
 */
function StatContent({ title, value, icon, color, info }: StatProps) {
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
            tickFormatter={monthShortYearLabel}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            minTickGap={30}
            padding={{ left: 12 }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            width={56}
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
function ChartCard({
  chart, currency, title, desc, right,
}: { chart: PortfolioSnapshot[]; currency: string; title: string; desc: string; right?: React.ReactNode }) {
  return (
    <Module>
      <ModuleHead eyebrow={currency} title={title} desc={desc} right={right} />
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
const formatSignedCurrency = (amount: number, currency: string) =>
  `${amount >= 0 ? "+" : ""}${formatCurrency(amount, currency, 0)}`;

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
  data.chart.length === 0;

type HistorySectionId = "performance" | "income" | "composition" | "risk";

const HISTORY_SECTIONS: { id: HistorySectionId; label: string; icon: typeof Coins }[] = [
  { id: "composition", label: "Composition", icon: LayoutGrid },
  { id: "income", label: "Income & Costs", icon: Coins },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "risk", label: "Risk", icon: Gauge },
];

const sectionAnchor = (id: HistorySectionId) => `insights-${id}`;

/**
 * HISTORY SECTION — one of the page's sections: a mosaic of Tiles, with no heading of its own
 * (SectionNav names it). `scroll-mt` keeps its top clear of the dashboard's sticky header when
 * SectionNav scrolls to it.
 */
function HistorySection({ id, children }: { id: HistorySectionId; children: React.ReactNode }) {
  return (
    <section id={sectionAnchor(id)} className="scroll-mt-28 grid grid-cols-2 lg:grid-cols-12 gap-6">
      {children}
    </section>
  );
}

/**
 * SECTION NAV — a timeline down the side of the page, pinned while the page scrolls and as
 * tall as the viewport allows. The line stands for the whole page: it fills in gold as the
 * reader moves down, reaching the bottom at the end of the page, and each section's dot sits
 * where the fill will be as that section's top crosses the reading line — so a long section
 * gets a long stretch of line, and a dot lights up exactly as its section comes into view. The
 * dots are the sections' icons, with the name shown on hover; a click scrolls to the section. Listens with capture on window so it follows whatever ends up
 * scrolling the page, the window or a container (scroll events don't bubble, but they can be
 * captured), and re-measures when a section changes height (Composition loads on its own).
 * Wide screens only; narrower ones just scroll.
 */
function SectionNav() {
  const [dots, setDots] = useState<number[]>(() => HISTORY_SECTIONS.map((_, i) => i / (HISTORY_SECTIONS.length - 1)));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const els = HISTORY_SECTIONS.map(({ id }) => document.getElementById(sectionAnchor(id)));
    if (els.some((el) => !el)) return;
    const sections = els as HTMLElement[];

    const update = () => {
      const rects = sections.map((el) => el.getBoundingClientRect());
      const first = rects[0].top;
      const total = rects[rects.length - 1].bottom - first;
      // The reading line: a third of the way down the viewport. Scrolling runs from the first
      // section's top on that line to the last one's bottom at the viewport's bottom, the
      // same span the fill covers.
      const line = window.innerHeight / 3;
      const span = Math.max(total - window.innerHeight + line, 1);
      const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
      setDots(rects.map((r) => clamp((r.top - first) / span)));
      setProgress(clamp((line - first) / span));
    };

    update();
    const resize = new ResizeObserver(update);
    sections.forEach((el) => resize.observe(el));
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      resize.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  // The section in view: the last one whose dot the fill has reached.
  const active = dots.reduce((acc, pos, i) => (progress >= pos - 0.001 ? i : acc), 0);

  return (
    <nav aria-label="Insights sections" className="hidden lg:block sticky top-28 self-start h-[calc(100vh-10rem)]">
      {/* Inset so the first and last icons, centred on their points, stay inside the nav. */}
      <div className="absolute inset-x-0 inset-y-4">
        <span aria-hidden className="absolute left-1/2 -translate-x-1/2 inset-y-0 w-px bg-slate-200">
          <span
            className="absolute inset-x-0 top-0 bg-[#C49A3C] transition-[height] duration-150 ease-out"
            style={{ height: `${progress * 100}%` }}
          />
        </span>
        <ol>
          {HISTORY_SECTIONS.map(({ id, label, icon: Icon }, i) => {
            const reached = i <= active;
            const isActive = i === active;
            return (
              <li
                key={id}
                className="group absolute left-1/2 -translate-x-1/2 -translate-y-1/2 transition-[top] duration-150 ease-out"
                style={{ top: `${dots[i] * 100}%` }}
              >
                <button
                  onClick={() => document.getElementById(sectionAnchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  aria-label={label}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40 ${
                    isActive
                      ? "bg-[#C49A3C] border-[#C49A3C] text-white shadow-sm ring-4 ring-[#C49A3C]/15"
                      : reached
                        ? "bg-white border-[#C49A3C] text-[#C49A3C]"
                        : "bg-white border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
                {/* The section's name, to the left of its icon while hovered or focused. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2.5 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
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
      <Tile>
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
      </Tile>
    );
  }

  const built = data.status === "ok";

  // Tiles of the Risk section's mosaic, not a block of its own.
  return (
    <>
      {data.isStale && <Tile><UpdatingNote /></Tile>}
      {built ? (
        <>
          <Tile><MixComparisonModule current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} /></Tile>
          <Tile>
            <FrontierModule
              frontier={data.frontier}
              current={data.current}
              maxSharpe={data.maxSharpe}
              minVolatility={data.minVolatility}
            />
          </Tile>
          <Tile span="half"><WeightGapsModule gaps={data.weightGaps} /></Tile>
          <Tile span="half"><RiskAssetsModule assets={data.assets} /></Tile>
        </>
      ) : (
        <Tile>
          <Module>
            <ModuleHead eyebrow="Risk" title="Risk Model" desc="How your holdings have behaved together, based on past returns." />
            <ModuleMessage>{riskModelUnavailableMessage(data)}</ModuleMessage>
          </Module>
        </Tile>
      )}

      {(built || data.correlation !== null) && <Tile><CorrelationMatrixModule riskModel={data} /></Tile>}
    </>
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
  // The holding being pointed at (hovered, or tapped on a touch screen), shared by the three
  // bars so the same holding lights up in all of them.
  const [activeTicker, setActiveTicker] = useState<string | null>(null);

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
                <MixWeights weights={m.entry.weights} colorOf={colorOf} active={activeTicker} onActive={setActiveTicker} />
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

/**
 * One segmented bar for a mix's weights. No legend under it: pointing at a segment (hover, or a
 * tap on a touch screen, tapping it again to let go) names that holding and its weight in the
 * line below, and lights the same holding up in the other two bars (`active` is shared), where
 * the line shows its weight in that mix — 0% when the mix leaves it out.
 */
function MixWeights({
  weights, colorOf, active, onActive,
}: {
  weights: RiskPortfolioEntry["weights"];
  colorOf: (ticker: string) => string;
  active: string | null;
  onActive: (ticker: string | null) => void;
}) {
  const shown = weights.filter((w) => w.weightPct >= 0.05);
  if (shown.length === 0) return null;
  const activeEntry = active === null ? null : weights.find((w) => w.ticker === active) ?? null;

  return (
    <div onMouseLeave={() => onActive(null)}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {shown.map((w) => (
          <button
            key={w.ticker}
            type="button"
            aria-label={`${w.ticker}: ${w.weightPct.toFixed(1)}%`}
            onMouseEnter={() => onActive(w.ticker)}
            onFocus={() => onActive(w.ticker)}
            onClick={() => onActive(active === w.ticker ? null : w.ticker)}
            className="h-full transition-opacity outline-none"
            style={{ width: `${w.weightPct}%`, background: colorOf(w.ticker), opacity: active === null || active === w.ticker ? 1 : 0.25 }}
          />
        ))}
      </div>
      <p className="mt-2.5 h-4 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 min-w-0">
        {active !== null && (
          <>
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: colorOf(active) }} />
            <span className="shrink-0">{active}</span>
            {activeEntry && <span className="truncate font-semibold text-slate-400">{activeEntry.name}</span>}
            <span className="ml-auto tabular-nums text-slate-900 shrink-0">{(activeEntry?.weightPct ?? 0).toFixed(1)}%</span>
          </>
        )}
      </p>
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
      <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3 p-6 md:p-7">
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
  // The ticker whose detail view (AssetExplore) is open. Rows without a ticker can't open one:
  // the asset endpoint is keyed by it.
  const [exploringTicker, setExploringTicker] = useState<string | null>(null);

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
                <tr
                  key={`${h.currency}::${h.ticker ?? h.isin ?? i}::${h.broker ?? ""}`}
                  onClick={h.ticker ? () => setExploringTicker(h.ticker) : undefined}
                  className={`hover:bg-slate-50/60 transition-colors ${h.ticker ? "group/explore cursor-pointer" : ""}`}
                >
                  <td className="px-5 md:px-6 py-3.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      {h.ticker ? (
                        <button
                          type="button"
                          className="text-sm font-bold text-slate-900 shrink-0 group-hover/explore:text-[#C49A3C] transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
                        >
                          {h.ticker}
                        </button>
                      ) : (
                        <span className="text-sm font-bold text-slate-900 shrink-0">{h.isin ?? "—"}</span>
                      )}
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
      {exploringTicker && (
        <ExploreView title={exploringTicker} onClose={() => setExploringTicker(null)}>
          <AssetExplore ticker={exploringTicker} positions={holdings.filter((h) => h.ticker === exploringTicker)} />
        </ExploreView>
      )}
    </div>
  );
}

const ASSET_RANGES: AssetChartRange[] = ["1M", "6M", "1Y", "5Y", "MAX"];
const ASSET_RANGE_LABELS: Record<AssetChartRange, string> = { "1M": "1 month", "6M": "6 months", "1Y": "1 year", "5Y": "5 years", MAX: "all time" };

/**
 * ASSET EXPLORE — one holding's own page, opened from a row of HoldingsExplorer: its price
 * over a chosen range (GET /v1/assets/{ticker}), what the asset is (identifiers, class,
 * sector or TER…), what it's made of when it's a fund, and the position held in it (the
 * HoldingsExplorer rows for that ticker — the endpoint knows nothing about portfolios).
 *
 * Prices default to the user's reference currency, the one the rest of Insights is in; when
 * the asset is quoted in another one, a toggle switches to its own quote prices. Changing
 * range keeps the previous chart on screen (dimmed) until the new one arrives, since a ticker
 * nobody else holds can take a few seconds.
 */
function AssetExplore({ ticker, positions }: { ticker: string; positions: Holding[] }) {
  const [range, setRange] = useState<AssetChartRange>("1Y");
  const [inQuoteCurrency, setInQuoteCurrency] = useState(false);
  // `forRange`: the range the last answer (data or error) was for — loading while it isn't the
  // one selected. `data` is kept across a range change so the old chart stays up meanwhile.
  const [state, setState] = useState<{ data: AssetDetailResponse | null; error: string | null; forRange: AssetChartRange | null }>({
    data: null, error: null, forRange: null,
  });

  useEffect(() => {
    let cancelled = false;
    portfolioService.getAssetDetail(ticker, range)
      .then((data) => { if (!cancelled) setState({ data, error: null, forRange: range }); })
      .catch((err) => {
        if (cancelled) return;
        const error = err instanceof ApiError && err.status === 404
          ? "No market data is available for this asset."
          : "Unable to load this right now. Try again in a moment.";
        setState((prev) => ({ ...prev, error, forRange: range }));
      });
    return () => { cancelled = true; };
  }, [ticker, range]);

  const loading = state.forRange !== range;
  const error = loading ? null : state.error;
  const { data } = state;
  const hasQuoteToggle = data !== null && data.quoteCurrency !== data.currency;
  const showQuote = hasQuoteToggle && inQuoteCurrency;
  const series = data ? (showQuote ? data.quotePrices : data.prices) : null;
  const unit = data ? (showQuote ? data.quoteCurrency : data.currency) : "";
  const points = useMemo(() => (series ? toChartPoints(series) : []), [series]);

  if (data === null) {
    return loading ? (
      <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" /></div>
    ) : (
      <Module><ModuleMessage>{error}</ModuleMessage></Module>
    );
  }

  const first = series?.values[0];
  const last = series?.values[series.values.length - 1];
  const changePct = first && last !== undefined ? (last / first - 1) * 100 : null;
  const rising = (changePct ?? 0) >= 0;
  const lineColor = changePct === null ? PORTFOLIO_COLOR : rising ? "#10b981" : "#f43f5e";

  const facts: { label: string; value: string }[] = [
    { label: "Ticker", value: data.ticker },
    ...(data.isin ? [{ label: "ISIN", value: data.isin }] : []),
    { label: "Asset class", value: data.assetClass },
    ...(data.sector ? [{ label: "Sector", value: data.sector }] : []),
    ...(data.industry ? [{ label: "Industry", value: data.industry }] : []),
    ...(data.country ? [{ label: "Country", value: data.country }] : []),
    ...(data.terPct !== null ? [{ label: "Yearly fee (TER)", value: `${data.terPct.toFixed(2)}%` }] : []),
    { label: "Quoted in", value: data.quoteCurrency },
  ];

  return (
    <>
      <Module>
        <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{data.assetClass}</p>
            <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {data.name}
            </h2>
          </div>
          {last !== undefined && (
            <div className="sm:text-right shrink-0">
              <p className="text-2xl font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {formatCurrency(last, unit, 2)}
              </p>
              {changePct !== null && (
                <p className={`text-[13px] font-bold tabular-nums mt-1 ${rising ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatPct(changePct)} <span className="text-slate-400 font-semibold">over {ASSET_RANGE_LABELS[data.range]}</span>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="px-6 md:px-7 pt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
            {ASSET_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                  r === range ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {hasQuoteToggle && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
              {[data.currency, data.quoteCurrency].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInQuoteCurrency(c === data.quoteCurrency)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                    c === unit ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="px-6 md:px-7 pt-4 text-sm font-semibold text-rose-600">{error}</p>}
        {points.length < 2 ? (
          <ModuleMessage>No prices in this range.</ModuleMessage>
        ) : (
          <div className={`p-6 md:p-7 h-80 transition-opacity ${loading ? "opacity-40" : ""}`}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 320 }}>
              <AreaChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={data.frequency === "daily" && data.range === "1M" ? chartDateLabel : monthShortYearLabel}
                  tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => formatCompact(Number(v))}
                  tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value) => [formatCurrency(Number(value), unit, 2), "Close"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill={lineColor} fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {data.pricesAsOf && (
          <p className="px-6 md:px-7 pb-5 -mt-2 text-[11px] font-semibold text-slate-400">
            Adjusted closes, last one on {fullDateLabel(data.pricesAsOf)}.
          </p>
        )}
      </Module>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ExplorePanel title="About">
          <dl className="px-6 md:px-7 py-2 divide-y divide-slate-100">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[13px] font-semibold text-slate-600">{f.label}</dt>
                <dd className="text-[13px] font-bold text-slate-900 text-right truncate">{f.value}</dd>
              </div>
            ))}
          </dl>
        </ExplorePanel>
        {positions.length > 0 && (
          <ExplorePanel title="Your position">
            <div className="divide-y divide-slate-100">
              {positions.map((p, i) => (
                <dl key={`${p.broker ?? ""}-${p.currency}-${i}`} className="px-6 md:px-7 py-2">
                  {positions.length > 1 && (
                    <p className="pt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">{p.broker ?? "Unknown broker"}</p>
                  )}
                  <div className="flex items-center justify-between gap-4 py-3">
                    <dt className="text-[13px] font-semibold text-slate-600">Quantity</dt>
                    <dd className="text-[13px] font-bold text-slate-900 tabular-nums">{formatQuantity(p.quantity)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 border-t border-slate-100">
                    <dt className="text-[13px] font-semibold text-slate-600">Invested</dt>
                    <dd className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(p.investedValue, p.currency, 2)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 border-t border-slate-100">
                    <dt className="text-[13px] font-semibold text-slate-600">Fees paid</dt>
                    <dd className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(p.fees, p.currency, 2)}</dd>
                  </div>
                  {positions.length === 1 && (
                    <div className="flex items-center justify-between gap-4 py-3 border-t border-slate-100">
                      <dt className="text-[13px] font-semibold text-slate-600">Broker</dt>
                      <dd className="text-[13px] font-bold text-slate-900">{p.broker ?? "Unknown"}</dd>
                    </div>
                  )}
                </dl>
              ))}
            </div>
          </ExplorePanel>
        )}
      </div>

      {data.topHoldings.length > 0 && (
        <ExplorePanel title="Largest holdings">
          <div className="p-6 md:p-7">
            <ExposureBreakdown entries={data.topHoldings} />
          </div>
        </ExplorePanel>
      )}
      {(data.sectorWeightings.length > 1 || data.regionWeightings.length > 1) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.sectorWeightings.length > 1 && (
            <ExplorePanel title="By sector">
              <div className="p-6 md:p-7"><ExposureBreakdown entries={data.sectorWeightings} /></div>
            </ExplorePanel>
          )}
          {data.regionWeightings.length > 1 && (
            <ExplorePanel title="By region">
              <div className="p-6 md:p-7"><ExposureBreakdown entries={data.regionWeightings} /></div>
            </ExplorePanel>
          )}
        </div>
      )}
    </>
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
  currency, endValue, deltaValue, deltaValuePct, isGain, hasBaseline, label = "End Value",
}: {
  currency: string; endValue: number; deltaValue: number; deltaValuePct: number; isGain: boolean; hasBaseline: boolean;
  label?: string;
}) {
  const DeltaIcon = isGain ? TrendingUp : TrendingDown;
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
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
 * badge next to it) with Start Value / Return / Market Effect / Dividends as supporting figures, plus
 * a separate Risk card for Volatility / Max Drawdown — kept apart from Performance since
 * these are risk figures, not performance, and mixing them read as one undifferentiated wall
 * of tiles (see the Monthly/Annual detail view this replaces). The month in progress is
 * valued as of today, and has no volatility or drawdown until it closes.
 */
function MonthDetail({ period }: { period: PeriodDashboard }) {
  const isGain = period.deltaValue >= 0;
  const marketIsGain = period.marketEffect >= 0;
  const hasBaseline = hasPeriodBaseline(period);
  const twr = period.timeWeightedReturnPct;

  return (
    <div className="space-y-6">
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
              label={period.inProgress ? "Value Today" : undefined}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-y divide-slate-100 sm:divide-y-0 sm:divide-x">
              <StatContent
                title="Start Value"
                value={formatCurrency(period.t0Value, period.currency, 0)}
                icon={<Wallet className="h-4 w-4 text-slate-500" />}
                info="Market value at the close of the previous month."
                color="slate"
              />
              <StatContent
                title="Return"
                value={twr !== null ? formatPct(twr) : "—"}
                icon={twr === null || twr >= 0 ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                info={twr !== null ? "Time-weighted, unaffected by money added or withdrawn." : "Not available yet for this month."}
                color={twr === null ? "slate" : twr >= 0 ? "emerald" : "red"}
              />
              <StatContent
                title="Market Effect"
                value={<AmountWithDelta amount={`${marketIsGain ? "+" : ""}${formatCurrency(period.marketEffect, period.currency, 0)}`} pct={period.marketEffectPct} hasBaseline={hasBaseline} />}
                icon={marketIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                info="Price movement alone, capital flows excluded."
                color={marketIsGain ? "emerald" : "red"}
              />
              <StatContent
                title="Dividends"
                value={formatCurrency(period.dividendsInPeriod, period.currency, 0)}
                icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
                info={period.inProgress ? "Received so far this month." : "Received this month."}
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
                info={period.inProgress ? "Available once the month closes." : "Annualized, from daily returns."}
                color="slate"
              />
              <StatContent
                title="Max Drawdown"
                value={period.maxDrawdownPct !== null ? `${period.maxDrawdownPct.toFixed(2)}%` : "—"}
                icon={<TrendingDown className="h-4 w-4 text-slate-500" />}
                info={period.inProgress ? "Available once the month closes." : "Largest peak-to-trough decline."}
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
 * calendar month, each cell shaded by that month's time-weighted return, same figure as
 * /performance (green = gain, rose = loss,
 * intensity scaled by magnitude) and clickable to open MonthDetail. Replaces the old
 * Monthly/Annual tabs' bar chart + card picker: a single grid makes the whole history
 * scannable at once instead of one time horizon at a time. Backed by
 * FullHistoryDashboard.monthlyMarketEffect, a single lightweight all-years fetch — a
 * (year, month) pair simply absent (before inception) renders as an empty, non-clickable
 * cell rather than a false zero. A month without a TWR yet (e.g. under a year of history)
 * falls back to its market effect ÷ opening value, marked as such in the cell's tooltip. The
 * month in progress is included, valued as of today, and drawn with a dashed outline.
 */
function MonthlyReturnsHeatmap({
  entries, onSelectMonth,
}: {
  entries: MonthlyMarketEffectEntry[]; onSelectMonth: (year: number, month: number) => void;
}) {
  const byYear = useMemo(() => {
    const map = new Map<number, Map<number, { pct: number; isTwr: boolean }>>();
    for (const e of entries) {
      if (!map.has(e.year)) map.set(e.year, new Map());
      map.get(e.year)!.set(e.month, e.timeWeightedReturnPct !== null
        ? { pct: e.timeWeightedReturnPct, isTwr: true }
        : { pct: e.marketEffectPct, isTwr: false });
    }
    return map;
  }, [entries]);
  const now = new Date();

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
                const cell = byYear.get(year)?.get(month);
                if (cell === undefined) {
                  return (
                    <td key={month} className="p-1">
                      <div className="w-full aspect-square rounded-lg bg-slate-50" />
                    </td>
                  );
                }
                const { pct, isTwr } = cell;
                const inProgress = year === now.getFullYear() && month === now.getMonth() + 1;
                return (
                  <td key={month} className="p-1">
                    <button
                      onClick={() => onSelectMonth(year, month)}
                      title={`${MONTH_LABELS[i]} ${year}${inProgress ? " (to date)" : ""}: ${formatPct(pct)}${isTwr ? "" : " market effect"}`}
                      style={heatmapCellStyle(pct)}
                      className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold tabular-nums hover:ring-2 hover:ring-offset-1 hover:ring-[#C49A3C] transition-all cursor-pointer ${inProgress ? "outline-2 outline-dashed outline-offset-1 outline-slate-400" : ""}`}
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
          <div className="grid grid-cols-2 divide-x divide-slate-200">
            <div className="pr-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total P&L</p>
              <p
                className={`text-2xl font-black tabular-nums mt-1 ${singleIsGain ? "text-emerald-600" : "text-rose-600"}`}
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {singleIsGain ? "+" : ""}{formatCurrency(single.totalPl, single.currency, 2)}
              </p>
            </div>
            <div className="pl-6">
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
            <div className="grid grid-cols-2 divide-x divide-slate-200 ml-auto">
              <div className="pr-6">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total P&L</p>
                <p className={`text-lg font-black tabular-nums ${isGain ? "text-emerald-600" : "text-rose-600"}`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  {isGain ? "+" : ""}{formatCurrency(group.totalPl, group.currency, 2)}
                </p>
              </div>
              <div className="pl-6">
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
  const [exploring, setExploring] = useState(false);

  return (
    <Module>
      <ModuleHead
        onExplore={showFigure ? () => setExploring(true) : undefined}
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
      {showFigure && exploring && (
        <ExploreView title="Volatility" onClose={() => setExploring(false)}>
          <VolatilityExplore data={data} />
        </ExploreView>
      )}
    </Module>
  );
}

const shortDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const rangeLabel = (start: string, end: string) => `${shortDateLabel(start)} – ${shortDateLabel(end)}`;
const daysBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);

/**
 * VOLATILITY EXPLORE — the detail view behind VolatilityModule: the rolling chart, then the
 * turbulent stretches the backend picked out of it (riskEvents), most recent first, with what
 * the portfolio did through each and what it held at the time.
 */
function VolatilityExplore({ data }: { data: VolatilityResponse }) {
  const events = useMemo(() => [...data.riskEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [data]);
  return (
    <>
      <ExplorePanel
        title={data.rollingWindowDays ? `Rolling ${data.rollingWindowDays}-day volatility` : "Rolling volatility"}
        right={
          <span className="text-sm font-black tabular-nums text-slate-900">
            {plainPctOrDash(data.annualizedVolatilityPct)} <span className="text-xs font-bold text-slate-400">overall</span>
          </span>
        }
      >
        {data.rollingVolatilityPct ? <RollingVolatilityChart series={data.rollingVolatilityPct} /> : <ModuleMessage>Not enough data yet to chart.</ModuleMessage>}
      </ExplorePanel>
      <ExplorePanel
        title="Turbulent periods"
        right={
          <InfoTip text="Stretches of at least five trading days when the portfolio's 20-day volatility stayed in its top 10%.">
            <Info className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
          </InfoTip>
        }
      >
        {events.length === 0 ? (
          <ModuleMessage>No stretch of unusual turbulence so far.</ModuleMessage>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events.map((e) => (
              <li key={`${e.startDate}-${e.endDate}`} className="px-6 md:px-7 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <p className="text-[13px] font-bold text-slate-900">
                    {rangeLabel(e.startDate, e.endDate)}
                    <span className="ml-2 text-xs font-semibold text-slate-400">{daysBetween(e.startDate, e.endDate) + 1} days</span>
                  </p>
                  <p className="flex items-baseline gap-4 text-[13px] tabular-nums">
                    <span><span className="text-xs text-slate-400 mr-1.5">Volatility</span><span className="font-bold text-slate-900">{plainPctOrDash(e.annualizedVolatilityPct)}</span></span>
                    <span><span className="text-xs text-slate-400 mr-1.5">Return</span><SignedPct pct={e.cumulativeReturnPct} /></span>
                  </p>
                </div>
                {e.assetNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {e.assetNames.map((name) => (
                      <span key={name} className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">{name}</span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ExplorePanel>
    </>
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

type BasketEntry = BenchmarkComponentEntry & { weightPct: number };

// The benchmark's current basket, largest first. The backend also lists proxies of closed
// positions at weight 0; those are dropped so only today's basket is shown.
const benchmarkBasket = (components: BenchmarkComponentEntry[]): BasketEntry[] =>
  components.filter((c): c is BasketEntry => (c.weightPct ?? 0) > 0).sort((a, b) => b.weightPct - a.weightPct);

/**
 * BENCHMARK BASKET LIST — what the dashed benchmark line is made of: the proxy ETFs it holds,
 * with their weights, bars in the benchmark's grey so they read as that line's explanation.
 */
function BenchmarkBasketList({ basket }: { basket: BasketEntry[] }) {
  const max = Math.max(...basket.map((c) => c.weightPct), 0.01);
  return (
    <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-8 gap-y-3">
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
  );
}

const BENCHMARK_BASKET_INFO =
  "Each of your holdings is matched to a proxy ETF. The benchmark holds them at today's weights and receives the same deposits and withdrawals as your portfolio.";

/**
 * BENCHMARK TILE — /benchmark on the page: the portfolio against the benchmark, the chart with
 * both total returns as its legend. Everything else (alpha, beta, tracking error, the
 * side-by-side risk figures, what the benchmark is made of) lives in its detail view
 * (BenchmarkExplore), so the page keeps the one question "am I beating it?" and the detail
 * answers "how, and at what risk?".
 */
function BenchmarkTile({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<BenchmarkResponse>(portfolioService.getBenchmark, portfolioUuid);
  const [exploring, setExploring] = useState(false);

  const ready = data !== null && !updating && data.status === "ok";
  const basket = useMemo(() => (data ? benchmarkBasket(data.components) : []), [data]);
  const coverage = data?.yearsCovered != null ? `Over the ${data.yearsCovered.toFixed(1)} years you share with the benchmark` : "Since inception";
  const explore = ready ? () => setExploring(true) : undefined;

  return (
    <>
      <Tile>
        <Module>
          <ModuleHead
            eyebrow="All Time"
            title="Benchmark"
            desc={data && !updating ? `${coverage}.` : "How your portfolio compares to the market."}
            onExplore={explore}
            right={ready ? (
              <div className="w-52 space-y-1.5 font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                <SeriesValue label="Portfolio" value={formatPctOrDash(data.portfolioTotalReturnPct)} color={PORTFOLIO_COLOR} />
                <SeriesValue label="Benchmark" value={formatPctOrDash(data.benchmarkTotalReturnPct)} color={BENCHMARK_COLOR} dashed />
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
              {data.status !== "ok" ? (
                <ModuleMessage>Not enough overlapping history with the benchmark yet to compare.</ModuleMessage>
              ) : data.portfolioCumulativeReturnPct && data.benchmarkCumulativeReturnPct ? (
                <CumulativeReturnChart portfolio={data.portfolioCumulativeReturnPct} benchmark={data.benchmarkCumulativeReturnPct} />
              ) : null}
            </>
          )}
        </Module>
      </Tile>
      {ready && exploring && (
        <ExploreView title="Benchmark" onClose={() => setExploring(false)}>
          <BenchmarkExplore data={data} basket={basket} coverage={coverage} />
        </ExploreView>
      )}
    </>
  );
}

// A difference in percentage points, green when it's the better side for the portfolio.
// `higherIsBetter` false for volatility; drawdowns are negative, so a higher one is milder.
function PointsDiff({ diff, higherIsBetter = true }: { diff: number | null; higherIsBetter?: boolean }) {
  if (diff === null) return <span className="text-slate-400">—</span>;
  const good = higherIsBetter ? diff >= 0 : diff <= 0;
  return <span className={`font-bold ${good ? "text-emerald-600" : "text-rose-600"}`}>{diff >= 0 ? "+" : ""}{diff.toFixed(2)} pp</span>;
}

const diffOrNull = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

interface BenchmarkPairRow {
  key: string;
  label: string;
  portfolio: number | null;
  benchmark: number | null;
  diff: number | null;
  higherIsBetter: boolean;
  signed: boolean;
}

/**
 * BENCHMARK EXPLORE — the detail view behind BenchmarkTile: the chart again, the portfolio and the
 * benchmark figure by figure (return and risk side by side), the relative statistics, and
 * the whole basket.
 */
function BenchmarkExplore({ data, basket, coverage }: { data: BenchmarkResponse; basket: BasketEntry[]; coverage: string }) {
  const pairs: BenchmarkPairRow[] = [
    { key: "total", label: "Total return", portfolio: data.portfolioTotalReturnPct, benchmark: data.benchmarkTotalReturnPct, diff: diffOrNull(data.portfolioTotalReturnPct, data.benchmarkTotalReturnPct), higherIsBetter: true, signed: true },
    { key: "annual", label: "Per year", portfolio: data.portfolioAnnualizedReturnPct, benchmark: data.benchmarkAnnualizedReturnPct, diff: data.excessReturnPct, higherIsBetter: true, signed: true },
    { key: "vol", label: "Volatility", portfolio: data.portfolioVolatilityPct, benchmark: data.benchmarkVolatilityPct, diff: diffOrNull(data.portfolioVolatilityPct, data.benchmarkVolatilityPct), higherIsBetter: false, signed: false },
    { key: "dd", label: "Deepest fall", portfolio: data.portfolioMaxDrawdownPct, benchmark: data.benchmarkMaxDrawdownPct, diff: diffOrNull(data.portfolioMaxDrawdownPct, data.benchmarkMaxDrawdownPct), higherIsBetter: true, signed: false },
  ];
  const cell = (row: BenchmarkPairRow, value: number | null) =>
    row.signed ? formatPctOrDash(value) : plainPctOrDash(value);
  const pairColumns: DataColumn<BenchmarkPairRow>[] = [
    { key: "label", label: "", render: (r) => <span className="font-bold text-slate-900 whitespace-nowrap">{r.label}</span> },
    { key: "portfolio", label: "Portfolio", align: "right", render: (r) => <span className="font-bold text-slate-900">{cell(r, r.portfolio)}</span> },
    { key: "benchmark", label: "Benchmark", align: "right", render: (r) => <span className="text-slate-500">{cell(r, r.benchmark)}</span> },
    { key: "diff", label: "Difference", align: "right", render: (r) => <PointsDiff diff={r.diff} higherIsBetter={r.higherIsBetter} /> },
  ];

  return (
    <>
      {data.portfolioCumulativeReturnPct && data.benchmarkCumulativeReturnPct && (
        <ExplorePanel title={coverage}>
          <CumulativeReturnChart portfolio={data.portfolioCumulativeReturnPct} benchmark={data.benchmarkCumulativeReturnPct} />
        </ExplorePanel>
      )}
      <ExplorePanel title="Side by side">
        <DataTable columns={pairColumns} rows={pairs} rowKey={(r) => r.key} />
      </ExplorePanel>
      <ExplorePanel title="Relative figures">
        <FigureList>
          <FigureRow label="Alpha" info="The part of your annualized return that your exposure to the benchmark (beta) doesn't explain. Positive means the portfolio earned more than its market exposure alone would suggest." value={formatPctOrDash(data.alphaPct)} tone={data.alphaPct === null ? undefined : data.alphaPct >= 0 ? "gain" : "loss"} />
          <FigureRow label="Beta" info="How much your portfolio tends to move when the benchmark moves. 1.0 moves in step with it, 0.5 about half as much, and above 1.0 amplifies its moves." value={ratioOrDash(data.beta)} />
          <FigureRow label="Tracking error" info="How much the gap between your portfolio's and the benchmark's daily returns swings, annualized. Low means the portfolio follows the benchmark closely." value={plainPctOrDash(data.trackingErrorPct)} />
          <FigureRow label="Information ratio" info="The excess return per unit of tracking error: how consistently the portfolio beat the benchmark, rather than by how much." value={ratioOrDash(data.informationRatio)} />
          <FigureRow label="Sharpe ratio difference" info="The portfolio's return per unit of volatility minus the benchmark's. Positive means better risk-adjusted returns." value={data.sharpeRatioDiff === null ? "—" : `${data.sharpeRatioDiff >= 0 ? "+" : ""}${data.sharpeRatioDiff.toFixed(2)}`} tone={data.sharpeRatioDiff === null ? undefined : data.sharpeRatioDiff >= 0 ? "gain" : "loss"} />
          <FigureRow label="Recovery ratio" info="The portfolio's total return over its deepest fall: how much it earned for the worst drop it went through." value={ratioOrDash(data.recoveryRatio)} />
          <FigureRow label="Days ahead" info="The share of trading days on which the portfolio's return beat the benchmark's." value={plainPctOrDash(data.winRatePct)} />
          <FigureRow label="Time in the lead" info="The share of the shared period during which the portfolio's growth since the start was above the benchmark's." value={plainPctOrDash(data.timeOutperformingPct)} />
          {data.tradingDays !== null && (
            <FigureRow label="Trading days compared" info="The days on which both the portfolio and the benchmark have a price." value={data.tradingDays.toLocaleString("en-US")} />
          )}
        </FigureList>
      </ExplorePanel>
      {basket.length > 0 && (
        <ExplorePanel
          title="What the benchmark is made of"
          right={
            <InfoTip text={BENCHMARK_BASKET_INFO}>
              <Info className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
            </InfoTip>
          }
        >
          <div className="p-6 md:p-7">
            <BenchmarkBasketList basket={basket} />
          </div>
        </ExplorePanel>
      )}
    </>
  );
}

const RISE_ICON = <TrendingUp className="h-4 w-4 text-emerald-600" />;
const FALL_ICON = <TrendingDown className="h-4 w-4 text-rose-600" />;
const pctColor = (pct: number | null) => (pct === null ? "slate" : pct >= 0 ? "emerald" : "red");

const lifespanLabel = (days: number) =>
  days >= 365 ? `${(days / 365).toFixed(1)} years` : `${days} ${days === 1 ? "day" : "days"}`;

/**
 * RETURNS MODULE — /performance: the time-weighted return since inception and per year, then
 * the trailing horizons. Time-weighted, so money added or withdrawn is neither a gain nor a
 * loss — the same figure the monthly heatmap uses. The "Inception" horizon is left out of the
 * row below, since it's the headline already; a horizon longer than the portfolio's history
 * isn't returned at all.
 */
function ReturnsModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<PerformanceResponse>(portfolioService.getPerformance, portfolioUuid);
  const horizons = data?.horizons.filter((h) => h.period !== "Inception") ?? [];
  const [exploring, setExploring] = useState(false);
  const canExplore = data !== null && !updating && data.status !== "insufficient_history";

  return (
    <Module>
      <ModuleHead
        onExplore={canExplore ? () => setExploring(true) : undefined}
        eyebrow="Performance"
        title="Returns"
        desc="Time-weighted: money you add or withdraw doesn't count as a gain or a loss."
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
            <ModuleMessage>Not enough history yet to measure returns — they&apos;ll show up here soon.</ModuleMessage>
          ) : (
            <>
              {/* The since-inception figures side by side, then the recent horizons two by two —
                  beside them in a wide tile, under them in a narrow one. */}
              <div className={`grid grid-cols-1 divide-y divide-slate-100 ${horizons.length > 0 ? "@3xl:grid-cols-2 @3xl:divide-y-0 @3xl:divide-x" : ""}`}>
                <div className="grid grid-cols-2 items-center divide-x divide-slate-100">
                  <StatContent
                    title="Since Inception"
                    value={formatPctOrDash(data.totalReturnPct)}
                    icon={data.totalReturnPct !== null && data.totalReturnPct < 0 ? FALL_ICON : RISE_ICON}
                    info={`Total return over ${lifespanLabel(data.lifespanDays)}.`}
                    color={pctColor(data.totalReturnPct)}
                  />
                  <StatContent
                    title="Per Year"
                    value={formatPctOrDash(data.annualizedReturnPct)}
                    icon={data.annualizedReturnPct !== null && data.annualizedReturnPct < 0 ? FALL_ICON : RISE_ICON}
                    info={data.annualizedReturnPct === null ? "Not enough history yet." : "The return since inception, annualized."}
                    color={pctColor(data.annualizedReturnPct)}
                  />
                </div>
                {horizons.length > 0 && (
                  <div className="grid grid-cols-2 auto-rows-fr gap-px bg-slate-100">
                    {horizons.map((h) => <HorizonCell key={h.period} horizon={h} onClick={() => setExploring(true)} />)}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
      {canExplore && exploring && (
        <ExploreView title="Returns" onClose={() => setExploring(false)}>
          <ReturnsExplore data={data} />
        </ExploreView>
      )}
    </Module>
  );
}

const monthYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const horizonLabel = (period: string) => (period === "Inception" ? "Since inception" : `Last ${period.toLowerCase()}`);

/**
 * RETURNS EXPLORE — the detail view behind ReturnsModule: the growth curve the headline figure is
 * the end of, the return of each calendar year, every horizon with the risk taken to earn it,
 * and the best and worst month.
 */
function ReturnsExplore({ data }: { data: PerformanceResponse }) {
  const cumulative = useMemo(() => (data.cumulativeReturnPct ? toChartPoints(data.cumulativeReturnPct) : []), [data]);
  const annual = useMemo(
    () => data.annual.filter((a): a is { year: number; returnPct: number } => a.returnPct !== null).map((a) => ({ year: String(a.year), value: a.returnPct })),
    [data],
  );

  const horizonColumns: DataColumn<HorizonEntry>[] = [
    { key: "period", label: "Period", render: (h) => <span className="font-bold text-slate-900 whitespace-nowrap">{horizonLabel(h.period)}</span> },
    { key: "return", label: "Return", align: "right", render: (h) => <SignedPct pct={h.totalReturnPct} /> },
    { key: "vol", label: "Volatility", align: "right", render: (h) => plainPctOrDash(h.volatilityPct) },
    { key: "dd", label: "Deepest fall", align: "right", render: (h) => plainPctOrDash(h.maxDrawdownPct) },
    { key: "rar", label: "Return / risk", align: "right", render: (h) => ratioOrDash(h.riskAdjustedReturn) },
  ];

  return (
    <>
      {cumulative.length >= 2 && (
        <ExplorePanel
          title="Growth since inception"
          right={<span className="text-sm tabular-nums"><SignedPct pct={data.totalReturnPct} /></span>}
        >
          <div className="p-6 md:p-7 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
              <AreaChart data={cumulative} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value) => [formatPct(Number(value)), "Return to date"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="monotone" dataKey="value" stroke={PORTFOLIO_COLOR} strokeWidth={2} fill={PORTFOLIO_COLOR} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ExplorePanel>
      )}
      {annual.length > 0 && (
        <ExplorePanel title="By calendar year">
          <div className="p-6 md:p-7 h-56">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 224 }}>
              <BarChart data={annual} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                <Tooltip formatter={(value) => [formatPct(Number(value)), "Return"]} contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={48}>
                  {annual.map((a) => <Cell key={a.year} fill={a.value >= 0 ? "#10b981" : "#f43f5e"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExplorePanel>
      )}
      {data.horizons.length > 0 && (
        <ExplorePanel
          title="By horizon"
          right={
            <InfoTip text="Return / risk is the return over the period divided by its volatility: how much it earned for each unit of swing.">
              <Info className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
            </InfoTip>
          }
        >
          <DataTable columns={horizonColumns} rows={data.horizons} rowKey={(h) => h.period} />
        </ExplorePanel>
      )}
      {(data.bestMonth || data.worstMonth) && (
        <ExplorePanel title="Extremes">
          <FigureList>
            {data.bestMonth && (
              <FigureRow label={`Best month · ${monthYearLabel(data.bestMonth.month)}`} info="The calendar month with the highest return." value={formatPct(data.bestMonth.returnPct)} tone={data.bestMonth.returnPct >= 0 ? "gain" : "loss"} />
            )}
            {data.worstMonth && (
              <FigureRow label={`Worst month · ${monthYearLabel(data.worstMonth.month)}`} info="The calendar month with the lowest return." value={formatPct(data.worstMonth.returnPct)} tone={data.worstMonth.returnPct >= 0 ? "gain" : "loss"} />
            )}
            <FigureRow label="Deepest fall" info="The largest drop from a high to a later low, since inception." value={plainPctOrDash(data.maxDrawdownPct)} />
          </FigureList>
        </ExplorePanel>
      )}
    </>
  );
}

function HorizonCell({ horizon, onClick }: { horizon: HorizonEntry; onClick: () => void }) {
  const pct = horizon.totalReturnPct;
  return (
    <button type="button" onClick={onClick} className="bg-white hover:bg-slate-50 transition-colors text-left px-5 md:px-6 py-4 flex flex-col justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/40">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last {horizon.period.toLowerCase()}</p>
      <p className={`text-lg font-black tabular-nums mt-1 ${pct === null ? "text-slate-400" : pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
        {formatPctOrDash(pct)}
      </p>
    </button>
  );
}

/**
 * DRAWDOWN MODULE — /performance's drawdown series: how far below its previous high the
 * portfolio stood on each day (0 at a new high, always ≤0), with the deepest fall as the
 * headline. Same document as ReturnsModule, fetched on its own since it's on another tab.
 */
function DrawdownModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<PerformanceResponse>(portfolioService.getPerformance, portfolioUuid);
  const points = useMemo(() => (data?.drawdownPct ? toChartPoints(data.drawdownPct) : []), [data]);
  const showFigure = data !== null && !updating && data.status !== "insufficient_history";
  const [exploring, setExploring] = useState(false);

  return (
    <Module>
      <ModuleHead
        onExplore={showFigure && points.length >= 2 ? () => setExploring(true) : undefined}
        eyebrow="Risk"
        title="Drawdown"
        desc="How far the portfolio stood below its previous high, day by day."
        right={showFigure ? (
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deepest fall</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {data.maxDrawdownPct === null ? "—" : `${data.maxDrawdownPct.toFixed(2)}%`}
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
          {points.length < 2 ? (
            <ModuleMessage>Not enough history yet to chart.</ModuleMessage>
          ) : (
            <DrawdownChart points={points} />
          )}
        </>
      )}
      {showFigure && exploring && data.drawdownPct && (
        <ExploreView title="Drawdown" onClose={() => setExploring(false)}>
          <DrawdownExplore series={data.drawdownPct} points={points} maxDrawdownPct={data.maxDrawdownPct} />
        </ExploreView>
      )}
    </Module>
  );
}

function DrawdownChart({ points }: { points: { date: string; value: number }[] }) {
  return (
    <div className="p-6 md:p-7 h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <AreaChart data={points} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
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
            formatter={(value) => [`${Number(value).toFixed(2)}%`, "Below previous high"]}
            contentStyle={TOOLTIP_STYLE}
          />
          <Area type="monotone" dataKey="value" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.12} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface DrawdownEpisode {
  peak: string;
  trough: string;
  depthPct: number;
  recovered: string | null;
}

// Values at or above this count as "back at the high": the series is exactly 0 on a new high,
// but leave room for float noise.
const DRAWDOWN_AT_HIGH = -1e-6;

/**
 * Splits the daily drawdown series into episodes: each starts on the last day at a high (the
 * peak), bottoms out at its deepest day (the trough) and ends on the first day back at a high
 * (recovered), or is still open. Deepest first.
 */
function drawdownEpisodes(series: TimeSeries): DrawdownEpisode[] {
  const episodes: DrawdownEpisode[] = [];
  let current: DrawdownEpisode | null = null;
  let lastHigh = series.dates[0];
  series.values.forEach((value, i) => {
    const date = series.dates[i];
    if (value >= DRAWDOWN_AT_HIGH) {
      if (current) {
        current.recovered = date;
        episodes.push(current);
        current = null;
      }
      lastHigh = date;
    } else if (!current) {
      current = { peak: lastHigh, trough: date, depthPct: value, recovered: null };
    } else if (value < current.depthPct) {
      current.trough = date;
      current.depthPct = value;
    }
  });
  if (current) episodes.push(current);
  return episodes.sort((a, b) => a.depthPct - b.depthPct);
}

const DRAWDOWN_EPISODE_ROWS = 10;

/**
 * DRAWDOWN EXPLORE — the detail view behind DrawdownModule: the chart, then the portfolio's
 * deepest falls one by one, with how long each took to hit bottom and to climb back.
 */
function DrawdownExplore({
  series, points, maxDrawdownPct,
}: { series: TimeSeries; points: { date: string; value: number }[]; maxDrawdownPct: number | null }) {
  const episodes = useMemo(() => drawdownEpisodes(series).slice(0, DRAWDOWN_EPISODE_ROWS), [series]);
  const today = series.dates[series.dates.length - 1];

  const columns: DataColumn<DrawdownEpisode>[] = [
    { key: "peak", label: "From the high of", sortValue: (e) => e.peak, render: (e) => <span className="font-bold text-slate-900 whitespace-nowrap">{shortDateLabel(e.peak)}</span> },
    { key: "depth", label: "Fall", align: "right", sortValue: (e) => -e.depthPct, render: (e) => <span className="font-bold text-rose-600">{e.depthPct.toFixed(2)}%</span> },
    { key: "trough", label: "Bottom", align: "right", sortValue: (e) => e.trough, render: (e) => shortDateLabel(e.trough) },
    { key: "down", label: "To bottom", align: "right", sortValue: (e) => daysBetween(e.peak, e.trough), render: (e) => `${daysBetween(e.peak, e.trough)} d` },
    {
      key: "recovery", label: "Recovered", align: "right",
      sortValue: (e) => daysBetween(e.peak, e.recovered ?? today),
      render: (e) => e.recovered
        ? `${daysBetween(e.peak, e.recovered)} d later`
        : <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-wider">Not yet</span>,
    },
  ];

  return (
    <>
      <ExplorePanel
        title="Below the previous high"
        right={<span className="text-sm font-black tabular-nums text-rose-600">{plainPctOrDash(maxDrawdownPct)} <span className="text-xs font-bold text-slate-400">deepest</span></span>}
      >
        <DrawdownChart points={points} />
      </ExplorePanel>
      <ExplorePanel title="Deepest falls">
        {episodes.length === 0 ? (
          <ModuleMessage>The portfolio hasn&apos;t fallen below a previous high yet.</ModuleMessage>
        ) : (
          <DataTable columns={columns} rows={episodes} rowKey={(e) => e.peak} initialSort={{ key: "depth", desc: true }} />
        )}
      </ExplorePanel>
    </>
  );
}

// How many rows the per-asset / per-platform lists below show before the rest would just be
// noise on a summary tab.
const TOP_ROWS = 5;

/**
 * RANKED BARS — a short "who contributes most" list: a label, a figure, and a bar scaled to the
 * largest row. Shared by the top dividend payers and the costs by platform. With `onSelect`
 * each row is a button that opens the module's detail view on that row; `more` adds a last line
 * for the rows left out, opening the detail too.
 */
function RankedBars({
  title, rows, onSelect, more,
}: {
  title: string;
  rows: { key: string; label: string; sub?: string; value: number; figure: string }[];
  onSelect?: (key: string) => void;
  more?: { count: number; onClick: () => void };
}) {
  const max = Math.max(...rows.map((r) => r.value), 0.01);
  return (
    <div className="px-6 md:px-7 py-6 border-t border-slate-100">
      <h3 className="text-sm font-black text-slate-900 mb-3">{title}</h3>
      <div className="space-y-1">
        {rows.map((r) => {
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <span className="min-w-0 truncate">
                  <span className="text-[13px] font-bold text-slate-900">{r.label}</span>
                  {r.sub && <span className="text-xs text-slate-400 ml-2">{r.sub}</span>}
                </span>
                <span className="text-[13px] font-bold text-slate-500 tabular-nums shrink-0">{r.figure}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-[#C49A3C]" style={{ width: `${(r.value / max) * 100}%` }} />
              </div>
            </>
          );
          return onSelect ? (
            <button
              key={r.key}
              type="button"
              onClick={() => onSelect(r.key)}
              className="block text-left -mx-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
              style={{ width: "calc(100% + 1rem)" }}
            >
              {body}
            </button>
          ) : (
            <div key={r.key} className="py-1.5">{body}</div>
          );
        })}
      </div>
      {more && more.count > 0 && (
        <button
          type="button"
          onClick={more.onClick}
          className="mt-3 text-xs font-bold text-[#C49A3C] hover:text-[#8A6A28] transition-colors"
        >
          +{more.count} more
        </button>
      )}
    </div>
  );
}

/**
 * DIVIDENDS MODULE — /dividends: the last 12 months' income as the headline, the yields behind
 * it, and the biggest payers. wholePortfolioYieldPct is the portfolio's yield as a whole (not
 * just the holdings that pay), which is what "what does my portfolio yield" means.
 */
function DividendsModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<DividendsResponse>(portfolioService.getDividends, portfolioUuid);
  const allPayers = useMemo(
    () => (data ? [...data.byAsset].filter((a) => a.trailing12MIncome > 0).sort((a, b) => b.trailing12MIncome - a.trailing12MIncome) : []),
    [data],
  );
  const payers = allPayers.slice(0, TOP_ROWS);
  const hasIncome = data !== null && data.totalLifetimeIncome > 0;
  // undefined: closed; null: open on the whole list; a key: open on that payer's row.
  const [exploring, setExploring] = useState<string | null | undefined>(undefined);
  const canExplore = hasIncome && !updating;

  return (
    <Module>
      <ModuleHead
        eyebrow={data?.currency ?? "Income"}
        title="Dividends"
        desc="Cash paid out by your holdings."
        onExplore={canExplore ? () => setExploring(null) : undefined}
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
          {!hasIncome ? (
            <ModuleMessage>No dividends received yet.</ModuleMessage>
          ) : (
            <>
              <FigureList>
                <FigureRow
                  label="Since inception"
                  info="All the dividends you've received, since your first transaction."
                  value={formatCurrency(data.totalLifetimeIncome, data.currency, 0)}
                  emphasis
                />
                <FigureRow
                  label="Last 12 months"
                  info="The dividends received over the last 12 months."
                  value={formatCurrency(data.totalTrailing12MIncome, data.currency, 0)}
                />
                <FigureRow
                  label="Yield"
                  info="The last 12 months' dividends over what the whole portfolio is worth today."
                  value={data.wholePortfolioYieldPct === null ? "—" : `${data.wholePortfolioYieldPct.toFixed(2)}%`}
                />
                <FigureRow
                  label="Yield on cost"
                  info="The last 12 months' dividends over what you paid for the holdings that pay them."
                  value={data.portfolioYieldOnCostPct === null ? "—" : `${data.portfolioYieldOnCostPct.toFixed(2)}%`}
                />
                <FigureRow
                  label="vs previous year"
                  info="How the last 12 months' dividends compare with the 12 months before."
                  value={formatPctOrDash(data.portfolioGrowthYoyPct)}
                  tone={data.portfolioGrowthYoyPct === null ? undefined : data.portfolioGrowthYoyPct >= 0 ? "gain" : "loss"}
                />
              </FigureList>
              {payers.length > 0 && (
                <RankedBars
                  title="Top payers, last 12 months"
                  rows={payers.map((a) => ({
                    key: a.assetId,
                    label: a.ticker ?? a.name,
                    sub: a.ticker ? a.name : undefined,
                    value: a.trailing12MIncome,
                    figure: formatCurrency(a.trailing12MIncome, data.currency, 0),
                  }))}
                  onSelect={setExploring}
                  more={{ count: allPayers.length - payers.length, onClick: () => setExploring(null) }}
                />
              )}
            </>
          )}
        </>
      )}
      {canExplore && exploring !== undefined && (
        <ExploreView title="Dividends" onClose={() => setExploring(undefined)}>
          <DividendsExplore data={data} focus={exploring} />
        </ExploreView>
      )}
    </Module>
  );
}

const DIVIDEND_COLUMNS = (currency: string): DataColumn<DividendsResponse["byAsset"][number]>[] => [
  { key: "asset", label: "Asset", sortValue: (a) => a.ticker ?? a.name, render: (a) => <AssetCell ticker={a.ticker} name={a.name} /> },
  { key: "t12m", label: "Last 12m", align: "right", sortValue: (a) => a.trailing12MIncome, render: (a) => formatCurrency(a.trailing12MIncome, currency, 0) },
  { key: "p12m", label: "Prior 12m", align: "right", sortValue: (a) => a.prior12MIncome, render: (a) => formatCurrency(a.prior12MIncome, currency, 0) },
  { key: "yoy", label: "Change", align: "right", sortValue: (a) => a.growthYoyPct, render: (a) => <SignedPct pct={a.growthYoyPct} /> },
  { key: "lifetime", label: "Lifetime", align: "right", sortValue: (a) => a.lifetimeIncome, render: (a) => formatCurrency(a.lifetimeIncome, currency, 0) },
  { key: "yield", label: "Yield", align: "right", sortValue: (a) => a.yieldPct, render: (a) => plainPctOrDash(a.yieldPct) },
  { key: "yoc", label: "On cost", align: "right", sortValue: (a) => a.yieldOnCostPct, render: (a) => plainPctOrDash(a.yieldOnCostPct) },
];

/**
 * DIVIDENDS EXPLORE — the detail view behind DividendsModule: every figure the module summarises,
 * plus the two it leaves out (the previous 12 months, and the yield of just the paying
 * holdings), then every asset that has ever paid, sortable.
 */
function DividendsExplore({ data, focus }: { data: DividendsResponse; focus: string | null }) {
  const assets = useMemo(() => data.byAsset.filter((a) => a.lifetimeIncome > 0), [data]);
  const columns = useMemo(() => DIVIDEND_COLUMNS(data.currency), [data.currency]);
  return (
    <>
      <ExplorePanel title="Overview">
        <FigureList>
          <FigureRow label="Since inception" info="All the dividends you've received, since your first transaction." value={formatCurrency(data.totalLifetimeIncome, data.currency, 0)} emphasis />
          <FigureRow label="Last 12 months" info="The dividends received over the last 12 months." value={formatCurrency(data.totalTrailing12MIncome, data.currency, 0)} />
          <FigureRow label="Previous 12 months" info="The dividends received in the 12 months before that." value={formatCurrency(data.totalPrior12MIncome, data.currency, 0)} />
          <FigureRow
            label="vs previous year"
            info="How the last 12 months' dividends compare with the 12 months before."
            value={formatPctOrDash(data.portfolioGrowthYoyPct)}
            tone={data.portfolioGrowthYoyPct === null ? undefined : data.portfolioGrowthYoyPct >= 0 ? "gain" : "loss"}
          />
          <FigureRow label="Yield" info="The last 12 months' dividends over what the whole portfolio is worth today." value={plainPctOrDash(data.wholePortfolioYieldPct)} />
          <FigureRow label="Yield of paying holdings" info="The same, counting only the holdings that pay dividends." value={plainPctOrDash(data.portfolioYieldPct)} />
          <FigureRow label="Paying holdings" info="How much of the portfolio's value is in holdings that paid a dividend over the last 12 months." value={plainPctOrDash(data.payersShareOfPortfolioPct)} />
          <FigureRow label="Yield on cost" info="The last 12 months' dividends over what you paid for the holdings that pay them." value={plainPctOrDash(data.portfolioYieldOnCostPct)} />
        </FigureList>
      </ExplorePanel>
      <ExplorePanel title="By asset">
        <DataTable columns={columns} rows={assets} rowKey={(a) => a.assetId} initialSort={{ key: "t12m", desc: true }} highlight={focus} />
      </ExplorePanel>
    </>
  );
}

// annualizedCostDragPct thresholds, the same ones the PDF report uses.
const costDragLabel = (pct: number) => (pct < 0.1 ? "Negligible" : pct > 0.5 ? "Material" : "Moderate");

function CostDragBadge({ pct }: { pct: number }) {
  const label = costDragLabel(pct);
  const tone = label === "Negligible"
    ? "bg-emerald-50 text-emerald-700"
    : label === "Moderate" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}>{label}</span>;
}

// An asset's cell in a DataTable: its ticker in bold with the full name under it (or just the
// name when there's no ticker), plus an optional third line.
function AssetCell({ ticker, name, sub }: { ticker: string | null; name: string; sub?: string }) {
  return (
    <div className="min-w-[9rem] max-w-[16rem]">
      <p className="font-bold text-slate-900 truncate">{ticker ?? name}</p>
      {ticker && <p className="text-xs text-slate-400 truncate">{name}</p>}
      {sub && <p className="text-xs text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

// A signed percentage in a table cell, green or red by its sign.
function SignedPct({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400">—</span>;
  return <span className={`font-bold ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatPct(pct)}</span>;
}

/**
 * FIGURE LIST — a module's secondary figures as compact rows (label left, value right)
 * rather than a strip of boxed stats, which crowd a half-width tile: each box's icon, title
 * and padding take more room than the number it holds. The explanation sits behind the info
 * icon next to the label, as on the stat cards.
 */
function FigureList({ children }: { children: React.ReactNode }) {
  return <dl className="px-6 md:px-7 py-2 divide-y divide-slate-100">{children}</dl>;
}

// `emphasis` for the headline figure of the list: same row, a bigger value. `tone` colours a
// value that reads as good or bad news (a change, say).
function FigureRow({
  label, info, value, badge, emphasis = false, tone,
}: { label: string; info: string; value: string; badge?: React.ReactNode; emphasis?: boolean; tone?: "gain" | "loss" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="flex items-center gap-1.5 min-w-0 text-[13px] font-semibold text-slate-600">
        <span className="truncate">{label}</span>
        <InfoTip text={info}>
          <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
        </InfoTip>
      </dt>
      <dd className="flex items-center gap-2.5 shrink-0">
        {badge}
        <span
          className={`font-black tabular-nums ${emphasis ? "text-2xl" : "text-base"} ${
            tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"
          }`}
          style={emphasis ? { fontFamily: "'Playfair Display', Georgia, serif" } : undefined}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

/**
 * TRADING COSTS MODULE — /trading-costs: what trading has cost (commissions plus spread) as
 * the headline, how heavy that is relative to what was traded and to the portfolio's return,
 * and which platforms it went to.
 */
function TradingCostsModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<TradingCostsResponse>(portfolioService.getTradingCosts, portfolioUuid);
  const allPlatforms = useMemo(
    () => (data ? [...data.byPlatform].sort((a, b) => b.totalCosts - a.totalCosts) : []),
    [data],
  );
  const platforms = allPlatforms.slice(0, TOP_ROWS);
  // undefined: closed; null: open; a platform: open on that platform's row.
  const [exploring, setExploring] = useState<string | null | undefined>(undefined);
  const canExplore = data !== null && !updating && data.totalTransactions > 0;

  return (
    <Module>
      <ModuleHead
        eyebrow={data?.currency ?? "Costs"}
        title="Trading Costs"
        desc="Commissions plus the spread paid when buying and selling."
        onExplore={canExplore ? () => setExploring(null) : undefined}
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
          {data.totalTransactions === 0 ? (
            <ModuleMessage>No trades recorded yet.</ModuleMessage>
          ) : (
            <>
              <FigureList>
                <FigureRow
                  label="Total costs"
                  info="Commissions plus the spread paid on every buy and sell, since your first transaction."
                  value={formatCurrency(data.totalCosts, data.currency, 0)}
                  emphasis
                />
                <FigureRow
                  label="Per trade"
                  info={`Average cost across ${data.totalTransactions} ${data.totalTransactions === 1 ? "trade" : "trades"}.`}
                  value={data.avgCostPerTrade === null ? "—" : formatCurrency(data.avgCostPerTrade, data.currency, 2)}
                />
                <FigureRow
                  label="Of traded volume"
                  info="Costs over the total amount you bought and sold."
                  value={data.costRatioPct === null ? "—" : `${data.costRatioPct.toFixed(2)}%`}
                />
                <FigureRow
                  label="Yearly drag"
                  info="How much costs take off the portfolio's return each year. Under 0.10% is negligible, over 0.50% is material."
                  value={data.annualizedCostDragPct === null ? "—" : `${data.annualizedCostDragPct.toFixed(2)}%`}
                  badge={data.annualizedCostDragPct === null ? undefined : <CostDragBadge pct={data.annualizedCostDragPct} />}
                />
              </FigureList>
              {platforms.length > 1 && (
                <RankedBars
                  title="By platform"
                  rows={platforms.map((pl) => ({
                    key: pl.platform,
                    label: pl.platform,
                    sub: `${pl.transactionCount} ${pl.transactionCount === 1 ? "trade" : "trades"}`,
                    value: pl.totalCosts,
                    figure: formatCurrency(pl.totalCosts, data.currency, 0),
                  }))}
                  onSelect={setExploring}
                  more={{ count: allPlatforms.length - platforms.length, onClick: () => setExploring(null) }}
                />
              )}
            </>
          )}
        </>
      )}
      {canExplore && exploring !== undefined && (
        <ExploreView title="Trading Costs" onClose={() => setExploring(undefined)}>
          <TradingCostsExplore data={data} focus={exploring} />
        </ExploreView>
      )}
    </Module>
  );
}

const bpsOrDash = (bps: number | null) => (bps === null ? "—" : `${bps.toFixed(1)} bps`);

/**
 * TRADING COSTS EXPLORE — the detail view behind TradingCostsModule: how the total splits into
 * commissions and spread, how it built up over time, and where it went, by platform and by
 * asset.
 */
function TradingCostsExplore({ data, focus }: { data: TradingCostsResponse; focus: string | null }) {
  const cumulative = useMemo(() => (data.cumulativeCosts ? toChartPoints(data.cumulativeCosts) : []), [data]);
  const commissionShare = data.totalCosts > 0 ? (data.explicitFees / data.totalCosts) * 100 : 0;

  const platformColumns = useMemo((): DataColumn<TradingCostsResponse["byPlatform"][number]>[] => [
    { key: "platform", label: "Platform", sortValue: (p) => p.platform, render: (p) => <span className="font-bold text-slate-900">{p.platform}</span> },
    { key: "trades", label: "Trades", align: "right", sortValue: (p) => p.transactionCount, render: (p) => p.transactionCount },
    { key: "volume", label: "Volume", align: "right", sortValue: (p) => p.tradedVolume, render: (p) => formatCurrency(p.tradedVolume, data.currency, 0) },
    { key: "fees", label: "Commissions", align: "right", sortValue: (p) => p.explicitFees, render: (p) => formatCurrency(p.explicitFees, data.currency, 2) },
    { key: "spread", label: "Spread", align: "right", sortValue: (p) => p.implicitCosts, render: (p) => formatCurrency(p.implicitCosts, data.currency, 2) },
    { key: "total", label: "Total", align: "right", sortValue: (p) => p.totalCosts, render: (p) => <span className="font-bold text-slate-900">{formatCurrency(p.totalCosts, data.currency, 2)}</span> },
    { key: "bps", label: "Of volume", align: "right", sortValue: (p) => p.costBps, render: (p) => bpsOrDash(p.costBps) },
    { key: "share", label: "Share", align: "right", sortValue: (p) => p.shareOfTotalPct, render: (p) => plainPctOrDash(p.shareOfTotalPct) },
  ], [data.currency]);

  const assetColumns = useMemo((): DataColumn<TradingCostsResponse["byAsset"][number]>[] => [
    { key: "asset", label: "Asset", sortValue: (a) => a.ticker ?? a.name, render: (a) => <AssetCell ticker={a.ticker} name={a.name} sub={a.broker} /> },
    { key: "trades", label: "Trades", align: "right", sortValue: (a) => a.transactionCount, render: (a) => a.transactionCount },
    { key: "volume", label: "Volume", align: "right", sortValue: (a) => a.tradedVolume, render: (a) => formatCurrency(a.tradedVolume, data.currency, 0) },
    { key: "total", label: "Total", align: "right", sortValue: (a) => a.totalCosts, render: (a) => <span className="font-bold text-slate-900">{formatCurrency(a.totalCosts, data.currency, 2)}</span> },
    { key: "bps", label: "Of volume", align: "right", sortValue: (a) => a.costBps, render: (a) => bpsOrDash(a.costBps) },
  ], [data.currency]);

  return (
    <>
      <ExplorePanel title="Where the costs come from">
        <div className="px-6 md:px-7 pt-5">
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full bg-[#C49A3C]" style={{ width: `${commissionShare}%` }} />
            <div className="h-full bg-[#E8C97A]" style={{ width: `${100 - commissionShare}%` }} />
          </div>
        </div>
        <FigureList>
          <FigureRow label="Total costs" info="Commissions plus the spread paid on every buy and sell, since your first transaction." value={formatCurrency(data.totalCosts, data.currency, 2)} emphasis />
          <FigureRow
            label="Commissions"
            info="The fees your brokers charged, as recorded on your transactions."
            value={formatCurrency(data.explicitFees, data.currency, 2)}
            badge={<span className="w-2.5 h-2.5 rounded-full bg-[#C49A3C]" />}
          />
          <FigureRow
            label="Spread"
            info={`What was lost to the gap between buying and selling prices${data.implicitCostWeightPct === null ? "" : ` — ${data.implicitCostWeightPct.toFixed(0)}% of the total`}.`}
            value={formatCurrency(data.implicitCosts, data.currency, 2)}
            badge={<span className="w-2.5 h-2.5 rounded-full bg-[#E8C97A]" />}
          />
          <FigureRow label="Traded volume" info={`The total amount bought and sold, over ${data.totalTransactions} ${data.totalTransactions === 1 ? "trade" : "trades"}.`} value={formatCurrency(data.totalVolume, data.currency, 0)} />
          <FigureRow label="Of traded volume" info="Costs over the total amount you bought and sold." value={data.costRatioBps === null ? "—" : `${bpsOrDash(data.costRatioBps)} · ${plainPctOrDash(data.costRatioPct)}`} />
          <FigureRow label="Of portfolio value" info="Costs over what the portfolio is worth today." value={plainPctOrDash(data.costToEquityPct)} />
        </FigureList>
      </ExplorePanel>
      {cumulative.length >= 2 && (
        <ExplorePanel title="Costs over time">
          <div className="p-6 md:p-7 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 256 }}>
              <AreaChart data={cumulative} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => formatCompact(Number(v))} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value) => [formatCurrency(Number(value), data.currency, 2), "Costs to date"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Area type="stepAfter" dataKey="value" stroke={PORTFOLIO_COLOR} strokeWidth={2} fill={PORTFOLIO_COLOR} fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ExplorePanel>
      )}
      {data.byPlatform.length > 0 && (
        <ExplorePanel title="By platform">
          <DataTable columns={platformColumns} rows={data.byPlatform} rowKey={(p) => p.platform} initialSort={{ key: "total", desc: true }} highlight={focus} />
        </ExplorePanel>
      )}
      {data.byAsset.length > 0 && (
        <ExplorePanel title="By asset">
          <DataTable columns={assetColumns} rows={data.byAsset} rowKey={(a) => `${a.assetId}-${a.broker}`} initialSort={{ key: "total", desc: true }} />
        </ExplorePanel>
      )}
    </>
  );
}

/**
 * PORTFOLIOS MIX MODULE — the aggregate's /composition, Composition side: each portfolio's
 * share of the value, of the profit and of the risk, then the assets held in more than one.
 * Risk share next to weight is the point: a portfolio carrying more risk than its size, or one
 * offsetting the rest. Colours match the Compare page (portfolioColorMap).
 */
function PortfoliosMixModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<CompositionResponse>(portfolioService.getComposition, portfolioUuid);
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const nameOf = (uuid: string) => data?.members.find((m) => m.portfolioUuid === uuid)?.name ?? portfolios.find((p) => p.uuid === uuid)?.name ?? "—";

  return (
    <Module>
      <ModuleHead
        eyebrow={data?.currency ?? "All portfolios"}
        title="Your Portfolios"
        desc="How each portfolio makes up the whole: its share of the value, of the profit and of the risk."
      />
      <AnalyticsPlaceholder
        loading={loading}
        failed={failed}
        hasData={data !== null}
        updating={updating}
        preparingMessage="Being prepared — this shows up after the overnight analysis of your portfolios has run."
      />
      {data !== null && !updating && (
        <>
          {data.isStale && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[520px]">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="text-left font-black py-3 pl-6 md:pl-7 pr-4">Portfolio</th>
                  <th className="text-right font-black py-3 px-4">Value</th>
                  <th className="text-right font-black py-3 px-4">Share of value</th>
                  <th className="text-right font-black py-3 px-4" title="Its share of the combined profit. Above 100% or below 0 when one portfolio lost while another gained.">
                    <span className="underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help">Share of profit</span>
                  </th>
                  <th className="text-right font-black py-3 pl-4 pr-6 md:pr-7" title="Its share of the combined risk at today's weights. The shares add up to 100%.">
                    <span className="underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help">Share of risk</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.portfolioUuid} className="border-t border-slate-100">
                    <th scope="row" className="text-left py-3 pl-6 md:pl-7 pr-4">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colorOf(m.portfolioUuid) }} />
                        <span className="font-bold text-slate-900">{m.name}</span>
                      </span>
                    </th>
                    <td className="text-right py-3 px-4 font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatCurrency(m.marketValue, data.currency, 0)}</td>
                    <td className="text-right py-3 px-4 font-bold text-slate-900 tabular-nums">{m.weightPct.toFixed(1)}%</td>
                    <td className="text-right py-3 px-4 tabular-nums whitespace-nowrap">
                      <span className="font-bold text-slate-900">{m.pnlSharePct === null ? "—" : `${m.pnlSharePct.toFixed(1)}%`}</span>
                      <span className={`block text-xs font-semibold ${m.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatSignedCurrency(m.totalPnl, data.currency)}
                      </span>
                    </td>
                    <td className="text-right py-3 pl-4 pr-6 md:pr-7 tabular-nums whitespace-nowrap">
                      <span className="font-bold text-slate-900">{m.riskContributionPct === null ? "—" : `${m.riskContributionPct.toFixed(1)}%`}</span>
                      {m.riskContributionPct !== null && <RiskShareNote risk={m.riskContributionPct} weight={m.weightPct} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.status === "insufficient_history" && (
            <p className="px-6 md:px-7 py-4 border-t border-slate-100 text-xs text-slate-400">
              Risk shares need at least 60 trading days shared by your portfolios — they&apos;ll show up once there are.
            </p>
          )}
          {data.overlappingAssets.length > 0 && (
            <div className="px-6 md:px-7 py-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Held in more than one portfolio</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 max-w-xl leading-relaxed">
                Your combined position in these is bigger than any single portfolio shows.
              </p>
              <div className="divide-y divide-slate-100">
                {data.overlappingAssets.slice(0, 10).map((a) => (
                  <div key={a.assetId} className="py-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-1.5">
                    <div className="min-w-0">
                      <p className="truncate">
                        <span className="text-[13px] font-bold text-slate-900">{a.ticker ?? a.name}</span>
                        {a.ticker && <span className="text-xs text-slate-400 ml-2">{a.name}</span>}
                      </p>
                      <p className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {a.holdings.map((h) => (
                          <span key={h.portfolioUuid} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colorOf(h.portfolioUuid) }} />
                            {nameOf(h.portfolioUuid)} <span className="tabular-nums">{formatCurrency(h.marketValue, data.currency, 0)}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(a.marketValue, data.currency, 0)}</p>
                      <p className="text-xs text-slate-400 tabular-nums">{a.weightPct.toFixed(1)}% of the total</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Module>
  );
}

// How far a risk share has to sit from the value share before it's worth pointing out, in
// percentage points — closer than that, "about its size" is the honest reading.
const RISK_SHARE_MARGIN = 5;

function RiskShareNote({ risk, weight }: { risk: number; weight: number }) {
  if (risk < 0) return <span className="block text-xs font-semibold text-emerald-600">Offsets the others</span>;
  if (risk > weight + RISK_SHARE_MARGIN) return <span className="block text-xs font-semibold text-amber-600">More than its size</span>;
  if (risk < weight - RISK_SHARE_MARGIN) return <span className="block text-xs font-semibold text-slate-400">Less than its size</span>;
  return null;
}

/**
 * PORTFOLIO CORRELATION MODULE — the aggregate's /composition, Risk side: how the portfolios'
 * daily returns move together. Near 1 they rise and fall together (little diversification
 * between them), near 0 independently, below 0 opposite. Null under "insufficient_history".
 */
function PortfolioCorrelationModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<CompositionResponse>(portfolioService.getComposition, portfolioUuid);
  const { portfolios } = usePortfolio();
  const nameOf = (uuid: string) => data?.members.find((m) => m.portfolioUuid === uuid)?.name ?? portfolios.find((p) => p.uuid === uuid)?.name ?? "—";
  const corr = data?.correlation ?? null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk"
        title="How Your Portfolios Move Together"
        desc={corr ? `Correlation of daily returns, over ${corr.observations} shared trading days.` : "Correlation of their daily returns."}
      />
      <AnalyticsPlaceholder
        loading={loading}
        failed={failed}
        hasData={data !== null}
        updating={updating}
        preparingMessage="Being prepared — this shows up after the overnight analysis of your portfolios has run."
      />
      {data !== null && !updating && (
        <>
          {data.isStale && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {corr === null ? (
            <ModuleMessage>Needs at least 60 trading days shared by your portfolios — it will appear once there are.</ModuleMessage>
          ) : (
            <div className="p-6 md:p-7 overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th />
                    {corr.portfolioUuids.map((u) => (
                      <th key={u} scope="col" className="px-1 pb-2 text-[11px] font-bold text-slate-500 text-center max-w-24 truncate">{nameOf(u)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corr.portfolioUuids.map((rowUuid, i) => (
                    <tr key={rowUuid}>
                      <th scope="row" className="pr-3 py-1 text-left text-[11px] font-bold text-slate-500 max-w-32 truncate">{nameOf(rowUuid)}</th>
                      {corr.portfolioUuids.map((colUuid, j) => {
                        const v = corr.matrix[i]?.[j] ?? null;
                        return (
                          <td key={colUuid} className="p-1">
                            {i === j || v === null ? (
                              <div className="w-16 h-12 rounded-lg bg-slate-50 flex items-center justify-center text-xs text-slate-300">—</div>
                            ) : (
                              <div
                                className="w-16 h-12 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums"
                                style={correlationCellStyle(v)}
                                title={`${nameOf(rowUuid)} and ${nameOf(colUuid)}: ${v.toFixed(2)}`}
                              >
                                {v.toFixed(2)}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center gap-3 mt-5 text-[11px] font-semibold text-slate-500">
                <span>Move opposite</span>
                {/* Same scale as the holdings' correlation matrix (correlationCellStyle). */}
                <span className="h-2 w-40 rounded-full" style={{ background: "linear-gradient(to right, rgb(244,63,94), #f8fafc, rgb(16,185,129))" }} />
                <span>Move together</span>
              </div>
            </div>
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
 * the way back in the header panel, where the tabs usually are. Month detail
 * needs the richer per-month figures (t0/t1 value, dividends, volatility, drawdown, report)
 * that monthlyMarketEffect doesn't carry, so it's fetched on demand via /monthly?year=, one
 * request per year, cached in `monthCache` so re-opening a month already visited this
 * session doesn't refetch.
 */
/**
 * MONTH TO DATE MODULE — how the market moved the portfolio this month: its value at last
 * month's close, today's and the month-to-date market effect, and a bar per day of that day's
 * market effect. Market effect, not raw value change: a purchase isn't a gain, so money added or
 * withdrawn is kept out of the figures and only mentioned alongside the month-to-date one.
 * Deltas, not raw values: a stable portfolio's value line is visually flat at this timescale.
 * /today carries isStale like the analytics documents, so useAnalytics polls it the same way.
 * Shown on the Dashboard, for the headline portfolio, rather than in Insights.
 */
export function MonthToDateModule({ portfolioUuid }: { portfolioUuid: string }) {
  const { data, loading, failed, updating } = useAnalytics<TodayDashboard>(portfolioService.getTodayDashboard, portfolioUuid);

  return (
    <Module>
      <ModuleHead
        eyebrow={data?.currency ?? "This month"}
        title="This month"
        desc="How the market moved your portfolio, day by day and month to date. Money you added or withdrew is left out."
      />
      {AnalyticsPlaceholder({
        loading, failed, hasData: data !== null, updating,
        preparingMessage: "Not enough history yet to show this month's moves.",
      }) ?? (data && <MonthToDateBody data={data} />)}
    </Module>
  );
}

function MonthToDateBody({ data }: { data: TodayDashboard }) {
  const isDayGain = data.dayMarketEffect >= 0;
  const isMtdGain = data.mtdMarketEffect >= 0;
  // A day or month with no opening value has no percentage to show (see hasPeriodBaseline).
  const points = [...data.chart]
    .sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime())
    .map((s) => ({
      date: s.snapshotAt, marketEffect: s.marketEffect, marketEffectPct: s.marketEffectPct,
      hasBaseline: s.previousValue !== 0,
    }));
  const mtdFlowsNote = data.mtdNetCapitalContributed !== 0
    ? `Value change ${formatSignedCurrency(data.deltaMtdValue, data.currency)}, with ${formatCurrency(Math.abs(data.mtdNetCapitalContributed), data.currency, 0)} ${data.mtdNetCapitalContributed > 0 ? "added" : "withdrawn"} by you`
    : undefined;

  return (
    <>
      {data.isStale && <div className="px-6 md:px-7 pt-6"><UpdatingNote /></div>}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <StatContent
          title="Month Start Value"
          value={formatCurrency(data.monthStartValue, data.currency, 0)}
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          info="Market value at the close of last month."
          color="blue"
        />
        <StatContent
          title="Market Move Today"
          value={<AmountWithDelta amount={formatSignedCurrency(data.dayMarketEffect, data.currency)} pct={data.dayMarketEffectPct} hasBaseline={data.previousDayValue !== 0} />}
          icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info="How much prices moved the portfolio since the previous day, excluding buys, sells, costs and dividends."
          color={isDayGain ? "emerald" : "red"}
        />
        <StatContent
          title="Market Move This Month"
          value={<AmountWithDelta amount={formatSignedCurrency(data.mtdMarketEffect, data.currency)} pct={data.mtdMarketEffectPct} hasBaseline={data.monthStartValue !== 0} />}
          icon={isMtdGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info={`How much prices moved the portfolio since the close of last month, excluding buys, sells, costs and dividends.${mtdFlowsNote ? ` ${mtdFlowsNote}.` : ""}`}
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
                tickFormatter={formatCompact}
                tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                width={56}
              />
              <Tooltip
                labelFormatter={(label) => fullDateLabel(label as string)}
                formatter={(value, name, props) => [
                  `${formatCurrency(Number(value), data.currency, 0)}${props.payload.hasBaseline ? ` (${formatPct(props.payload.marketEffectPct)})` : ""}`,
                  "Market move",
                ]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Bar dataKey="marketEffect" radius={[4, 4, 4, 4]}>
                {points.map((d) => (
                  <Cell key={d.date} fill={d.marketEffect >= 0 ? "#10b981" : "#f43f5e"} />
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
  data, historyUpdating, portfolioUuid, selected,
  monthCache, monthLoading, monthError, onSelectMonth, selectedYearStale, monthStaleTimedOut, isAggregate,
}: {
  data: FullHistoryDashboard; historyUpdating: boolean; portfolioUuid: string;
  selected: { year: number; month: number } | null;
  monthCache: Record<number, PeriodDashboard[]>;
  monthLoading: boolean;
  monthError: string | null;
  onSelectMonth: (year: number, month: number) => void;
  selectedYearStale: boolean;
  monthStaleTimedOut: boolean;
  // "All portfolios": Composition and Risk then also show how the portfolios make it up.
  isAggregate: boolean;
}) {

  // Composition (current holdings/currency breakdown plus sector/region exposure) used to live
  // on Insights' own Today page, fetched from the today dashboard's own `summary` field —
  // that endpoint no longer carries it (see GET /v1/portfolio/summary), so this fetches it
  // directly instead. Cached in this component's own state, so opening a month's detail and
  // coming back doesn't fetch it again.
  const [composition, setComposition] = useState<PortfolioComposition | null>(null);
  const [compositionError, setCompositionError] = useState<string | null>(null);

  useEffect(() => {
    if (composition !== null) return;
    let cancelled = false;
    const loadComposition = async () => {
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
      }
    };
    loadComposition();
    return () => { cancelled = true; };
  }, [composition, portfolioUuid]);

  if (selected) {
    const yearData = monthCache[selected.year];
    const period = yearData?.find(p => new Date(p.periodStart).getUTCMonth() + 1 === selected.month);
    const monthUpdating = selectedYearStale && !monthStaleTimedOut;
    return (
      <div className="space-y-6">
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
            <MonthDetail period={period} />
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

  // The /history figures (lifetime totals, chart, heatmap) all come from the one document, so
  // one isStale check covers them: each hidden behind a StaleUpdatingState while
  // historyUpdating, with one hint at the top of the page once that window times out. The
  // analytics modules in each section are their own fetches with their own isStale.
  const historyTile = (content: React.ReactNode) => historyUpdating ? <Module><StaleUpdatingState /></Module> : content;

  return (
    // The timeline's column and gap add up to --timeline-gutter (set in PerformanceSection).
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_2rem] gap-6">
      <div className="space-y-6 min-w-0">
        <HistorySection id="composition">
          {compositionError ? (
            <Tile>
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm font-bold">{compositionError}</p>
              </div>
            </Tile>
          ) : composition ? (
            <>
              {isAggregate && <Tile><PortfoliosMixModule portfolioUuid={portfolioUuid} /></Tile>}
              <Tile><HoldingsExplorer holdings={composition.summary.holdings} byCurrency={composition.summary.byCurrency} /></Tile>
              <Tile><SectorRegionModule sector={composition.sector} region={composition.region} /></Tile>
            </>
          ) : (
            <Tile>
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
              </div>
            </Tile>
          )}
        </HistorySection>
        <HistorySection id="income">
          <Tile span="half"><DividendsModule portfolioUuid={portfolioUuid} /></Tile>
          <Tile span="half"><TradingCostsModule portfolioUuid={portfolioUuid} /></Tile>
        </HistorySection>
        <HistorySection id="performance">
          {!historyUpdating && data.isStale && <Tile><UpdatingNote /></Tile>}
          <Tile>
            {historyTile(
              <ChartCard
                chart={data.chart}
                currency={data.currency}
                title="Portfolio Value"
                desc="Market value at each month end since inception, and today."
                right={
                  <div className="sm:text-right shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Value today</p>
                    <p className="text-2xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {formatCurrency(data.currentValue, data.currency, 0)}
                    </p>
                  </div>
                }
              />,
            )}
          </Tile>
          <Tile><ReturnsModule portfolioUuid={portfolioUuid} /></Tile>
          {/* Its own row: the list grows with every closed position. */}
          {!historyUpdating && <Tile><RealizedPnLCard trades={data.realizedTradesByAsset} /></Tile>}
          <Tile>
            {historyTile(
              <Module>
                <ModuleHead
                  eyebrow={data.currency}
                  title="Monthly Returns"
                  desc="Time-weighted return by month, since inception. Click a month for its full detail."
                />
                <MonthlyReturnsHeatmap entries={data.monthlyMarketEffect} onSelectMonth={onSelectMonth} />
              </Module>,
            )}
          </Tile>
          <BenchmarkTile portfolioUuid={portfolioUuid} />
        </HistorySection>
        <HistorySection id="risk">
          <Tile><VolatilityModule portfolioUuid={portfolioUuid} /></Tile>
          <Tile><DrawdownModule portfolioUuid={portfolioUuid} /></Tile>
          {isAggregate && <Tile><PortfolioCorrelationModule portfolioUuid={portfolioUuid} /></Tile>}
          <RiskModelTab portfolioUuid={portfolioUuid} />
        </HistorySection>
      </div>
      <SectionNav />
    </div>
  );
}
