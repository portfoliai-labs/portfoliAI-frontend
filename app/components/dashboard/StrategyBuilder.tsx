// components/dashboard/StrategyBuilder.tsx
"use client";

import { useState } from "react";
import { ArrowDownToLine, CalendarClock, ChevronDown, Coins, History, Loader2, PiggyBank, Play, Plus, Repeat, Search, SlidersHorizontal, X } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { Toggle } from "./Toggle";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { PreviewBadge } from "../preview/PreviewKit";
import { searchAssets, type CatalogAsset } from "../../lib/mock/assets";
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

// Ready-made mixes, the first thing a strategy is: most people pick one and go.
const PRESETS: { name: string; text: string; weights: Partial<Weights> }[] = [
  { name: "Conservative", text: "Mostly bonds and cash: small swings, slower growth.", weights: { equity: 25, bonds: 60, cash: 15 } },
  { name: "Balanced 60/40", text: "The classic mix of stocks and bonds.", weights: { equity: 60, bonds: 40 } },
  { name: "Growth", text: "Mostly stocks: bigger swings, more growth over time.", weights: { equity: 80, bonds: 10, real_estate: 10 } },
  { name: "All-weather", text: "Spread to hold up in most markets.", weights: { equity: 30, bonds: 55, commodities: 15 } },
  { name: "Core + crypto", text: "Stocks at the core, with a slice of Bitcoin.", weights: { equity: 75, bonds: 10, crypto: 10, cash: 5 } },
];

const presetWeights = (preset: (typeof PRESETS)[number]) =>
  Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, preset.weights[c] ?? 0])) as Weights;
const presetOf = (weights: Weights) =>
  PRESETS.find((p) => STRATEGY_CATEGORIES.every((c) => (p.weights[c] ?? 0) === weights[c])) ?? null;

// The form: the API's StrategyParams, with every category's weight present (0 = not held).
interface StrategyForm extends Omit<StrategyParams, "weights"> {
  name: string;
  weights: Weights;
}

// The longest a strategy starting in a year can be: up to this year (at least one).
const spanFrom = (startYear: number) => Math.max(1, new Date().getFullYear() - startYear);

// A plain start: a classic mix, a lump sum plus a monthly amount, never rebalanced, run to today,
// with only the bid-ask spread as a cost. Everything past that is an advanced setting.
const DEFAULT_FORM: StrategyForm = {
  name: "",
  weights: presetWeights(PRESETS[1]),
  initialAmount: 10000,
  startYear: 2012,
  years: spanFrom(2012),
  rebalancing: { mode: "none", frequency: "annual", thresholdPct: 5, relativeThresholdPct: 25 },
  contributions: { enabled: true, amount: 200, amountType: "fixed", frequency: "monthly", allocation: "target" },
  withdrawals: { enabled: false, amount: 4, amountType: "percent_of_value", frequency: "annual", startAfterYears: 10 },
  costs: { commissionPct: 0, fixedFee: 0, spreadPct: 0.1 },
};

// A new start keeps the length coherent: one that ran to today still does, a shorter one stays
// as it is unless the new start leaves it too long.
const withStart = (f: StrategyForm, startYear: number): StrategyForm => ({
  ...f,
  startYear,
  years: f.years >= spanFrom(f.startYear) ? spanFrom(startYear) : Math.min(f.years, spanFrom(startYear)),
});

const FREQUENCY_OPTIONS: { value: StrategyFrequency; label: string }[] = [
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every quarter" },
  { value: "semiannual", label: "Every six months" },
  { value: "annual", label: "Every year" },
];

// The three rebalancing choices of the simple view, and the rules each one stands for.
type SimpleRebalance = "never" | "yearly" | "drift";
const SIMPLE_REBALANCE: { value: SimpleRebalance; title: string; text: string; rules: Partial<StrategyForm["rebalancing"]> }[] = [
  { value: "never", title: "Never", text: "Buy and hold: the mix drifts as prices move.", rules: { mode: "none" } },
  { value: "yearly", title: "Once a year", text: "Back to your mix every January.", rules: { mode: "calendar", frequency: "annual" } },
  { value: "drift", title: "When it drifts", text: "Only when a weight strays too far (the 5/25 rule).", rules: { mode: "threshold", thresholdPct: 5, relativeThresholdPct: 25 } },
];
// Which simple choice the rules are, if any (advanced settings can make them something else).
function simpleRebalanceOf(r: StrategyForm["rebalancing"]): SimpleRebalance | null {
  if (r.mode === "none") return "never";
  if (r.mode === "calendar" && r.frequency === "annual") return "yearly";
  if (r.mode === "threshold" && r.thresholdPct === 5 && r.relativeThresholdPct === 25) return "drift";
  return null;
}

