// components/dashboard/StrategyBuilder.tsx
"use client";

import { useState } from "react";
import { ArrowDownToLine, CalendarClock, Coins, History, Loader2, Play, Repeat, Scale, ShoppingCart, SlidersHorizontal } from "lucide-react";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { Toggle } from "./Toggle";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import {
  MAX_STRATEGY_YEARS, STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, STRATEGY_FIRST_YEAR, STRATEGY_PROXIES,
  earliestStartYear,
  type CashFlowAmountType, type RebalanceMode, type StrategyCategory, type StrategyFrequency, type StrategyParams,
} from "../../models/Strategy";

const serif = { fontFamily: "'Playfair Display', Georgia, serif" } as const;

const CATEGORY_COLORS: Record<StrategyCategory, string> = {
  equity: "#2a78d6",
  bonds: "#1baf7a",
  real_estate: "#eb6834",
  commodities: "#eda100",
  cash: "#94a3b8",
  crypto: "#4a3aa7",
};

type Weights = Record<StrategyCategory, number>;

const PRESETS: { name: string; weights: Partial<Weights> }[] = [
  { name: "Conservative", weights: { equity: 25, bonds: 60, cash: 15 } },
  { name: "Balanced 60/40", weights: { equity: 60, bonds: 40 } },
  { name: "Growth", weights: { equity: 80, bonds: 10, real_estate: 10 } },
  { name: "All-weather", weights: { equity: 30, bonds: 55, commodities: 15 } },
  { name: "Core + crypto", weights: { equity: 75, bonds: 10, crypto: 10, cash: 5 } },
];

// The form: the API's StrategyParams, with every category's weight present (0 = not held).
interface StrategyForm extends Omit<StrategyParams, "weights"> {
  name: string;
  weights: Weights;
}

const DEFAULT_FORM: StrategyForm = {
  name: "My balanced strategy",
  weights: { equity: 60, bonds: 30, real_estate: 5, commodities: 5, cash: 0, crypto: 0 },
  initialAmount: 20000,
  startYear: 2012,
  years: 14,
  rebalancing: { mode: "both", frequency: "annual", thresholdPct: 5, relativeThresholdPct: null },
  contributions: { enabled: true, amount: 300, amountType: "fixed", frequency: "monthly", allocation: "current" },
  withdrawals: { enabled: false, amount: 4, amountType: "percent_of_value", frequency: "annual", startAfterYears: 10 },
  costs: { commissionPct: 0.1, fixedFee: 2, spreadPct: 0.1 },
};

const FREQUENCY_OPTIONS: { value: StrategyFrequency; label: string }[] = [
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every quarter" },
  { value: "semiannual", label: "Every six months" },
  { value: "annual", label: "Every year" },
];

/**
 * STRATEGY — build a portfolio strategy and backtest it, opened from the Manage hub. The
 * strategy is a set of rules: how much goes into each macro category, the initial purchase at the
 * start of the period, when to rebalance back to those weights (on a calendar, past a drift band,
 * or both), optional recurring contributions (PAC) or withdrawals, and the trading costs. "Run
 * backtest" sends them to POST /v1/portfolios/strategies, which plays them on real prices (one
 * ETF per category, see models/Strategy) into a virtual portfolio: read only, kept apart from the
 * real ones and out of the net worth (see BacktestMarks). The page then opens that portfolio,
 * whose figures come in once the backend's job has generated its trades. A demo account can look
 * but not run one.
 */
