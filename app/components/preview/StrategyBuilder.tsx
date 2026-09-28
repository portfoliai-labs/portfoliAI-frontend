// components/preview/StrategyBuilder.tsx
"use client";

import { useMemo, useRef, useState } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";
import { ArrowDownToLine, CalendarClock, Coins, FlaskConical, Play, Repeat, Save, Scale, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { DataTable, type DataColumn } from "../dashboard/ExploreView";
import { Toggle } from "../dashboard/Toggle";
import { formatCompact, formatCurrency } from "../../lib/format";
import { MACRO_CATEGORIES, MACRO_COLORS, type MacroCategory } from "../../lib/mock/community";
import {
  CATEGORY_ASSUMPTIONS, DEFAULT_STRATEGY, FIRST_YEAR, PRESETS, runBacktest,
  type BacktestResult, type Frequency, type RebalanceEvent, type RebalanceMode, type StrategyConfig,
} from "../../lib/mock/strategy";
import { AXIS_TICK, ComingSoonButton, Panel, Pills, PreviewBadge, PreviewBanner, Stat, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

const eur = (v: number) => formatCurrency(v, "EUR", 0);

interface VirtualPortfolio {
  id: number;
  config: StrategyConfig;
  result: BacktestResult;
  noRebalance: BacktestResult;
  frictionless: BacktestResult;
}

/**
 * STRATEGY (preview) — build a portfolio strategy and backtest it, opened from the Portfolios
 * hub. The strategy is a set of rules: how much goes into each macro category, the initial
 * purchase at the start of the period, when to rebalance back to those weights (on a calendar,
 * past a drift band, or both), optional recurring contributions (PAC) or withdrawals, and the
 * real-world frictions (commissions, spread, fund fees, stamp duty, capital gains tax). "Run
 * backtest" plays the rules over a synthetic market (lib/mock/strategy) and shows the result as
 * a virtual portfolio, next to the same plan without rebalancing and without costs. Virtual
 * portfolios live on this page only.
 */
export function StrategyBuilder({ trail }: { trail: Crumb[] }) {
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_STRATEGY);
  const [runs, setRuns] = useState<VirtualPortfolio[]>([]);
  const [openRun, setOpenRun] = useState<number | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const patch = <K extends keyof StrategyConfig>(key: K, value: Partial<StrategyConfig[K]> | StrategyConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: typeof value === "object" && !Array.isArray(value) ? { ...(c[key] as object), ...value } : value }));

  const sum = MACRO_CATEGORIES.reduce((s, c) => s + config.weights[c], 0);
  const maxYears = 2026 - config.startYear;
  const valid = sum === 100 && config.initialAmount > 0 && config.name.trim() !== "";

  const run = () => {
    const cfg = { ...config, years: Math.min(config.years, maxYears) };
    const vp: VirtualPortfolio = {
      id: Date.now(),
      config: cfg,
      result: runBacktest(cfg),
      noRebalance: runBacktest(cfg, { noRebalance: true }),
      frictionless: runBacktest(cfg, { noCosts: true }),
    };
    setRuns((r) => [vp, ...r]);
    setOpenRun(vp.id);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const current = runs.find((r) => r.id === openRun) ?? null;

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Strategy" />
      <PreviewBanner feature="Strategy">
        Design a strategy&apos;s rules and backtest them. The backtest runs on a synthetic market (made-up returns for each
        asset class, with 2008, 2020 and 2022-style shocks), not on real prices, and the virtual portfolio it creates
        isn&apos;t saved.
      </PreviewBanner>

      <Panel title="Strategy name">
        <div className="p-6 md:p-7">
          <input
            value={config.name}
            onChange={(e) => patch("name", e.target.value)}
            maxLength={60}
            className="w-full max-w-md h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
          />
        </div>
      </Panel>

      <Step n={1} icon={<Scale className="h-4 w-4" />} title="Allocation by macro category" text="How much of the portfolio each asset class should hold. The weights must add up to 100%.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => patch("weights", Object.fromEntries(MACRO_CATEGORIES.map((c) => [c, p.weights[c] ?? 0])) as Record<MacroCategory, number>)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-600 hover:border-[#C49A3C] hover:text-[#8A6A28] transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            {MACRO_CATEGORIES.map((c) => (
              <span key={c} style={{ width: `${Math.min(config.weights[c], 100)}%`, background: MACRO_COLORS[c] }} className="transition-all" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {MACRO_CATEGORIES.map((c) => (
              <div key={c}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: MACRO_COLORS[c] }} />{c}
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={config.weights[c]}
                      onChange={(e) => patch("weights", { ...config.weights, [c]: clamp(Number(e.target.value), 0, 100) })}
                      aria-label={`${c} weight`}
                      className="w-16 h-8 px-2 rounded-lg border border-slate-200 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-[#C49A3C]/60"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={config.weights[c]}
                  onChange={(e) => patch("weights", { ...config.weights, [c]: Number(e.target.value) })}
                  aria-label={`${c} weight slider`}
                  className="w-full mt-1.5 accent-[#C49A3C]"
                />
                <p className="text-[11px] font-semibold text-slate-400">
                  Assumed {(CATEGORY_ASSUMPTIONS[c].mean * 100).toFixed(1)}%/yr, volatility {(CATEGORY_ASSUMPTIONS[c].vol * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${sum === 100 ? "bg-emerald-50" : "bg-amber-50"}`}>
            <span className={`text-sm font-black tabular-nums ${sum === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              Total {sum}% {sum === 100 ? "✓" : sum > 100 ? `— ${sum - 100} points too many` : `— ${100 - sum} points left`}
            </span>
            {sum !== 100 && sum > 0 && (
              <button
                type="button"
                onClick={() => patch("weights", normalize(config.weights))}
                className="text-xs font-bold text-amber-800 underline underline-offset-2"
              >
                Scale to 100%
              </button>
            )}
          </div>
        </div>
      </Step>

      <Step n={2} icon={<ShoppingCart className="h-4 w-4" />} title="Initial purchase" text="The whole amount is invested at the start of the period, split at the target weights.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Amount" suffix="€" value={config.initialAmount} step={1000} onChange={(v) => patch("initialAmount", Math.max(0, v))} />
          <SelectField
            label="Start of the period"
            value={String(config.startYear)}
            options={Array.from({ length: 2024 - FIRST_YEAR }, (_, i) => String(FIRST_YEAR + i)).map((y) => ({ value: y, label: `January ${y}` }))}
            onChange={(v) => patch("startYear", Number(v))}
          />
          <NumberField label="Length" suffix="years" value={Math.min(config.years, maxYears)} min={1} max={maxYears} onChange={(v) => patch("years", clamp(v, 1, maxYears))} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 mt-3">
          Runs until {config.startYear + Math.min(config.years, maxYears) >= 2026 ? "September 2026" : `January ${config.startYear + Math.min(config.years, maxYears)}`}.
        </p>
      </Step>

      <Step
        n={3}
        icon={<Repeat className="h-4 w-4" />}
        title="Rebalancing"
        text="Because some assets grow more than others, the portfolio's weights drift away from the target over time. Rebalancing sells what has grown past its weight and buys what has fallen behind."
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { value: "none", title: "Never", text: "Buy and hold: let the weights drift." },
            { value: "calendar", title: "On a calendar", text: "Back to target at fixed dates." },
            { value: "threshold", title: "On drift", text: "When a weight moves past a band." },
            { value: "both", title: "Calendar + drift", text: "Fixed dates, plus the band in between." },
          ] as { value: RebalanceMode; title: string; text: string }[]).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => patch("rebalancing", { mode: o.value })}
              className={`text-left rounded-2xl border-2 p-3.5 transition-colors ${
                config.rebalancing.mode === o.value ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-[13px] font-black text-slate-900">{o.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{o.text}</p>
            </button>
          ))}
        </div>
        {config.rebalancing.mode !== "none" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            {(config.rebalancing.mode === "calendar" || config.rebalancing.mode === "both") && (
              <SelectField
                label="How often"
                value={config.rebalancing.frequency}
                options={[
                  { value: "monthly", label: "Every month" },
                  { value: "quarterly", label: "Every quarter" },
                  { value: "semiannual", label: "Every six months" },
                  { value: "annual", label: "Every year" },
                ]}
                onChange={(v) => patch("rebalancing", { frequency: v as Frequency })}
              />
            )}
            {(config.rebalancing.mode === "threshold" || config.rebalancing.mode === "both") && (
              <NumberField
                label="Drift band"
                suffix="± points"
                value={config.rebalancing.thresholdPct}
                min={1}
                max={25}
                onChange={(v) => patch("rebalancing", { thresholdPct: clamp(v, 1, 25) })}
              />
            )}
          </div>
        )}
      </Step>

      <Step n={4} icon={<CalendarClock className="h-4 w-4" />} title="Cash flows (optional)" text="Recurring contributions (PAC) are invested at the target weights; scheduled withdrawals are taken from every asset in proportion.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FlowCard
            title="Recurring contribution (PAC)"
            enabled={config.contributions.enabled}
            onToggle={(v) => patch("contributions", { enabled: v })}
          >
            <NumberField label="Amount" suffix="€" value={config.contributions.amount} step={50} onChange={(v) => patch("contributions", { amount: Math.max(0, v) })} />
            <SelectField
              label="Every"
              value={config.contributions.frequency}
              options={[{ value: "monthly", label: "Month" }, { value: "quarterly", label: "Quarter" }, { value: "annual", label: "Year" }]}
              onChange={(v) => patch("contributions", { frequency: v as StrategyConfig["contributions"]["frequency"] })}
            />
          </FlowCard>
          <FlowCard
            title="Scheduled withdrawal"
            enabled={config.withdrawals.enabled}
            onToggle={(v) => patch("withdrawals", { enabled: v })}
          >
            <NumberField label="Amount" suffix="€" value={config.withdrawals.amount} step={50} onChange={(v) => patch("withdrawals", { amount: Math.max(0, v) })} />
            <SelectField
              label="Every"
              value={config.withdrawals.frequency}
              options={[{ value: "monthly", label: "Month" }, { value: "quarterly", label: "Quarter" }, { value: "annual", label: "Year" }]}
              onChange={(v) => patch("withdrawals", { frequency: v as StrategyConfig["withdrawals"]["frequency"] })}
            />
            <NumberField label="Starting after" suffix="years" value={config.withdrawals.startAfterYears} min={0} onChange={(v) => patch("withdrawals", { startAfterYears: Math.max(0, v) })} />
          </FlowCard>
        </div>
      </Step>

      <Step n={5} icon={<Coins className="h-4 w-4" />} title="Costs and real-world frictions" text="What each trade and each year of holding costs. Set any of them to 0 to leave it out.">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <NumberField label="Commission" suffix="% per trade" step={0.05} value={config.costs.commissionPct} onChange={(v) => patch("costs", { commissionPct: Math.max(0, v) })} />
          <NumberField label="Fixed fee" suffix="€ per trade" step={0.5} value={config.costs.fixedFee} onChange={(v) => patch("costs", { fixedFee: Math.max(0, v) })} />
          <NumberField label="Bid-ask spread" suffix="%" step={0.05} value={config.costs.spreadPct} onChange={(v) => patch("costs", { spreadPct: Math.max(0, v) })} />
          <NumberField label="Fund fees (TER)" suffix="% a year" step={0.05} value={config.costs.terPct} onChange={(v) => patch("costs", { terPct: Math.max(0, v) })} />
          <NumberField label="Stamp duty" suffix="% a year" step={0.05} value={config.costs.stampDutyPct} onChange={(v) => patch("costs", { stampDutyPct: Math.max(0, v) })} />
          <NumberField label="Capital gains tax" suffix="% on gains" step={0.5} value={config.costs.capitalGainsTaxPct} onChange={(v) => patch("costs", { capitalGainsTaxPct: clamp(v, 0, 100) })} />
        </div>
      </Step>

      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black text-white" style={serif}>Backtest &ldquo;{config.name || "Untitled"}&rdquo;</p>
          <p className="text-[13px] text-stone-400 mt-1">
            {valid ? "Plays these rules month by month and creates a virtual portfolio with the result." : sum !== 100 ? "The weights must add up to 100% first." : "Give it a name and an amount first."}
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!valid}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#C49A3C] text-[#131210] text-sm font-black hover:bg-[#d4aa4c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Play className="h-4 w-4 fill-current" /> Run backtest
        </button>
      </div>

      <div ref={resultRef} className="scroll-mt-24">
        {runs.length > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Virtual portfolios</span>
            <Pills
              options={runs.map((r, i) => ({ value: String(r.id), label: `${r.config.name} #${runs.length - i}` }))}
              value={String(openRun)}
              onChange={(v) => setOpenRun(Number(v))}
            />
          </div>
        )}
        {current && <BacktestReport run={current} />}
      </div>
    </div>
  );
}

