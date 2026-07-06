// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Layers,
  Wallet,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Receipt,
  Target,
  Repeat,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";

import { portfolioService } from "../../services/portfolioService";
import type { PortfolioSummary } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";

interface AISuggestion {
  id: number;
  text: string;
}

const SUGGESTIONS: AISuggestion[] = [
  { id: 1, text: "Remember to set your financial goals in the settings page." },
  { id: 2, text: "Upgrade to Pro to access the latest GPT-4o analysis models." },
  { id: 3, text: "You can upload raw CSVs from major brokers; we'll handle the conversion." },
  { id: 4, text: "Analyze your dividend history to optimize your passive income." },
  { id: 5, text: "Check your portfolio's risk score after every new trade import." }
];

export default function DashboardOverview() {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [currentSuggestion, setCurrentSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await portfolioService.getPortfolioSummary();
        setPortfolio(data);
        const randomIdx = Math.floor(Math.random() * SUGGESTIONS.length);
        setCurrentSuggestion(SUGGESTIONS[randomIdx]);
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
  const totalInvested = portfolio?.totalInvested ?? 0;
  const currency = portfolio?.currency ?? "EUR";
  const totalFeesPaid = portfolio?.totalFeesPaid ?? 0;
  const purchasesByCurrency = portfolio?.purchasesByCurrency ?? [];
  const purchasesByBroker = portfolio?.purchasesByBroker ?? [];
  const feesByBroker = portfolio?.feesByBroker ?? [];
  const realizedTrades = portfolio?.realizedTrades ?? [];
  const totalRealizedPL = portfolio?.totalRealizedPL ?? 0;
  const sellCount = portfolio?.sellCount ?? 0;
  const winRate = portfolio?.winRate ?? 0;
  const sortedHoldings = [...holdings].sort((a, b) => b.investedValue - a.investedValue);
  const topHolding = sortedHoldings[0];
  const maxInvested = topHolding?.investedValue ?? 0;
  const maxCurrencyTotal = Math.max(0, ...purchasesByCurrency.map(c => c.totalInvested));
  const maxBrokerTotal = Math.max(0, ...purchasesByBroker.map(b => b.totalInvested));
  const tradesWithPL = realizedTrades.map(t => ({ ...t, profitLoss: (t.sellPrice - t.buyPrice) * t.quantity }));
  const maxAbsPL = Math.max(0, ...tradesWithPL.map(t => Math.abs(t.profitLoss)));

  return (
    <div className="px-0 py-6 space-y-8">

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 font-medium">Track your portfolio performance and AI insights.</p>
          <p className="text-xs text-slate-400 italic mt-1">
            Figures below come only from your recorded transactions (price paid, quantity, fees) — not from current market prices.
          </p>
        </div>

        {/* AI SUGGESTION BOX */}
        {currentSuggestion && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl max-w-md shadow-sm">
            <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">AI Suggestion</span>
              <p className="text-xs font-bold text-amber-900 leading-relaxed italic">
                &quot;{currentSuggestion.text}&quot;
              </p>
            </div>
          </div>
        )}
      </div>

      {/* PORTFOLIO SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <StatCard
          title="Total Invested"
          value={formatCurrency(totalInvested, currency, 0)}
          icon={<Wallet className="h-5 w-5 text-[#C49A3C]" />}
          description={`Across ${holdings.length} ${holdings.length === 1 ? "holding" : "holdings"}`}
          color="gold"
        />

        <StatCard
          title="Holdings"
          value={holdings.length.toString()}
          icon={<Layers className="h-5 w-5 text-blue-600" />}
          description="Distinct assets you've invested in"
          color="blue"
        />

        <StatCard
          title="Most Invested In"
          value={topHolding?.ticker ?? "—"}
          icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          description={topHolding ? `${formatCurrency(topHolding.investedValue, topHolding.currency)} invested` : "No holdings yet"}
          color="emerald"
        />

        <StatCard
          title="Total Fees Paid"
          value={formatCurrency(totalFeesPaid, currency, 2)}
          icon={<Receipt className="h-5 w-5 text-violet-600" />}
          description="Across all transactions"
          color="violet"
        />
      </div>

      {/* HOLDINGS */}
      <SectionHeader
        eyebrow="Portfolio"
        title="Your Holdings"
        subtitle="How much you've put into each asset, by purchase price"
      />
      <div className="bg-white p-6 md:p-8 rounded-4xl border border-slate-200 shadow-sm">
        {sortedHoldings.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-slate-50 rounded-2xl mb-3">
              <Wallet className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold">No holdings yet</p>
            <p className="text-slate-400 text-sm mt-1">Upload or add transactions to see your allocation here.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedHoldings.map((h) => {
              const pctOfInvested = totalInvested > 0 ? (h.investedValue / totalInvested) * 100 : 0;
              const widthPct = maxInvested > 0 ? (h.investedValue / maxInvested) * 100 : 0;
              return (
                <div key={h.ticker} className="group">
                  <div className="flex items-baseline justify-between gap-4 mb-1.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-sm font-bold text-slate-900 shrink-0">{h.ticker}</span>
                      <span className="text-xs text-slate-400 truncate">{h.name}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{formatCurrency(h.investedValue, h.currency)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-r-full bg-[#C49A3C] transition-all duration-500 group-hover:brightness-110"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-slate-400">{h.quantity} units</span>
                    <span className="text-[11px] text-slate-400">{pctOfInvested.toFixed(1)}% of total invested value</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* WHERE YOUR MONEY WENT */}
      <SectionHeader
        eyebrow="Portfolio"
        title="Where Your Money Went"
        subtitle="Broken down by broker, currency, and fees paid"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-4xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">Purchases by broker</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">Where your orders were placed</p>
          <div className="space-y-4">
            {purchasesByBroker.map((b) => {
              const widthPct = maxBrokerTotal > 0 ? (b.totalInvested / maxBrokerTotal) * 100 : 0;
              return (
                <div key={b.broker}>
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <span className="text-xs font-bold text-slate-900">{b.broker}</span>
                    <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(b.totalInvested, currency, 0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-r-full bg-[#C49A3C]" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-4xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-black text-slate-900">Purchases by currency</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">How much you&apos;ve invested in each currency</p>
          <div className="space-y-4">
            {purchasesByCurrency.map((c) => {
              const widthPct = maxCurrencyTotal > 0 ? (c.totalInvested / maxCurrencyTotal) * 100 : 0;
              return (
                <div key={c.currency}>
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <span className="text-xs font-bold text-slate-900">{c.currency}</span>
                    <span className="text-xs font-bold text-slate-900 shrink-0">{formatCurrency(c.totalInvested, c.currency, 0)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-r-full bg-[#C49A3C]" style={{ width: `${widthPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DonutBreakdown
          title="Fees by broker"
          subtitle="Where your trading costs came from"
          data={feesByBroker.map(d => ({ label: d.broker, value: d.totalFees }))}
          currency={currency}
        />
      </div>

      {/* REALIZED GAINS & LOSSES */}
      <SectionHeader
        eyebrow="Performance"
        title="Realized Gains & Losses"
        subtitle="From completed sells only — comparing your sell price to your original purchase price"
      />
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <StatCard
            title="Total Realized P&L"
            value={`${totalRealizedPL >= 0 ? "+" : ""}${formatCurrency(totalRealizedPL, currency, 2)}`}
            icon={totalRealizedPL >= 0
              ? <TrendingUp className="h-5 w-5 text-emerald-600" />
              : <TrendingDown className="h-5 w-5 text-rose-600" />}
            description="Sum of profit/loss on closed positions"
            color={totalRealizedPL >= 0 ? "emerald" : "red"}
          />
          <StatCard
            title="Sell Transactions"
            value={sellCount.toString()}
            icon={<Repeat className="h-5 w-5 text-blue-600" />}
            description="Completed sells recorded"
            color="blue"
          />
          <StatCard
            title="Win Rate"
            value={`${winRate.toFixed(0)}%`}
            icon={<Target className="h-5 w-5 text-[#C49A3C]" />}
            description="Sells closed at a profit"
            color="gold"
          />
        </div>

        <div className="bg-white p-6 md:p-8 rounded-4xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-black text-slate-900">Profit / loss by trade</h3>
          <p className="text-xs text-slate-500 mt-1 mb-6">Based on your recorded buy and sell prices for each closed position</p>

          {tradesWithPL.length === 0 ? (
            <p className="text-sm text-slate-400 py-6">No completed sells yet.</p>
          ) : (
            <div className="space-y-5">
              {tradesWithPL.map((t) => {
                const isGain = t.profitLoss >= 0;
                const halfWidthPct = maxAbsPL > 0 ? (Math.abs(t.profitLoss) / maxAbsPL) * 50 : 0;
                return (
                  <div key={t.ticker}>
                    <div className="flex items-baseline justify-between gap-4 mb-1.5">
                      <span className="text-sm font-bold text-slate-900">{t.ticker}</span>
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
      </div>

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
 * REUSABLE STAT CARD COMPONENT
 */
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "emerald" | "violet" | "red" | "gold";
}

function StatCard({ title, value, icon, description, color }: StatCardProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    red: "bg-red-50 text-red-600 border-red-100",
    gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  };

  return (
    <div className="bg-white p-6 rounded-4xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        <p className="text-xs font-medium text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}

/**
 * DONUT BREAKDOWN — part-to-whole across a handful of named categories (≤ ~6-8).
 * Single categorical hue per slot, fixed order; every value also lives in the legend
 * as text (never color-only), which is the required relief for the low-contrast slots.
 */
interface DonutBreakdownProps {
  title: string;
  subtitle: string;
  data: { label: string; value: number }[];
  currency: string;
}

function DonutBreakdown({ title, subtitle, data, currency }: DonutBreakdownProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white p-6 rounded-4xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>

      {data.length === 0 ? (
        <p className="text-sm text-slate-400 py-6">No data yet.</p>
      ) : (
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
      )}
    </div>
  );
}
