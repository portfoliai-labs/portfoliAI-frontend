// lib/mock/strategy.ts
//
// The Strategy preview's backtest (components/preview/StrategyBuilder). It runs a strategy's
// rules month by month — the initial purchase, rebalancing, recurring contributions (PAC) or
// withdrawals, and the costs of each trade — over a SYNTHETIC market: each macro category's
// returns are drawn from a seeded generator with a shared market factor and a few scripted
// shocks (2008, 2020, 2022), not from real price history. Good enough to show how the rules
// behave; not a real backtest.

import { MACRO_CATEGORIES, type MacroCategory } from "./community";
import { normal, seeded } from "./random";

export type Frequency = "monthly" | "quarterly" | "semiannual" | "annual";
export type RebalanceMode = "none" | "calendar" | "threshold" | "both";

export interface StrategyConfig {
  name: string;
  weights: Record<MacroCategory, number>; // percent of the portfolio, summing to 100
  initialAmount: number;
  startYear: number;
  years: number;
  rebalancing: { mode: RebalanceMode; frequency: Frequency; thresholdPct: number };
  contributions: { enabled: boolean; amount: number; frequency: Exclude<Frequency, "semiannual"> };
  withdrawals: { enabled: boolean; amount: number; frequency: Exclude<Frequency, "semiannual">; startAfterYears: number };
  costs: { commissionPct: number; fixedFee: number; spreadPct: number; terPct: number; capitalGainsTaxPct: number; stampDutyPct: number };
}

// Yearly mean return, yearly volatility and exposure to the shared market factor.
export const CATEGORY_ASSUMPTIONS: Record<MacroCategory, { mean: number; vol: number; beta: number }> = {
  Equity: { mean: 0.075, vol: 0.16, beta: 1 },
  Bonds: { mean: 0.028, vol: 0.06, beta: -0.15 },
  "Real estate": { mean: 0.055, vol: 0.15, beta: 0.7 },
  Commodities: { mean: 0.035, vol: 0.17, beta: 0.25 },
  Cash: { mean: 0.018, vol: 0.006, beta: 0 },
  Crypto: { mean: 0.28, vol: 0.7, beta: 0.5 },
};

export const FIRST_YEAR = 2005;
export const LAST_YEAR = 2026;

const FREQUENCY_MONTHS: Record<Frequency, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

// Scripted shocks on top of the random draws, as [year, month (0-based), market factor, bond move].
const SHOCKS: [number, number, number, number][] = [
  [2008, 8, -2.4, 0.4], [2008, 9, -3.2, 0.6], [2008, 10, -1.6, 0.3], [2009, 1, -1.8, 0], [2009, 3, 2.2, 0],
  [2011, 7, -2.0, 0.3], [2020, 1, -1.5, 0.2], [2020, 2, -3.4, 0.4], [2020, 3, 2.6, 0], [2020, 4, 1.2, 0],
  [2022, 2, -0.8, -1.4], [2022, 5, -1.9, -1.8], [2022, 8, -1.7, -1.9], [2022, 10, 1.4, 0.8],
];

/** One synthetic history for every category, from Jan 2005: monthly returns as fractions. */
const MARKET: Record<MacroCategory, number[]> = (() => {
  const months = (LAST_YEAR - FIRST_YEAR + 1) * 12;
  const rand = seeded(20050101);
  const out = Object.fromEntries(MACRO_CATEGORIES.map((c) => [c, [] as number[]])) as Record<MacroCategory, number[]>;
  for (let m = 0; m < months; m++) {
    const year = FIRST_YEAR + Math.floor(m / 12);
    const shock = SHOCKS.find(([y, mo]) => y === year && mo === m % 12);
    const factor = shock ? shock[2] : normal(rand);
    for (const c of MACRO_CATEGORIES) {
      const { mean, vol, beta } = CATEGORY_ASSUMPTIONS[c];
      const own = normal(rand);
      const mix = beta * factor + Math.sqrt(Math.max(0, 1 - beta * beta)) * own;
      let r = mean / 12 + (vol / Math.sqrt(12)) * mix;
      if (c === "Bonds" && shock) r += shock[3] * 0.012;
      out[c].push(Math.max(-0.6, r));
    }
  }
  return out;
})();

export interface BacktestPoint {
  date: string; // "YYYY-MM"
  value: number;
  contributed: number; // money put in, net of money taken out
  weights: Record<MacroCategory, number>; // percent, at month end
}

export interface RebalanceEvent {
  date: string;
  reason: "Calendar" | "Threshold";
  turnover: number; // total bought + sold
  cost: number; // fees, spread and tax paid on the trades
  maxDrift: number; // largest gap from target before trading, in points
}