/**
 * STRATEGY — build a portfolio strategy and backtest it, opened from Investments. The page asks
 * four plain questions first: what to hold (a ready-made mix, your own weights or — a preview for
 * demo accounts — assets picked from a search, see AssetPicker), how much (a
 * lump sum and an amount every month), from when (it runs to today) and whether to rebalance
 * (never, once a year, or when a weight drifts). Everything else — the period's length, the
 * rebalancing rules in detail, how contributions are made, withdrawals and trading costs — is
 * under Advanced settings, closed until asked for, with a line saying what they're set to. The
 * name fills itself from the mix and the start until it's typed over.
 *
 * "Run backtest" sends it to POST /v1/portfolios/strategies, which plays it on real prices (one
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
  // How the mix is made: a ready-made one, weights of one's own, or (a demo preview) picked assets.
  const [mixMode, setMixMode] = useState<"preset" | "custom" | "assets">("preset");
  const [picks, setPicks] = useState<AssetPick[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = <K extends keyof StrategyForm>(key: K, value: Partial<StrategyForm[K]> | StrategyForm[K]) =>
    setForm((f) => ({ ...f, [key]: typeof value === "object" && !Array.isArray(value) ? { ...(f[key] as object), ...value } : value }));
  // New weights can hold a category with a shorter history: the start moves up to where it begins.
  const setWeights = (weights: Weights) =>
    setForm((f) => withStart({ ...f, weights }, Math.max(f.startYear, earliestStartYear(weights))));

  const preset = presetOf(form.weights);
  // Own weights: opened by Custom, or when the weights match no ready-made mix.
  const showWeights = mixMode === "custom" || (mixMode === "preset" && preset === null);
  // Picked assets decide the categories' weights: each asset's weight goes to its category.
  const setPicksAndWeights = (next: AssetPick[]) => {
    setPicks(next);
    setWeights(Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, next.filter((p) => p.asset.category === c).reduce((s, p) => s + p.weight, 0)])) as Weights);
  };
  const sum = STRATEGY_CATEGORIES.reduce((s, c) => s + form.weights[c], 0);
  const firstYear = earliestStartYear(form.weights);
  const thisYear = new Date().getFullYear();
  const endYear = form.startYear + form.years;
  // Its whole span, this year's months included: the length is as long as it can be.
  const toToday = form.years >= spanFrom(form.startYear);
  const { mode, thresholdPct, relativeThresholdPct } = form.rebalancing;
  const needsBand = mode === "threshold" || mode === "both";
  const simpleRebalance = simpleRebalanceOf(form.rebalancing);
  // The simple view's monthly amount: a fixed sum every month. Anything else is set in Advanced.
  const simpleContribution = form.contributions.amountType === "fixed" && form.contributions.frequency === "monthly";
  // Until it's typed over, the name says what it is.
  const autoName = `${mixMode === "assets" ? "My assets" : mixMode === "preset" && preset ? preset.name : "Custom mix"} from ${form.startYear}`;
  const name = form.name.trim() || autoName;

  const problems = [
    mixMode === "assets" && picks.length === 0 && "Pick at least one asset.",
    sum !== 100 && "The weights must add up to 100%.",
    !(form.initialAmount > 0) && "The starting amount must be more than 0.",
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
      const { weights, ...rest } = form;
      const strategy: StrategyParams = {
        ...rest,
        // The backend stops at January of the last year: one more takes it through this year's
        // months, up to today's prices.
        years: toToday ? Math.min(form.years + 1, MAX_STRATEGY_YEARS) : form.years,
        weights: Object.fromEntries(STRATEGY_CATEGORIES.filter((c) => weights[c] > 0).map((c) => [c, weights[c]])),
      };
      delete (strategy as Partial<StrategyForm>).name;
      const created = await createStrategyPortfolio({ name, strategy });
      onCreated(created.uuid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run this backtest.");
      setSubmitting(false);
    }
  };

  const recap = [
    { label: "Mix", value: mixMode === "assets" ? `${picks.length} ${picks.length === 1 ? "asset" : "assets"}` : mixMode === "preset" && preset ? preset.name : "Custom mix" },
    {
      label: "Invested",
      value: form.contributions.enabled
        ? `${formatCurrency(form.initialAmount, currency, 0)} + ${simpleContribution ? `${formatCurrency(form.contributions.amount, currency, 0)} a month` : "contributions"}`
        : formatCurrency(form.initialAmount, currency, 0),
    },
    { label: "Period", value: toToday ? `${form.startYear} – today` : `${form.startYear} – ${endYear}` },
    { label: "Rebalancing", value: SIMPLE_REBALANCE.find((o) => o.value === simpleRebalance)?.title ?? "Custom rules" },
  ];

  const advancedSummary = [
    toToday ? "runs to today" : `${form.years} ${form.years === 1 ? "year" : "years"}`,
    simpleRebalance === null ? "custom rebalancing" : null,
    !simpleContribution && form.contributions.enabled ? "custom contributions" : null,
    form.withdrawals.enabled ? "withdrawals on" : "no withdrawals",
    `costs ${form.costs.commissionPct}% + ${formatCurrency(form.costs.fixedFee, currency, 0)} a trade, ${form.costs.spreadPct}% spread`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Strategy" />

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50/70 px-4 py-3.5">
        <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
          <History className="h-4 w-4" />
        </span>
        <p className="text-xs text-sky-900/80 leading-relaxed">
          <span className="block text-[13px] font-black text-sky-950">See how a plan would have done</span>
          Pick a mix, an amount and a start: we play it on real past prices and show you the result as a virtual portfolio.
          It&apos;s read only, kept apart from your real portfolios and never counted in your net worth.
        </p>
      </div>

      <div className="space-y-4">
        <Question n={1} title="What do you want to invest in?" text="Pick a ready-made mix, or set your own.">
          <div className="grid grid-cols-1 @md:grid-cols-2 @2xl:grid-cols-3 gap-3">
            {PRESETS.map((p) => (
              <ChoiceCard
                key={p.name}
                selected={mixMode === "preset" && preset?.name === p.name}
                title={p.name}
                text={p.text}
                onClick={() => { setWeights(presetWeights(p)); setMixMode("preset"); }}
              >
                <WeightsBar weights={presetWeights(p)} />
                <WeightsLegend weights={presetWeights(p)} />
              </ChoiceCard>
            ))}
            <ChoiceCard
              selected={showWeights}
              title="Custom"
              text="Choose how much goes into each asset class."
              onClick={() => setMixMode("custom")}
            >
              <WeightsBar weights={form.weights} />
              {showWeights && <WeightsLegend weights={form.weights} />}
            </ChoiceCard>
            {/* Demo only for now: a backtest still trades one ETF per asset class. */}
            {isDemo && (
              <ChoiceCard
                selected={mixMode === "assets"}
                className="@md:col-span-2 @2xl:col-span-3"
                title="Pick assets"
                badge={<PreviewBadge label="Preview" />}
                text="Search stocks, ETFs, bonds or crypto: each counts towards its asset class."
                onClick={() => { setMixMode("assets"); setPicksAndWeights(picks); }}
              >
                <WeightsBar weights={mixMode === "assets" ? form.weights : EMPTY_WEIGHTS} />
              </ChoiceCard>
            )}
          </div>

          {mixMode === "assets" && (
            <AssetPicker picks={picks} onChange={setPicksAndWeights} weights={form.weights} />
          )}

          {showWeights && (
            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/70 p-4 md:p-5 space-y-4">
              <p className="text-[13px] font-black text-slate-900">Your own weights</p>
              <div className="grid grid-cols-1 @xl:grid-cols-2 gap-x-8 gap-y-4">
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
                          className="w-16 h-8 px-2 rounded-lg bg-white border border-slate-200 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-[#C49A3C]/60"
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
              <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-2.5 ${sum === 100 ? "bg-emerald-50" : "bg-amber-50"}`}>
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
          )}
        </Question>

        <Question n={2} title="How much?" text="What you'd have put in at the start, and what you'd have added every month.">
          <div className="grid grid-cols-1 @md:grid-cols-2 gap-4">
            <NumberField label="To start with" suffix={currency} value={form.initialAmount} step={1000} min={0} onChange={(v) => patch("initialAmount", Math.max(0, v))} />
            {simpleContribution ? (
              <NumberField
                label="Every month"
                suffix={currency}
                value={form.contributions.enabled ? form.contributions.amount : 0}
                step={50}
                min={0}
                onChange={(v) => patch("contributions", { amount: Math.max(0, v), enabled: v > 0 })}
              />
            ) : (
              <div>
                <span className={fieldLabel}>Adding</span>
                <button type="button" onClick={() => setAdvancedOpen(true)} className="h-11 w-full px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-sm font-semibold text-slate-600">
                  Set in Advanced settings
                </button>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mt-3">
            The starting amount is invested all at once, on the first day. The monthly amount is your recurring contribution
            (PAC), the same one as in Advanced settings; leave it at 0 for a single lump sum.
          </p>
        </Question>

        <Question n={3} title="Starting when?" text="It starts in January of that year and runs up to today.">
          <div className="@md:max-w-[calc(50%-0.5rem)]">
            <SelectField
              label="Start in"
              value={String(form.startYear)}
              options={Array.from({ length: thisYear - firstYear + 1 }, (_, i) => String(firstYear + i)).map((y) => ({ value: y, label: `January ${y}` }))}
              onChange={(v) => setForm((f) => withStart(f, Number(v)))}
            />
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mt-3">
            {toToday
              ? `That's ${thisYear - form.startYear} ${thisYear - form.startYear === 1 ? "year" : "years"} of real prices, up to today.`
              : `${form.years} ${form.years === 1 ? "year" : "years"}, to January ${endYear}: the length is set in Advanced settings.`}
          </p>
          {firstYear > 2008 && (
            <p className="text-xs text-slate-500 leading-relaxed mt-1">Can&apos;t start before {firstYear}: that&apos;s where the price history of what it holds begins.</p>
          )}
        </Question>

        <Question n={4} title="Keep the mix in balance?" text="As prices move, the mix drifts. Rebalancing sells what grew too big and buys what fell behind.">
          <div className="grid grid-cols-1 @xl:grid-cols-3 gap-3">
            {SIMPLE_REBALANCE.map((o) => (
              <ChoiceCard
                key={o.value}
                selected={simpleRebalance === o.value}
                title={o.title}
                text={o.text}
                onClick={() => patch("rebalancing", o.rules)}
              />
            ))}
          </div>
          {simpleRebalance === null && (
            <p className="text-xs text-slate-500 mt-3">Custom rules are set in Advanced settings.</p>
          )}
        </Question>
      </div>

      {/* Everything past the four questions, closed until asked for. */}
      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="w-full flex items-center justify-between gap-4 p-5 md:px-7 text-left bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0"><SlidersHorizontal className="h-4 w-4" /></span>
            <span className="min-w-0">
              <span className="block text-xl font-black text-slate-900 leading-tight" style={serif}>Advanced settings</span>
              <span className="block text-[13px] text-slate-500 truncate mt-0.5">{advancedSummary}</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 shrink-0">
            {advancedOpen ? "Hide" : "Show"}
            <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </span>
        </button>

        {advancedOpen && (
          <div className="space-y-3">
            <Advanced icon={<CalendarClock className="h-4 w-4" />} title="Period" text="How long it runs from its start.">
              <div className="grid grid-cols-1 @md:grid-cols-2 items-end gap-4">
                <NumberField label="Length" suffix="years" value={form.years} min={1} max={spanFrom(form.startYear)} onChange={(v) => patch("years", clamp(v, 1, spanFrom(form.startYear)))} />
                <p className="text-xs text-slate-500 leading-relaxed @md:pb-3.5">
                  {toToday ? `Runs until today, from January ${form.startYear}.` : `From January ${form.startYear} to January ${endYear}.`}
                </p>
              </div>
            </Advanced>

            <Advanced icon={<Repeat className="h-4 w-4" />} title="Rebalancing rules" text="When the mix is brought back to its weights.">
              <div className="grid grid-cols-2 @2xl:grid-cols-4 gap-3">
                {([
                  { value: "none", title: "Never", text: "Let the weights drift." },
                  { value: "calendar", title: "On a calendar", text: "At fixed dates." },
                  { value: "threshold", title: "On drift", text: "Past a band." },
                  { value: "both", title: "Calendar + drift", text: "Dates, plus the band." },
                ] as { value: RebalanceMode; title: string; text: string }[]).map((o) => (
                  <ChoiceCard key={o.value} selected={mode === o.value} title={o.title} text={o.text} onClick={() => patch("rebalancing", { mode: o.value })} />
                ))}
              </div>
              {mode !== "none" && (
                <div className="grid grid-cols-1 @xl:grid-cols-3 gap-4 mt-4">
                  {(mode === "calendar" || mode === "both") && (
                    <SelectField label="How often" value={form.rebalancing.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("rebalancing", { frequency: v as StrategyFrequency })} />
                  )}
                  {needsBand && (
                    <>
                      <OptionalNumberField label="Absolute band" suffix="± points" value={thresholdPct} onChange={(v) => patch("rebalancing", { thresholdPct: v == null ? null : clamp(v, 0.1, 100) })} />
                      <OptionalNumberField label="Relative band" suffix="± % of weight" value={relativeThresholdPct} onChange={(v) => patch("rebalancing", { relativeThresholdPct: v == null ? null : clamp(v, 0.1, 100) })} />
                    </>
                  )}
                </div>
              )}
              {needsBand && (
                <p className="text-xs text-slate-500 leading-relaxed mt-3">
                  Checked every trading day. With both bands set, crossing either one rebalances. Leave a band empty to turn it off.
                </p>
              )}
            </Advanced>

            <Advanced icon={<PiggyBank className="h-4 w-4" />} title="Contributions" text="How the money added over time goes in (PAC).">
              <FlowCard title="Recurring contribution" enabled={form.contributions.enabled} onToggle={(v) => patch("contributions", { enabled: v })}>
                <AmountFields currency={currency} amount={form.contributions.amount} amountType={form.contributions.amountType} onChange={(v) => patch("contributions", v)} />
                <SelectField label="How often" value={form.contributions.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("contributions", { frequency: v as StrategyFrequency })} />
                <SelectField
                  label="Bought at"
                  value={form.contributions.allocation}
                  options={[{ value: "target", label: "Target weights" }, { value: "current", label: "Current weights" }]}
                  onChange={(v) => patch("contributions", { allocation: v as "current" | "target" })}
                />
              </FlowCard>
            </Advanced>

            <Advanced icon={<ArrowDownToLine className="h-4 w-4" />} title="Withdrawals" text="Money taken out on a schedule, sold from every asset in proportion.">
              <FlowCard title="Scheduled withdrawal" enabled={form.withdrawals.enabled} onToggle={(v) => patch("withdrawals", { enabled: v })}>
                <AmountFields currency={currency} amount={form.withdrawals.amount} amountType={form.withdrawals.amountType} onChange={(v) => patch("withdrawals", v)} />
                <SelectField label="How often" value={form.withdrawals.frequency} options={FREQUENCY_OPTIONS} onChange={(v) => patch("withdrawals", { frequency: v as StrategyFrequency })} />
                <NumberField label="Starting after" suffix="years" value={form.withdrawals.startAfterYears} min={0} onChange={(v) => patch("withdrawals", { startAfterYears: Math.max(0, Math.round(v)) })} />
              </FlowCard>
              <p className="text-xs text-slate-500 leading-relaxed mt-3">
                A percentage is of the portfolio&apos;s value that day, each time: 4% every month is 4% a month, not a year.
              </p>
            </Advanced>

            <Advanced icon={<Coins className="h-4 w-4" />} title="Trading costs" text="What each trade costs. Fund fees are already in the ETFs' prices; taxes aren't modelled yet.">
              <div className="grid grid-cols-1 @xl:grid-cols-3 gap-4">
                <NumberField label="Commission" suffix="% per trade" step={0.05} min={0} value={form.costs.commissionPct} onChange={(v) => patch("costs", { commissionPct: clamp(v, 0, 100) })} />
                <NumberField label="Fixed fee" suffix={`${currency} per trade`} step={0.5} min={0} value={form.costs.fixedFee} onChange={(v) => patch("costs", { fixedFee: Math.max(0, v) })} />
                <NumberField label="Bid-ask spread" suffix="%" step={0.05} min={0} value={form.costs.spreadPct} onChange={(v) => patch("costs", { spreadPct: Math.max(0, v) })} />
              </div>
            </Advanced>
          </div>
        )}
      </section>

      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-7 space-y-5">
        {/* The four answers at a glance, before it runs. */}
        <div className="space-y-3">
          <h3 className="text-xl font-black text-white leading-tight" style={serif}>Your strategy</h3>
          <div className="max-w-md"><WeightsBar weights={form.weights} /></div>
          <ul className="flex flex-wrap gap-2">
            {recap.map((r) => (
              <li key={r.label} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">{r.label}</span>
                <span className="block text-[13px] font-black text-white tabular-nums">{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-5 border-t border-white/10">
          <div className="min-w-0 flex-1 space-y-2">
            <label className="block max-w-md">
              <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">Name</span>
              <input
                value={form.name}
                onChange={(e) => patch("name", e.target.value)}
                placeholder={autoName}
                maxLength={80}
                aria-label="Strategy name"
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-white outline-none placeholder:text-stone-400 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
              />
            </label>
            <p className="text-[13px] text-stone-400">
              {isDemo
                ? "Backtests can't be run on a demo account."
                : valid
                  ? "Creates a virtual portfolio and opens it. Its figures take a few minutes to come in."
                  : problems[0]}
            </p>
            {error && <p className="text-[13px] font-bold text-rose-400">{error}</p>}
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
      </div>

      <p className="text-[11px] text-slate-400 text-center max-w-xl mx-auto leading-relaxed">
        A backtest shows how rules would have played out in the past. Past returns don&apos;t predict future ones. Not investment advice.
      </p>
    </div>
  );
}

/**
 * One of the four questions, a card of its own: its number, wording and a line on the left, its
 * answers on the right (stacked on narrow screens), centred on the heading's height when shorter.
 * The answers' grids follow their own width.
 */
function Question({ n, title, text, children }: { n: number; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center gap-5 lg:gap-8">
      <header className="flex lg:flex-col items-start lg:self-start gap-3">
        <span className="w-9 h-9 rounded-full bg-[#C49A3C] text-white text-sm font-black flex items-center justify-center shrink-0">{n}</span>
        <div className="min-w-0">
          <h3 className="text-xl font-black text-slate-900 leading-tight" style={serif}>{title}</h3>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{text}</p>
        </div>
      </header>
      <div className="@container min-w-0">{children}</div>
    </section>
  );
}

/**
 * One group of advanced settings, a card laid out like a question's (heading left, fields right),
 * a step quieter: an icon for the number, no shadow, a smaller title.
 */
function Advanced({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl border border-slate-200 p-5 md:p-7 grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] lg:items-center gap-4 lg:gap-8">
      <header className="flex lg:flex-col items-start lg:self-start gap-3">
        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{icon}</span>
        <div className="min-w-0">
          <h4 className="text-lg font-black text-slate-900 leading-tight" style={serif}>{title}</h4>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{text}</p>
        </div>
      </header>
      <div className="@container min-w-0">{children}</div>
    </section>
  );
}

/** A choice among a few: a card with a title and a line, gold when picked. */
function ChoiceCard({ selected, title, badge, text, onClick, className = "", children }: {
  selected: boolean;
  className?: string;
  title: string;
  badge?: React.ReactNode;
  text: string;
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${className} text-left rounded-2xl border-2 p-3.5 transition-colors flex flex-col gap-2 ${
        selected ? "border-[#C49A3C] bg-[#C49A3C]/5" : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <span>
        <span className="flex items-center gap-2 text-[13px] font-black text-slate-900">{title}{badge}</span>
        <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{text}</span>
      </span>
      {/* At the card's foot, so the bars of a row line up whatever the text's length. */}
      {children && <span className="mt-auto flex flex-col gap-1.5">{children}</span>}
    </button>
  );
}

/** A mix's asset classes with their share, under its bar: "Equity 60% · Bonds 40%". */
function WeightsLegend({ weights }: { weights: Weights }) {
  const held = STRATEGY_CATEGORIES.filter((c) => weights[c] > 0);
  if (held.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-bold text-slate-500 tabular-nums">
      {held.map((c) => (
        <span key={c} className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />
          {STRATEGY_CATEGORY_LABELS[c]} {weights[c]}%
        </span>
      ))}
    </span>
  );
}

const EMPTY_WEIGHTS = Object.fromEntries(STRATEGY_CATEGORIES.map((c) => [c, 0])) as Weights;

// One asset picked for the mix, and how much of it.
interface AssetPick {
  asset: CatalogAsset;
  weight: number;
}

/**
 * ASSET PICKER (preview, demo accounts) — the mix made of assets rather than asset classes: a
 * search over a sample catalogue (lib/mock/assets), each result showing its asset class, then the
 * picked assets with their weight. What goes into each asset class is the sum of its assets'
 * weights, shown on the bar under them; the backtest still trades one ETF per class.
 */
function AssetPicker({ picks, onChange, weights }: { picks: AssetPick[]; onChange: (picks: AssetPick[]) => void; weights: Weights }) {
  const [query, setQuery] = useState("");
  const picked = new Set(picks.map((p) => p.asset.ticker));
  const results = searchAssets(query, picked);
  const total = picks.reduce((s, p) => s + p.weight, 0);

  const add = (asset: CatalogAsset) => {
    // A new asset takes what's left of the 100%.
    onChange([...picks, { asset, weight: Math.max(0, 100 - total) }]);
    setQuery("");
  };

  return (
    <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200/70 p-4 md:p-5 space-y-4">
      <p className="text-[13px] font-black text-slate-900">Your assets</p>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or ticker — e.g. VWCE, Apple, gold, Bitcoin"
          aria-label="Search assets"
          className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        {results.length > 0 && (
          <ul className="absolute z-20 left-0 right-0 mt-1.5 p-1.5 bg-white rounded-xl border border-slate-200 shadow-xl">
            {results.map((a) => (
              <li key={a.ticker}>
                <button
                  type="button"
                  onClick={() => add(a)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="text-[13px] font-black text-slate-900">{a.ticker}</span>
                    <span className="text-xs text-slate-500"> · {a.name}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <CategoryChip category={a.category} />
                    <Plus className="h-4 w-4 text-slate-400" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim() !== "" && results.length === 0 && (
          <p className="text-xs text-slate-400 mt-2">Nothing in the sample catalogue matches &ldquo;{query}&rdquo;.</p>
        )}
      </div>

      {picks.length === 0 ? (
        <p className="text-sm text-slate-400">Search for an asset above to add it to the mix.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white border border-slate-200/70 px-3">
          {picks.map((p) => (
            <li key={p.asset.ticker} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-slate-900">{p.asset.ticker}</span>
                <span className="block text-xs text-slate-500 truncate">{p.asset.name} · {p.asset.kind}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <CategoryChip category={p.asset.category} />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={p.weight}
                  onChange={(e) => onChange(picks.map((x) => (x === p ? { ...x, weight: clamp(Number(e.target.value), 0, 100) } : x)))}
                  aria-label={`${p.asset.ticker} weight`}
                  className="w-16 h-8 px-2 rounded-lg bg-white border border-slate-200 text-right text-sm font-black tabular-nums text-slate-900 outline-none focus:border-[#C49A3C]/60"
                />
                <span className="text-xs font-bold text-slate-400">%</span>
                <button type="button" onClick={() => onChange(picks.filter((x) => x !== p))} aria-label={`Remove ${p.asset.ticker}`} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                  <X className="h-4 w-4" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {picks.length > 0 && (
        <div className="space-y-2">
          <WeightsBar weights={weights} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <WeightsLegend weights={weights} />
            <span className={`text-xs font-black tabular-nums ${total === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              Total {total}%{total === 100 ? " ✓" : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** An asset class as a small coloured pill. */
function CategoryChip({ category }: { category: StrategyCategory }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap" style={{ background: `${color}14`, color }}>
      {STRATEGY_CATEGORY_LABELS[category]}
    </span>
  );
}

/** A mix as one thin bar, each asset class in its colour. */
function WeightsBar({ weights }: { weights: Weights }) {
  return (
    <span className="flex h-1.5 rounded-full overflow-hidden bg-slate-100">
      {STRATEGY_CATEGORIES.map((c) => (
        <span key={c} style={{ width: `${Math.min(weights[c], 100)}%`, background: CATEGORY_COLORS[c] }} />
      ))}
    </span>
  );
}

function FlowCard({ title, enabled, onToggle, children }: { title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 transition-colors ${enabled ? "border-[#C49A3C]/40 bg-[#C49A3C]/5" : "border-slate-200"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-black text-slate-900">{title}</span>
        <Toggle checked={enabled} onChange={onToggle} label={title} />
      </div>
      {enabled && <div className="grid grid-cols-1 @md:grid-cols-2 gap-3 mt-4">{children}</div>}
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