function BacktestReport({ run }: { run: VirtualPortfolio }) {
  const { config, result, noRebalance, frictionless } = run;
  const gain = result.finalValue - (result.totalContributed - result.totalWithdrawn);
  const totalCosts = Object.values(result.costs).reduce((s, v) => s + v, 0);
  const cats = useMemo(() => MACRO_CATEGORIES.filter((c) => config.weights[c] > 0), [config]);

  const growth = useMemo(
    () => result.points.map((p, i) => ({
      date: p.date,
      strategy: Math.round(p.value),
      noRebalance: Math.round(noRebalance.points[i]?.value ?? 0),
      frictionless: Math.round(frictionless.points[i]?.value ?? 0),
      contributed: Math.round(p.contributed),
    })),
    [result, noRebalance, frictionless],
  );
  const drift = useMemo(
    () => noRebalance.points.filter((_, i) => i % 3 === 0).map((p) => ({ date: p.date, ...Object.fromEntries(cats.map((c) => [c, Math.round(p.weights[c] * 10) / 10])) })),
    [noRebalance, cats],
  );

  const eventColumns: DataColumn<RebalanceEvent>[] = [
    { key: "date", label: "Date", sortValue: (e) => e.date, render: (e) => e.date },
    { key: "reason", label: "Why", sortValue: (e) => e.reason, render: (e) => e.reason },
    { key: "drift", label: "Largest drift", align: "right", sortValue: (e) => e.maxDrift, render: (e) => `${e.maxDrift.toFixed(1)} pts` },
    { key: "turnover", label: "Traded", align: "right", sortValue: (e) => e.turnover, render: (e) => eur(e.turnover) },
    { key: "cost", label: "Cost", align: "right", sortValue: (e) => e.cost, render: (e) => eur(e.cost) },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-4xl border-2 border-dashed border-violet-200 shadow-sm p-6 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <FlaskConical className="h-3.5 w-3.5 text-violet-600" />
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">Virtual portfolio · simulated</p>
            </div>
            <h2 className="text-2xl font-black text-slate-900" style={serif}>{config.name}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              {result.points[0].date} → {result.points.at(-1)!.date} · {cats.map((c) => `${c} ${config.weights[c]}%`).join(" · ")}
            </p>
          </div>
          <ComingSoonButton icon={<Save className="h-3.5 w-3.5" />}>Save to Investments</ComingSoonButton>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
          <Stat label="Final value" value={eur(result.finalValue)} />
          <Stat label="Put in" value={eur(result.totalContributed)} note={result.totalWithdrawn > 0 ? `${eur(result.totalWithdrawn)} taken out` : undefined} />
          <Stat label="Gain" value={`${gain >= 0 ? "+" : ""}${eur(gain)}`} tone={gain >= 0 ? "gain" : "loss"} />
          <Stat label="Return per year" value={formatPct(result.cagrPct, 2)} tone={result.cagrPct >= 0 ? "gain" : "loss"} note="Time-weighted" />
          <Stat label="Volatility" value={`${result.volatilityPct.toFixed(1)}%`} />
          <Stat label="Max drawdown" value={`${result.maxDrawdownPct.toFixed(1)}%`} tone="loss" />
          <Stat label="Best / worst year" value={`${formatPct(result.bestYearPct, 0)} / ${formatPct(result.worstYearPct, 0)}`} />
          <Stat label="Rebalances" value={String(result.events.length)} note={`${eur(totalCosts)} total costs`} />
        </div>
      </section>

      <Panel title="Growth of the virtual portfolio" subtitle="Against the same plan never rebalanced, and without any costs.">
        <div className="p-4 md:p-6 h-80">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 300 }}>
            <LineChart data={growth} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={48} />
              <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [eur(Number(v)), LABELS[name as keyof typeof LABELS] ?? name]} />
              <Legend formatter={(v) => LABELS[v as keyof typeof LABELS] ?? v} wrapperStyle={{ fontSize: 12 }} />
              <Line type="stepAfter" dataKey="contributed" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="frictionless" stroke="#1baf7a" strokeWidth={1.5} strokeOpacity={0.7} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="noRebalance" stroke="#2a78d6" strokeWidth={1.5} strokeOpacity={0.7} dot={false} isAnimationActive={false} />
              <Line type="monotone" dataKey="strategy" stroke="#C49A3C" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="px-6 md:px-7 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Comparison label="Your strategy" value={result.finalValue} cagr={result.cagrPct} dd={result.maxDrawdownPct} highlight />
          <Comparison label="Never rebalanced" value={noRebalance.finalValue} cagr={noRebalance.cagrPct} dd={noRebalance.maxDrawdownPct} />
          <Comparison label="Without costs" value={frictionless.finalValue} cagr={frictionless.cagrPct} dd={frictionless.maxDrawdownPct} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6">
        <Panel title="How the weights drift without rebalancing" subtitle="Share of each asset class if the portfolio were never rebalanced.">
          <div className="p-4 md:p-6 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 240 }}>
              <AreaChart data={drift} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} stackOffset="expand">
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={48} />
                <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]} />
                {cats.map((c) => (
                  <Area key={c} type="monotone" dataKey={c} stackId="w" stroke={MACRO_COLORS[c]} fill={MACRO_COLORS[c]} fillOpacity={0.75} isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Where the costs went" subtitle={`${eur(totalCosts)} over the whole period.`}>
          <ul className="p-6 md:p-7 space-y-3">
            {([
              ["Commissions & fixed fees", result.costs.commissions],
              ["Bid-ask spread", result.costs.spread],
              ["Fund fees (TER)", result.costs.ter],
              ["Stamp duty", result.costs.stampDuty],
              ["Capital gains tax", result.costs.taxes],
            ] as [string, number][]).map(([label, v]) => (
              <li key={label}>
                <div className="flex justify-between text-[13px]">
                  <span className="font-semibold text-slate-600">{label}</span>
                  <span className="font-black tabular-nums text-slate-900">{eur(v)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-[#C49A3C]" style={{ width: `${totalCosts > 0 ? (v / totalCosts) * 100 : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Rebalancing log" subtitle={result.events.length === 0 ? "No rebalancing happened." : `${result.events.length} rebalances, winners sold and laggards bought.`}>
        {result.events.length > 0 && (
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            <DataTable columns={eventColumns} rows={result.events} rowKey={(e) => e.date} initialSort={{ key: "date", desc: false }} />
          </div>
        )}
      </Panel>

      <p className="text-[11px] text-slate-400 text-center max-w-xl mx-auto leading-relaxed flex items-center justify-center gap-1.5">
        <PreviewBadge label="Simulated" /> Synthetic market, not real prices. Not investment advice.
      </p>
    </div>
  );
}

const LABELS = { strategy: "Your strategy", noRebalance: "Never rebalanced", frictionless: "Without costs", contributed: "Money put in" };

function Comparison({ label, value, cagr, dd, highlight }: { label: string; value: number; cagr: number; dd: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${highlight ? "bg-[#C49A3C]/10 border border-[#C49A3C]/30" : "bg-slate-50"}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="text-lg font-black tabular-nums text-slate-900 mt-0.5">{eur(value)}</p>
      <p className="text-[11px] font-semibold text-slate-500 tabular-nums">{formatPct(cagr, 2)}/yr · drawdown {dd.toFixed(1)}%</p>
    </div>
  );
}

function Step({ n, icon, title, text, children }: { n: number; icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100 flex items-start gap-3">
        <span className="w-8 h-8 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-slate-900"><span className="text-[#C49A3C] mr-1.5">{n}.</span>{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{text}</p>
        </div>
      </div>
      <div className="p-6 md:p-7">{children}</div>
    </section>
  );
}

function FlowCard({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? "border-[#C49A3C]/40 bg-[#C49A3C]/5" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-black text-slate-900">
          {title.startsWith("Recurring") ? <SlidersHorizontal className="h-4 w-4 text-[#C49A3C]" /> : <ArrowDownToLine className="h-4 w-4 text-[#C49A3C]" />}
          {title}
        </span>
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="grid grid-cols-2 gap-3 mt-4">{children}</div>}
    </div>
  );
}

const fieldLabel = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";
const fieldBox = "w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10";

function NumberField({ label, value, onChange, suffix, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; step?: number; min?: number; max?: number }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={`${fieldBox} tabular-nums ${suffix ? "pr-20" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>}
      </span>
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldBox}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));

function normalize(weights: Record<MacroCategory, number>): Record<MacroCategory, number> {
  const sum = MACRO_CATEGORIES.reduce((s, c) => s + weights[c], 0);
  const scaled = MACRO_CATEGORIES.map((c) => ({ c, v: Math.floor((weights[c] / sum) * 100) }));
  // Hand the rounding leftovers to the largest weights so the total is exactly 100.
  let left = 100 - scaled.reduce((s, x) => s + x.v, 0);
  for (const x of [...scaled].sort((a, b) => weights[b.c] - weights[a.c])) {
    if (left <= 0) break;
    x.v += 1;
    left -= 1;
  }
  return Object.fromEntries(scaled.map((x) => [x.c, x.v])) as Record<MacroCategory, number>;
}