export interface BacktestResult {
  points: BacktestPoint[];
  events: RebalanceEvent[];
  finalValue: number;
  totalContributed: number;
  totalWithdrawn: number;
  cagrPct: number; // time-weighted, per year
  volatilityPct: number;
  maxDrawdownPct: number;
  bestYearPct: number;
  worstYearPct: number;
  costs: { commissions: number; spread: number; ter: number; stampDuty: number; taxes: number };
}

const dateOf = (monthIndex: number) => `${FIRST_YEAR + Math.floor(monthIndex / 12)}-${String((monthIndex % 12) + 1).padStart(2, "0")}`;

/** Runs `config` over its period. `overrides` lets the page compare variants of the same plan. */
export function runBacktest(config: StrategyConfig, overrides?: { noRebalance?: boolean; noCosts?: boolean }): BacktestResult {
  const cats = MACRO_CATEGORIES.filter((c) => config.weights[c] > 0);
  const target = Object.fromEntries(cats.map((c) => [c, config.weights[c] / 100])) as Record<MacroCategory, number>;
  const k = overrides?.noCosts
    ? { commissionPct: 0, fixedFee: 0, spreadPct: 0, terPct: 0, capitalGainsTaxPct: 0, stampDutyPct: 0 }
    : config.costs;
  const mode = overrides?.noRebalance ? "none" : config.rebalancing.mode;

  const holdings = Object.fromEntries(cats.map((c) => [c, 0])) as Record<MacroCategory, number>;
  const basis = { ...holdings };
  const costs = { commissions: 0, spread: 0, ter: 0, stampDuty: 0, taxes: 0 };
  let contributed = 0;
  let withdrawn = 0;

  const total = () => cats.reduce((s, c) => s + holdings[c], 0);
  const weightsNow = () => {
    const t = total() || 1;
    return Object.fromEntries(MACRO_CATEGORIES.map((c) => [c, ((holdings[c] ?? 0) / t) * 100])) as Record<MacroCategory, number>;
  };

  // A trade's frictions: percent commission, half the bid-ask spread, the fixed fee.
  const friction = (amount: number) => {
    const commission = amount * (k.commissionPct / 100) + (amount > 0 ? k.fixedFee : 0);
    const spread = amount * (k.spreadPct / 100) / 2;
    costs.commissions += commission;
    costs.spread += spread;
    return commission + spread;
  };
  const buy = (c: MacroCategory, amount: number) => {
    if (amount <= 0) return 0;
    const cost = friction(amount);
    holdings[c] += amount - cost;
    basis[c] += amount - cost;
    return cost;
  };
  // Sells `amount` of c; returns the cash it frees after fees and capital gains tax.
  const sell = (c: MacroCategory, amount: number) => {
    if (amount <= 0 || holdings[c] <= 0) return { cash: 0, cost: 0 };
    const fraction = Math.min(1, amount / holdings[c]);
    const basisSold = basis[c] * fraction;
    const gain = Math.max(0, amount - basisSold);
    const tax = gain * (k.capitalGainsTaxPct / 100);
    costs.taxes += tax;
    holdings[c] -= amount;
    basis[c] -= basisSold;
    const cost = friction(amount) + tax;
    return { cash: amount - cost, cost };
  };
  const buyAtTarget = (cash: number) => {
    let cost = 0;
    for (const c of cats) cost += buy(c, cash * target[c]);
    return cost;
  };

  const start = (config.startYear - FIRST_YEAR) * 12;
  // Up to September 2026, the last month of the synthetic history that's "happened".
  const months = Math.min(config.years * 12, (LAST_YEAR - config.startYear) * 12 + 8);

  // Initial purchase: the whole amount, at the start of the period, at the target weights.
  buyAtTarget(config.initialAmount);
  contributed += config.initialAmount;

  const points: BacktestPoint[] = [{ date: dateOf(start), value: total(), contributed, weights: weightsNow() }];
  const events: RebalanceEvent[] = [];
  const monthlyReturns: number[] = [];
  let twrIndex = 1;
  let peak = 1;
  let maxDrawdown = 0;
  const yearly = new Map<number, number>();

  for (let i = 1; i <= months; i++) {
    const m = start + i;
    const before = total();
    for (const c of cats) holdings[c] *= 1 + MARKET[c][m];
    // Fund fees accrue monthly.
    for (const c of cats) {
      const fee = holdings[c] * (k.terPct / 100 / 12);
      holdings[c] -= fee;
      costs.ter += fee;
    }
    const r = before > 0 ? total() / before - 1 : 0;
    monthlyReturns.push(r);
    twrIndex *= 1 + r;
    peak = Math.max(peak, twrIndex);
    maxDrawdown = Math.min(maxDrawdown, twrIndex / peak - 1);
    const year = FIRST_YEAR + Math.floor(m / 12);
    yearly.set(year, (1 + (yearly.get(year) ?? 0)) * (1 + r) - 1);

    // Stamp duty on the year-end value (Italy's 0.2% imposta di bollo).
    if (m % 12 === 11) {
      const t = total();
      const duty = t * (k.stampDutyPct / 100);
      for (const c of cats) holdings[c] -= duty * (holdings[c] / t);
      costs.stampDuty += duty;
    }

    const due = (freq: Frequency) => i % FREQUENCY_MONTHS[freq] === 0;
    if (config.contributions.enabled && due(config.contributions.frequency)) {
      buyAtTarget(config.contributions.amount);
      contributed += config.contributions.amount;
    }
    if (config.withdrawals.enabled && i > config.withdrawals.startAfterYears * 12 && due(config.withdrawals.frequency)) {
      const t = total();
      const gross = Math.min(t, config.withdrawals.amount);
      // Taken from every category in proportion, so it doesn't move the weights.
      for (const c of cats) sell(c, gross * (holdings[c] / t));
      withdrawn += gross;
      contributed -= gross;
    }

    // Rebalance: back to target when the calendar says so, or when a weight drifts past the band.
    const w = weightsNow();
    const maxDrift = Math.max(...cats.map((c) => Math.abs(w[c] - config.weights[c])));
    const calendar = (mode === "calendar" || mode === "both") && due(config.rebalancing.frequency);
    const threshold = (mode === "threshold" || mode === "both") && maxDrift > config.rebalancing.thresholdPct;
    if ((calendar || threshold) && maxDrift > 0.05) {
      const t = total();
      let turnover = 0;
      let cost = 0;
      let cash = 0;
      // Sell what's overweight (the winners) first, then buy what's underweight with the proceeds.
      for (const c of cats) {
        const excess = holdings[c] - t * target[c];
        if (excess > 0) {
          const res = sell(c, excess);
          cash += res.cash;
          cost += res.cost;
          turnover += excess;
        }
      }
      const gaps = cats.map((c) => ({ c, gap: Math.max(0, t * target[c] - holdings[c]) }));
      const gapTotal = gaps.reduce((s, g) => s + g.gap, 0) || 1;
      for (const { c, gap } of gaps) {
        const amount = cash * (gap / gapTotal);
        cost += buy(c, amount);
        turnover += amount;
      }
      events.push({ date: dateOf(m), reason: calendar ? "Calendar" : "Threshold", turnover, cost, maxDrift });
    }

    points.push({ date: dateOf(m), value: total(), contributed, weights: weightsNow() });
  }

  const mean = monthlyReturns.reduce((s, r) => s + r, 0) / (monthlyReturns.length || 1);
  const variance = monthlyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(1, monthlyReturns.length - 1);
  const years = [...yearly.values()];

  return {
    points,
    events,
    finalValue: total(),
    totalContributed: contributed + withdrawn,
    totalWithdrawn: withdrawn,
    cagrPct: (twrIndex ** (12 / Math.max(1, months)) - 1) * 100,
    volatilityPct: Math.sqrt(variance) * Math.sqrt(12) * 100,
    maxDrawdownPct: maxDrawdown * 100,
    bestYearPct: Math.max(...years) * 100,
    worstYearPct: Math.min(...years) * 100,
    costs,
  };
}

