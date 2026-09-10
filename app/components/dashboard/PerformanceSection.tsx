// components/dashboard/PerformanceSection.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Sun, History,
  TrendingUp, TrendingDown, Wallet, CircleDollarSign, Receipt, Activity,
  Loader2, AlertCircle, FileText, ExternalLink, ArrowLeft,
  Search, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { portfolioService } from "../../services/portfolioService";
import { formatCurrency, formatQuantity } from "../../lib/format";
import { NewsModule } from "./NewsSection";
import type {
  TodayDashboard, PeriodDashboard, FullHistoryDashboard, PortfolioSnapshot, DailyValueChange,
  AssetRealizedTrade, MonthlyMarketEffectEntry, Holding, CurrencyBreakdown,
} from "../../models/Portfolio";

type PageId = "today" | "history";

const PAGES: { id: PageId; label: string; icon: typeof Sun }[] = [
  { id: "today", label: "Today", icon: Sun },
  { id: "history", label: "All Time", icon: History },
];

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const monthYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

/**
 * INSIGHTS SECTION — two time horizons, each backed by its own backend dashboard endpoint
 * that already picks the relevant period(s) server-side: Today (vs. yesterday and vs.
 * month-to-date) and All Time, which now also carries the merged month-by-month view
 * (returns heatmap, drilled into per-month via /monthly?year=) and lifetime realized P&L —
 * no date picker needed, the tab itself is the date selection. /today and /history return
 * null rather than a zeroed-out object when there isn't enough history yet — such tabs are
 * hidden from the switcher entirely rather than shown empty. Both are fetched together on
 * mount (and whenever forUserUuid changes) so which tabs to show is known up front.
 */
