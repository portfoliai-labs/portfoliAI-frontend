// services/policyService.ts
import type { PortfolioPolicy, PortfolioPolicyResponse } from "../models/Policy";
import { ApiError, apiFetch } from "./apiClient";

// A portfolio's policy (see models/Policy). Errors come back as ApiError: 404 (no policy), 409 (past the 20-rules-per-portfolio
// limit, which the policy's rules count toward; nothing saved), 403 (an advisor writing), 422 (an
// invalid constraint).
export const policyService = {
  // GET /v1/portfolios/{p}/policy — null for a portfolio without one (the backend's 404).
  async get(portfolioUuid: string): Promise<PortfolioPolicyResponse | null> {
    try {
      return await apiFetch<PortfolioPolicyResponse>(`/v1/portfolios/${portfolioUuid}/policy`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },

  // PUT /v1/portfolios/{p}/policy — replaces the policy (see PortfolioPolicy for ids).
  async put(portfolioUuid: string, policy: PortfolioPolicy): Promise<PortfolioPolicyResponse> {
    return apiFetch<PortfolioPolicyResponse>(`/v1/portfolios/${portfolioUuid}/policy`, {
      method: "PUT",
      body: JSON.stringify(policy),
    });
  },

  // DELETE /v1/portfolios/{p}/policy — removes it with its rules.
  async remove(portfolioUuid: string): Promise<void> {
    await apiFetch<unknown>(`/v1/portfolios/${portfolioUuid}/policy`, { method: "DELETE" });
  },

  // GET /v1/portfolios/{p}/strategy/policy — the policy a strategy's backtest implies, a draft
  // (nothing saved, ids null): one group_target per category, on the backtest's own ETFs. 404 for
  // a portfolio that isn't a strategy's, 422 when its band covers every weight.
  async strategyDraft(strategyPortfolioUuid: string): Promise<PortfolioPolicy> {
    return apiFetch<PortfolioPolicy>(`/v1/portfolios/${strategyPortfolioUuid}/strategy/policy`);
  },
};
