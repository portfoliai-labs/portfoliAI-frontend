// components/dashboard/PerformanceSection.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Activity,
  Loader2, AlertCircle, FileText, ExternalLink,
  Search, ChevronDown, ChevronLeft, ChevronRight, Info, ArrowUpRight,
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
import { useDetail, useInsights, type Insights, type SectionState } from "../../hooks/useInsights";
import { pushDashboardEntry, readDashboardEntry, type DashboardOverlay } from "../../lib/dashboardHistory";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { BacktestBanner } from "./BacktestMarks";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { ExploreView, ExploreHostContext, ExplorePanel, DataTable, type DataColumn, type ExploreHeader } from "./ExploreView";
import type {
  ExposureEntryResponse, RiskModelResponse, RiskPointResponse, RiskPortfolioEntry, RiskModelUnavailableReason, WeightGapEntry,
  BenchmarkResponse, BenchmarkComponentEntry, TimeSeries, HorizonEntry, DividendsResponse, TradingCostsResponse,
  AssetDetailResponse, AssetChartRange, PeriodDashboard, MonthlyMarketEffectEntry, ValuePoint, PortfolioHoldingResponse,
  CurrencyDetail, RealizedPnlEntryResponse, RealizedPnlResponse, ReturnsResponse, VolatilityDetailResponse,
  PositionResponse, InsightsHoldingsModule, InsightsExposureModule, InsightsPortfoliosModule, InsightsComovementModule,
  InsightsDividendsModule, InsightsTradingCostsModule, InsightsRealizedPnlModule, InsightsThisMonthModule,
  InsightsValueModule, InsightsVolatilityModule, InsightsFrontierModule, InsightsPerformanceResponse,
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

// Shared recharts tooltip box. The text colour is set explicitly: recharts leaves the date
// label uncoloured, so it inherits the page's text colour — near-white in dark mode (see
// globals.css) — on the tooltip's white background, making it unreadable.
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155",
};

/**
 * INSIGHTS SECTION — one portfolio's lifetime figures: a page with one module per question
 * (HistoryPage: Holdings, Profit & Loss, Costs, Performance, Risk), each opening a detail view
 * with everything else about it, and a month opening from Performance's one level further down.
 * The data comes in four calls (see useInsights), and each detail view fetches its own documents
 * when it opens. The page waits for the
 * Performance section, whose `value` says whether there's any history at all; the others fill
 * in as they arrive. Stale modules are followed through /insights/status (see useInsights).
 */
