// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  BellRing,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { portfolioService } from "../../services/portfolioService";
import type { PortfolioSnapshot, TodayDashboard } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { AlertGaugeCard } from "./AlertGauge";
import { useAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";
import { usePortfolio } from "../../context/PortfolioContext";

// How often to refetch /today while it comes back `isStale: true` (a transaction edit
// triggered a rebuild that hasn't landed yet), and how long to keep trying before giving up
// and showing the — possibly still-mixed — data anyway with a hint. Same values and rationale
// as PerformanceSection.tsx's own copy of these constants (see that file for the full
// explanation of why /today carries this flag at all).
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { current: portfolio } = usePortfolio();
  const portfolioUuid = portfolio?.uuid;
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [todayStaleTimedOut, setTodayStaleTimedOut] = useState(false);

  // Alerts live in Settings; this section only shows them, so "Manage alerts" (and the empty
  // state's button) open Settings on its Alerts tab — via the URL hash, which SettingsSection
  // reads when it mounts.
  const openAlertSettings = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#alerts`);
    onNavigate?.("settings");
  };

  // `portfolioUuid` is null for the brief window PortfolioContext is still resolving which
  // portfolio to open — `loading` starts (and stays) true until it's known, which already
  // reads correctly as "still loading" with no extra gate needed.
  useEffect(() => {
    if (!portfolioUuid) return;
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [data, todayData] = await Promise.all([
          portfolioService.getPortfolioOverview(portfolioUuid),
          portfolioService.getTodayDashboard(portfolioUuid),
        ]);
        setSnapshot(data);
        setToday(todayData);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load portfolio data");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, [portfolioUuid]);

  // `snapshot` (GET /v1/portfolios/{p}/overview) never mixes history with fresh data, so it
  // has no isStale and needs no polling — only `today` does. Keyed off `today?.isStale` rather
  // than `today` itself so a poll's own setToday call (still isStale, next tick due) doesn't
  // reset the deadline below.
  useEffect(() => {
    if (!today?.isStale || !portfolioUuid) {
      setTodayStaleTimedOut(false);
      return;
    }
    let cancelled = false;
    const deadline = Date.now() + STALE_TIMEOUT_MS;
    const timer = setInterval(async () => {
      if (Date.now() >= deadline) {
        clearInterval(timer);
        if (!cancelled) setTodayStaleTimedOut(true);
        return;
      }
      try {
        const fresh = await portfolioService.getTodayDashboard(portfolioUuid);
        if (!cancelled) setToday(fresh);
      } catch {
        // Transient error while polling — the next tick tries again.
      }
    }, STALE_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [today?.isStale, portfolioUuid]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
      </div>

      {/* BLOCK 1 — YOUR PORTFOLIO TODAY. Answers both "what's it all worth?" (the one place
          currencies are summed together, since that's the only way to answer that question)
          and "how has it moved?" (day-over-day and month-to-date, folded in from the old
          Today's trend module — the two used to be separate cards but both measured the same
          today-snapshot of the portfolio, so they're one module now). Composition (by asset/
          category/broker) and the holdings detail table used to live here too, then moved to
          the Performance section's Today page — which has since been folded away too (see
          Insights' Composition tab). With no snapshot at all (a new account with no
          transactions) it's replaced by the same "no data yet" window Insights shows; a
          failed request gets an error banner instead, since "no data" would be the wrong
          thing to tell the user then. */}
      {error ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      ) : snapshot === null ? (
        <NoDataEmptyState
          title="No portfolio data yet"
          message="Add or upload your transactions and this is where you'll see what your portfolio is worth today."
          onNavigate={onNavigate}
        />
      ) : (
        <>
          <PortfolioTodayModule snapshot={snapshot} today={today} todayStaleTimedOut={todayStaleTimedOut} />

          {/* BLOCK 1.2 — ALERTS. Each alert as a fuel-gauge style dial showing how close it is
              to its limit. Shown only alongside real portfolio data, since an alert with no
              portfolio to watch has nothing to measure. portfolioUuid is always defined here in
              practice (this branch only renders once the fetch above has resolved), the `&&`
              is just to satisfy the type checker. */}
          {portfolioUuid && <AlertsModule portfolioUuid={portfolioUuid} onManage={openAlertSettings} />}
        </>
      )}

      {/* BLOCK 2 — YOUR ACTIVITY. Answers "what did I actually do?"
          COSTS used to live here too — commented out for now, not removed: undecided whether
          to keep it. Reinstating it needs PerCurrencyModule/AllocPanel back from
          PerformanceSection.tsx, where Composition took them when it moved out of this file.
      <div className="space-y-5">
        <PerCurrencyModule
          byCurrency={byCurrency}
          holdings={holdings}
          preferredCurrency={preferredCurrency}
          title="Costs"
          renderDesc={costsDesc}
          renderRight={costsRight}
          renderBody={CostsBody}
        />
      </div>
      */}

    </div>
  );
}

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

// Axis tick labels and the day-change chart's tooltip box — same values PerformanceSection.tsx
// uses for its own copy of this chart, kept local rather than imported (see the Module/
// ModuleHead comment above on why this file doesn't depend on that one).
const AXIS_TICK_COLOR = "#64748b";
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155",
};

/**
 * AMOUNT WITH DELTA — a Stat value: the amount on its own line, with the percentage change in
 * its own colored, directional line underneath instead of squeezed into "€X (+Y%)"
 * parentheses — see PerformanceSection.tsx's identical helper for the full rationale.
 */
function AmountWithDelta({ amount, pct }: { amount: string; pct: number }) {
  const isGain = pct >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  return (
    <>
      {amount}
      <div className={`flex items-center gap-1 font-sans text-sm font-bold mt-1 ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
        <Icon className="h-3.5 w-3.5" />
        {formatPct(pct)}
      </div>
    </>
  );
}

/**
 * TODAY TREND CHART — day-over-day value change for the current month, one bar per DAILY
 * snapshot. Deltas, not raw values: a stable portfolio's value-over-time line is visually flat
 * at this timescale, and the absolute-value context is already covered by the Stat cards above
 * it, so nothing is lost by charting the change instead.
 */
function TodayTrendChart({ data }: { data: TodayDashboard }) {
  if (data.chart.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>;
  }

  const sorted = [...data.chart].sort((a, b) => new Date(a.snapshotAt).getTime() - new Date(b.snapshotAt).getTime());
  const points = sorted.map(s => ({ date: s.snapshotAt, deltaValue: s.deltaValue, deltaValuePct: s.deltaValuePct }));

  return (
    <div className="p-6 md:p-7 h-64">
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

/**
 * STALE STATES — /today carries `isStale: true` while a transaction edit's rebuild hasn't
 * landed yet (today's value/transactions are already the new portfolio, the past days behind
 * the chart/deltas aren't yet); see PerformanceSection.tsx's own copy of these two for the
 * full rationale (this file keeps its own rather than importing, same reason as Module/
 * ModuleHead above). UpdatingState hides the second row + chart while still within the poll
 * window; UpdatingNote is the fallback hint once that window times out and the — possibly
 * still-mixed — data is shown anyway.
 */
function TodayUpdatingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-14 px-6 text-center border-t border-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" />
      <p className="text-slate-600 font-semibold">Updating after a recent change</p>
      <p className="text-slate-400 text-sm max-w-sm">
        This usually takes a few minutes — it&apos;ll refresh here on its own once it&apos;s ready.
      </p>
    </div>
  );
}

function TodayUpdatingNote() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 mx-6 md:mx-7 mt-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
      <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
      <p className="text-xs font-bold">Update is taking longer than usual — the figures below may be out of date.</p>
    </div>
  );
}

/**
 * PORTFOLIO TODAY MODULE — Block 1. What the portfolio is worth today, combined across every
 * currency (a profile-level reference currency, independent of what currencies the holdings
 * themselves are in), plus how that figure has moved: day-over-day and since the start of the
 * month. Used to be two separate modules — one from the snapshot endpoint (value, invested
 * capital, unrealized P&L), one from the /today endpoint (value again, plus the two deltas) —
 * merged into one because both were just today's portfolio performance told twice, with
 * "Current Value" and "Market Value" literally the same number from two different endpoints.
 * The second row (and its chart) only renders once /today has something to say — independent
 * of the snapshot above, since a brand-new account can have one without the other (`snapshot`,
 * from GET /v1/portfolio/, never mixes history with fresh data so it has no isStale of its
 * own and is never hidden here).
 */
function PortfolioTodayModule({
  snapshot, today, todayStaleTimedOut,
}: { snapshot: PortfolioSnapshot; today: TodayDashboard | null; todayStaleTimedOut: boolean }) {
  const currency = snapshot.currency;
  const pnlIsGain = snapshot.totalUnrealizedPnl >= 0;
  const isDayGain = (today?.deltaDayValue ?? 0) >= 0;
  const isMtdGain = (today?.deltaMtdValue ?? 0) >= 0;
  const todayUpdating = !!today?.isStale && !todayStaleTimedOut;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Your portfolio today"
        desc={`As of ${chartDateLabel(snapshot.snapshotAt)} — from daily market prices.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <InvestedStat snapshot={snapshot} />
        <Stat
          title="Market Value"
          value={formatCurrency(snapshot.totalMarketValue, currency, 0)}
          icon={<Coins className="h-4 w-4 text-[#C49A3C]" />}
          description="What your positions are worth today"
          color="gold"
        />
        <Stat
          title="Unrealized P&L"
          value={`${pnlIsGain ? "+" : ""}${formatCurrency(snapshot.totalUnrealizedPnl, currency, 0)}`}
          icon={pnlIsGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          description="Vs your invested capital"
          color={pnlIsGain ? "emerald" : "red"}
        />
      </div>
      {today && (
        todayUpdating ? (
          <TodayUpdatingState />
        ) : (
          <>
            {today.isStale && <TodayUpdatingNote />}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x border-t border-slate-100">
              <Stat
                title="Month Start Value"
                value={formatCurrency(today.monthStartValue, today.currency, 0)}
                icon={<Wallet className="h-4 w-4 text-slate-500" />}
                description="Market value on the 1st of this month"
                color="blue"
              />
              <Stat
                title="Day Change"
                value={<AmountWithDelta amount={`${isDayGain ? "+" : ""}${formatCurrency(today.deltaDayValue, today.currency, 0)}`} pct={today.deltaDayValuePct} />}
                icon={isDayGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                description="Day-over-day move"
                color={isDayGain ? "emerald" : "red"}
              />
              <Stat
                title="Month-to-Date Change"
                value={<AmountWithDelta amount={`${isMtdGain ? "+" : ""}${formatCurrency(today.deltaMtdValue, today.currency, 0)}`} pct={today.deltaMtdValuePct} />}
                icon={isMtdGain ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
                description="Move since the start of the month"
                color={isMtdGain ? "emerald" : "red"}
              />
            </div>
            <TodayTrendChart data={today} />
          </>
        )
      )}
    </Module>
  );
}

// Most urgent first: a triggered alert leads, a switched-off one comes last. Rules of the same
// state keep the backend's order (oldest first).
const ALERT_ORDER: Record<AlertState["kind"], number> = {
  triggered: 0, reached: 1, approaching: 2, ok: 3, pending: 4, unavailable: 5, off: 6,
};

// A user can have up to 20 alerts, far too many dials to show at once. The most urgent (the list
// is sorted by urgency) get a dial each; the rest sit behind "Show all".
const ALERTS_SHOWN_COLLAPSED = 6;

// How the states roll up into the one-line summary above the dials.
const SUMMARY_GROUPS: { tone: AlertTone; label: string; dot: string }[] = [
  { tone: "danger", label: "triggered", dot: "bg-red-500" },
  { tone: "warn", label: "approaching", dot: "bg-amber-500" },
  { tone: "ok", label: "within range", dot: "bg-emerald-500" },
  { tone: "muted", label: "not active", dot: "bg-slate-400" },
];

/**
 * ALERTS MODULE — Block 1.2. The user's alert rules as dials, refreshed every minute (the
 * backend re-checks every rule about every 5 minutes, so a reading changes while the page is
 * open). A one-line summary counts them by state; only the ALERTS_SHOWN_COLLAPSED most urgent get
 * a dial until the user asks for all of them. With no rules it invites the user to create one
 * instead of rendering an empty card.
 */
function AlertsModule({ portfolioUuid, onManage }: { portfolioUuid: string; onManage: () => void }) {
  const { rules, loading, error } = useAlertRules(portfolioUuid, 60_000);
  const [showAll, setShowAll] = useState(false);

  const sorted = rules === null
    ? []
    : [...rules].sort((a, b) => ALERT_ORDER[alertState(a).kind] - ALERT_ORDER[alertState(b).kind]);
  const visible = showAll ? sorted : sorted.slice(0, ALERTS_SHOWN_COLLAPSED);
  const counts = SUMMARY_GROUPS
    .map((g) => ({ ...g, count: sorted.filter((r) => alertState(r).tone === g.tone).length }))
    .filter((g) => g.count > 0);

  return (
    <Module>
      <ModuleHead
        eyebrow="Alerts"
        title="Your alerts"
        desc="How close each alert is to its limit. Checked about every 5 minutes."
        right={
          <button
            onClick={onManage}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
          >
            Manage alerts
          </button>
        }
      />
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
        </div>
      ) : error ? (
        <p className="text-sm text-slate-500 p-6 md:p-7">Unable to load your alerts right now.</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-10">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            You haven&apos;t set up any alerts. Get notified when your portfolio moves by a set amount, or when a
            single holding grows past a share you choose.
          </p>
          <button
            onClick={onManage}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors"
          >
            Create an alert
          </button>
        </div>
      ) : (
        <div className="p-6 md:p-7 space-y-5">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-slate-600">
            {counts.map((g) => (
              <li key={g.tone} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                {g.count} {g.label}
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {visible.map((rule) => <AlertGaugeCard key={rule.ruleId} rule={rule} />)}
          </div>
          {sorted.length > ALERTS_SHOWN_COLLAPSED && (
            <div className="flex justify-center">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
              >
                {showAll ? "Show fewer" : `Show all ${sorted.length}`}
              </button>
            </div>
          )}
        </div>
      )}
    </Module>
  );
}

/**
 * INVESTED STAT — the per-currency breakdown this used to expand into (byCurrency, from the
 * old PortfolioOverviewResponse.summary) is gone now that GET /v1/portfolio/ only returns the
 * latest snapshot — just the converted total.
 */
function InvestedStat({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const currency = snapshot.currency;

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
        {formatCurrency(snapshot.totalInvestedCapital, currency, 0)}
      </p>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">Capital deployed to date</p>
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

// SCOREBOARD — inline stat badges in a module head. Only used by the commented-out Costs
// section above; commented out alongside it, not removed, so it comes back with everything
// else if Costs is reinstated.
// function Scoreboard({ items }: { items: { label: string; value: string; tone?: "good" | "bad" }[] }) {
//   return (
//     <div className="flex gap-6 flex-wrap shrink-0">
//       {items.map((it) => (
//         <div key={it.label} className="text-right">
//           <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{it.label}</p>
//           <p
//             className={`text-xl font-black tabular-nums ${it.tone === "good" ? "text-emerald-600" : it.tone === "bad" ? "text-rose-600" : "text-slate-900"}`}
//             style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
//           >
//             {it.value}
//           </p>
//         </div>
//       ))}
//     </div>
//   );
// }

/**
 * STAT — one segment of a Module's stat strip.
 */
interface StatProps {
  title: string;
  // A plain string for a single figure, or richer content (see AmountWithDelta) for a figure
  // that needs more than one line.
  value: React.ReactNode;
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
      <div
        className="font-black text-slate-900 text-xl md:text-2xl"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </div>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

// ALLOC PANEL — only used by the commented-out Costs section above (and, since Composition
// moved to PerformanceSection.tsx, by that file's own copy) — commented out alongside Costs,
// not removed, so it comes back if Costs is reinstated.
// function AllocPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
//   return (
//     <div className="p-6 md:p-7">
//       <h3 className="text-sm font-black text-slate-900">{title}</h3>
//       <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>
//       {children}
//     </div>
//   );
// }

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

