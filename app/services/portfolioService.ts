// services/portfolioService.ts
import type { PortfolioSnapshot, TodayDashboard, PeriodDashboard, FullHistoryDashboard, PortfolioSummary } from "../models/Portfolio";
import type {
  HoldingsResponse, ExposureResponse, PerformanceResponse, VolatilityResponse, CategoriesResponse,
  DividendsResponse, TradingCostsResponse, BenchmarkResponse, RiskModelResponse, CompositionResponse,
} from "../models/PortfolioData";
import { apiFetch } from "./apiClient";

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const portfolioService = {
  // GET /v1/portfolios/{p}/overview — the latest portfolio-value snapshot. Returns null when
  // there's no snapshot yet, same convention as getTodayDashboard/getFullHistoryDashboard below.
  async getPortfolioOverview(portfolioUuid: string): Promise<PortfolioSnapshot | null> {
    return apiFetch<PortfolioSnapshot | null>(`/v1/portfolios/${portfolioUuid}/overview`);
  },

  // GET /v1/portfolios/{p}/today — today vs. yesterday, and today vs. the start of the current
  // month. Returns null when there's no portfolio history to compute it from (e.g. no
  // transactions yet) — a 200 with a null body, not a 404.
  async getTodayDashboard(portfolioUuid: string): Promise<TodayDashboard | null> {
    return apiFetch<TodayDashboard | null>(`/v1/portfolios/${portfolioUuid}/today`);
  },

  // GET /v1/portfolios/{p}/summary — current holdings and currency-breakdown composition,
  // derived purely from stored transactions (not a snapshot tick or any time horizon). Used to
  // live nested under getTodayDashboard's own `summary` field; split out to its own endpoint
  // since a page showing composition shouldn't depend on the today dashboard's availability.
  // Unlike every other call here this never returns null — an empty portfolio is a summary
  // with empty lists, not "not computed yet".
  async getPortfolioSummary(portfolioUuid: string): Promise<PortfolioSummary> {
    return apiFetch<PortfolioSummary>(`/v1/portfolios/${portfolioUuid}/summary`);
  },

  // GET /v1/portfolios/{p}/monthly — one entry per calendar month of `year` (defaults to the
  // current year server-side). For the current year the last entry is the current
  // in-progress month; a past year returns all 12. Used on demand (one call per year) to
  // fetch the full per-month detail — t0/t1 value, dividends, volatility, drawdown, report —
  // behind a cell clicked in the All Time page's returns heatmap, which itself is backed
  // by the lighter-weight FullHistoryDashboard.monthlyMarketEffect (all years, one call).
  // Returns [] (not null) when there's no history yet — unambiguous for a list endpoint.
  async getMonthlyDashboard(portfolioUuid: string, year?: number): Promise<PeriodDashboard[]> {
    return apiFetch<PeriodDashboard[]>(`/v1/portfolios/${portfolioUuid}/monthly${buildQuery({ year })}`);
  },

  // GET /v1/portfolios/{p}/annual — one entry per calendar year from the portfolio's inception
  // year through the current year, each diffed against the previous year's close. Returns
  // [] (not null) when there's no history yet.
  async getAnnualDashboard(portfolioUuid: string): Promise<PeriodDashboard[]> {
    return apiFetch<PeriodDashboard[]>(`/v1/portfolios/${portfolioUuid}/annual`);
  },

  // GET /v1/portfolios/{p}/history — lifetime figures since the portfolio's inception. Returns
  // null when there's no portfolio history at all (no transactions ever recorded).
  async getFullHistoryDashboard(portfolioUuid: string): Promise<FullHistoryDashboard | null> {
    return apiFetch<FullHistoryDashboard | null>(`/v1/portfolios/${portfolioUuid}/history`);
  },

  // The analytics endpoints below all answer 200 with either the document or null (nothing
  // computed for this user yet — "being prepared", not an error). Where a document has
  // `status` / `isStale`, see models/PortfolioData.ts for how each state should be shown.

  // GET /v1/portfolios/{p}/holdings — currently-held positions as of the last snapshot tick
  // (refreshed about every 5 minutes), largest first. No status / isStale.
  async getHoldings(portfolioUuid: string): Promise<HoldingsResponse | null> {
    return apiFetch<HoldingsResponse | null>(`/v1/portfolios/${portfolioUuid}/holdings`);
  },

  // GET /v1/portfolios/{p}/exposure/sector — sector breakdown of the held positions (look-
  // through into funds), as of the last snapshot tick. No status / isStale.
  async getSectorExposure(portfolioUuid: string): Promise<ExposureResponse | null> {
    return apiFetch<ExposureResponse | null>(`/v1/portfolios/${portfolioUuid}/exposure/sector`);
  },

  // GET /v1/portfolios/{p}/exposure/region — same as getSectorExposure, grouped by geography.
  async getRegionExposure(portfolioUuid: string): Promise<ExposureResponse | null> {
    return apiFetch<ExposureResponse | null>(`/v1/portfolios/${portfolioUuid}/exposure/region`);
  },

  // GET /v1/portfolios/{p}/performance — returns, drawdown, and horizon / monthly / annual
  // breakdowns over the whole history, rebuilt daily at 04:00 UTC and after transaction edits.
  // Long histories make this a few hundred KB — downsample the series before charting.
  async getPerformance(portfolioUuid: string): Promise<PerformanceResponse | null> {
    return apiFetch<PerformanceResponse | null>(`/v1/portfolios/${portfolioUuid}/performance`);
  },

  // GET /v1/portfolios/{p}/volatility — annualized and rolling volatility, plus stress episodes.
  async getVolatility(portfolioUuid: string): Promise<VolatilityResponse | null> {
    return apiFetch<VolatilityResponse | null>(`/v1/portfolios/${portfolioUuid}/volatility`);
  },

  // GET /v1/portfolios/{p}/categories — per-asset-class allocation and, past a year of
  // history, each class's own performance.
  async getCategories(portfolioUuid: string): Promise<CategoriesResponse | null> {
    return apiFetch<CategoriesResponse | null>(`/v1/portfolios/${portfolioUuid}/categories`);
  },

  // GET /v1/portfolios/{p}/dividends — trailing-12-month and lifetime income, yields, per-
  // asset rows.
  async getDividends(portfolioUuid: string): Promise<DividendsResponse | null> {
    return apiFetch<DividendsResponse | null>(`/v1/portfolios/${portfolioUuid}/dividends`);
  },

  // GET /v1/portfolios/{p}/trading-costs — explicit fees plus implicit spread cost, by
  // platform and by asset, and the cumulative cost over time.
  async getTradingCosts(portfolioUuid: string): Promise<TradingCostsResponse | null> {
    return apiFetch<TradingCostsResponse | null>(`/v1/portfolios/${portfolioUuid}/trading-costs`);
  },

  // GET /v1/portfolios/{p}/benchmark — portfolio vs. a synthetic benchmark of proxy ETFs fed
  // the same cash flows: paired return / volatility / drawdown, beta, alpha, tracking error,
  // and the two cumulative-return curves (in %, base 0).
  async getBenchmark(portfolioUuid: string): Promise<BenchmarkResponse | null> {
    return apiFetch<BenchmarkResponse | null>(`/v1/portfolios/${portfolioUuid}/benchmark`);
  },

  // GET /v1/portfolios/{p}/risk-model — mean-variance model over the held assets: max-Sharpe /
  // min-volatility allocations, efficient frontier, correlation matrix. Expected returns are
  // trailing historical means, not forecasts.
  async getRiskModel(portfolioUuid: string): Promise<RiskModelResponse | null> {
    return apiFetch<RiskModelResponse | null>(`/v1/portfolios/${portfolioUuid}/risk-model`);
  },

  // GET /v1/portfolios/{p}/composition — how the user's portfolios make up the aggregate:
  // value / profit / risk shares, their correlation and the assets held in more than one.
  // Null for a standard portfolio (and before the aggregate's first analytics run).
  async getComposition(portfolioUuid: string): Promise<CompositionResponse | null> {
    return apiFetch<CompositionResponse | null>(`/v1/portfolios/${portfolioUuid}/composition`);
  },
};
