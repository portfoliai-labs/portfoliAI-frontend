// models/Portfolio.ts
// Matches TransactionsSummaryResponse / PortfolioOverviewResponse DTOs (GET /v1/portfolios/{p}/overview)

// Matches PortfolioResponse (GET/POST/PATCH /v1/portfolios, GET /v1/portfolios/{p},
// GET/POST /v1/advisor/clients/{client_uuid}/portfolios) — a user can own several of these
// (e.g. "Main portfolio", "Pensione", "Trading"); every dashboard/transactions/alerts/reports
// endpoint is scoped to one via its uuid in the path. Every user (including advisor-created
// clients, advisors themselves, and demo accounts) has exactly one `isDefault` portfolio,
// created at registration and never deletable (DELETE on it is a 409). While a user owns 2+
// portfolios they also get an automatic `isAggregate` one ("All portfolios"): its figures are
// recomputed from every portfolio's transactions combined, it's readable everywhere (incl.
// alert rules) but otherwise read-only — transaction writes, import commit, reports, rename
// and delete all 409. GET /v1/portfolios returns the aggregate first (if any), then the
// default, then oldest first; an advisor lists a client's the same way via
// GET /v1/advisor/clients/{client_uuid}/portfolios, then reaches each through the same
// /v1/portfolios/{p}/... paths the client would.
interface Portfolio {
  uuid: string;
  name: string;
  isDefault: boolean;
  isAggregate: boolean;
  createdAt: string;
}

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

// Matches DailyValueChangeResponse (one entry of TodayDashboardResponse.chart) — a day-over-day
// delta rather than a fresh absolute-value snapshot (see PortfolioSnapshot, still what /history's
// chart returns). Absolute-value context for /today lives in TodayDashboard's own top-level
// scalars (currentValue, monthStartValue, etc.), not duplicated here.
interface DailyValueChange {
  snapshotAt: string;
  value: number;
  previousValue: number;
  deltaValue: number;
  deltaValuePct: number;
  // The day's change net of flows (buys/sells, costs, dividends) — a purchase isn't a gain here.
  marketEffect: number;
  marketEffectPct: number;
}

// Matches TodayDashboardResponse (GET /v1/portfolio/today) — today vs. yesterday, and
// today vs. the end of the previous month (month-to-date), always in the user's
// reference currency. `chart` is the month-to-date day-over-day deltas (one per day,
// oldest→newest not guaranteed — sort before use); their deltaValue sums to deltaMtdValue.
// The month-to-date figures equal /monthly's last (in-progress) entry. The endpoint returns
// null (not a zeroed-out object) when there's no snapshot history yet to compute this from.
interface TodayDashboard {
  currentValue: number;
  previousDayValue: number;
  deltaDayValue: number;
  deltaDayValuePct: number;
  // deltaDayValue net of flows — "how much the market moved" today.
  dayMarketEffect: number;
  dayMarketEffectPct: number;
  // Value at the end of the previous month, not on the 1st. 0 for a portfolio created this
  // month, in which case deltaMtdValuePct / mtdMarketEffectPct have no baseline.
  monthStartValue: number;
  deltaMtdValue: number;
  deltaMtdValuePct: number;
  mtdNetCapitalContributed: number;
  mtdMarketEffect: number;
  mtdMarketEffectPct: number;
  currency: string;
  chart: DailyValueChange[];
  // True while a transaction edit has landed but the rebuild it triggered hasn't yet: today's
  // value/transactions are already the new portfolio while the past days here are still being
  // rebuilt, so chart/deltas can mix two different portfolios. Don't render them while true —
  // show an "updating" state and refetch every 15s; if it's still true after ~5 minutes, stop
  // polling and show the (possibly still-mixed) data with a "taking longer than usual" hint.
  // Unlike PortfolioSnapshot (from GET /v1/portfolio/, no isStale — never mixes history with
  // fresh data), this endpoint does, hence the flag.
  isStale: boolean;
}

// Matches one entry of PeriodDashboardResponse[] (GET /v1/portfolio/monthly, GET
// /v1/portfolio/annual) — one row per calendar month or per calendar year (since inception),
// each running from the previous period's closing value to its own end. For the current
// year, /monthly's last entry is the month in progress and /annual's is the year in
// progress, both valued as of today (`inProgress: true`).
// No `chart` field: unlike /today and /history, a list entry is one row of a performance
// table, not its own drill-down. marketEffect isolates price movement from
// netCapitalContributed (money the user added/withdrew), since deltaValue alone conflates
// the two; flows are converted at each trade's own date, and costs are commissions + spread.
// For a portfolio's very first tracked period, t0Value is 0 (no prior baseline)
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
  // misleading, so the backend suppresses it there). On /monthly, null on the month in
  // progress, and until the monthly cron has processed that particular month since this
  // field shipped (gradual backfill, not missing data).
  volatilityPct: number | null;
  // Peak-to-trough max drawdown within the period, as a percentage (e.g. -1.46 — always ≤0).
  // Same nullability rules as volatilityPct.
  maxDrawdownPct: number | null;
  // Time-weighted return for this month/year, same figure as /performance. This is the
  // "return"; marketEffectPct is market effect ÷ opening value, which diverges from it when
  // money moves mid-period. Null when /performance has none (e.g. under a year of history).
  timeWeightedReturnPct: number | null;
  // True on the period still in progress (valued as of today).
  inProgress: boolean;
  currency: string;
  // Set only once a report covering this exact period has been generated — null is normal
  // for the current in-progress year (annual) or for a month too recent to have a report yet.
  reportDocumentId: string | null;
  // Same value on every entry of one /monthly or /annual response — see TodayDashboard.isStale
  // for what it means and how to handle it.
  isStale: boolean;
}

// One month's market-effect percentage, keyed by calendar year/month rather than a date
// range — the compact shape behind the All Time page's year-by-month returns heatmap.
// Only months with computable data are included (mirrors PeriodDashboard.marketEffectPct);
// a (year, month) pair simply absent means "nothing to show", not zero.
interface MonthlyMarketEffectEntry {
  year: number;
  month: number;
  marketEffectPct: number;
  // See PeriodDashboard.timeWeightedReturnPct.
  timeWeightedReturnPct: number | null;
}

// Matches FullHistoryDashboardResponse (GET /v1/portfolio/history) — lifetime figures
// since the portfolio's first recorded transaction (inceptionDate), as of today:
// currentValue equals /today.currentValue and /overview. `chart` is the month-end series
// plus today's point last; monthlyMarketEffect includes the month in progress.
interface FullHistoryDashboard {
  inceptionDate: string;
  currentValue: number;
  totalInvestedCapital: number;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalDividendIncome: number;
  // Commissions + spread, same as /trading-costs.totalCosts.
  lifetimeTradingCosts: number;
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
  // See TodayDashboard.isStale for what it means and how to handle it.
  isStale: boolean;
}

export type {
  Portfolio, Holding, PortfolioSummary, PortfolioSnapshot, DailyValueChange,
  CurrencyBreakdown, BrokerTotal, AssetClassTotal, BrokerFeesTotal, AssetRealizedTrade,
  TodayDashboard, PeriodDashboard, FullHistoryDashboard, MonthlyMarketEffectEntry,
};