export const PRESETS: { name: string; weights: Partial<Record<MacroCategory, number>> }[] = [
  { name: "Conservative", weights: { Equity: 25, Bonds: 60, Cash: 15 } },
  { name: "Balanced 60/40", weights: { Equity: 60, Bonds: 40 } },
  { name: "Growth", weights: { Equity: 80, Bonds: 10, "Real estate": 10 } },
  { name: "All-weather", weights: { Equity: 30, Bonds: 55, Commodities: 15 } },
  { name: "Core + crypto", weights: { Equity: 75, Bonds: 10, Crypto: 10, Cash: 5 } },
];

export const DEFAULT_STRATEGY: StrategyConfig = {
  name: "My balanced strategy",
  weights: { Equity: 60, Bonds: 30, "Real estate": 5, Commodities: 5, Cash: 0, Crypto: 0 },
  initialAmount: 20000,
  startYear: 2012,
  years: 14,
  rebalancing: { mode: "both", frequency: "annual", thresholdPct: 5 },
  contributions: { enabled: true, amount: 300, frequency: "monthly" },
  withdrawals: { enabled: false, amount: 500, frequency: "monthly", startAfterYears: 10 },
  costs: { commissionPct: 0.1, fixedFee: 2, spreadPct: 0.1, terPct: 0.2, capitalGainsTaxPct: 26, stampDutyPct: 0.2 },
};
