// models/PortfolioData.ts
//
// Types for the ten precomputed-analytics endpoints under GET /v1/portfolio/* (holdings,
// exposure/sector, exposure/region, performance, volatility, categories, dividends,
// trading-costs, benchmark, risk-model). Mirrors the backend's generated
// doc/frontend/portfolio-data-api.d.ts — regenerate from there if the routes change.
//
// Conventions shared by all of them:
// - Every response is HTTP 200 and can be `null` (nothing computed for this user yet), so the
//   service returns `T | null`.
// - Every key is always present; a value that doesn't apply is `null` (never NaN, never a
//   missing key), so those fields are typed `T | null`, not optional.
// - `*Pct` is already a percentage (5.0 = 5%), `*Bps` is in basis points, and beta / sharpe /
//   informationRatio / riskAdjustedReturn are plain ratios. Series are parallel arrays.
// - `isStale: true` means the user edited transactions after the numbers were computed: keep
//   showing them, with an "updating" hint. holdings / exposure carry neither status nor isStale.

import type { Portfolio } from "./Portfolio";

// "unavailable" only ever appears on /risk-model.
type AnalyticsStatus = "ok" | "insufficient_history" | "unavailable";

type WeightGapDirection = "overweight" | "underweight" | "in_line";

// Why /risk-model is "unavailable" (set only with that status, null otherwise):
// - too_few_assets: fewer than two held assets share at least 30 days of history;
// - no_positive_returns: every asset's trailing mean return is at or below the risk-free
//   rate (0), so no max-Sharpe allocation exists;
// - solver_failed: the optimiser did not converge.
type RiskModelUnavailableReason = "too_few_assets" | "no_positive_returns" | "solver_failed";

// Two parallel arrays, ascending by date. `values` are in the unit stated where the series
// is used (percent for the return / drawdown / volatility curves, money for cumulativeCosts).
interface TimeSeries {
  dates: string[];
  values: number[];
}

// ---------- holdings ----------

// assetClass is Yahoo Finance's quoteType, uppercase and not normalised (EQUITY, ETF,
// MUTUALFUND, CRYPTOCURRENCY, UNKNOWN — but not a closed set), so anything that styles it
// needs a fallback.
interface PortfolioHoldingResponse {
  assetId: string;
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  quantity: number;
  currentPrice: number;
  marketValue: number;
  weightPct: number;
  avgCost: number;
  costBasis: number;
  unrealizedPnl: number;
  roiPct: number;
}

interface HoldingsResponse {
  currency: string;
  computedAt: string;
  holdings: PortfolioHoldingResponse[];
}

// ---------- exposure ----------

// label is a GICS sector (sector endpoint) or North America / Europe / Pacific / Emerging
// Markets (region endpoint), plus "Unknown" for assets with no known breakdown so entries
// always add up to the full held weight. A name the provider spells differently passes
// through unchanged.
interface ExposureEntryResponse {
  label: string;
  weightPct: number;
}

interface ExposureResponse {
  computedAt: string;
  entries: ExposureEntryResponse[];
}

// ---------- performance ----------

// `period` is "1 Month", "6 Months", "1 Year", "3 Years" or "Inception"; a horizon longer than
// the portfolio's history isn't returned at all. windowDays counts the calendar days it covers.
interface HorizonEntry {
  period: string;
  windowDays: number;
  totalReturnPct: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  riskAdjustedReturn: number | null;
}

interface MonthlyReturnEntry {
  month: string;
  totalReturnPct: number | null;
  volatilityPct: number | null;
  maxDrawdownPct: number | null;
  riskAdjustedReturn: number | null;
}

interface AnnualReturnEntry {
  year: number;
  returnPct: number | null;
}

interface MonthReturn {
  month: string;
  returnPct: number;
}

interface PerformanceResponse {
  status: AnalyticsStatus;
  lifespanDays: number;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  maxDrawdownPct: number | null;
  horizons: HorizonEntry[];
  monthly: MonthlyReturnEntry[];
  annual: AnnualReturnEntry[];
  bestMonth: MonthReturn | null;
  worstMonth: MonthReturn | null;
  cumulativeReturnPct: TimeSeries | null;
  drawdownPct: TimeSeries | null;
  computedAt: string;
  isStale: boolean;
}

// ---------- volatility ----------

interface RiskEventEntry {
  startDate: string;
  endDate: string;
  annualizedVolatilityPct: number | null;
  cumulativeReturnPct: number | null;
  assetNames: string[];
}

interface VolatilityResponse {
  status: AnalyticsStatus;
  annualizedVolatilityPct: number | null;
  rollingWindowDays: number | null;
  rollingVolatilityPct: TimeSeries | null;
  riskEvents: RiskEventEntry[];
  computedAt: string;
  isStale: boolean;
}

// ---------- categories ----------