export function PerformanceSection({ forUserUuid, onNavigate }: { forUserUuid?: string | null; onNavigate?: (section: string) => void } = {}) {
  const [active, setActive] = useState<PageId>("today");
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [history, setHistory] = useState<FullHistoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, h] = await Promise.all([
          portfolioService.getTodayDashboard(forUserUuid),
          portfolioService.getFullHistoryDashboard(forUserUuid),
        ]);
        if (cancelled) return;
        setToday(t);
        setHistory(h);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load portfolio data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, [forUserUuid]);

  const availablePages = useMemo(() => {
    const isAvailable: Record<PageId, boolean> = {
      today: today != null,
      history: history != null,
    };
    return PAGES.filter(p => isAvailable[p.id]);
  }, [today, history]);
  // Falls back to the first tab that actually has data whenever `active` itself doesn't
  // (the default "today", or a tab that had data for a previously selected client and
  // doesn't for this one) — computed rather than synced via an effect.
  const effectiveActive: PageId | null = availablePages.some(p => p.id === active) ? active : (availablePages[0]?.id ?? null);

  return (
    <div className="px-0 py-6 space-y-6">
      {/* MASTHEAD — page switcher sits on the same row as the title, pushed to the right,
          rather than as its own row below. */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">Portfolio</p>
          <h1
            className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Insights
          </h1>
          <p className="text-slate-500 font-medium mt-1">A closer look at your portfolio, one time horizon at a time.</p>
        </div>

        {/* PAGE SWITCHER — only tabs with data show up here */}
        {availablePages.length > 0 && (
          <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 w-full sm:w-fit overflow-x-auto">
            {availablePages.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  effectiveActive === p.id ? "bg-white shadow-sm text-[#C49A3C]" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <p.icon className="h-4 w-4" /> {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : availablePages.length === 0 ? (
        <NoHistoryEmptyState onNavigate={onNavigate} />
      ) : (
        <>
          {effectiveActive === "today" && today && <TodayPage data={today} />}
          {effectiveActive === "history" && history && (
            <HistoryPage key={forUserUuid ?? "self"} data={history} forUserUuid={forUserUuid} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * NO HISTORY EMPTY STATE — shown instead of the switcher and any page when every endpoint
 * came back null, i.e. there's no portfolio history at all yet (typically a brand new
 * account with no transactions recorded). One unified message reads far better here than
 * two tabs that would each individually be hidden, leaving nothing on screen at all.
 */
function NoHistoryEmptyState({ onNavigate }: { onNavigate?: (section: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center bg-white border border-slate-200 border-dashed rounded-4xl">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
        <TrendingUp className="h-6 w-6 text-slate-300" />
      </div>
      <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        No performance data yet
      </h3>
      <p className="text-slate-500 text-sm mt-1.5 max-w-sm">
        Add or upload your transactions and this is where you&apos;ll track how your portfolio moves over time.
      </p>
      {onNavigate && (
        <button
          onClick={() => onNavigate("upload")}
          className="mt-5 flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200"
        >
          Add transactions
        </button>
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

function ModuleHead({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </h2>
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
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "emerald" | "red" | "gold" | "slate";
}

const STAT_COLOR_MAP: Record<StatProps["color"], string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  red: "bg-red-50 text-red-600 border-red-100",
  gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  slate: "bg-slate-50 text-slate-600 border-slate-100",
};

/**
 * STAT CONTENT — the icon/title/value/description block, with no card shell of its own,
 * meant to share a card with siblings via StatCardGroup, divided by internal borders
 * instead of gaps — reads better than each figure getting its own separate card.
 */
function StatContent({ title, value, icon, description, color }: StatProps) {
  return (
    <div className="p-5 md:p-6 flex flex-col gap-2.5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${STAT_COLOR_MAP[color]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="font-black text-slate-900 text-xl md:text-2xl" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {value}
      </p>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>
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
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, 0)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value) => [formatCurrency(Number(value), currency, 0), "Market value"]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
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

/**
 * DAY CHANGE CHART — /today's chart entries are now day-over-day deltas rather than fresh
 * absolute-value snapshots (backend no longer duplicates the absolute value inside the chart
 * now that TodayDashboard's own top-level scalars already cover it), so a bar per day colored
 * by the sign of that day's move reads better than the area/line SnapshotChart uses for /history,
 * which still gets real snapshots.
 */
function DayChangeChart({ chart, currency }: { chart: DailyValueChange[]; currency: string }) {
  if (chart.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>;
  }

  const sorted = [...chart].sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime());
  const data = sorted.map(s => ({ date: s.snapshotAt, deltaValue: s.deltaValue, deltaValuePct: s.deltaValuePct }));

  return (
    <div className="p-6 md:p-7 h-64">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 256 }}>
        <BarChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={chartDateLabel}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, 0)}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            labelFormatter={(label) => fullDateLabel(label as string)}
            formatter={(value, name, props) => [
              `${formatCurrency(Number(value), currency, 0)} (${formatPct(props.payload.deltaValuePct)})`,
              "Day change",
            ]}
            contentStyle={{ borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12 }}
          />
          <Bar dataKey="deltaValue" radius={[4, 4, 4, 4]}>
            {data.map((d) => (
              <Cell key={d.date} fill={d.deltaValue >= 0 ? "#10b981" : "#f43f5e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DayChangeChartCard({ chart, currency, title, desc }: { chart: DailyValueChange[]; currency: string; title: string; desc: string }) {
  return (
    <Module>
      <ModuleHead eyebrow={currency} title={title} desc={desc} />
      <DayChangeChart chart={chart} currency={currency} />
    </Module>
  );
}

function ViewReportLink({ documentId }: { documentId: string | null }) {
  if (!documentId) return null;
  return (
    <a
      href={`/reports/${documentId}`}
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

const isTodayEmpty = (data: TodayDashboard) =>
  data.currentValue === 0 && data.previousDayValue === 0 && data.deltaDayValue === 0 &&
  data.monthStartValue === 0 && data.deltaMtdValue === 0 && data.chart.length === 0;

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

const isHistoryEmpty = (data: FullHistoryDashboard) =>
  data.currentValue === 0 && data.totalInvestedCapital === 0 && data.totalRealizedPnl === 0 &&
  data.totalUnrealizedPnl === 0 && data.totalDividendIncome === 0 && data.lifetimeTradingCosts === 0 &&
  data.lifetimeDividends === 0 && data.chart.length === 0;

/**
 * TODAY PAGE — current value against two references (yesterday, and the start of the
 * current month), plus the month-to-date daily snapshots that back those deltas.
 */
function TodayPage({ data }: { data: TodayDashboard }) {
  const isDayGain = data.deltaDayValue >= 0;
  const isMtdGain = data.deltaMtdValue >= 0;

  if (isTodayEmpty(data)) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={data.currency} title="Today" desc="Compared with yesterday and with the start of the month." />
        <EmptyPeriodState message="Add or upload transactions to see today's portfolio value." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={data.currency} title="Today" desc="Compared with yesterday and with the start of the month." />
      <StatCardGroup gridClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y divide-slate-100 sm:divide-x xl:divide-y-0">
        <StatContent
          title="Month Start Value"
          value={formatCurrency(data.monthStartValue, data.currency, 0)}
          icon={<Wallet className="h-4 w-4 text-slate-500" />}
          description="Market value on the 1st of this month"
          color="slate"
        />
        <StatContent
          title="Current Value"
          value={formatCurrency(data.currentValue, data.currency, 0)}
          icon={<Wallet className="h-4 w-4 text-[#C49A3C]" />}
          description="Market value as of today"
          color="gold"
        />
        <StatContent
          title="Day Change"
          value={`${isDayGain ? "+" : ""}${formatCurrency(data.deltaDayValue, data.currency, 0)} (${isDayGain ? "+" : ""}${data.deltaDayValuePct.toFixed(2)}%)`}
          icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          description="Day-over-day move"
          color={isDayGain ? "emerald" : "red"}
        />
        <StatContent
          title="Month-to-Date Change"
          value={`${isMtdGain ? "+" : ""}${formatCurrency(data.deltaMtdValue, data.currency, 0)} (${isMtdGain ? "+" : ""}${data.deltaMtdValuePct.toFixed(2)}%)`}
          icon={isMtdGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          description="Move since the start of the month"
          color={isMtdGain ? "emerald" : "red"}
        />
      </StatCardGroup>
      <DayChangeChartCard
        chart={data.chart}
        currency={data.currency}
        title="Month-to-Date Trend"
        desc="Daily portfolio value change since the start of the month."
      />
      <CurrencyCarouselModule
        byCurrency={data.summary.byCurrency}
        holdings={data.summary.holdings}
        title="Composition"
        renderDesc={compositionDesc}
        renderBody={CompositionBody}
      />
      <HoldingsExplorer holdings={data.summary.holdings} />
      <NewsModule title="Today's Headlines" desc="Market news published today." />
    </div>
  );
}

/**
 * CURRENCY CAROUSEL MODULE — one Module/card whose head (currency label, description) and
 * body independently page through every native currency present, currently used only by
 * Composition below. A single currency renders with no nav chrome at all (nothing to switch
 * between); with more than one, arrows/dots in the head page through them and the body scroll-
 * snaps in sync. No "land on the user's preferred currency" logic (unlike the near-identical
 * component this was ported from, in DashboardOverview) — Today doesn't otherwise load the
 * user's profile, and defaulting to the first currency is a reasonable simplification.
 */
function CurrencyCarouselModule({
  byCurrency, holdings, title, renderDesc, renderBody,
}: {
  byCurrency: CurrencyBreakdown[];
  holdings: Holding[];
  title: string;
  renderDesc?: (data: CurrencyBreakdown) => string | undefined;
  renderBody: (data: CurrencyBreakdown, holdings: Holding[]) => React.ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (byCurrency.length === 0) return null;

  const multi = byCurrency.length > 1;
  const active = byCurrency[activeIndex] ?? byCurrency[0];
  const activeHoldings = holdings.filter(h => h.currency === active.currency);

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
          multi && (
            <div className="flex items-center gap-1.5">
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
          )
        }
      />
      {multi ? (
        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {byCurrency.map((cb) => (
            <div key={cb.currency} className="w-full shrink-0 snap-center">
              {renderBody(cb, holdings.filter(h => h.currency === cb.currency))}
            </div>
          ))}
        </div>
      ) : (
        renderBody(active, activeHoldings)
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
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">End Value</p>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl md:text-4xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {formatCurrency(endValue, currency, 0)}
        </p>
        <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${isGain ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          {isGain ? "+" : ""}{formatCurrency(deltaValue, currency, 0)} ({hasBaseline ? formatPct(deltaValuePct) : "—"})
        </span>
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
function MonthDetail({ period, year, month }: { period: PeriodDashboard; year: number; month: number }) {
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
        right={<ViewReportLink documentId={period.reportDocumentId} />}
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
                value={`${marketIsGain ? "+" : ""}${formatCurrency(period.marketEffect, period.currency, 0)} (${hasBaseline ? formatPct(period.marketEffectPct) : "—"})`}
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
      <NewsModule year={year} month={month} title={`${title} Headlines`} desc="Market news published that month." />
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

// Below this many closed sells, a win rate is more noise than signal — this is a
// long-horizon investing product, not a trading platform, so the metric is withheld
// rather than shown with false precision on a handful of trades.
const MIN_SELLS_FOR_WIN_RATE = 20;

interface CurrencyRealizedGroup {
  currency: string;
  totalPl: number;
  sellCount: number;
  winRate: number;
  trades: AssetRealizedTrade[];
}

function groupRealizedTradesByCurrency(trades: AssetRealizedTrade[]): CurrencyRealizedGroup[] {
  const byCurrency = new Map<string, AssetRealizedTrade[]>();
  for (const t of trades) {
    if (!byCurrency.has(t.currency)) byCurrency.set(t.currency, []);
    byCurrency.get(t.currency)!.push(t);
  }
  return [...byCurrency.entries()]
    .map(([currency, list]) => {
      const sellCount = list.reduce((sum, t) => sum + t.sellCount, 0);
      return {
        currency,
        totalPl: list.reduce((sum, t) => sum + t.realizedPl, 0),
        sellCount,
        winRate: sellCount > 0 ? list.reduce((sum, t) => sum + t.winRate * t.sellCount, 0) / sellCount : 0,
        trades: [...list].sort((a, b) => Math.abs(b.realizedPl) - Math.abs(a.realizedPl)),
      };
    })
    .sort((a, b) => b.trades.length - a.trades.length);
}

/**
 * REALIZED P&L CARD — lifetime closed-position P&L, moved here from the Dashboard Overview
 * (which now only covers live/open-position figures) since it's a performance figure over
 * the portfolio's full history, same time horizon as the rest of this page. Grouped by each
 * trade's own native currency (not the reference currency the rest of this page's figures
 * are in) — a group's totals are computed locally from its trades rather than relying on a
 * pre-aggregated backend figure, since FullHistoryDashboard only supplies the trade list.
 */
function RealizedPnLCard({ trades }: { trades: AssetRealizedTrade[] }) {
  const groups = useMemo(() => groupRealizedTradesByCurrency(trades), [trades]);

  return (
    <Module>
      <ModuleHead
        eyebrow="Lifetime"
        title="Realized P&L"
        desc="From closed positions, based on recorded buy and sell prices."
      />
      {groups.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">No closed positions yet.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {groups.map((group) => (
            <RealizedPnLGroup key={group.currency} group={group} showCurrencyLabel={groups.length > 1} />
          ))}
        </div>
      )}
    </Module>
  );
}

function RealizedPnLGroup({ group, showCurrencyLabel }: { group: CurrencyRealizedGroup; showCurrencyLabel: boolean }) {
  const isGain = group.totalPl >= 0;
  const maxAbsPl = Math.max(0, ...group.trades.map(t => Math.abs(t.realizedPl)));

  return (
    <div className="p-6 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
        {showCurrencyLabel && <p className="text-xs font-black uppercase tracking-wider text-slate-400">{group.currency}</p>}
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
          {group.sellCount >= MIN_SELLS_FOR_WIN_RATE && (
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Win Rate</p>
              <p className="text-lg font-black tabular-nums text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {(group.winRate * 100).toFixed(0)}%
              </p>
            </div>
          )}
        </div>
      </div>
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
 * HISTORY PAGE — backs the "All Time" tab, merging what used to be three separate tabs
 * (Monthly, Annual, Full History) into one: lifetime figures + trend chart up top, a
 * year-by-month returns heatmap, and lifetime realized P&L. Clicking a heatmap cell swaps
 * the whole page for that month's own detail (MonthDetail) — same "replace, don't stack"
 * pattern the old Monthly/Annual picker used, with a back button to return. Month detail
 * needs the richer per-month figures (t0/t1 value, dividends, volatility, drawdown, report)
 * that monthlyMarketEffect doesn't carry, so it's fetched on demand via /monthly?year=, one
 * request per year, cached in `monthCache` so re-opening a month already visited this
 * session doesn't refetch.
 */
function HistoryPage({ data, forUserUuid }: { data: FullHistoryDashboard; forUserUuid?: string | null }) {
  const unrealizedIsGain = data.totalUnrealizedPnl >= 0;

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
      const periods = await portfolioService.getMonthlyDashboard(forUserUuid, year);
      setMonthCache(prev => ({ ...prev, [year]: periods }));
    } catch (err) {
      setMonthError(err instanceof Error ? err.message : "Failed to load that month's detail");
    } finally {
      setMonthLoading(false);
    }
  };

  if (selected) {
    const yearData = monthCache[selected.year];
    const period = yearData?.find(p => new Date(p.periodStart).getUTCMonth() + 1 === selected.month);
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
        ) : period ? (
          <MonthDetail period={period} year={selected.year} month={selected.month} />
        ) : (
          <EmptyPeriodState message="No detail available for this month." />
        )}
      </div>
    );
  }

  if (isHistoryEmpty(data)) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow={data.currency} title="All Time" desc="Lifetime portfolio figures." />
        <EmptyPeriodState message="Add or upload transactions to build your full portfolio history." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={data.currency}
        title="All Time"
        desc={`Since inception — ${fullDateLabel(data.inceptionDate)}.`}
        right={<ViewReportLink documentId={data.reportDocumentId} />}
      />
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
        <StatContent
          title="Lifetime Dividends"
          value={formatCurrency(data.lifetimeDividends, data.currency, 0)}
          icon={<CircleDollarSign className="h-4 w-4 text-blue-600" />}
          description="All dividend cash flows recorded"
          color="blue"
        />
      </StatCardGroup>
      <ChartCard
        chart={data.chart}
        currency={data.currency}
        title="Value Since Inception"
        desc="Daily portfolio market value across your full history."
      />
      <Module>
        <ModuleHead
          eyebrow={data.currency}
          title="Monthly Returns"
          desc="Market effect by month, since inception. Click a month for its full detail."
        />
        <MonthlyReturnsHeatmap entries={data.monthlyMarketEffect} onSelectMonth={handleSelectMonth} />
      </Module>
      <RealizedPnLCard trades={data.realizedTradesByAsset} />
    </div>
  );
}
