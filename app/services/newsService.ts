// services/newsService.ts
import type { NewsItem, DailyArticle } from "../models/News";
import { apiFetch } from "./apiClient";

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const newsService = {
  // GET /v1/news/ — news for a given calendar month (year+month, must be passed together),
  // or for today when both are omitted. `limit` caps how many stories come back.
  async getNews(year?: number, month?: number, limit?: number): Promise<NewsItem[]> {
    return apiFetch<NewsItem[]>(`/v1/news/${buildQuery({ year, month, limit })}`);
  },

  // GET /v1/news/daily-article — the global "article of the day", same for every user.
  async getDailyArticle(): Promise<DailyArticle> {
    return apiFetch<DailyArticle>(`/v1/news/daily-article`);
  },
};
