// services/portfolioService.ts
import type { PortfolioSummary } from "../models/Portfolio";
import { apiFetch } from "./apiClient";

export const portfolioService = {
  // GET /v1/transactions/summary — advisors pass for_user_uuid to fetch a client's summary
  async getPortfolioSummary(forUserUuid?: string | null): Promise<PortfolioSummary> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<PortfolioSummary>(`/v1/transactions/summary${query}`);
  },
};
