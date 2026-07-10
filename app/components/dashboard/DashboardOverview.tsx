// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Wallet,
  TrendingUp,
  Receipt,
  Search,
  ChevronDown,
  Info,
  Sparkles,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

import { useUser } from "../../context/UserContext";
import { portfolioService } from "../../services/portfolioService";
import { userService } from "../../services/userService";
import type { PortfolioSummary, CurrencyBreakdown, Holding } from "../../models/Portfolio";
import type { UserMetrics } from "../../models/User";
import { formatCurrency } from "../../lib/format";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";
import { QuotaBar, FREE_MONTHLY_REPORTS } from "./QuotaBar";

export default function DashboardOverview({
  onNavigate,
}: {
  onNavigate?: (section: string) => void;
}) {
  const { user } = useUser();
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [data, userMetrics] = await Promise.all([
          portfolioService.getPortfolioSummary(),
          userService.getUserMetrics(),
        ]);
        setPortfolio(data);
        setMetrics(userMetrics);
        setSelectedCurrency(data.byCurrency[0]?.currency ?? null);
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

  // The top holding within each currency — a cross-currency "top holding" would need an
  // FX rate to compare, so this is computed per currency instead of once globally.
  const topHoldingByCurrency = new Map<string, Holding | undefined>(
    byCurrency.map(cb => {
      const inCurrency = [...holdings]
        .filter(h => h.currency === cb.currency)
        .sort((a, b) => b.investedValue - a.investedValue);
      return [cb.currency, inCurrency[0]];
    })
  );

  const activeCurrencyData = byCurrency.find(cb => cb.currency === selectedCurrency) ?? byCurrency[0];

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
          {onNavigate && (
            <button
              onClick={() => onNavigate("upload")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate Report
            </button>
          )}
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white text-xs text-slate-500 font-medium">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            Figures come from your recorded transactions — not current market prices
          </div>
        </div>
      </div>

      {/* REPORT QUOTA — user-level, not per-currency, so it lives outside the currency loop.
          Testers aren't capped, so there's no quota to show them. */}
      {user?.subscription_tier !== "TESTER" && (
        <div className="max-w-sm">
          <QuotaBar used={metrics?.report_generated ?? 0} total={FREE_MONTHLY_REPORTS} />
        </div>
      )}

      {/* PER-CURRENCY BREAKDOWN — see CurrencySection for why these are never merged */}
      {activeCurrencyData && (
        <div className="space-y-4">
          {byCurrency.length > 1 && (
            <div className="inline-flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
              {byCurrency.map((cb) => {
                const active = cb.currency === activeCurrencyData.currency;
                return (
                  <button
                    key={cb.currency}
                    onClick={() => setSelectedCurrency(cb.currency)}
                    className={`px-5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-colors ${
                      active ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {cb.currency}
                  </button>
                );
              })}
            </div>
          )}
          {byCurrency.length > 1 && (
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Figures below are shown in {activeCurrencyData.currency} only, never combined with other currencies — converting between them would need a live FX rate.
            </p>
          )}
          <CurrencySection data={activeCurrencyData} topHolding={topHoldingByCurrency.get(activeCurrencyData.currency)} />
        </div>
      )}

      {/* ALL HOLDINGS — detail table, every currency together, since nothing here is summed */}
      <div>
        <SectionHeader
          eyebrow="Portfolio"
          title="All Holdings"
          subtitle="Every position across all currencies — search or filter to narrow the list"
        />
        <div className="mt-6">
          <HoldingsExplorer holdings={holdings} />
        </div>
      </div>

    </div>
  );
}

/**
 * CURRENCY SECTION — every monetary aggregate (invested, fees, broker/asset-class
 * breakdowns, realized P&L) lives inside one of these, scoped to a single currency.
 * A ticker's currency isn't something this app converts, so summing across sections
 * would silently add e.g. USD and EUR as if they were the same unit — small multiples
 * (one full section per currency) avoid that instead of one misleading combined total.
 */
function CurrencySection({ data, topHolding }: { data: CurrencyBreakdown; topHolding?: Holding }) {
  const { currency } = data;
  // feesByBroker is grouped by broker, so a broker with $0 in fees still gets a row —
  // an empty-array check wouldn't catch that. totalFeesPaid reflects the actual amount.
  const hasFees = data.totalFeesPaid > 0;
  const tradesWithPL = data.realizedTrades.map(t => ({ ...t, profitLoss: (t.sellPrice - t.buyPrice) * t.quantity }));
  const maxAbsPL = Math.max(0, ...tradesWithPL.map(t => Math.abs(t.profitLoss)));

  return (
    <div className="space-y-6">

      {/* MODULE 1 — AT A GLANCE */}
      <Module>
        <ModuleHead
          eyebrow={`${currency} · Positions`}
          title="At a glance"
          desc="The four numbers that matter most for your positions in this currency."
        />
        <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1fr_1fr] divide-y divide-slate-100 md:divide-y-0 md:divide-x">
          <Stat
            hero
            title="Total Invested"
            value={formatCurrency(data.totalInvested, currency, 0)}
            icon={<Wallet className="h-4.5 w-4.5 text-[#C49A3C]" />}
            description={`Across ${data.holdingsCount} ${data.holdingsCount === 1 ? "holding" : "holdings"}`}
            color="gold"
          />
          <Stat
            title="Holdings"
            value={data.holdingsCount.toString()}
            icon={<Layers className="h-4 w-4 text-blue-600" />}
            description={`Distinct assets in ${currency}`}
            color="blue"
          />
          <Stat
            title="Most Invested In"
            value={topHolding?.ticker ?? "—"}
            icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
            description={topHolding ? `${formatCurrency(topHolding.investedValue, currency)} invested` : "No holdings yet"}
            color="emerald"
          />
          <Stat
            title="Total Fees Paid"
            value={formatCurrency(data.totalFeesPaid, currency, 2)}
            icon={<Receipt className="h-4 w-4 text-violet-600" />}
            description={`Across all ${currency} transactions`}
            color="violet"
          />
        </div>
      </Module>

      {/* MODULE 2 — ALLOCATION */}
      <Module>
        <ModuleHead
          eyebrow="Allocation"
          title="Where the money went"
          desc={`Broker, asset class and cost — all scaled to the same ${formatCurrency(data.totalInvested, currency, 0)}`}
        />
        <div className={`grid grid-cols-1 divide-y divide-slate-100 md:divide-y-0 md:divide-x ${hasFees ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <AllocPanel title="Purchases by broker" subtitle="Where your orders were placed">
            <BarListBody
              items={data.purchasesByBroker.map(b => ({ label: b.broker, value: b.totalInvested }))}
              currency={currency}
            />
          </AllocPanel>
          <AllocPanel title="Purchases by asset class" subtitle="Stocks, ETFs, bonds, and the rest">
            <BarListBody
              items={data.purchasesByAssetClass.map(a => ({ label: a.assetClass, value: a.totalInvested }))}
              currency={currency}
            />
          </AllocPanel>
          {hasFees && (
            <AllocPanel title="Fees by broker" subtitle="Where your trading costs came from">
              <DonutBody
                data={data.feesByBroker.map(d => ({ label: d.broker, value: d.totalFees }))}
                currency={currency}
              />
            </AllocPanel>
          )}
        </div>
      </Module>

      {/* MODULE 3 — REALIZED PERFORMANCE */}
      <Module>
        <ModuleHead
          eyebrow="Closed positions"
          title="Realized gains & losses"
          desc="Based on your recorded buy and sell prices for each closed position."
          right={
            <Scoreboard
              items={[
                {
                  label: "Total P&L",
                  value: `${data.totalRealizedPl >= 0 ? "+" : ""}${formatCurrency(data.totalRealizedPl, currency, 2)}`,
                  tone: data.totalRealizedPl >= 0 ? "good" : "bad",
                },
                { label: "Sell Transactions", value: data.sellCount.toString() },
                { label: "Win Rate", value: data.sellCount > 0 ? `${data.winRate.toFixed(0)}%` : "—" },
              ]}
            />
          }
        />
        <div className="p-6 md:p-7">
          {tradesWithPL.length === 0 ? (
            <p className="text-sm text-slate-400 py-6">No completed sells in {currency} yet.</p>
          ) : (
            <div className="space-y-5">
              {tradesWithPL.map((t, i) => {
                const isGain = t.profitLoss >= 0;
                const halfWidthPct = maxAbsPL > 0 ? (Math.abs(t.profitLoss) / maxAbsPL) * 50 : 0;
                return (
                  <div key={`${t.ticker ?? "unknown"}-${i}`}>
                    <div className="flex items-baseline justify-between gap-4 mb-1.5">
                      <span className="text-sm font-bold text-slate-900">{t.ticker ?? "—"}</span>
                      <span className={`text-sm font-bold shrink-0 ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
                        {isGain ? "+" : ""}{formatCurrency(t.profitLoss, t.currency, 2)}
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
                      <span className="text-[11px] text-slate-400">{t.quantity} units</span>
                      <span className="text-[11px] text-slate-400">{formatCurrency(t.buyPrice, t.currency)} → {formatCurrency(t.sellPrice, t.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Module>

    </div>
  );
}

/**
 * SECTION HEADER — a prominent "chapter" break between major groups of cards:
 * small colored eyebrow, a large bold title, an optional subtitle, and a divider rule.
 */
function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="pt-2 pb-3 border-b border-slate-200">
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
      <h2 className="text-xl md:text-2xl font-black text-slate-900">{title}</h2>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
  );
}

/**
 * MODULE — the card shell every group of related content lives in. Restructured from the
 * old one-card-per-metric layout: related stats/charts now share a single Module, separated
 * by internal dividers, instead of each getting its own bordered/shadowed box.
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
 * SCOREBOARD — inline stat badges in a module head, used where the old design gave a metric
 * its own full StatCard (e.g. P&L / win rate). Numbers stay neutral ink unless the value itself
 * carries a sign (gain/loss), matching how the rest of the app already colors P&L text.
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
 * STAT — one segment of a Module's stat strip. `hero` marks the single most important figure
 * in the strip (larger type), giving real hierarchy instead of four equally-weighted boxes.
 */
interface StatProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "emerald" | "violet" | "red" | "gold";
  hero?: boolean;
}

function Stat({ title, value, icon, description, color, hero }: StatProps) {
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
        className={`font-black text-slate-900 ${hero ? "text-[28px] md:text-[32px]" : "text-xl md:text-2xl"}`}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </p>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}

/**
 * ALLOC PANEL — one third of the "Where the money went" Module (was its own bordered card).
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

/**
 * BAR LIST BODY — magnitude comparison across a handful of named categories that all share
 * one currency (broker, asset class). Never fed cross-currency values: bar length directly
 * encodes size, so mixing units would visually imply a comparison that isn't real. Lives inside
 * an AllocPanel now rather than owning its own card.
 */
function BarListBody({ items, currency }: { items: { label: string; value: number }[]; currency: string }) {
  const max = Math.max(0, ...items.map(i => i.value));

  if (items.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const widthPct = max > 0 ? (item.value / max) * 100 : 0;
        return (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-4 mb-1">
              <span className="text-xs font-bold text-slate-900">{item.label}</span>
              <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(item.value, currency, 0)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-r-full bg-[#C49A3C]" style={{ width: `${widthPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * DONUT BODY — part-to-whole across a handful of named categories (≤ ~6-8).
 * Single categorical hue per slot, fixed order; every value also lives in the legend
 * as text (never color-only), which is the required relief for the low-contrast slots.
 * Lives inside an AllocPanel now rather than owning its own card.
 */
function DonutBody({ data, currency }: { data: { label: string; value: number }[]; currency: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (data.length === 0) {
    return <p className="text-sm text-slate-400 py-6">No data yet.</p>;
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="w-28 h-28 shrink-0">
        <PieChart width={112} height={112}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={36}
            outerRadius={56}
            paddingAngle={2}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatCurrency(Number(value), currency, 0)} />
        </PieChart>
      </div>
      <div className="w-full space-y-2.5">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={d.label} className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length] }}
              />
              <span className="text-xs font-bold text-slate-900 flex-1 truncate">{d.label}</span>
              <span className="text-xs font-semibold text-slate-500 shrink-0">{formatCurrency(d.value, currency, 0)}</span>
              <span className="text-[11px] font-semibold text-slate-400 w-9 text-right shrink-0">{pct.toFixed(0)}%</span>
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
                  <td className="px-3 py-3.5 text-sm font-semibold text-slate-600 text-right tabular-nums">{h.quantity}</td>
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