export function StrategyBuilder({ trail, onCreated }: { trail: Crumb[]; onCreated: (portfolioUuid: string) => void }) {
  const { createStrategyPortfolio } = usePortfolio();
  const { user, isDemo } = useUser();
  const currency = user?.currency ?? "EUR";
  const [form, setForm] = useState<StrategyForm>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = <K extends keyof StrategyForm>(key: K, value: Partial<StrategyForm[K]> | StrategyForm[K]) =>
    setForm((f) => ({ ...f, [key]: typeof value === "object" && !Array.isArray(value) ? { ...(f[key] as object), ...value } : value }));
  // New weights can hold a category with a shorter history: the start moves up to where it begins.
  const setWeights = (weights: Weights) =>
    setForm((f) => ({ ...f, weights, startYear: Math.max(f.startYear, earliestStartYear(weights)) }));

  const sum = STRATEGY_CATEGORIES.reduce((s, c) => s + form.weights[c], 0);
  const firstYear = earliestStartYear(form.weights);
  const thisYear = new Date().getFullYear();
  const endYear = form.startYear + form.years;
  const { mode, thresholdPct, relativeThresholdPct } = form.rebalancing;
  const needsBand = mode === "threshold" || mode === "both";

  const problems = [
    !form.name.trim() && "Give the strategy a name.",
    sum !== 100 && "The weights must add up to 100%.",
    !(form.initialAmount > 0) && "The initial amount must be more than 0.",
    needsBand && thresholdPct == null && relativeThresholdPct == null && "Rebalancing on drift needs at least one band.",
    form.contributions.enabled && form.contributions.amountType === "percent_of_value" && form.contributions.amount > 100 && "A contribution can't be more than 100% of the value.",
    form.withdrawals.enabled && form.withdrawals.amountType === "percent_of_value" && form.withdrawals.amount > 100 && "A withdrawal can't be more than 100% of the value.",
  ].filter((p): p is string => typeof p === "string");
  const valid = problems.length === 0;

  const run = async () => {
    if (!valid || isDemo) return;
    setSubmitting(true);
    setError(null);
    try {
      const { name, weights, ...rest } = form;
      const strategy: StrategyParams = {
        ...rest,
        weights: Object.fromEntries(STRATEGY_CATEGORIES.filter((c) => weights[c] > 0).map((c) => [c, weights[c]])),
      };
      const created = await createStrategyPortfolio({ name: name.trim(), strategy });
      onCreated(created.uuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run this backtest.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Strategy" />

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <History className="h-4 w-4" />
        </span>
        <p className="text-xs text-sky-900/80 leading-relaxed">
          <span className="block text-[13px] font-black text-sky-950">Backtest a strategy on historical prices</span>
          Each asset class is traded through one ETF, on real prices with distributions reinvested. The result is a virtual
          portfolio: you can explore it like any other, but it&apos;s read only, kept apart from your real portfolios and never
          counted in your net worth.
        </p>
      </div>

      <Panel title="Strategy name">
        <input
          value={form.name}
          onChange={(e) => patch("name", e.target.value)}
          maxLength={80}
          aria-label="Strategy name"
          className="w-full max-w-md h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        <p className="text-[11px] font-semibold text-slate-400 mt-2">Also the name of the virtual portfolio it creates.</p>
      </Panel>

      <Step n={1} icon={<Scale className="h-4 w-4" />} title="Allocation by macro category" text="How much of the portfolio each asset class should hold. The weights must add up to 100%.">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setWeights(Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, p.weights[c] ?? 0])) as Weights)}
                className="px-3 py-1.5 rounded-full text-xs font-bold border border-slate-200 text-slate-600 hover:border-[#C49A3C] hover:text-[#8A6A28] transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>

          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
            {STRATEGY_CATEGORIES.map((c) => (
              <span key={c} style={{ width: `${Math.min(form.weights[c], 100)}%`, background: CATEGORY_COLORS[c] }} className="transition-all" />
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {STRATEGY_CATEGORIES.map((c) => (
              <div key={c}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />{STRATEGY_CATEGORY_LABELS[c]}
                  </span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.weights[c]}
                      onChange={(e) => setWeights({ ...form.weights, [c]: clamp(Number(e.target.value), 0, 100) })}
                      aria-label={`${STRATEGY_CATEGORY_LABELS[c]} weight`}
                      className="w-16 h-8 px-2 rounded-lg border border-slate-200 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-[#C49A3C]/60"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.weights[c]}
                  onChange={(e) => setWeights({ ...form.weights, [c]: Number(e.target.value) })}
                  aria-label={`${STRATEGY_CATEGORY_LABELS[c]} weight slider`}
                  className="w-full mt-1.5 accent-[#C49A3C]"
                />
                <p className="text-[11px] font-semibold text-slate-400">
                  {STRATEGY_PROXIES[c]} · prices from {STRATEGY_FIRST_YEAR[c]}
                </p>
              </div>
            ))}
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 ${sum === 100 ? "bg-emerald-50" : "bg-amber-50"}`}>
            <span className={`text-sm font-black tabular-nums ${sum === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              Total {sum}% {sum === 100 ? "✓" : sum > 100 ? `— ${sum - 100} points too many` : `— ${100 - sum} points left`}
            </span>
            {sum !== 100 && sum > 0 && (
              <button type="button" onClick={() => setWeights(normalize(form.weights))} className="text-xs font-bold text-amber-800 underline underline-offset-2">
                Scale to 100%
              </button>
            )}
          </div>
        </div>
      </Step>

      <Step n={2} icon={<ShoppingCart className="h-4 w-4" />} title="Initial purchase" text="The whole amount is invested at the start of the period, split at the target weights.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Amount" suffix={currency} value={form.initialAmount} step={1000} min={0} onChange={(v) => patch("initialAmount", Math.max(0, v))} />
          <SelectField
            label="Start of the period"
            value={String(form.startYear)}
            options={Array.from({ length: thisYear - firstYear + 1 }, (_, i) => String(firstYear + i)).map((y) => ({ value: y, label: `January ${y}` }))}
            onChange={(v) => patch("startYear", Number(v))}
          />
          <NumberField label="Length" suffix="years" value={form.years} min={1} max={MAX_STRATEGY_YEARS} onChange={(v) => patch("years", clamp(v, 1, MAX_STRATEGY_YEARS))} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 mt-3">
          {endYear > thisYear ? "Runs until today." : `Runs until January ${endYear}.`}
          {firstYear > 2008 && ` Can't start before ${firstYear}: that's where the price history of what it holds begins.`}
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
                mode === o.value ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <p className="text-[13px] font-black text-slate-900">{o.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{o.text}</p>
            </button>
          ))}
        </div>
        {mode !== "none" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            {(mode === "calendar" || mode === "both") && (
              <SelectField
                label="How often"
                value={form.rebalancing.frequency}
                options={FREQUENCY_OPTIONS}
                onChange={(v) => patch("rebalancing", { frequency: v as StrategyFrequency })}
              />
            )}
            {needsBand && (
              <>
                <OptionalNumberField
                  label="Absolute band"
                  suffix="± points"
                  value={thresholdPct}
                  onChange={(v) => patch("rebalancing", { thresholdPct: v == null ? null : clamp(v, 0.1, 100) })}
                />
                <OptionalNumberField
                  label="Relative band"
                  suffix="± % of weight"
                  value={relativeThresholdPct}
                  onChange={(v) => patch("rebalancing", { relativeThresholdPct: v == null ? null : clamp(v, 0.1, 100) })}
                />
              </>
            )}
          </div>
        )}
        {needsBand && (
          <p className="text-[11px] font-semibold text-slate-400 mt-3">
            Checked every trading day. With both bands set, crossing either one rebalances (the 5/25 rule: ±5 points, or ±25% of
            the weight). Leave a band empty to turn it off.
          </p>
        )}
      </Step>

      <Step n={4} icon={<CalendarClock className="h-4 w-4" />} title="Cash flows (optional)" text="Recurring contributions (PAC) and scheduled withdrawals, on the first trading day of the month they fall in. Withdrawals sell every asset in proportion.">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FlowCard
            icon={<SlidersHorizontal className="h-4 w-4 text-[#C49A3C]" />}
            title="Recurring contribution (PAC)"
            enabled={form.contributions.enabled}
            onToggle={(v) => patch("contributions", { enabled: v })}
          >
            <AmountFields
              currency={currency}
              amount={form.contributions.amount}
              amountType={form.contributions.amountType}
              onChange={(v) => patch("contributions", v)}
            />
            <SelectField label="How often" value={form.contributions.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("contributions", { frequency: v as StrategyFrequency })} />
            <SelectField
              label="Bought at"
              value={form.contributions.allocation}
              options={[{ value: "current", label: "Current weights" }, { value: "target", label: "Target weights" }]}
              onChange={(v) => patch("contributions", { allocation: v as "current" | "target" })}
            />
          </FlowCard>
          <FlowCard
            icon={<ArrowDownToLine className="h-4 w-4 text-[#C49A3C]" />}
            title="Scheduled withdrawal"
            enabled={form.withdrawals.enabled}
            onToggle={(v) => patch("withdrawals", { enabled: v })}
          >
            <AmountFields
              currency={currency}
              amount={form.withdrawals.amount}
              amountType={form.withdrawals.amountType}
              onChange={(v) => patch("withdrawals", v)}
            />
            <SelectField label="How often" value={form.withdrawals.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("withdrawals", { frequency: v as StrategyFrequency })} />
            <NumberField label="Starting after" suffix="years" value={form.withdrawals.startAfterYears} min={0} onChange={(v) => patch("withdrawals", { startAfterYears: Math.max(0, Math.round(v)) })} />
          </FlowCard>
        </div>
        <p className="text-[11px] font-semibold text-slate-400 mt-3">
          A percentage is of the portfolio&apos;s value that day, each time: 4% every month is 4% a month, not a year.
        </p>
      </Step>

      <Step n={5} icon={<Coins className="h-4 w-4" />} title="Trading costs" text="What each trade costs. Fund fees are already in the ETFs' prices; taxes aren't modelled yet.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NumberField label="Commission" suffix="% per trade" step={0.05} min={0} value={form.costs.commissionPct} onChange={(v) => patch("costs", { commissionPct: clamp(v, 0, 100) })} />
          <NumberField label="Fixed fee" suffix={`${currency} per trade`} step={0.5} min={0} value={form.costs.fixedFee} onChange={(v) => patch("costs", { fixedFee: Math.max(0, v) })} />
          <NumberField label="Bid-ask spread" suffix="%" step={0.05} min={0} value={form.costs.spreadPct} onChange={(v) => patch("costs", { spreadPct: Math.max(0, v) })} />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 mt-3">
          Commissions and fixed fees show up in the trading costs; the spread moves the price you trade at, so it lowers the returns.
        </p>
      </Step>

      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-lg font-black text-white" style={serif}>Backtest &ldquo;{form.name.trim() || "Untitled"}&rdquo;</p>
          <p className="text-[13px] text-stone-400 mt-1">
            {isDemo
              ? "Backtests can't be run on a demo account."
              : valid
                ? "Creates a virtual portfolio and opens it. Its figures take a few minutes to come in."
                : problems[0]}
          </p>
          {error && <p className="text-[13px] font-bold text-rose-400 mt-1.5">{error}</p>}
        </div>
        <button
          type="button"
          onClick={run}
          disabled={!valid || isDemo || submitting}
          title={isDemo ? DEMO_DISABLED_TITLE : undefined}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#C49A3C] text-[#131210] text-sm font-black hover:bg-[#d4aa4c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
          Run backtest
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center max-w-xl mx-auto leading-relaxed">
        A backtest shows how rules would have played out in the past. Past returns don&apos;t predict future ones. Not investment advice.
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 md:px-7 pt-5 pb-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
      </div>
      <div className="p-6 md:p-7">{children}</div>
    </section>
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