export function PerformanceSection({
  portfolioUuid, isAggregate = false, backtest = false, onNavigate, trail, action,
}: {
  portfolioUuid: string; isAggregate?: boolean; onNavigate?: (section: string) => void;
  // A strategy's backtest (a virtual portfolio): the page opens under BacktestBanner, and before
  // its job has run it says so rather than asking for transactions.
  backtest?: boolean;
  // The pages above this one in the investor's Portfolios ("Portfolios / Main portfolio"), where
  // this page is "Insights" and a month or a detail one level deeper, published to the Sidebar
  // (see Breadcrumb). Without it (an advisor's view of a client, which has its own header) the
  // trail starts at "Insights".
  trail?: Crumb[];
  // The page's own action at its top right, on Insights itself (not a month or a detail): the
  // investor's "…" with Rename and Delete (PortfolioActions).
  action?: React.ReactNode;
}) {
  const insights = useInsights(portfolioUuid);
  const performance = insights.performance;

  // The month opened from the heatmap. Its detail lives here rather than in HistoryPage below,
  // even though only HistoryPage's content depends on it: while a month is open, its trail
  // (with the month's report link) takes the header's place, and that's rendered here. Fetched
  // again when the Performance section is (its figures come from the same stored values).
  const [selected, setSelected] = useState<{ year: number; month: number } | null>(null);
  const month = useDetail(
    selected ? () => portfolioService.getMonth(portfolioUuid, selected.year, selected.month) : null,
    selected ? `${selected.year}-${selected.month}` : "",
    performance.revision,
  );

  // A module's detail view (see ExploreView): the module draws it into `exploreSlot` and
  // reports it here, so the page can hide everything else and publish its trail instead of the
  // header's. The scroll position is kept for the way back, like the page itself.
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

  // A month opens from Performance's detail, one level further down, over it: the detail stays
  // mounted underneath (hidden), and the scroll position is kept for the way back to it.
  const scrollBeforeMonth = useRef(0);
  const openMonth = (year: number, m: number) => {
    scrollBeforeMonth.current = window.scrollY;
    setSelected({ year, month: m });
    window.scrollTo({ top: 0 });
  };
  const monthOpen = selected !== null;
  const firstMonthRun = useRef(true);
  useEffect(() => {
    if (firstMonthRun.current) {
      firstMonthRun.current = false;
      return;
    }
    if (monthOpen) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeMonth.current }));
    return () => cancelAnimationFrame(frame);
  }, [monthOpen]);

  // The browser's back button closes a month, then a detail view: opening either adds a history
  // entry (see lib/dashboardHistory), and landing on an entry below it closes it. Closed from the
  // page (Esc, the Sidebar), it goes back past its entry, so the next back goes further up.
  const overlay: DashboardOverlay | null = selected ? "month" : explore ? "explore" : null;
  const exploreRef = useRef(explore);
  useEffect(() => {
    exploreRef.current = explore;
  }, [explore]);
  const firstOverlayRun = useRef(true);
  useEffect(() => {
    const entry = readDashboardEntry();
    if (firstOverlayRun.current) {
      firstOverlayRun.current = false;
      // An entry for a detail that can't be shown again (reached with forward, or a reload).
      if (!overlay && entry?.overlay) pushDashboardEntry({ ...entry, overlay: undefined }, true);
      return;
    }
    const depth = OVERLAY_DEPTH[overlay ?? "none"];
    const entryDepth = OVERLAY_DEPTH[entry?.overlay ?? "none"];
    if (entry && depth > entryDepth) pushDashboardEntry({ ...entry, overlay: overlay ?? undefined });
    else if (depth < entryDepth) window.history.back();
  }, [overlay]);
  useEffect(() => {
    const onPopState = () => {
      const landed = readDashboardEntry()?.overlay;
      if (landed !== "month") setSelected(null);
      if (landed !== "explore") exploreRef.current?.onClose();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const above = trail ?? [];
  const insightsCrumb = (back: () => void): Crumb => ({ label: "Insights", onClick: back });
  const monthTitle = selected
    ? new Date(Date.UTC(selected.year, selected.month - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <div className="space-y-6 pb-12">
      {selected ? (
        <Breadcrumb
          trail={[...above, insightsCrumb(() => setSelected(null)), ...(explore ? [{ label: explore.title, onClick: () => setSelected(null) }] : [])]}
          current={monthTitle}
          right={<ViewReportLink portfolioUuid={portfolioUuid} documentId={month.data?.reportDocumentId ?? null} />}
        />
      ) : explore ? (
        <Breadcrumb trail={[...above, insightsCrumb(explore.onClose)]} current={explore.title} />
      ) : trail ? (
        <Breadcrumb trail={trail} current="Insights" right={action} />
      ) : null}
      {backtest && !selected && !explore && <BacktestBanner portfolioUuid={portfolioUuid} />}

      {performance.failed ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load portfolio data</p>
        </div>
      ) : performance.data === null ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : performance.data.value === null ? (
        backtest ? (
          <NoDataEmptyState
            title="The backtest is running"
            message="Its trades are being generated on historical prices, then its history is built like any portfolio's. Come back in a few minutes."
          />
        ) : (
          <NoDataEmptyState
            title="No performance data yet"
            message="Add or upload your transactions and this is where you'll track how your portfolio moves over time."
            onNavigate={onNavigate}
          />
        )
      ) : (
        <>
        {selected && (
          <MonthPage
            month={month}
            historyUpdating={performance.data.historyIsStale && !insights.timedOut}
            thisMonth={slotOf(performance, insights.timedOut, (d) => d.thisMonth, (_, d) => d.historyIsStale)}
            currency={performance.data.currency}
          />
        )}
        {/* Under an open month, the page and its detail stay mounted but hidden, the same way
            the page stays under a detail (see below). */}
        <div className={selected ? "invisible h-0 overflow-hidden" : "space-y-6"} aria-hidden={selected ? true : undefined} inert={selected ? true : undefined}>
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
              insights={insights}
              performance={performance.data}
              value={performance.data.value}
              portfolioUuid={portfolioUuid}
              onSelectMonth={openMonth}
              isAggregate={isAggregate}
            />
          </div>
        </ExploreHostContext.Provider>
        </div>
        </>
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
 * TILE — one cell of the page's mosaic (see HistoryPage): a 12-column grid on wide
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
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        {icon ? <div className="flex items-center gap-2.5">{icon}{heading}</div> : heading}
        {desc && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{desc}</p>}
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
function SnapshotChart({ chart, currency }: { chart: ValuePoint[]; currency: string }) {
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
  chart, currency, title, desc, right, onExplore,
}: { chart: ValuePoint[]; currency: string; title: string; desc: string; right?: React.ReactNode; onExplore?: () => void }) {
  return (
    <Module>
      <ModuleHead eyebrow={currency} title={title} desc={desc} right={right} onExplore={onExplore} />
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

const isHistoryEmpty = (value: InsightsValueModule) =>
  value.currentValue === 0 && value.chart.length === 0;

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
  // this component's parent (the Holdings carousel) triggers while scrolling/snapping.
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
 * EXPOSURE PANELS — part of the Holdings detail: the look-through exposure of the held positions
 * by sector and by region, as of the last snapshot tick (into funds, at today's fund composition
 * — not at any past date). Two modules of the Composition section, each null until the first
 * tick has run for this user; never stale.
 */
function ExposurePanels({ sector, region }: { sector: InsightsExposureModule | null; region: InsightsExposureModule | null }) {
  const panel = (title: string, subtitle: string, module: InsightsExposureModule | null) => (
    <ExplorePanel eyebrow="Holdings" title={title} desc={subtitle}>
      {module === null ? <ModuleMessage>{PREPARING_TICK}</ModuleMessage> : (
        <div className="p-6 md:p-7"><ExposureBreakdown entries={module.entries} /></div>
      )}
    </ExplorePanel>
  );
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {panel("By Sector", "Where your holdings' companies operate, weighted by market value.", sector)}
      {panel("By Region", "Geographic exposure, weighted by market value.", region)}
    </div>
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
 * they share (from /insights/risk-model, see RiskModelTab). Drawn whenever the document carries
 * a matrix of at least two assets, whatever its status; without one, a message stands in for
 * the table. Individual cells can be null and render as a dash.
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
function riskModelUnavailableMessage(model: { status: RiskModelResponse["status"]; unavailableReason: RiskModelUnavailableReason | null }): string {
  if (model.status === "insufficient_history") {
    return "The risk model needs at least a year of history. It will appear once your portfolio has one.";
  }
  return (model.unavailableReason && RISK_UNAVAILABLE_MESSAGES[model.unavailableReason]) || RISK_UNAVAILABLE_GENERIC;
}

/**
 * RISK DETAIL — everything behind the volatility: the rolling volatility, the turbulent periods
 * and the drawdowns (/insights/volatility, which also follows the returns document) and, on the
 * aggregate, how the portfolios move together. The risk model has its own (RiskModelModule).
 */
function RiskDetail({
  portfolioUuid, revision, returnsRevision, aggregate,
}: { portfolioUuid: string; revision: number; returnsRevision: number; aggregate: AggregateSlots | null }) {
  return (
    <>
      <VolatilityExplore portfolioUuid={portfolioUuid} revision={revision + returnsRevision} />
      {aggregate && <PortfolioCorrelationModule slot={aggregate.comovement} members={aggregate.portfolios.module?.members ?? []} />}
    </>
  );
}

/**
 * RISK MODEL MODULE — the risk model on the page: the efficient frontier, from the Risk section
 * (the frontier and the three mixes on it, without their weights). Its detail
 * (RiskModelExplore, /insights/risk-model) holds the rest. When the frontier can't be drawn (fewer
 * than two plottable points) or the model wasn't built, a message stands in for it, and the
 * detail still opens on what there is (a model that isn't built can still carry correlations).
 */
function RiskModelModule({ slot, portfolioUuid }: { slot: ModuleSlot<InsightsFrontierModule>; portfolioUuid: string }) {
  const [exploring, setExploring] = useState(false);
  const data = slot.module;
  const built = data?.status === "ok";
  const hasFrontier = data !== null && data.frontier.filter((f) => f.volatilityPct !== null && f.expectedReturnPct !== null).length >= 2;
  const explore = ready(slot) ? () => setExploring(true) : undefined;
  const head = <ModuleHead eyebrow="Risk" title="Risk Model" desc="How your holdings have behaved together, based on past returns." onExplore={explore} />;

  return (
    <>
      {ready(slot) && built && hasFrontier ? (
        <>
          {slot.lagging && <div className="mb-6"><UpdatingNote /></div>}
          <FrontierModule frontier={slot.module.frontier} current={slot.module.current} maxSharpe={slot.module.maxSharpe} minVolatility={slot.module.minVolatility} onExplore={explore} />
        </>
      ) : (
        <Module>
          {head}
          {SlotPlaceholder({ slot }) ?? (
            <ModuleMessage>
              {built
                ? "The efficient frontier can't be drawn for these holdings. Open it for the mixes and how your holdings move together."
                : riskModelUnavailableMessage(slot.module!)}
            </ModuleMessage>
          )}
        </Module>
      )}
      {ready(slot) && exploring && (
        <ExploreView title="Risk Model" onClose={() => setExploring(false)}>
          <RiskModelExplore portfolioUuid={portfolioUuid} revision={slot.revision} />
        </ExploreView>
      )}
    </>
  );
}

/**
 * RISK MODEL EXPLORE — the risk model's detail: either it was built for the whole
 * portfolio or none of it was. Built: the efficient frontier (when it has two plottable points),
 * the three mixes side by side with their weights, how far each holding sits from the max-Sharpe
 * mix and the per-asset inputs; not built: a single explanation, worded by unavailableReason.
 * The correlation matrix follows whenever the backend sent one (it does for no_positive_returns
 * and solver_failed too, since correlations need only returns). Everything here is built from
 * past returns, so it says so and avoids recommendation wording.
 */
function RiskModelExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getRiskModel(portfolioUuid), portfolioUuid, revision);
  return (
    <DetailBody detail={detail}>
      {(data) => {
        const built = data.status === "ok";
        return (
          <>
            {built ? (
              <>
                <FrontierModule frontier={data.frontier} current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} />
                <MixComparisonModule current={data.current} maxSharpe={data.maxSharpe} minVolatility={data.minVolatility} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="@container min-w-0">
                    <WeightGapsModule gaps={data.weightGaps} />
                  </div>
                  <div className="@container min-w-0">
                    <RiskAssetsModule assets={data.assets} />
                  </div>
                </div>
              </>
            ) : (
              <Module><ModuleMessage>{riskModelUnavailableMessage(data)}</ModuleMessage></Module>
            )}
            {(built || data.correlation !== null) && <CorrelationMatrixModule riskModel={data} />}
          </>
        );
      }}
    </DetailBody>
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
  frontier, current, maxSharpe, minVolatility, onExplore,
}: {
  frontier: { volatilityPct: number | null; expectedReturnPct: number | null }[];
  current: RiskPointResponse | null;
  maxSharpe: RiskPointResponse | null;
  minVolatility: RiskPointResponse | null;
  onExplore?: () => void;
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
  ].filter((d): d is typeof d & { entry: RiskPointResponse & { volatilityPct: number; expectedReturnPct: number } } =>
    d.entry?.volatilityPct != null && d.entry?.expectedReturnPct != null);

  if (curve.length < 2) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk Model"
        title="Efficient Frontier"
        desc="The highest past return available at each level of volatility, using your current holdings."
        onExplore={onExplore}
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

interface CarouselSlide {
  key: string;
  label: string;
  content: React.ReactNode;
}

/**
 * HOLDINGS EXPLORE — the Holdings module's detail view: a carousel with every currency together
 * first, drawn at once from the holdings the page already has, then one slide per currency,
 * from /insights/holdings/currencies (computed from the transactions on each call, so fetched
 * only here, and again when the section is). Swipe or scroll sideways, or pick a currency from
 * the pills; the pills and arrows follow what's on screen.
 */
function HoldingsExplore({
  holdings, currency, portfolioUuid, revision,
}: { holdings: PortfolioHoldingResponse[]; currency: string; portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getHoldingsByCurrency(portfolioUuid), portfolioUuid, revision);
  const slides: CarouselSlide[] = [
    { key: "all", label: "All currencies", content: <AllCurrenciesSlide holdings={holdings} currency={currency} /> },
    ...[...(detail.data?.currencies ?? [])]
      .sort((a, b) => a.currency.localeCompare(b.currency))
      .map((c) => ({ key: c.currency, label: c.currency, content: <CurrencySlide detail={c} /> })),
  ];
  const note = detail.loading ? (
    <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading each currency…</span>
  ) : detail.error ? (
    <span className="text-xs font-semibold text-slate-400">The per-currency view couldn&apos;t be loaded.</span>
  ) : null;
  return (
    <Carousel
      head={<ModuleHead eyebrow="Holdings" title="Allocation" desc={`Every currency together in ${currency}, then each currency on its own, in that currency.`} />}
      slides={slides}
      note={note}
    />
  );
}

/**
 * CAROUSEL — slides side by side in a track that scrolls sideways and snaps to one at a time.
 * The active slide is read back from the scroll position, so the pills and arrows never run
 * ahead of what's actually on screen while a smooth scroll is under way.
 */
// `head`: the module's heading, above the pills. `note`: a line after the pills, for slides
// still on their way.
function Carousel({ head, slides, note }: { head?: React.ReactNode; slides: CarouselSlide[]; note?: React.ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollTo = (i: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, i));
    const track = trackRef.current;
    if (track) track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
    else setActive(clamped);
  };
  const onScroll = () => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  const arrow = "w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:text-slate-500";

  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {head}
      <div className="px-4 md:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              onClick={() => scrollTo(i)}
              aria-current={i === active ? "true" : undefined}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                i === active ? "bg-[#1c1917] text-white border-[#1c1917]" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
            >
              {slide.label}
            </button>
          ))}
          {note && <span className="self-center ml-1">{note}</span>}
        </div>
        {slides.length > 1 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => scrollTo(active - 1)} disabled={active === 0} aria-label="Previous" className={arrow}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => scrollTo(active + 1)} disabled={active === slides.length - 1} aria-label="Next" className={arrow}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {slides.map((slide) => (
          <div key={slide.key} className="w-full shrink-0 snap-center">{slide.content}</div>
        ))}
      </div>
    </section>
  );
}