// volatilityContributionPct is the class's contribution to the portfolio's volatility, not
// the volatility of holding it alone — the classes don't add up to the portfolio total.
interface CategoryEntry {
  assetClass: string;
  assetCount: number;
  marketValue: number;
  weightPct: number;
  costBasis: number;
  unrealizedPnl: number;
  roiPct: number | null;
  totalReturnPct: number | null;
  maxDrawdownPct: number | null;
  volatilityContributionPct: number | null;
  volatilityContributionRatio: number | null;
}

interface CategoriesResponse {
  currency: string;
  categories: CategoryEntry[];
  computedAt: string;
  isStale: boolean;
}

// ---------- dividends ----------

interface DividendAssetEntry {
  assetId: string;
  ticker: string | null;
  name: string;
  trailing12MIncome: number;
  prior12MIncome: number;
  lifetimeIncome: number;
  marketValue: number;
  costBasis: number;
  yieldPct: number | null;
  yieldOnCostPct: number | null;
  growthYoyPct: number | null;
}

// Two yields: wholePortfolioYieldPct is "what does the portfolio yield" (income over the
// whole portfolio); portfolioYieldPct only counts the holdings that pay.
interface DividendsResponse {
  currency: string;
  totalLifetimeIncome: number;
  totalTrailing12MIncome: number;
  totalPrior12MIncome: number;
  portfolioYieldPct: number | null;
  wholePortfolioYieldPct: number | null;
  payersShareOfPortfolioPct: number | null;
  portfolioYieldOnCostPct: number | null;
  portfolioGrowthYoyPct: number | null;
  byAsset: DividendAssetEntry[];
  computedAt: string;
  isStale: boolean;
}

// ---------- trading costs ----------

interface PlatformCostEntry {
  platform: string;
  transactionCount: number;
  tradedVolume: number;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  costBps: number | null;
  avgCostPerTrade: number | null;
  shareOfTotalPct: number | null;
}

interface AssetCostEntry {
  assetId: string;
  ticker: string | null;
  name: string;
  broker: string;
  transactionCount: number;
  tradedVolume: number;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  costBps: number | null;
}

// cumulativeCosts values are money in `currency`, not percent. annualizedCostDragPct is
// under 0.10 = negligible, over 0.50 = material (the PDF report's own thresholds).
interface TradingCostsResponse {
  currency: string;
  explicitFees: number;
  implicitCosts: number;
  totalCosts: number;
  totalVolume: number;
  totalTransactions: number;
  costRatioBps: number | null;
  costRatioPct: number | null;
  avgCostPerTrade: number | null;
  implicitCostWeightPct: number | null;
  costToEquityPct: number | null;
  annualizedCostDragPct: number | null;
  byPlatform: PlatformCostEntry[];
  byAsset: AssetCostEntry[];
  cumulativeCosts: TimeSeries | null;
  computedAt: string;
  isStale: boolean;
}

// ---------- benchmark ----------

// components also lists the proxies of closed positions, at weightPct 0 — filter to
// weightPct > 0 to show only the current basket.
interface BenchmarkComponentEntry {
  ticker: string | null;
  name: string;
  weightPct: number | null;
}

// Both cumulative curves are in percent, base 0, and share the same dates.
interface BenchmarkResponse {
  status: AnalyticsStatus;
  components: BenchmarkComponentEntry[];
  tradingDays: number | null;
  yearsCovered: number | null;
  portfolioTotalReturnPct: number | null;
  benchmarkTotalReturnPct: number | null;
  portfolioAnnualizedReturnPct: number | null;
  benchmarkAnnualizedReturnPct: number | null;
  excessReturnPct: number | null;
  portfolioVolatilityPct: number | null;
  benchmarkVolatilityPct: number | null;
  portfolioMaxDrawdownPct: number | null;
  benchmarkMaxDrawdownPct: number | null;
  beta: number | null;
  alphaPct: number | null;
  trackingErrorPct: number | null;
  informationRatio: number | null;
  sharpeRatioDiff: number | null;
  recoveryRatio: number | null;
  winRatePct: number | null;
  timeOutperformingPct: number | null;
  outperformed: boolean | null;
  portfolioCumulativeReturnPct: TimeSeries | null;
  benchmarkCumulativeReturnPct: TimeSeries | null;
  computedAt: string;
  isStale: boolean;
}

// ---------- risk model ----------

interface RiskAssetEntry {
  ticker: string;
  name: string;
  expectedReturnPct: number | null;
  volatilityPct: number | null;
}

interface PortfolioWeightEntry {
  ticker: string;
  name: string;
  weightPct: number;
}

// expectedReturnPct is a trailing historical mean, not a forecast — anything showing it says
// "based on past returns" and avoids recommendation wording.
interface RiskPortfolioEntry {
  expectedReturnPct: number | null;
  volatilityPct: number | null;
  sharpeRatio: number | null;
  weights: PortfolioWeightEntry[];
}

