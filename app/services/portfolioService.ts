// services/portfolioService.ts
import type { PortfolioOverview, TodayDashboard, PeriodDashboard, FullHistoryDashboard } from "../models/Portfolio";
import { apiFetch } from "./apiClient";

const forUserUuidQuery = (forUserUuid?: string | null) =>
  forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const portfolioService = {
  // GET /v1/portfolio/ — advisors pass for_user_uuid to fetch a client's portfolio.
  // date_from/date_to default server-side to the last 90 days and scope only the snapshots
  // returned, not the transaction-derived summary (which always covers full history).
  async getPortfolioOverview(forUserUuid?: string | null): Promise<PortfolioOverview> {
    return apiFetch<PortfolioOverview>(`/v1/portfolio/${forUserUuidQuery(forUserUuid)}`);
  },

  // GET /v1/portfolio/today — today vs. yesterday, and today vs. the start of the current
  // month. Returns null when there's no portfolio history to compute it from (e.g. no
  // transactions yet) — a 200 with a null body, not a 404.
  async getTodayDashboard(forUserUuid?: string | null): Promise<TodayDashboard | null> {
    return apiFetch<TodayDashboard | null>(`/v1/portfolio/today${forUserUuidQuery(forUserUuid)}`);
  },

  // GET /v1/portfolio/monthly — one entry per calendar month of `year` (defaults to the
  // current year server-side). For the current year the last entry is the current
  // in-progress month; a past year returns all 12. Used on demand (one call per year) to
  // fetch the full per-month detail — t0/t1 value, dividends, volatility, drawdown, report —
  // behind a cell clicked in the All Time page's returns heatmap, which itself is backed
  // by the lighter-weight FullHistoryDashboard.monthlyMarketEffect (all years, one call).
  // Returns [] (not null) when there's no history yet — unambiguous for a list endpoint.
  async getMonthlyDashboard(forUserUuid?: string | null, year?: number): Promise<PeriodDashboard[]> {
    return apiFetch<PeriodDashboard[]>(`/v1/portfolio/monthly${buildQuery({ for_user_uuid: forUserUuid, year })}`);
  },

  // GET /v1/portfolio/annual — one entry per calendar year from the portfolio's inception
  // year through the current year, each diffed against the previous year's close. Returns
  // [] (not null) when there's no history yet.
  async getAnnualDashboard(forUserUuid?: string | null): Promise<PeriodDashboard[]> {
    return apiFetch<PeriodDashboard[]>(`/v1/portfolio/annual${forUserUuidQuery(forUserUuid)}`);
  },

  // GET /v1/portfolio/history — lifetime figures since the portfolio's inception. Returns
  // null when there's no portfolio history at all (no transactions ever recorded).
  async getFullHistoryDashboard(forUserUuid?: string | null): Promise<FullHistoryDashboard | null> {
    return apiFetch<FullHistoryDashboard | null>(`/v1/portfolio/history${forUserUuidQuery(forUserUuid)}`);
  },
};
