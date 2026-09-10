// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import type { PortfolioSnapshot } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NewsCarouselModule, DailyArticleModule } from "./NewsSection";

export default function DashboardOverview() {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await portfolioService.getPortfolioOverview();
        setSnapshot(data);
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
          the same summary (currently-held assets) alongside the rest of today's figures. */}
      <PortfolioTodayModule snapshot={snapshot} />

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
function PortfolioTodayModule({ snapshot }: { snapshot: PortfolioSnapshot | null }) {
  if (!snapshot) return null;

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

