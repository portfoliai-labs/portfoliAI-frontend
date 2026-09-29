// models/Strategy.ts
// Matches StrategyParams (the `strategy` of POST /v1/portfolios/strategies, and what GET
// /v1/portfolios/{p}/strategy returns): the rules a strategy's backtest plays month by month on
// real prices — one listed proxy per macro category (equity SWDA, bonds XGLE, real estate IWDP,
// commodities EXXY, cash XEON, crypto BTC-EUR), on adjusted close so distributions are in the
// price. The backtest is a virtual portfolio (Portfolio.isVirtual): the POST answers at once with
// it empty, a background job then generates its transactions up to the day it was created, and
// its history is built like any portfolio's (its /insights/* answer null or isStale until then).
// After that it just holds: no further contributions or rebalancing.
//
// Cash flows and calendar rebalancing act on the first trading day of each month, in this order:
// contribution, withdrawal, rebalance. The drift band is checked every trading day. Amounts are in
// the user's reference currency. Commission and fixed fee show up in the trading costs, not in the
// returns; the spread does reduce the returns. Fund fees (TER) are already in the ETFs' prices, and
// taxes aren't modelled.

type StrategyCategory = "equity" | "bonds" | "real_estate" | "commodities" | "cash" | "crypto";
type StrategyFrequency = "monthly" | "quarterly" | "semiannual" | "annual";
type RebalanceMode = "none" | "calendar" | "threshold" | "both";
// `percent_of_value`: a % of the portfolio's value that day, per occurrence (monthly 4 = 4% every
// month, not per year), at most 100.
type CashFlowAmountType = "fixed" | "percent_of_value";

interface StrategyRebalancing {
  mode: RebalanceMode;
  frequency: StrategyFrequency;
  // Band around each target weight, in percentage points (absolute) or as a % of that weight
  // (relative). With both set, crossing either triggers (the 5/25 rule); `threshold` and `both`
  // need at least one.
  thresholdPct: number | null;
  relativeThresholdPct: number | null;
}

interface StrategyContributions {
  enabled: boolean;
  amount: number;
  amountType: CashFlowAmountType;
  frequency: StrategyFrequency;
  // `current`: bought at the weights the portfolio holds that day; `target`: at the target weights.
  allocation: "current" | "target";
}

interface StrategyWithdrawals {
  enabled: boolean;
  amount: number;
  amountType: CashFlowAmountType;
  frequency: StrategyFrequency;
  // Withdrawals sell every category in proportion, from this many years into the run.
  startAfterYears: number;
}

interface StrategyCosts {
  commissionPct: number;
  // Per trade, in the reference currency.
  fixedFee: number;
  // Bid-ask %, half above the price to buy, half below to sell.
  spreadPct: number;
}

interface StrategyParams {
  // Percent of the portfolio, summing to 100; a category at 0 or left out isn't held.
  weights: Partial<Record<StrategyCategory, number>>;
  initialAmount: number;
  // The run starts in January of this year: not before STRATEGY_FIRST_YEAR of any held category,
  // nor in the future.
  startYear: number;
  // 1–40; the run stops at today if that comes first.
  years: number;
  rebalancing: StrategyRebalancing;
  contributions: StrategyContributions;
  withdrawals: StrategyWithdrawals;
  costs: StrategyCosts;
}

// Body of POST /v1/portfolios/strategies. `name`: 1–80 chars, unique among the user's portfolios
// (409 otherwise); a strategy that doesn't add up is a 422.
interface StrategyPortfolioPayload {
  name: string;
  strategy: StrategyParams;
}

const STRATEGY_CATEGORIES: StrategyCategory[] = ["equity", "bonds", "real_estate", "commodities", "cash", "crypto"];

const STRATEGY_CATEGORY_LABELS: Record<StrategyCategory, string> = {
  equity: "Equity",
  bonds: "Bonds",
  real_estate: "Real estate",
  commodities: "Commodities",
  cash: "Cash",
  crypto: "Crypto",
};

// The first January each category's proxy has a full month of prices behind.
const STRATEGY_FIRST_YEAR: Record<StrategyCategory, number> = {
  equity: 2010,
  bonds: 2008,
  real_estate: 2008,
  commodities: 2008,
  cash: 2008,
  crypto: 2015,
};

// The listed instrument each category is traded through.
const STRATEGY_PROXIES: Record<StrategyCategory, string> = {
  equity: "SWDA · iShares Core MSCI World",
  bonds: "XGLE · Xtrackers Eurozone Government Bond",
  real_estate: "IWDP · iShares Developed Markets Property Yield",
  commodities: "EXXY · iShares Diversified Commodity Swap",
  cash: "XEON · Xtrackers EUR Overnight Rate Swap",
  crypto: "BTC-EUR · Bitcoin",
};

const MAX_STRATEGY_YEARS = 40;

/** The earliest year a strategy holding these weights can start in. */
function earliestStartYear(weights: StrategyParams["weights"]): number {
  const held = STRATEGY_CATEGORIES.filter((c) => (weights[c] ?? 0) > 0);
  return Math.max(Math.min(...Object.values(STRATEGY_FIRST_YEAR)), ...held.map((c) => STRATEGY_FIRST_YEAR[c]));
}

export type {
  StrategyCategory, StrategyFrequency, RebalanceMode, CashFlowAmountType, StrategyRebalancing,
  StrategyContributions, StrategyWithdrawals, StrategyCosts, StrategyParams, StrategyPortfolioPayload,
};
export {
  STRATEGY_CATEGORIES, STRATEGY_CATEGORY_LABELS, STRATEGY_FIRST_YEAR, STRATEGY_PROXIES, MAX_STRATEGY_YEARS,
  earliestStartYear,
};
