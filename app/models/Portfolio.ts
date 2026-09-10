// models/Portfolio.ts
// Matches TransactionsSummaryResponse / PortfolioOverviewResponse DTOs (GET /v1/portfolio/)

// A single asset currently held, aggregated across all of the user's processed transactions.
// Every field here is derived purely from transaction input data (quantity, price paid, fees,
// broker, currency, asset class) — never from current market prices/values.
interface Holding {
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  // String, not number — arbitrary decimal precision (e.g. crypto quantities)
  quantity: string;
  investedValue: number;
  currency: string;
  fees: number;
  broker: string | null;
}

interface BrokerTotal {
  broker: string;
  totalInvested: number;
}

interface AssetClassTotal {
  assetClass: string;
  totalInvested: number;
}

interface BrokerFeesTotal {
  broker: string;
  totalFees: number;
}

// All monetary figures in here share one currency. A ticker's underlying currency isn't
// something the app can convert (no live FX rate), so every aggregate — total invested,
// fees, broker/asset-class breakdowns, realized P&L — is scoped to a single currency rather
// than summed across them. One of these exists per currency actually present in the portfolio.
interface CurrencyBreakdown {
  currency: string;
  totalInvested: number;
  totalFeesPaid: number;
  holdingsCount: number;
  purchasesByBroker: BrokerTotal[];
  purchasesByAssetClass: AssetClassTotal[];
  feesByBroker: BrokerFeesTotal[];
  totalRealizedPl: number;
  sellCount: number;
  winRate: number;
}

// Every closed round-trip for one asset, aggregated together (not one row per individual
// sell) — cost/proceeds/P&L summed across every sell of this asset, profit/loss derived
// entirely from the buy/sell prices recorded in the transactions, never from a current quote.
interface AssetRealizedTrade {
  assetId: string;
  ticker: string | null;
  name: string;
  assetClass: string;
  currency: string;
  // String, not number — arbitrary decimal precision (e.g. crypto quantities)
  quantitySold: string;
  totalCost: number;
  totalProceeds: number;
  realizedPl: number;
  sellCount: number;
  winRate: number;
}

// Matches TransactionsSummaryResponse
interface PortfolioSummary {
  // Every holding across every currency — safe to list or filter, never summed as one figure.
  holdings: Holding[];
  // One entry per currency present in the portfolio.
  byCurrency: CurrencyBreakdown[];
  // Every asset with at least one closed round-trip, across every currency — filter by
  // currency before pairing with a CurrencyBreakdown, same rule as `holdings`.
  realizedTradesByAsset: AssetRealizedTrade[];
}

// A single day's snapshot of the portfolio's live state in one currency — unlike the rest of
// this file, these figures DO come from current market prices (totalMarketValue, totalUnrealizedPnl),
// not just recorded transactions. One entry per currency per day.
//
// Also the exact shape GET /v1/portfolio/ itself returns (the latest one, or null when there's
// no snapshot yet) — that endpoint used to wrap it in a PortfolioOverviewResponse alongside the
// transaction-derived summary and a snapshot history list, both dropped as unused.
interface PortfolioSnapshot {
  snapshotAt: string;
  currency: string;
  totalMarketValue: number;
  totalInvestedCapital: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  totalDividendIncome: number;
}

// Matches TodayDashboardResponse (GET /v1/portfolio/today) — today vs. yesterday, and
// today vs. the start of the current month (month-to-date), always in the user's
// reference currency. `chart` is the month-to-date daily snapshots (one per day,
// oldest→newest not guaranteed — sort before use). The endpoint returns null (not a
// zeroed-out object) when there's no snapshot history yet to compute this from.
interface TodayDashboard {
  currentValue: number;
  previousDayValue: number;
  deltaDayValue: number;
  deltaDayValuePct: number;
  monthStartValue: number;
  deltaMtdValue: number;
  deltaMtdValuePct: number;
  currency: string;
  chart: PortfolioSnapshot[];
  // Currently-held assets and their composition (by asset/asset class/broker) — surfaced here
  // so the Performance section's Today page can show "what do I hold right now" alongside
  // today's figures. GET /v1/portfolio/ itself no longer returns this (see PortfolioSnapshot).
  summary: PortfolioSummary;
}