/** A figure at the top of a slide: label over value, with an optional line under it. */
function SlideFigure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p
        className={`text-xl md:text-2xl font-black tabular-nums mt-1 ${tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      {note && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{note}</p>}
    </div>
  );
}

type DonutItems = { label: string; value: number }[];

// A slide: its key figures, then three composition donuts side by side (all in `currency`).
function SlideBody({ figures, currency, donuts }: { figures: React.ReactNode; currency: string; donuts: { title: string; subtitle: string; items: DonutItems }[] }) {
  return (
    <>
      <div className="p-6 md:p-7 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5 border-b border-slate-100">{figures}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        {donuts.map((d) => (
          <AllocPanel key={d.title} title={d.title} subtitle={d.subtitle}>
            <CompositionDonut items={d.items} currency={currency} />
          </AllocPanel>
        ))}
      </div>
    </>
  );
}

/**
 * Every currency together, from the holdings module, where each position is already converted
 * to the reference currency: market value, cost and unrealized P&L, then the split by asset, by
 * asset class and by the currency each holding trades in.
 */
function AllCurrenciesSlide({ holdings, currency }: { holdings: PortfolioHoldingResponse[]; currency: string }) {
  const byCurrency = useMemo(() => sumBy(holdings, (h) => h.currency), [holdings]);
  const byClass = useMemo(() => sumBy(holdings, (h) => h.assetClass), [holdings]);

  const marketValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const cost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const pnl = marketValue - cost;

  return (
    <SlideBody
      figures={
        <>
          <SlideFigure label="Market value" value={formatCurrency(marketValue, currency, 0)} note={`In ${currency}, every currency converted`} />
          <SlideFigure label="Cost" value={formatCurrency(cost, currency, 0)} />
          <SlideFigure
            label="Unrealized P&L"
            value={formatSignedCurrency(pnl, currency)}
            note={cost > 0 ? `${pnl >= 0 ? "+" : ""}${((pnl / cost) * 100).toFixed(2)}%` : undefined}
            tone={pnl >= 0 ? "gain" : "loss"}
          />
          <SlideFigure label="Holdings" value={String(holdings.length)} note={`In ${byCurrency.length} ${byCurrency.length === 1 ? "currency" : "currencies"}`} />
        </>
      }
      currency={currency}
      donuts={[
        { title: "By asset", subtitle: "Individual positions", items: holdings.map((h) => ({ label: h.ticker ?? h.isin ?? h.name, value: h.marketValue })) },
        { title: "By category", subtitle: "Asset class", items: byClass },
        { title: "By currency", subtitle: "The currency each holding trades in", items: byCurrency },
      ]}
    />
  );
}

// Market value summed by a label (asset class, trading currency), for a donut.
const sumBy = (holdings: PortfolioHoldingResponse[], labelOf: (h: PortfolioHoldingResponse) => string) => {
  const totals = new Map<string, number>();
  for (const h of holdings) totals.set(labelOf(h), (totals.get(labelOf(h)) ?? 0) + h.marketValue);
  return [...totals].map(([label, value]) => ({ label, value }));
};

/**
 * One currency's holdings, in that currency: inside a single currency they can be weighted by
 * what was invested in them without any conversion: what's invested, fees and realized P&L,
 * then the split by asset, by asset class and by broker.
 */
function CurrencySlide({ detail }: { detail: CurrencyDetail }) {
  const { currency } = detail;
  const sales = `${detail.sellCount} ${detail.sellCount === 1 ? "sale" : "sales"}`;
  return (
    <SlideBody
      figures={
        <>
          <SlideFigure label="Invested" value={formatCurrency(detail.totalInvested, currency, 0)} note="In holdings still open" />
          <SlideFigure label="Holdings" value={String(detail.holdingsCount)} />
          <SlideFigure label="Fees paid" value={formatCurrency(detail.totalFeesPaid, currency, 0)} />
          <SlideFigure
            label="Realized P&L"
            value={formatSignedCurrency(detail.totalRealizedPl, currency)}
            note={detail.sellCount > 0 ? `${sales}, ${Math.round(detail.winRate * 100)}% at a gain` : sales}
            tone={detail.totalRealizedPl >= 0 ? "gain" : "loss"}
          />
        </>
      }
      currency={currency}
      donuts={[
        { title: "By asset", subtitle: "Individual positions", items: detail.holdings.map((h) => ({ label: h.ticker ?? h.isin ?? h.name, value: h.investedValue })) },
        { title: "By category", subtitle: "Asset class", items: detail.purchasesByAssetClass.map((a) => ({ label: a.assetClass, value: a.totalInvested })) },
        { title: "By broker", subtitle: "Where your orders were placed", items: detail.purchasesByBroker.map((b) => ({ label: b.broker, value: b.totalInvested })) },
      ]}
    />
  );
}

/**
 * HOLDINGS EXPLORER — the Holdings module: every position held now, at today's price and in the
 * reference currency, searchable and filterable by asset class and by the currency it trades in.
 * A row opens that asset's own page (AssetExplore); its title opens how the holdings add up
 * (HoldingsExplore): on the aggregate how the portfolios make it up first, then across every
 * currency, then within each one, then by sector and region.
 */
function HoldingsExplorer({
  slot, sector, region, aggregate, currency, portfolioUuid,
}: {
  slot: ModuleSlot<InsightsHoldingsModule>;
  sector: InsightsExposureModule | null;
  region: InsightsExposureModule | null;
  // "All portfolios" only.
  aggregate: AggregateSlots | null;
  currency: string;
  portfolioUuid: string;
}) {
  const holdings = useMemo(() => slot.module?.holdings ?? [], [slot.module]);
  const [exploringCurrencies, setExploringCurrencies] = useState(false);
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("all");
  const [tradedIn, setTradedIn] = useState("all");
  // The holding whose detail view (AssetExplore) is open. Rows without a ticker can't open one:
  // the market-data endpoint is keyed by it.
  const [exploringAsset, setExploringAsset] = useState<PortfolioHoldingResponse | null>(null);

  const assetClasses = useMemo(() => [...new Set(holdings.map(h => h.assetClass))].sort(), [holdings]);
  const currencies = useMemo(() => [...new Set(holdings.map(h => h.currency))].sort(), [holdings]);

  // Kept in the backend's order, largest market value first: every figure is in one currency.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return holdings
      .filter(h => assetClass === "all" || h.assetClass === assetClass)
      .filter(h => tradedIn === "all" || h.currency === tradedIn)
      .filter(h => !q || h.ticker?.toLowerCase().includes(q) || h.name.toLowerCase().includes(q));
  }, [holdings, search, assetClass, tradedIn]);

  const th = "py-3 text-[10px] font-black uppercase tracking-wider text-slate-400";

  return (
    <div className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      <ModuleHead
        eyebrow={currency}
        title="Holdings"
        desc={`Every position at today's price, in ${currency}. Open it for the allocation: overall, by currency, by sector and by region.`}
        onExplore={ready(slot) && holdings.length > 0 ? () => setExploringCurrencies(true) : undefined}
      />
      {SlotPlaceholder({ slot, preparingMessage: PREPARING_TICK }) ?? (
        <>
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
            <FilterSelect label="Currency" value={tradedIn} onChange={setTradedIn} options={currencies} />
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
                    <th className={`px-5 md:px-6 ${th}`}>Asset</th>
                    <th className={`px-3 ${th}`}>Class</th>
                    <th className={`px-3 ${th} text-right`}>Quantity</th>
                    <th className={`px-3 ${th} text-right`}>Value</th>
                    <th className={`px-3 ${th} text-right`}>Weight</th>
                    <th className={`px-3 md:px-6 ${th} text-right`}>Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((h) => (
                    <tr
                      key={h.assetId}
                      onClick={h.ticker ? () => setExploringAsset(h) : undefined}
                      className={`hover:bg-slate-50/60 transition-colors ${h.ticker ? "group/explore cursor-pointer" : ""}`}
                    >
                      <td className="px-5 md:px-6 py-3.5">
                        {/* Capped, the name truncated (full name on hover): a long fund name would
                            otherwise widen this column until the figures wrap. */}
                        <div className="flex items-baseline gap-2 min-w-0 max-w-56 md:max-w-72" title={h.name}>
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
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                          {h.assetClass}
                        </span>
                        {h.currency !== currency && <span className="ml-1.5 text-[10px] font-bold text-slate-400">{h.currency}</span>}
                      </td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-600 text-right tabular-nums whitespace-nowrap">{formatQuantity(h.quantity)}</td>
                      <td className="px-3 py-3.5 text-sm font-bold text-slate-900 text-right tabular-nums whitespace-nowrap">{formatCurrency(h.marketValue, currency, 2)}</td>
                      <td className="px-3 py-3.5 text-sm font-semibold text-slate-500 text-right tabular-nums whitespace-nowrap">{h.weightPct.toFixed(1)}%</td>
                      <td className="px-3 md:px-6 py-3.5 text-right tabular-nums whitespace-nowrap">
                        <span className={`text-sm font-bold ${h.unrealizedPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatSignedCurrency(h.unrealizedPnl, currency)}</span>
                        <span className="block text-[11px] font-semibold text-slate-400">{formatPct(h.roiPct)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {exploringCurrencies && (
        <ExploreView title="Holdings" onClose={() => setExploringCurrencies(false)}>
          {aggregate && <PortfoliosMixModule slot={aggregate.portfolios} comovement={aggregate.comovement.module} currency={currency} />}
          <HoldingsExplore holdings={holdings} currency={currency} portfolioUuid={portfolioUuid} revision={slot.revision} />
          <ExposurePanels sector={sector} region={region} />
        </ExploreView>
      )}
      {exploringAsset?.ticker && (
        <ExploreView title={exploringAsset.ticker} onClose={() => setExploringAsset(null)}>
          <AssetExplore ticker={exploringAsset.ticker} assetId={exploringAsset.assetId} portfolioUuid={portfolioUuid} revision={slot.revision} />
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
 * sector or TER…), what it's made of when it's a fund, and the user's own position in it
 * (GET /positions/{assetId}, fetched alongside: the asset endpoint knows nothing about
 * portfolios).
 *
 * Prices default to the user's reference currency, the one the rest of Insights is in; when
 * the asset is quoted in another one, a toggle switches to its own quote prices. Changing
 * range keeps the previous chart on screen (dimmed) until the new one arrives, since a ticker
 * nobody else holds can take a few seconds.
 */
function AssetExplore({ ticker, assetId, portfolioUuid, revision }: { ticker: string; assetId: string; portfolioUuid: string; revision: number }) {
  const position = useDetail(() => portfolioService.getPosition(portfolioUuid, assetId), assetId, revision);
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
        <ExplorePanel eyebrow={data.assetClass} title="About" desc="What the asset is and where it trades.">
          <dl className="px-6 md:px-7 py-2 divide-y divide-slate-100">
            {facts.map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-[13px] font-semibold text-slate-600">{f.label}</dt>
                <dd className="text-[13px] font-bold text-slate-900 text-right truncate">{f.value}</dd>
              </div>
            ))}
          </dl>
        </ExplorePanel>
        {position.data && <PositionPanel position={position.data} />}
      </div>

      {data.topHoldings.length > 0 && (
        <ExplorePanel eyebrow="Fund" title="Largest Holdings" desc="The fund's largest positions, by weight.">
          <div className="p-6 md:p-7">
            <ExposureBreakdown entries={data.topHoldings} />
          </div>
        </ExplorePanel>
      )}
      {(data.sectorWeightings.length > 1 || data.regionWeightings.length > 1) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.sectorWeightings.length > 1 && (
            <ExplorePanel eyebrow="Fund" title="By Sector" desc="Where the fund's companies operate, by weight.">
              <div className="p-6 md:p-7"><ExposureBreakdown entries={data.sectorWeightings} /></div>
            </ExplorePanel>
          )}
          {data.regionWeightings.length > 1 && (
            <ExplorePanel eyebrow="Fund" title="By Region" desc="The fund's geographic exposure, by weight.">
              <div className="p-6 md:p-7"><ExposureBreakdown entries={data.regionWeightings} /></div>
            </ExplorePanel>
          )}
        </div>
      )}
    </>
  );
}

/**
 * POSITION PANEL — the user's own position in an asset, in the reference currency: what's held
 * now and what it's worth, what selling it has realized, what it has paid, and what trading it
 * has cost on each broker. Each part shows only when it applies.
 */
function PositionPanel({ position }: { position: PositionResponse }) {
  const { currency, holding, realized, dividends, costs } = position;
  const rows: { label: string; value: string; tone?: "gain" | "loss" }[] = [];
  const tone = (n: number) => (n >= 0 ? "gain" : "loss");
  if (holding) {
    rows.push(
      { label: "Quantity", value: formatQuantity(holding.quantity) },
      { label: "Value", value: formatCurrency(holding.marketValue, currency, 2) },
      { label: "Average cost", value: formatCurrency(holding.avgCost, currency, 2) },
      { label: "Unrealized P&L", value: `${formatSignedCurrency(holding.unrealizedPnl, currency)} · ${formatPct(holding.roiPct)}`, tone: tone(holding.unrealizedPnl) },
      { label: "Weight in the portfolio", value: `${holding.weightPct.toFixed(1)}%` },
    );
  }
  if (realized && realized.realizedTradingPnl !== 0) {
    rows.push({ label: "Realized from sales", value: formatSignedCurrency(realized.realizedTradingPnl, currency), tone: tone(realized.realizedTradingPnl) });
  }
  if (dividends && dividends.lifetimeIncome > 0) {
    rows.push({ label: "Dividends received", value: formatCurrency(dividends.lifetimeIncome, currency, 2) });
    if (dividends.yieldOnCostPct !== null) rows.push({ label: "Yield on cost", value: `${dividends.yieldOnCostPct.toFixed(2)}%` });
  }
  for (const c of costs) {
    rows.push({ label: costs.length > 1 ? `Trading costs · ${c.broker}` : "Trading costs", value: formatCurrency(c.totalCosts, currency, 2) });
  }
  if (rows.length === 0) return null;

  return (
    <ExplorePanel
      eyebrow={currency}
      title={holding ? "Your Position" : "Your Past Position"}
      desc="What you hold of it, what selling it has realized, what it has paid and what trading it has cost."
    >
      <dl className="px-6 md:px-7 py-2 divide-y divide-slate-100">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-3">
            <dt className="text-[13px] font-semibold text-slate-600">{r.label}</dt>
            <dd className={`text-[13px] font-bold tabular-nums text-right ${r.tone === "gain" ? "text-emerald-600" : r.tone === "loss" ? "text-rose-600" : "text-slate-900"}`}>
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </ExplorePanel>
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
            <ModuleHead
              eyebrow={period.currency}
              title="The Month"
              desc={period.inProgress ? "From the value at the end of last month to today's." : "From the value at the end of the previous month to its own."}
            />
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

/**
 * REALIZED ROWS — the assets whose sales made or lost the most, one compact row each: the asset and
 * whether it's still held (plus its dividends), a bar growing from a centre line (gains to the
 * right, losses to the left, all on one scale), then the figure.
 */
function RealizedRows({ rows, currency }: { rows: RealizedPnlEntryResponse[]; currency: string }) {
  const maxAbs = Math.max(0, ...rows.map((r) => Math.abs(r.realizedTradingPnl)));
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((r) => {
        const isGain = r.realizedTradingPnl >= 0;
        const halfWidthPct = maxAbs > 0 ? Math.max(1.5, (Math.abs(r.realizedTradingPnl) / maxAbs) * 50) : 0;
        return (
          <li key={r.assetId} className="grid grid-cols-[minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_7rem] items-center gap-x-5 gap-y-2 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                {r.ticker ? <>{r.ticker} <span className="font-semibold text-slate-400">· {r.name}</span></> : r.name}
              </p>
              <p className="text-[11px] font-semibold text-slate-400 truncate">
                {r.isHeld ? "Still partly held" : "Closed"}
                {r.dividendIncome !== 0 && ` · + ${formatCurrency(r.dividendIncome, currency, 0)} dividends`}
              </p>
            </div>
            <div className="order-last col-span-2 @xl:order-none @xl:col-span-1 relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
              {isGain ? (
                <div className="absolute left-1/2 top-0 h-full rounded-r-full bg-emerald-500" style={{ width: `${halfWidthPct}%` }} />
              ) : (
                <div className="absolute right-1/2 top-0 h-full rounded-l-full bg-rose-500" style={{ width: `${halfWidthPct}%` }} />
              )}
            </div>
            <span className={`text-sm font-black tabular-nums text-right ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
              {formatSignedCurrency(r.realizedTradingPnl, currency)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// One of the realized P&L module's headline figures: a label with its explanation, the figure,
// and a line under it.
function RealizedFigure({ label, info, value, note, tone, emphasis = false }: {
  label: string; info: string; value: string; note: string; tone?: "gain" | "loss"; emphasis?: boolean;
}) {
  return (
    <div className="px-6 md:px-7 py-5">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
        {label}
        <InfoTip text={info}>
          <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
        </InfoTip>
      </p>
      <p
        className={`font-black tabular-nums mt-1.5 ${emphasis ? "text-3xl" : "text-xl"} ${
          tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"
        }`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-[11px] font-semibold text-slate-400 mt-1">{note}</p>
    </div>
  );
}

/**
 * REALIZED P&L MODULE — the Income & Costs section's realized P&L: what selling has locked in
 * since inception, in the reference currency (each sale converted at its own date, the PDF
 * report's figures). A band of three figures (the total, from sales, from dividends), then the
 * five assets whose sales made or lost the most, one row each (RealizedRows). Its detail is
 * Profit & Loss's (ProfitLossExplore): the realized and dividend figures, then every asset in one
 * table.
 */
function RealizedPnlModule({ slot, currency, portfolioUuid }: { slot: ModuleSlot<InsightsRealizedPnlModule>; currency: string; portfolioUuid: string }) {
  const [exploring, setExploring] = useState(false);
  const data = slot.module;
  const hasAny = data !== null && (data.topAssets.length > 0 || data.totalRealizedPnl !== 0);
  const canExplore = hasAny && !slot.updating;
  const toneOf = (v: number): "gain" | "loss" => (v >= 0 ? "gain" : "loss");

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Realized P&L"
        desc="What selling has locked in since inception, plus the dividends received."
        onExplore={canExplore ? () => setExploring(true) : undefined}
      />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_TICK} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {!hasAny ? (
            <ModuleMessage>No closed positions yet.</ModuleMessage>
          ) : (
            <>
              <div className="grid grid-cols-1 @xl:grid-cols-3 divide-y @xl:divide-y-0 @xl:divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40">
                <RealizedFigure
                  label="Total"
                  info="From sales plus dividends, since inception."
                  value={formatSignedCurrency(data.totalRealizedPnl, currency)}
                  note="Sales and dividends together"
                  tone={toneOf(data.totalRealizedPnl)}
                  emphasis
                />
                <RealizedFigure
                  label="From sales"
                  info="Sale proceeds minus what those units cost, each sale converted at its own date."
                  value={formatSignedCurrency(data.totalRealizedTradingPnl, currency)}
                  note="Proceeds minus what the units cost"
                  tone={toneOf(data.totalRealizedTradingPnl)}
                />
                <RealizedFigure
                  label="From dividends"
                  info="Dividends received since inception, from the holdings you still have and the ones you sold."
                  value={formatCurrency(data.totalDividendIncome, currency, 0)}
                  note="Received, held or sold since"
                />
              </div>
              <div className="px-6 md:px-7 pt-5 pb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Biggest gains and losses from sales</p>
                {data.topAssets.length === 0 ? (
                  <p className="text-sm text-slate-400 py-3">Nothing sold yet: the total is all dividends.</p>
                ) : (
                  <RealizedRows rows={data.topAssets} currency={currency} />
                )}
              </div>
            </>
          )}
        </>
      )}
      {canExplore && exploring && (
        <ExploreView title="Profit & Loss" onClose={() => setExploring(false)}>
          <ProfitLossExplore portfolioUuid={portfolioUuid} revision={slot.revision} />
        </ExploreView>
      )}
    </Module>
  );
}

/**
 * PROFIT & LOSS EXPLORE — the Realized P&L module's detail: what selling has locked in
 * (/insights/realized-pnl) and every dividend figure (/insights/dividends), then every asset in one
 * table (AssetPnlTable). The two load on their own, and the table shows as soon as either has.
 */
function ProfitLossExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const realized = useDetail(() => portfolioService.getRealizedPnl(portfolioUuid), portfolioUuid, revision);
  const dividends = useDetail(() => portfolioService.getDividends(portfolioUuid), portfolioUuid, revision);
  const loading = realized.loading || dividends.loading;
  return (
    <>
      <DetailBody detail={realized}>{(data) => <RealizedPnlFigures data={data} />}</DetailBody>
      <DetailBody detail={dividends}>{(data) => <DividendsFigures data={data} />}</DetailBody>
      {!loading && (realized.data || dividends.data) && (
        <AssetPnlTable realized={realized.data} dividends={dividends.data} />
      )}
    </>
  );
}

function RealizedPnlFigures({ data }: { data: RealizedPnlResponse }) {
  const { currency } = data;
  return (
      <ExplorePanel eyebrow={currency} title="Realized P&L" desc="What selling has locked in since inception, each sale converted at its own date, plus the dividends received.">
        {/* The same band of three figures as the module on the page. */}
        <div className="@container">
          <div className="grid grid-cols-1 @xl:grid-cols-3 divide-y @xl:divide-y-0 @xl:divide-x divide-slate-100">
            <RealizedFigure label="Total" info="From sales plus dividends, since inception." value={formatSignedCurrency(data.totalRealizedPnl, currency)} note="Sales and dividends together" tone={data.totalRealizedPnl >= 0 ? "gain" : "loss"} emphasis />
            <RealizedFigure label="From sales" info="Sale proceeds minus what those units cost, each sale converted at its own date." value={formatSignedCurrency(data.totalRealizedTradingPnl, currency)} note="Proceeds minus what the units cost" tone={data.totalRealizedTradingPnl >= 0 ? "gain" : "loss"} />
            <RealizedFigure label="From dividends" info="Dividends received since inception, from the holdings you still have and the ones you sold." value={formatCurrency(data.totalDividendIncome, currency, 0)} note="Received, held or sold since" />
          </div>
        </div>
      </ExplorePanel>
  );
}

// One asset's row in Profit & Loss's table: its realized P&L and its dividends, joined on the
// asset. null where the asset has no such figure (never sold, or never paid), or its half of the
// data didn't load.
interface AssetPnlRow {
  assetId: string;
  ticker: string | null;
  name: string;
  isHeld: boolean | null;
  fromSales: number | null;
  dividends: number | null;
  total: number | null;
  trailing12M: number | null;
  prior12M: number | null;
  growthYoyPct: number | null;
  yieldPct: number | null;
  yieldOnCostPct: number | null;
}

/**
 * Every asset sold or that has paid: the realized P&L's rows in their order (largest gains and
 * losses from sales first, dividend-only assets last), each with its dividend figures, then any
 * payer the realized P&L doesn't list. An asset's lifetime dividends are the realized P&L's (so
 * they add up to its total), or the dividends' when it isn't there.
 */
function joinAssetPnl(realized: RealizedPnlResponse | null, dividends: DividendsResponse | null): AssetPnlRow[] {
  const payers = new Map((dividends?.byAsset ?? []).filter((a) => a.lifetimeIncome > 0).map((a) => [a.assetId, a]));
  const fromDividends = (d: DividendsResponse["byAsset"][number] | undefined) => ({
    trailing12M: d?.trailing12MIncome ?? null,
    prior12M: d?.prior12MIncome ?? null,
    growthYoyPct: d?.growthYoyPct ?? null,
    yieldPct: d?.yieldPct ?? null,
    yieldOnCostPct: d?.yieldOnCostPct ?? null,
  });
  const rows: AssetPnlRow[] = (realized?.byAsset ?? []).map((r) => ({
    assetId: r.assetId,
    ticker: r.ticker,
    name: r.name,
    isHeld: r.isHeld,
    fromSales: r.realizedTradingPnl,
    dividends: r.dividendIncome,
    total: r.realizedPnl,
    ...fromDividends(payers.get(r.assetId)),
  }));
  const listed = new Set(rows.map((r) => r.assetId));
  for (const d of payers.values()) {
    if (listed.has(d.assetId)) continue;
    rows.push({
      assetId: d.assetId, ticker: d.ticker, name: d.name, isHeld: null,
      fromSales: null, dividends: d.lifetimeIncome, total: null,
      ...fromDividends(d),
    });
  }
  return rows;
}

/**
 * ASSET P&L TABLE — Profit & Loss's every asset, in one table instead of one for the realized P&L
 * and one for the dividends (which repeated each asset's lifetime dividends): what selling it
 * locked in, what it has paid, the total, then its dividends over the last two years and its
 * yields. Every column sorts; it scrolls sideways when it doesn't fit.
 */
function AssetPnlTable({ realized, dividends }: { realized: RealizedPnlResponse | null; dividends: DividendsResponse | null }) {
  const currency = realized?.currency ?? dividends?.currency ?? "EUR";
  const rows = useMemo(() => joinAssetPnl(realized, dividends), [realized, dividends]);
  const money = (v: number | null) => (v === null ? <span className="text-slate-300">—</span> : formatCurrency(v, currency, 0));
  const signed = (v: number | null) => (v === null ? <span className="text-slate-300">—</span> : <SignedAmount amount={v} currency={currency} />);
  const columns = useMemo((): DataColumn<AssetPnlRow>[] => [
    { key: "asset", label: "Asset", sortValue: (a) => a.ticker ?? a.name, render: (a) => <AssetCell ticker={a.ticker} name={a.name} sub={a.isHeld === null ? undefined : a.isHeld ? "Still partly held" : "Closed"} /> },
    { key: "sales", label: "From sales", align: "right", sortValue: (a) => a.fromSales, render: (a) => signed(a.fromSales) },
    { key: "dividends", label: "Dividends", align: "right", sortValue: (a) => a.dividends, render: (a) => money(a.dividends) },
    { key: "total", label: "Total", align: "right", sortValue: (a) => a.total, render: (a) => signed(a.total) },
    { key: "t12m", label: "Div. last 12m", align: "right", sortValue: (a) => a.trailing12M, render: (a) => money(a.trailing12M) },
    { key: "p12m", label: "Div. prior 12m", align: "right", sortValue: (a) => a.prior12M, render: (a) => money(a.prior12M) },
    { key: "yoy", label: "Change", align: "right", sortValue: (a) => a.growthYoyPct, render: (a) => <SignedPct pct={a.growthYoyPct} /> },
    { key: "yield", label: "Yield", align: "right", sortValue: (a) => a.yieldPct, render: (a) => plainPctOrDash(a.yieldPct) },
    { key: "yoc", label: "On cost", align: "right", sortValue: (a) => a.yieldOnCostPct, render: (a) => plainPctOrDash(a.yieldOnCostPct) },
  // money and signed only read currency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [currency]);

  return (
    <ExplorePanel
      eyebrow={currency}
      title="By Asset"
      desc="Every asset sold or that has paid dividends: what selling it locked in, what it has paid, and its dividends over the last two years. The largest gains and losses from sales first."
    >
      <DataTable columns={columns} rows={rows} rowKey={(a) => a.assetId} />
    </ExplorePanel>
  );
}

// A signed amount in a table cell, green or red by its sign.
function SignedAmount({ amount, currency }: { amount: number; currency: string }) {
  return <span className={`font-bold ${amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatSignedCurrency(amount, currency)}</span>;
}

const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });

const formatPctOrDash = (pct: number | null) => (pct === null ? "—" : formatPct(pct));

/**
 * MODULE SLOT — what a module on the page is drawn from: its own object in its section's
 * response (null until its document is first computed), and the state of the section's request
 * around it. A stale module (the user edited transactions, the rebuild hasn't landed) is
 * `updating` while useInsights is still waiting for it — the caller hides its figures behind
 * StaleUpdatingState, since old and new numbers would describe two different portfolios — and
 * `lagging` once it has stopped waiting: the figures are drawn with an UpdatingNote.
 * `revision` goes up with each fetch of the section, so an open detail view fetches again too.
 */
interface ModuleSlot<M> {
  module: M | null;
  loading: boolean;
  failed: boolean;
  updating: boolean;
  lagging: boolean;
  revision: number;
}

function slotOf<S, M>(
  section: SectionState<S>, timedOut: boolean, pick: (data: S) => M | null, staleOf: (module: M, data: S) => boolean,
): ModuleSlot<M> {
  const data = section.data;
  const picked = data === null ? null : pick(data);
  const stale = data !== null && picked !== null && staleOf(picked, data);
  return {
    module: picked,
    loading: data === null && !section.failed,
    failed: data === null && section.failed,
    updating: stale && !timedOut,
    lagging: stale && timedOut,
    revision: section.revision,
  };
}

// Most modules carry their own isStale; value, this month and the heatmap go by the Performance
// section's historyIsStale instead (see HistoryPage).
const ownStale = (module: { isStale: boolean }) => module.isStale;

// How deep each overlay sits over the page: a month opens from a detail view.
const OVERLAY_DEPTH: Record<DashboardOverlay | "none", number> = { none: 0, explore: 1, month: 2 };

const PREPARING_ANALYTICS = "Being prepared — this shows up after the overnight analysis of your portfolio has run.";
const PREPARING_TICK = "Being prepared — this shows up shortly after your first transactions are processed.";

/**
 * Shared loading / failed / null / updating placeholder for a module; null when there's a module
 * to draw normally. `updating` takes priority over drawing the module's own content but comes
 * after the other states, which all mean there's nothing to be stale about.
 */
function SlotPlaceholder({ slot, preparingMessage = PREPARING_ANALYTICS }: { slot: ModuleSlot<unknown>; preparingMessage?: string }) {
  if (slot.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
      </div>
    );
  }
  if (slot.failed) return <ModuleMessage>Unable to load this right now. Try again in a moment.</ModuleMessage>;
  if (slot.module === null) return <ModuleMessage>{preparingMessage}</ModuleMessage>;
  if (slot.updating) return <StaleUpdatingState />;
  return null;
}

// The module's figures can be drawn: loaded, computed, and not waiting on a rebuild.
const ready = <M,>(slot: ModuleSlot<M>): slot is ModuleSlot<M> & { module: M } => slot.module !== null && !slot.updating;

/**
 * A detail view's document (see useDetail): a spinner while it loads, a message when it failed or
 * isn't computed yet, otherwise `children` with it. A document that's stale inside its detail is
 * drawn with an UpdatingNote on top: the module that opened it was fresh a moment ago, and the
 * page fetches it again once the rebuild lands.
 */
function DetailBody<T extends { isStale: boolean }>({
  detail, children,
}: { detail: { data: T | null; error: unknown; loading: boolean }; children: (data: T) => React.ReactNode }) {
  if (detail.loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" /></div>;
  }
  if (detail.data === null) {
    return (
      <Module>
        <ModuleMessage>{detail.error ? "Unable to load this right now. Try again in a moment." : PREPARING_ANALYTICS}</ModuleMessage>
      </Module>
    );
  }
  return (
    <>
      {detail.data.isStale && <UpdatingNote />}
      {children(detail.data)}
    </>
  );
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
 * VOLATILITY MODULE — the Risk section's volatility: the portfolio's annualized volatility as a
 * headline, and the rolling series behind it. Null until the first analytics run, and
 * "insufficient_history" (nothing to show but a message) under a year of history. Risk on the
 * page: its detail (RiskDetail) holds the rest of it.
 */
function VolatilityModule({
  slot, portfolioUuid, returnsRevision, aggregate,
}: { slot: ModuleSlot<InsightsVolatilityModule>; portfolioUuid: string; returnsRevision: number; aggregate: AggregateSlots | null }) {
  const data = slot.module;
  const showFigure = ready(slot) && slot.module.status !== "insufficient_history";
  const [exploring, setExploring] = useState(false);

  return (
    <Module>
      <ModuleHead
        onExplore={ready(slot) ? () => setExploring(true) : undefined}
        eyebrow="Risk"
        title="Volatility"
        icon={
          <InfoTip text="How widely your portfolio's daily returns swing, scaled to a year (the standard deviation of daily returns, annualized). A higher figure means bigger ups and downs along the way.">
            <div className="w-8 h-8 rounded-xl border flex items-center justify-center cursor-help bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20">
              <Activity className="h-4 w-4" />
            </div>
          </InfoTip>
        }
        desc={`${data?.rollingWindowDays ? `The chart uses a rolling ${data.rollingWindowDays}-day window.` : "How much your portfolio's value moves around."} Open it for its turbulent periods and drawdowns.`}
        right={showFigure ? (
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Annualized volatility</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {plainPctOrDash(slot.module.annualizedVolatilityPct)}
            </p>
          </div>
        ) : undefined}
      />
      <SlotPlaceholder slot={slot} />
      {ready(slot) && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {slot.module.status === "insufficient_history" ? (
            <ModuleMessage>Volatility needs at least a year of history — it will appear once your portfolio has one.</ModuleMessage>
          ) : (
            slot.module.rollingVolatilityPct && <RollingVolatilityChart series={slot.module.rollingVolatilityPct} />
          )}
        </>
      )}
      {ready(slot) && exploring && (
        <ExploreView title="Risk" onClose={() => setExploring(false)}>
          <RiskDetail portfolioUuid={portfolioUuid} revision={slot.revision} returnsRevision={returnsRevision} aggregate={aggregate} />
        </ExploreView>
      )}
    </Module>
  );
}

const shortDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const rangeLabel = (start: string, end: string) => `${shortDateLabel(start)} – ${shortDateLabel(end)}`;
const daysBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);

/**
 * VOLATILITY EXPLORE — the detail view behind VolatilityModule, /insights/volatility: the
 * rolling chart, then the turbulent stretches the backend picked out of it (riskEvents), most
 * recent first, with what the portfolio did through each and what it held at the time; then the
 * drawdown (DrawdownSection): how far below its previous high it fell, and its deepest falls.
 * `revision` follows both documents it's built from (volatility and returns).
 */
function VolatilityExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getVolatility(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <VolatilityDetail data={data} />}</DetailBody>;
}

function VolatilityDetail({ data }: { data: VolatilityDetailResponse }) {
  if (data.status === "insufficient_history") {
    return <Module><ModuleMessage>Volatility needs at least a year of history — it will appear once your portfolio has one.</ModuleMessage></Module>;
  }
  return <VolatilityPanels data={data} />;
}

function VolatilityPanels({ data }: { data: VolatilityDetailResponse }) {
  const events = useMemo(() => [...data.riskEvents].sort((a, b) => b.startDate.localeCompare(a.startDate)), [data]);
  return (
    <>
      <ExplorePanel
        eyebrow="Risk"
        title="Rolling Volatility"
        desc={`Annualized volatility${data.rollingWindowDays ? ` over a rolling ${data.rollingWindowDays}-day window` : ""}, day by day.`}
        right={
          <span className="text-sm font-black tabular-nums text-slate-900">
            {plainPctOrDash(data.annualizedVolatilityPct)} <span className="text-xs font-bold text-slate-400">overall</span>
          </span>
        }
      >
        {data.rollingVolatilityPct ? <RollingVolatilityChart series={data.rollingVolatilityPct} /> : <ModuleMessage>Not enough data yet to chart.</ModuleMessage>}
      </ExplorePanel>
      <ExplorePanel
        eyebrow="Risk"
        title="Turbulent Periods"
        desc="Stretches of at least five trading days when the portfolio's 20-day volatility stayed in its top 10%, with what it held then."
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
      <DrawdownSection data={data} />
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

const benchmarkCoverage = (yearsCovered: number | null) =>
  yearsCovered !== null ? `Over the ${yearsCovered.toFixed(1)} years you share with the benchmark` : "Since inception";

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
 * BENCHMARK EXPLORE — the detail view behind BenchmarkTile, /insights/benchmark: the chart
 * again, the portfolio and the benchmark figure by figure (return and risk side by side), the
 * relative statistics, and the whole basket.
 */
function BenchmarkExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getBenchmark(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <BenchmarkDetail data={data} />}</DetailBody>;
}

function BenchmarkDetail({ data }: { data: BenchmarkResponse }) {
  if (data.status !== "ok") {
    return <Module><ModuleMessage>Not enough overlapping history with the benchmark yet to compare.</ModuleMessage></Module>;
  }
  return <BenchmarkPanels data={data} />;
}

function BenchmarkPanels({ data }: { data: BenchmarkResponse }) {
  const basket = useMemo(() => benchmarkBasket(data.components), [data]);
  const coverage = benchmarkCoverage(data.yearsCovered);
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
        <ExplorePanel eyebrow="Benchmark" title="Portfolio vs. Benchmark" desc={`Cumulative return. ${coverage}.`}>
          <CumulativeReturnChart portfolio={data.portfolioCumulativeReturnPct} benchmark={data.benchmarkCumulativeReturnPct} />
        </ExplorePanel>
      )}
      <ExplorePanel eyebrow="Benchmark" title="Side by Side" desc="The return and risk of each, over the same period.">
        <DataTable columns={pairColumns} rows={pairs} rowKey={(r) => r.key} />
      </ExplorePanel>
      <ExplorePanel eyebrow="Benchmark" title="Relative Figures" desc="How the portfolio's returns relate to the benchmark's. Hover a figure for what it means.">
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
        <ExplorePanel eyebrow="Benchmark" title="What the Benchmark Is Made Of" desc={BENCHMARK_BASKET_INFO}>
          <div className="p-6 md:p-7">
            <BenchmarkBasketList basket={basket} />
          </div>
        </ExplorePanel>
      )}
    </>
  );
}


const monthYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const horizonLabel = (period: string) => (period === "Inception" ? "Since inception" : `Last ${period.toLowerCase()}`);

/**
 * RETURNS EXPLORE — the detail view behind ReturnsModule, /insights/returns: the growth curve the
 * headline figure is the end of, the return of each calendar year, every horizon with the risk
 * taken to earn it, and the best and worst month.
 */
function ReturnsExplore({ portfolioUuid, revision }: { portfolioUuid: string; revision: number }) {
  const detail = useDetail(() => portfolioService.getReturns(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <ReturnsDetail data={data} />}</DetailBody>;
}

function ReturnsDetail({ data }: { data: ReturnsResponse }) {
  if (data.status === "insufficient_history") {
    return <Module><ModuleMessage>Not enough history yet to measure returns — they&apos;ll show up here soon.</ModuleMessage></Module>;
  }
  return <ReturnsPanels data={data} />;
}

function ReturnsPanels({ data }: { data: ReturnsResponse }) {
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
          eyebrow="Returns"
          title="Since Inception"
          desc="Time-weighted: money you add or withdraw doesn't count as a gain or a loss."
          right={
            <span className="text-sm tabular-nums">
              <SignedPct pct={data.totalReturnPct} />
              {data.annualizedReturnPct !== null && <span className="text-xs font-bold text-slate-400"> · <SignedPct pct={data.annualizedReturnPct} /> per year</span>}
            </span>
          }
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
        <ExplorePanel eyebrow="Returns" title="By Calendar Year" desc="The time-weighted return of each calendar year.">
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
          eyebrow="Returns"
          title="By Horizon"
          desc="Each trailing period with the risk taken to earn it. Return / risk is the return divided by the volatility: how much it earned for each unit of swing."
        >
          <DataTable columns={horizonColumns} rows={data.horizons} rowKey={(h) => h.period} />
        </ExplorePanel>
      )}
      {(data.bestMonth || data.worstMonth) && (
        <ExplorePanel eyebrow="Returns" title="Best and Worst Months" desc="The extremes of the monthly returns, and the deepest fall since inception.">
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

/**
 * DRAWDOWN SECTION — part of Volatility's detail view (VolatilityExplore): the drawdown series,
 * how far below its previous high the portfolio stood on each day (0 at a new high, always ≤0),
 * charted and then broken into its deepest falls (DrawdownExplore). It comes from the returns
 * document, so it can be missing while the volatility is there.
 */
function DrawdownSection({ data }: { data: VolatilityDetailResponse }) {
  const points = useMemo(() => (data.drawdownPct ? toChartPoints(data.drawdownPct) : []), [data]);

  if (!data.drawdownPct || points.length < 2) {
    return (
      <ExplorePanel eyebrow="Risk" title="Drawdown" desc="How far below its previous high the portfolio stood, day by day.">
        <ModuleMessage>Not enough history yet to chart the drawdown.</ModuleMessage>
      </ExplorePanel>
    );
  }
  return <DrawdownExplore series={data.drawdownPct} points={points} maxDrawdownPct={data.maxDrawdownPct} />;
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
 * DRAWDOWN EXPLORE — the drawdown panels of Volatility's detail view: the chart, then the portfolio's
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
        eyebrow="Risk"
        title="Drawdown"
        desc="How far below its previous high the portfolio stood, day by day."
        right={<span className="text-sm font-black tabular-nums text-rose-600">{plainPctOrDash(maxDrawdownPct)} <span className="text-xs font-bold text-slate-400">deepest</span></span>}
      >
        <DrawdownChart points={points} />
      </ExplorePanel>
      <ExplorePanel eyebrow="Risk" title="Deepest Falls" desc="The portfolio's deepest falls, how long each took to hit bottom and to climb back.">
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
 * leading to the whole list in the detail, for when the summary may have left rows out.
 */
function RankedBars({
  title, rows, onSelect, more,
}: {
  title: string;
  rows: { key: string; label: string; sub?: string; value: number; figure: string }[];
  onSelect?: (key: string) => void;
  more?: { label: string; onClick: () => void };
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
      {more && (
        <button
          type="button"
          onClick={more.onClick}
          className="mt-3 text-xs font-bold text-[#C49A3C] hover:text-[#8A6A28] transition-colors"
        >
          {more.label}
        </button>
      )}
    </div>
  );
}

/**
 * DIVIDENDS MODULE — the Income & Costs section's dividends: the income since inception as the
 * headline, the yields behind it, and the biggest payers over the last 12 months (the section
 * sends the top TOP_ROWS). wholePortfolioYieldPct is the portfolio's yield as a whole (not just
 * the holdings that pay), which is what "what does my portfolio yield" means. No detail of its
 * own: every dividend figure and asset is in Profit & Loss's (ProfitLossExplore).
 */
function DividendsModule({ slot, currency }: { slot: ModuleSlot<InsightsDividendsModule>; currency: string }) {
  const data = slot.module;
  const hasIncome = data !== null && data.totalLifetimeIncome > 0;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Dividends"
        desc="Cash paid out by your holdings."
      />
      <SlotPlaceholder slot={slot} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {!hasIncome ? (
            <ModuleMessage>No dividends received yet.</ModuleMessage>
          ) : (
            <>
              <FigureList>
                <FigureRow
                  label="Since inception"
                  info="All the dividends you've received, since your first transaction."
                  value={formatCurrency(data.totalLifetimeIncome, currency, 0)}
                  emphasis
                />
                <FigureRow
                  label="Last 12 months"
                  info="The dividends received over the last 12 months."
                  value={formatCurrency(data.totalTrailing12MIncome, currency, 0)}
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
              {data.topPayers.length > 0 && (
                <RankedBars
                  title="Top payers, last 12 months"
                  rows={data.topPayers.map((a) => ({
                    key: a.assetId,
                    label: a.ticker ?? a.name,
                    sub: a.ticker ? a.name : undefined,
                    value: a.trailing12MIncome,
                    figure: formatCurrency(a.trailing12MIncome, currency, 0),
                  }))}
                />
              )}
            </>
          )}
        </>
      )}
    </Module>
  );
}


// Every dividend figure the Dividends module summarises, plus the ones it leaves out (the
// previous 12 months, the yield of just the paying holdings), in Profit & Loss's detail.
function DividendsFigures({ data }: { data: DividendsResponse }) {
  return (
      <ExplorePanel eyebrow={data.currency} title="Dividends" desc="Cash paid out by your holdings.">
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
 * FIGURE LIST — a module's figures as a grid of small tiles rather than one row each across the
 * whole module, which left the space between label and value empty and made a half-width module
 * as tall as a list. The `emphasis` figure (the headline) spans the grid, larger, on a gold tint;
 * the others take two columns, three or four as the module widens (it's its own container, so it
 * follows the module's width, not the screen's). Each tile is lean — a label, its explanation
 * behind the info icon, the value — so two still fit a half-width tile.
 */
function FigureList({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <dl className="grid grid-cols-2 @xl:grid-cols-3 @4xl:grid-cols-4 gap-3 p-5 md:p-6">{children}</dl>
    </div>
  );
}

// `emphasis` for the headline figure of the list: the grid's whole width, a bigger value. `tone`
// colours a value that reads as good or bad news (a change, say).
function FigureRow({
  label, info, value, badge, emphasis = false, tone,
}: { label: string; info: string; value: string; badge?: React.ReactNode; emphasis?: boolean; tone?: "gain" | "loss" }) {
  const toneClass = tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900";
  return (
    <div className={`min-w-0 rounded-2xl ${emphasis ? "col-span-full bg-[#C49A3C]/8 px-5 py-4" : "bg-slate-50 px-4 py-3.5"}`}>
      <dt className="flex items-center gap-1.5 min-w-0 text-[12px] font-semibold text-slate-500">
        <span className="truncate">{label}</span>
        <InfoTip text={info}>
          <Info className="h-3.5 w-3.5 shrink-0 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
        </InfoTip>
      </dt>
      <dd className="flex items-center gap-2 mt-1 min-w-0">
        {badge}
        <span
          className={`font-black tabular-nums truncate ${emphasis ? "text-3xl" : "text-lg"} ${toneClass}`}
          style={emphasis ? { fontFamily: "'Playfair Display', Georgia, serif" } : undefined}
        >
          {value}
        </span>
      </dd>
    </div>
  );
}

/**
 * TRADING COSTS MODULE — the Income & Costs section's trading costs: what trading has cost
 * (commissions plus spread) as the headline, how heavy that is relative to what was traded and
 * to the portfolio's return, and which platforms it went to (the section sends the top
 * TOP_ROWS). Its detail (TradingCostsExplore) is /insights/trading-costs.
 */
function TradingCostsModule({ slot, currency, portfolioUuid }: { slot: ModuleSlot<InsightsTradingCostsModule>; currency: string; portfolioUuid: string }) {
  const data = slot.module;
  const platforms = data?.topPlatforms ?? [];
  // undefined: closed; null: open; a platform: open on that platform's row.
  const [exploring, setExploring] = useState<string | null | undefined>(undefined);
  const canExplore = data !== null && !slot.updating && data.totalTransactions > 0;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Trading Costs"
        desc="Commissions plus the spread paid when buying and selling."
        onExplore={canExplore ? () => setExploring(null) : undefined}
      />
      <SlotPlaceholder slot={slot} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
          {data.totalTransactions === 0 ? (
            <ModuleMessage>No trades recorded yet.</ModuleMessage>
          ) : (
            <>
              <FigureList>
                <FigureRow
                  label="Total costs"
                  info="Commissions plus the spread paid on every buy and sell, since your first transaction."
                  value={formatCurrency(data.totalCosts, currency, 0)}
                  emphasis
                />
                <FigureRow
                  label="Per trade"
                  info={`Average cost across ${data.totalTransactions} ${data.totalTransactions === 1 ? "trade" : "trades"}.`}
                  value={data.avgCostPerTrade === null ? "—" : formatCurrency(data.avgCostPerTrade, currency, 2)}
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
                    figure: formatCurrency(pl.totalCosts, currency, 0),
                  }))}
                  onSelect={setExploring}
                  more={platforms.length >= TOP_ROWS ? { label: "Every platform", onClick: () => setExploring(null) } : undefined}
                />
              )}
            </>
          )}
        </>
      )}
      {canExplore && exploring !== undefined && (
        <ExploreView title="Trading Costs" onClose={() => setExploring(undefined)}>
          <TradingCostsExplore portfolioUuid={portfolioUuid} revision={slot.revision} focus={exploring} />
        </ExploreView>
      )}
    </Module>
  );
}

const bpsOrDash = (bps: number | null) => (bps === null ? "—" : `${bps.toFixed(1)} bps`);

/**
 * TRADING COSTS EXPLORE — the detail view behind TradingCostsModule, /insights/trading-costs:
 * how the total splits into commissions and spread, how it built up over time, and where it
 * went, by platform and by asset.
 */
function TradingCostsExplore({ portfolioUuid, revision, focus }: { portfolioUuid: string; revision: number; focus: string | null }) {
  const detail = useDetail(() => portfolioService.getTradingCosts(portfolioUuid), portfolioUuid, revision);
  return <DetailBody detail={detail}>{(data) => <TradingCostsDetail data={data} focus={focus} />}</DetailBody>;
}

function TradingCostsDetail({ data, focus }: { data: TradingCostsResponse; focus: string | null }) {
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
      <ExplorePanel eyebrow={data.currency} title="Where the Costs Come From" desc="Commissions your brokers charged, and the spread lost between buying and selling prices.">
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
        <ExplorePanel eyebrow={data.currency} title="Costs over Time" desc="Trading costs added up since your first transaction.">
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
        <ExplorePanel eyebrow={data.currency} title="By Platform" desc="What trading cost on each platform.">
          <DataTable columns={platformColumns} rows={data.byPlatform} rowKey={(p) => p.platform} initialSort={{ key: "total", desc: true }} highlight={focus} />
        </ExplorePanel>
      )}
      {data.byAsset.length > 0 && (
        <ExplorePanel eyebrow={data.currency} title="By Asset" desc="What trading each asset cost, on each broker.">
          <DataTable columns={assetColumns} rows={data.byAsset} rowKey={(a) => `${a.assetId}-${a.broker}`} initialSort={{ key: "total", desc: true }} />
        </ExplorePanel>
      )}
    </>
  );
}

// The aggregate's own two modules, from the Composition section.
interface AggregateSlots {
  portfolios: ModuleSlot<InsightsPortfoliosModule>;
  comovement: ModuleSlot<InsightsComovementModule>;
}

const PREPARING_AGGREGATE = "Being prepared — this shows up after the overnight analysis of your portfolios has run.";

/**
 * PORTFOLIOS MIX MODULE — the aggregate's `portfolios` module, Composition side: each
 * portfolio's share of the value, of the profit and of the risk, then the assets held in more
 * than one (from `comovement`, the same document). Risk share next to weight is the point: a
 * portfolio carrying more risk than its size, or one offsetting the rest. Colours match the
 * Compare page (portfolioColorMap).
 */
function PortfoliosMixModule({
  slot, comovement, currency,
}: { slot: ModuleSlot<InsightsPortfoliosModule>; comovement: InsightsComovementModule | null; currency: string }) {
  const data = slot.module;
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const nameOf = (uuid: string) => data?.members.find((m) => m.portfolioUuid === uuid)?.name ?? portfolios.find((p) => p.uuid === uuid)?.name ?? "—";
  const overlapping = comovement?.overlappingAssets ?? [];

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Your Portfolios"
        desc="How each portfolio makes up the whole: its share of the value, of the profit and of the risk."
      />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_AGGREGATE} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
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
                    <td className="text-right py-3 px-4 font-bold text-slate-900 tabular-nums whitespace-nowrap">{formatCurrency(m.marketValue, currency, 0)}</td>
                    <td className="text-right py-3 px-4 font-bold text-slate-900 tabular-nums">{m.weightPct.toFixed(1)}%</td>
                    <td className="text-right py-3 px-4 tabular-nums whitespace-nowrap">
                      <span className="font-bold text-slate-900">{m.pnlSharePct === null ? "—" : `${m.pnlSharePct.toFixed(1)}%`}</span>
                      <span className={`block text-xs font-semibold ${m.totalPnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatSignedCurrency(m.totalPnl, currency)}
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
          {overlapping.length > 0 && (
            <div className="px-6 md:px-7 py-6 border-t border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Held in more than one portfolio</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                Your combined position in these is bigger than any single portfolio shows.
              </p>
              <div className="divide-y divide-slate-100">
                {overlapping.slice(0, 10).map((a) => (
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
                            {nameOf(h.portfolioUuid)} <span className="tabular-nums">{formatCurrency(h.marketValue, currency, 0)}</span>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-bold text-slate-900 tabular-nums">{formatCurrency(a.marketValue, currency, 0)}</p>
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
 * PORTFOLIO CORRELATION MODULE — the aggregate's `comovement` module, Risk side (it arrives
 * with the Composition section): how the portfolios' daily returns move together. Near 1 they
 * rise and fall together (little diversification between them), near 0 independently, below 0
 * opposite. Null under "insufficient_history".
 */
function PortfolioCorrelationModule({ slot, members }: { slot: ModuleSlot<InsightsComovementModule>; members: InsightsPortfoliosModule["members"] }) {
  const data = slot.module;
  const { portfolios } = usePortfolio();
  const nameOf = (uuid: string) => members.find((m) => m.portfolioUuid === uuid)?.name ?? portfolios.find((p) => p.uuid === uuid)?.name ?? "—";
  const corr = data?.correlation ?? null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Risk"
        title="How Your Portfolios Move Together"
        desc={corr ? `Correlation of daily returns, over ${corr.observations} shared trading days.` : "Correlation of their daily returns."}
      />
      <SlotPlaceholder slot={slot} preparingMessage={PREPARING_AGGREGATE} />
      {data !== null && !slot.updating && (
        <>
          {slot.lagging && <div className="p-6 md:p-7 pb-0"><UpdatingNote /></div>}
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

/**
 * MONTH TO DATE MODULE — how the market moved the portfolio this month: its value at last
 * month's close, today's and the month-to-date market effect, and a bar per day of that day's
 * market effect. Market effect, not raw value change: a purchase isn't a gain, so money added or
 * withdrawn is kept out of the figures and only mentioned alongside the month-to-date one.
 * Deltas, not raw values: a stable portfolio's value line is visually flat at this timescale.
 * In Insights' Performance section, right under the portfolio's value: the short term, before
 * the rest of the history.
 */
function MonthToDateModule({ slot, currency }: { slot: ModuleSlot<InsightsThisMonthModule>; currency: string }) {
  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="This month"
        desc="How the market moved your portfolio, day by day and month to date. Money you added or withdrew is left out."
      />
      {SlotPlaceholder({ slot, preparingMessage: "Not enough history yet to show this month's moves." })
        ?? (slot.module && <MonthToDateBody data={slot.module} currency={currency} lagging={slot.lagging} />)}
    </Module>
  );
}

function MonthToDateBody({ data, currency, lagging }: { data: InsightsThisMonthModule; currency: string; lagging: boolean }) {
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
    ? `Value change ${formatSignedCurrency(data.deltaMtdValue, currency)}, with ${formatCurrency(Math.abs(data.mtdNetCapitalContributed), currency, 0)} ${data.mtdNetCapitalContributed > 0 ? "added" : "withdrawn"} by you`
    : undefined;

  return (
    <>
      {lagging && <div className="px-6 md:px-7 pt-6"><UpdatingNote /></div>}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <StatContent
          title="Month Start Value"
          value={formatCurrency(data.monthStartValue, currency, 0)}
          icon={<Wallet className="h-4 w-4 text-blue-600" />}
          info="Market value at the close of last month."
          color="blue"
        />
        <StatContent
          title="Market Move Today"
          value={<AmountWithDelta amount={formatSignedCurrency(data.dayMarketEffect, currency)} pct={data.dayMarketEffectPct} hasBaseline={data.previousDayValue !== 0} />}
          icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          info="How much prices moved the portfolio since the previous day, excluding buys, sells, costs and dividends."
          color={isDayGain ? "emerald" : "red"}
        />
        <StatContent
          title="Market Move This Month"
          value={<AmountWithDelta amount={formatSignedCurrency(data.mtdMarketEffect, currency)} pct={data.mtdMarketEffectPct} hasBaseline={data.monthStartValue !== 0} />}
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
                  `${formatCurrency(Number(value), currency, 0)}${props.payload.hasBaseline ? ` (${formatPct(props.payload.marketEffectPct)})` : ""}`,
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

/**
 * MONTH PAGE — a month opened from the returns heatmap, in place of the whole page, the month in
 * progress followed by how the market moved it day by day (MonthToDateModule) (the way back
 * is the browser's back button): /insights/monthly/{YYYY-MM}, fetched by PerformanceSection so
 * its report link can sit at the top of the page. Its figures come from the same stored values as the
 * Performance section's history, so they're hidden while that's being rebuilt.
 */
function MonthPage({
  month, historyUpdating, thisMonth, currency,
}: {
  month: { data: PeriodDashboard | null; error: unknown; loading: boolean };
  historyUpdating: boolean;
  // How the market moved the portfolio day by day, for the month in progress.
  thisMonth: ModuleSlot<InsightsThisMonthModule>;
  currency: string;
}) {
  if (month.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
      </div>
    );
  }
  if (month.data === null) {
    return month.error instanceof ApiError && month.error.status === 404 ? (
      <EmptyPeriodState message="No detail available for this month." />
    ) : (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <p className="text-sm font-bold">Failed to load that month&apos;s detail</p>
      </div>
    );
  }
  if (historyUpdating && month.data.isStale) return <Module><StaleUpdatingState /></Module>;
  return (
    <div className="space-y-6">
      {month.data.isStale && <UpdatingNote />}
      <MonthDetail period={month.data} />
      {month.data.inProgress && <MonthToDateModule slot={thisMonth} currency={currency} />}
    </div>
  );
}

/**
 * HISTORY PAGE — the Insights page itself (see PerformanceSection above): one module per
 * question, each opening a detail view with everything else about it. Holdings (what it holds),
 * Profit & Loss (what selling locked in, and what the holdings paid, the latter not opening
 * anything of its own), Costs (what trading cost), Performance (the value over time: returns,
 * the monthly returns and the benchmark behind it), Risk (the volatility: its turbulent periods
 * and drawdowns) and the Risk Model (the efficient frontier: the mixes, the weight gaps and the
 * correlations behind it). A month opens from Performance's detail (see PerformanceSection).
 */
function HistoryPage({
  insights, performance, value, portfolioUuid, onSelectMonth, isAggregate,
}: {
  insights: Insights;
  // The Performance section, already loaded, and its value (PerformanceSection checks both).
  performance: InsightsPerformanceResponse;
  value: InsightsValueModule;
  portfolioUuid: string;
  onSelectMonth: (year: number, month: number) => void;
  // "All portfolios": Holdings and Risk then also show how the portfolios make it up.
  isAggregate: boolean;
}) {
  const { composition, incomeCosts, risk, timedOut } = insights;
  const currency = performance.currency;
  const own = <S, M extends { isStale: boolean }>(section: SectionState<S>, pick: (data: S) => M | null) =>
    slotOf(section, timedOut, pick, ownStale);

  if (isHistoryEmpty(value)) {
    return (
      <div className="space-y-6">
        <EmptyPeriodState message="Add or upload transactions to build your full portfolio history." />
      </div>
    );
  }

  // The value, this month and the monthly returns come from the stored daily and month-end
  // values, so one historyIsStale covers them: hidden behind a StaleUpdatingState while it's
  // being rebuilt, with a hint once useInsights stops waiting.
  const historyUpdating = performance.historyIsStale && !timedOut;
  const aggregate = isAggregate
    ? { portfolios: own(composition, (d) => d.portfolios), comovement: own(composition, (d) => d.comovement) }
    : null;

  const performanceDetail = (
    <PerformanceDetail
      heatmap={performance.heatmap?.entries ?? []}
      historyUpdating={historyUpdating}
      currency={currency}
      portfolioUuid={portfolioUuid}
      revision={insights.performance.revision}
      onSelectMonth={onSelectMonth}
    />
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-12 gap-6">
      <Tile>
        <HoldingsExplorer
          slot={own(composition, (d) => d.holdings)}
          sector={composition.data?.sectorExposure ?? null}
          region={composition.data?.regionExposure ?? null}
          aggregate={aggregate}
          currency={currency}
          portfolioUuid={portfolioUuid}
        />
      </Tile>
      <Tile><RealizedPnlModule slot={own(incomeCosts, (d) => d.realizedPnl)} currency={currency} portfolioUuid={portfolioUuid} /></Tile>
      <Tile span="half"><DividendsModule slot={own(incomeCosts, (d) => d.dividends)} currency={currency} /></Tile>
      <Tile span="half"><TradingCostsModule slot={own(incomeCosts, (d) => d.tradingCosts)} currency={currency} portfolioUuid={portfolioUuid} /></Tile>
      {!historyUpdating && performance.historyIsStale && <Tile><UpdatingNote /></Tile>}
      <Tile>
        {historyUpdating ? <Module><StaleUpdatingState /></Module> : (
          <ValueModule value={value} currency={currency}>{performanceDetail}</ValueModule>
        )}
      </Tile>
      <Tile>
        <VolatilityModule
          slot={own(risk, (d) => d.volatility)}
          portfolioUuid={portfolioUuid}
          returnsRevision={insights.performance.revision}
          aggregate={aggregate}
        />
      </Tile>
      <Tile><RiskModelModule slot={own(risk, (d) => d.frontier)} portfolioUuid={portfolioUuid} /></Tile>
    </div>
  );
}

/**
 * VALUE MODULE — Performance on the page: the portfolio's value at each month end since
 * inception and today. Its detail (`children`, PerformanceDetail) holds the rest of Performance.
 */
function ValueModule({ value, currency, children }: { value: InsightsValueModule; currency: string; children: React.ReactNode }) {
  const [exploring, setExploring] = useState(false);
  return (
    <>
      <ChartCard
        chart={value.chart}
        currency={currency}
        title="Portfolio Value"
        desc="Market value at each month end since inception, and today. Open it for this month, the returns and the benchmark."
        onExplore={() => setExploring(true)}
        right={
          <div className="sm:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Value today</p>
            <p className="text-2xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {formatCurrency(value.currentValue, currency, 0)}
            </p>
          </div>
        }
      />
      {exploring && (
        <ExploreView title="Performance" onClose={() => setExploring(false)}>
          {children}
        </ExploreView>
      )}
    </>
  );
}

/**
 * PERFORMANCE DETAIL — everything behind the value: the time-weighted returns
 * (/insights/returns), the monthly returns (a month opens one level further down, the month in
 * progress with how the market moved it day by day) and the benchmark comparison
 * (/insights/benchmark).
 */
function PerformanceDetail({
  heatmap, historyUpdating, currency, portfolioUuid, revision, onSelectMonth,
}: {
  heatmap: MonthlyMarketEffectEntry[];
  historyUpdating: boolean;
  currency: string;
  portfolioUuid: string;
  revision: number;
  onSelectMonth: (year: number, month: number) => void;
}) {
  return (
    <>
      <ReturnsExplore portfolioUuid={portfolioUuid} revision={revision} />
      <Module>
        <ModuleHead
          eyebrow={currency}
          title="Monthly Returns"
          desc="Time-weighted return by month, since inception. Click a month for its full detail."
        />
        {historyUpdating ? <StaleUpdatingState /> : <MonthlyReturnsHeatmap entries={heatmap} onSelectMonth={onSelectMonth} />}
      </Module>
      <BenchmarkExplore portfolioUuid={portfolioUuid} revision={revision} />
    </>
  );
}