interface FrontierPointEntry {
  volatilityPct: number | null;
  expectedReturnPct: number | null;
}

interface WeightGapEntry {
  ticker: string;
  name: string;
  currentWeightPct: number;
  targetWeightPct: number;
  deltaPct: number;
  direction: WeightGapDirection;
}

// matrix[i][j] is the correlation of tickers[i] with tickers[j] (−1 to 1); a cell can be null.
interface CorrelationMatrix {
  tickers: string[];
  matrix: (number | null)[][];
}

// `correlation` needs only returns, not the optimiser, so it is also present with status
// "unavailable" for no_positive_returns / solver_failed (null for too_few_assets). Documents
// stored before unavailableReason existed carry null there until they are recomputed, so a
// null reason on an unavailable model still needs a generic fallback.
interface RiskModelResponse {
  status: AnalyticsStatus;
  unavailableReason: RiskModelUnavailableReason | null;
  riskFreeRatePct: number | null;
  appliedViewsCount: number;
  assets: RiskAssetEntry[];
  current: RiskPortfolioEntry | null;
  maxSharpe: RiskPortfolioEntry | null;
  minVolatility: RiskPortfolioEntry | null;
  frontier: FrontierPointEntry[];
  weightGaps: WeightGapEntry[];
  correlation: CorrelationMatrix | null;
  computedAt: string;
  isStale: boolean;
}

// ---------- portfolio comparison ----------

// GET /v1/portfolios/comparison — one entry per compared portfolio, each section a slice of the
// matching single-portfolio document above, all in the user's reference currency. A section is
// null until that portfolio has been computed. The aggregate is recomputed from the combined
// transactions, so its column isn't the sum of the others. Compare returns through `horizons`,
// matched by `period` (same window for every portfolio); cumulativeReturnPct starts on each
// portfolio's own first day.
interface ComparisonValue {
  valuedAt: string;
  currency: string;
  marketValue: number;
  investedCapital: number;
  unrealizedPnl: number;
  realizedPnl: number;
  dividendIncome: number;
  netContributed: number;
  tradingCosts: number;
}

interface ComparisonPerformance {
  status: AnalyticsStatus;
  lifespanDays: number;
  totalReturnPct: number | null;
  annualizedReturnPct: number | null;
  maxDrawdownPct: number | null;
  horizons: HorizonEntry[];
  cumulativeReturnPct: TimeSeries | null;
}

interface ComparisonVolatility {
  status: AnalyticsStatus;
  annualizedVolatilityPct: number | null;
}

interface ComparisonAllocationEntry {
  assetClass: string;
  weightPct: number;
  marketValue: number;
}

interface ComparisonDividends {
  totalTrailing12MIncome: number;
  wholePortfolioYieldPct: number | null;
  portfolioYieldOnCostPct: number | null;
}

interface ComparisonTradingCosts {
  totalCosts: number;
  costRatioBps: number | null;
  annualizedCostDragPct: number | null;
}

interface ComparisonBenchmark {
  status: AnalyticsStatus;
  excessReturnPct: number | null;
  alphaPct: number | null;
  beta: number | null;
  trackingErrorPct: number | null;
  informationRatio: number | null;
}

// isStale is per portfolio, same handling as every other document.
interface PortfolioComparisonEntry {
  portfolio: Portfolio;
  isStale: boolean;
  value: ComparisonValue | null;
  performance: ComparisonPerformance | null;
  volatility: ComparisonVolatility | null;
  allocation: ComparisonAllocationEntry[] | null;
  dividends: ComparisonDividends | null;
  tradingCosts: ComparisonTradingCosts | null;
  benchmark: ComparisonBenchmark | null;
}

export type {
  AnalyticsStatus, RiskModelUnavailableReason, WeightGapDirection, TimeSeries,
  PortfolioHoldingResponse, HoldingsResponse,
  ExposureEntryResponse, ExposureResponse,
  HorizonEntry, MonthlyReturnEntry, AnnualReturnEntry, MonthReturn, PerformanceResponse,
  RiskEventEntry, VolatilityResponse,
  CategoryEntry, CategoriesResponse,
  DividendAssetEntry, DividendsResponse,
  PlatformCostEntry, AssetCostEntry, TradingCostsResponse,
  BenchmarkComponentEntry, BenchmarkResponse,
  RiskAssetEntry, PortfolioWeightEntry, RiskPortfolioEntry, FrontierPointEntry, WeightGapEntry,
  CorrelationMatrix, RiskModelResponse,
  ComparisonValue, ComparisonPerformance, ComparisonVolatility, ComparisonAllocationEntry,
  ComparisonDividends, ComparisonTradingCosts, ComparisonBenchmark, PortfolioComparisonEntry,
};