function FlowCard({ icon, title, enabled, onToggle, children }: { icon: React.ReactNode; title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? "border-[#C49A3C]/40 bg-[#C49A3C]/5" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-black text-slate-900">{icon}{title}</span>
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="grid grid-cols-2 gap-3 mt-4">{children}</div>}
    </div>
  );
}

/** A cash flow's amount, either a sum or a percentage of the portfolio's value. */
function AmountFields({ currency, amount, amountType, onChange }: {
  currency: string;
  amount: number;
  amountType: CashFlowAmountType;
  onChange: (v: { amount?: number; amountType?: CashFlowAmountType }) => void;
}) {
  const percent = amountType === "percent_of_value";
  return (
    <>
      <NumberField
        label="Amount"
        suffix={percent ? "% of value" : currency}
        step={percent ? 0.5 : 50}
        min={0}
        max={percent ? 100 : undefined}
        value={amount}
        onChange={(v) => onChange({ amount: percent ? clamp(v, 0, 100) : Math.max(0, v) })}
      />
      <SelectField
        label="As"
        value={amountType}
        options={[{ value: "fixed", label: "A fixed sum" }, { value: "percent_of_value", label: "A % of the value" }]}
        onChange={(v) => onChange({ amountType: v as CashFlowAmountType })}
      />
    </>
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
          className={`${fieldBox} tabular-nums ${suffix ? "pr-24" : ""}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">{suffix}</span>}
      </span>
    </label>
  );
}

/** A number that can be left empty (null), for a setting that's off without one. */
function OptionalNumberField({ label, value, onChange, suffix }: { label: string; value: number | null; onChange: (v: number | null) => void; suffix?: string }) {
  return (
    <label className="block">
      <span className={fieldLabel}>{label}</span>
      <span className="relative block">
        <input
          type="number"
          value={value ?? ""}
          step={0.5}
          min={0}
          placeholder="Off"
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={`${fieldBox} tabular-nums placeholder:text-slate-300 ${suffix ? "pr-28" : ""}`}
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

function normalize(weights: Weights): Weights {
  const sum = STRATEGY_CATEGORIES.reduce((s, c) => s + weights[c], 0);
  const scaled = STRATEGY_CATEGORIES.map((c) => ({ c, v: Math.floor((weights[c] / sum) * 100) }));
  // Hand the rounding leftovers to the largest weights so the total is exactly 100.
  let left = 100 - scaled.reduce((s, x) => s + x.v, 0);
  for (const x of [...scaled].sort((a, b) => weights[b.c] - weights[a.c])) {
    if (left <= 0) break;
    x.v += 1;
    left -= 1;
  }
  return Object.fromEntries(scaled.map((x) => [x.c, x.v])) as Weights;
}
