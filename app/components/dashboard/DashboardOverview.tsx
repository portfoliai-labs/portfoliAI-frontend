// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  Info,
  AlertCircle,
  Loader2,
  BellRing,
} from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import type { PortfolioSnapshot } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NewsCarouselModule, DailyArticleModule } from "./NewsSection";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { AlertGaugeCard } from "./AlertGauge";
import { useAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";

export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Alerts are managed in Profile; this section only shows them, so "Manage alerts" (and the empty
  // state's button) open Profile on its Alerts tab — via the URL hash, which ProfileSection
  // reads when it mounts.
  const openAlertSettings = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#alerts`);
    onNavigate?.("profile");
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await portfolioService.getPortfolioOverview();
        setSnapshot(data);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(err instanceof Error ? err.message : "Failed to load portfolio data");
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

      {/* BLOCK 1 — YOUR PORTFOLIO TODAY. Answers "what's it all worth?" — the one place
          currencies are summed together, because that's the only way to answer that question.
          Composition (by asset/category/broker) and the holdings detail table used to live
          here too — both moved to the Performance section's Today page, which now carries
          the same summary (currently-held assets) alongside the rest of today's figures.
          With no snapshot at all (a new account with no transactions) it's replaced by the
          same "no data yet" window Insights shows; a failed request gets an error banner
          instead, since "no data" would be the wrong thing to tell the user then. */}
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
          <PortfolioTodayModule snapshot={snapshot} />

          {/* BLOCK 1.2 — ALERTS. Each alert as a fuel-gauge style dial showing how close it is
              to its limit. Shown only alongside real portfolio data, since an alert with no
              portfolio to watch has nothing to measure. */}
          <AlertsModule onManage={openAlertSettings} />
        </>
      )}

      {/* BLOCK 1.5 — TODAY'S NEWS. One story at a time so it doesn't compete for attention
          with Block 1's figures; renders nothing at all when there's no news today. */}
      <NewsCarouselModule />

      {/* BLOCK 1.6 — ARTICLE OF THE DAY. The same global pick for every user, not scoped to
          this portfolio — renders nothing at all if it fails to load. */}
      <DailyArticleModule />

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
 * PORTFOLIO TODAY MODULE — Block 1. The three numbers that only make sense combined across
 * every currency: market value, invested capital, unrealized P&L. Always in the user's
 * reference currency (a profile-level preference, independent of what currencies the
 * holdings themselves are in) and always dated, since a converted figure without a date is
 * meaningless — see the "As of ..." line below.
 */
function PortfolioTodayModule({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const currency = snapshot.currency;
  const pnlIsGain = snapshot.totalUnrealizedPnl >= 0;

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
function AlertsModule({ onManage }: { onManage: () => void }) {
  const { rules, loading, error } = useAlertRules(60_000);
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