// Matches one entry of PeriodDashboardResponse[] (GET /v1/portfolio/monthly, GET
// /v1/portfolio/annual) — one row per calendar month (since January of the current year,
// through the most recently *closed* month — the in-progress month isn't included until a
// monthly cron closes it out early the following month) or per calendar year (since
// inception, through the current in-progress year), each diffed against the previous one.
// No `chart` field: unlike /today and /history, a list entry is one row of a performance
// table, not its own drill-down. marketEffect isolates price movement from
// netCapitalContributed (money the user added/withdrew), since deltaValue alone conflates
// the two. For a portfolio's very first tracked period, t0Value is 0 (no prior baseline)
// and deltaValuePct/marketEffectPct both come back as exactly 0 rather than a real
// percentage — see hasPeriodBaseline in PerformanceSection.tsx.
interface PeriodDashboard {
  periodStart: string;
  periodEnd: string;
  t0Value: number;
  t1Value: number;
  deltaValue: number;
  deltaValuePct: number;
  marketEffect: number;
  marketEffectPct: number;
  netCapitalContributed: number;
  tradingCostsInPeriod: number;
  dividendsInPeriod: number;
  // Annualized stdev of daily returns, as a percentage (e.g. 8.4). Computed once a month
  // from the full historical return series — same formula the full-history PDF report's
  // Risk and Volatility Analysis section uses. Null on /annual entries always (an annual
  // row's underlying data is really just its last MONTHLY row, so its volatility would only
  // describe that one month, not the year — showing it under an "annual" label would be
  // misleading, so the backend suppresses it there). On /monthly, null until the monthly
  // cron has processed that particular month since this field shipped (gradual backfill,
  // not missing data).
  volatilityPct: number | null;
  // Peak-to-trough max drawdown within the period, as a percentage (e.g. -1.46 — always ≤0).
  // Same nullability rules as volatilityPct.
  maxDrawdownPct: number | null;
  currency: string;
  // Set only once a report covering this exact period has been generated — null is normal
  // for the current in-progress year (annual) or for a month too recent to have a report yet.
  reportDocumentId: string | null;
}

// One month's market-effect percentage, keyed by calendar year/month rather than a date
// range — the compact shape behind the All Time page's year-by-month returns heatmap.
// Only months with computable data are included (mirrors PeriodDashboard.marketEffectPct);
// a (year, month) pair simply absent means "nothing to show", not zero.
interface MonthlyMarketEffectEntry {
  year: number;
  month: number;
  marketEffectPct: number;
}

// Matches FullHistoryDashboardResponse (GET /v1/portfolio/history) — lifetime figures
// since the portfolio's first recorded transaction (inceptionDate).
interface FullHistoryDashboard {
  inceptionDate: string;
  currentValue: number;
  totalInvestedCapital: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalDividendIncome: number;
  lifetimeTradingCosts: number;
  lifetimeDividends: number;
  currency: string;
  chart: PortfolioSnapshot[];
  // Every asset with at least one closed round-trip, lifetime — same shape/semantics as
  // PortfolioSummary.realizedTradesByAsset, surfaced here too so the All Time page (which
  // merges Month/Year/Full History into one section) can show realized P&L without a second
  // fetch. Not scoped to one currency — group by each trade's own `currency` before summing.
  realizedTradesByAsset: AssetRealizedTrade[];
  // Backs the returns heatmap: one entry per (year, month) with computable market effect,
  // across the portfolio's full history. Not necessarily sorted.
  monthlyMarketEffect: MonthlyMarketEffectEntry[];
  reportDocumentId: string | null;
}

export type {
  Holding, PortfolioSummary, PortfolioSnapshot,
  CurrencyBreakdown, BrokerTotal, AssetClassTotal, BrokerFeesTotal, AssetRealizedTrade,
  TodayDashboard, PeriodDashboard, FullHistoryDashboard, MonthlyMarketEffectEntry,
};
