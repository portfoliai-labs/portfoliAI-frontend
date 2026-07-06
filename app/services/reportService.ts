// services/reportService.ts
import type { Document, PresignedUrl, StandardTransaction } from "../models/Report";
import { apiFetch } from "./apiClient";

// MOCK — no backend endpoint exists yet for fetching a user's saved transaction history.
// Swap getExistingTransactions' body for a real, paginated GET call once that endpoint exists.
const MOCK_TICKERS = [
  { ticker: "AAPL", isin: "US0378331005", currency: "USD" },
  { ticker: "VWCE.MI", isin: "IE00BK5BQT80", currency: "EUR" },
  { ticker: "TSLA", isin: "US88160R1014", currency: "USD" },
  { ticker: "MSFT", isin: "US5949181045", currency: "USD" },
  { ticker: "ENI.MI", isin: "IT0003132476", currency: "EUR" },
];

const MOCK_EXISTING_TRANSACTIONS: StandardTransaction[] = Array.from({ length: 45 }, (_, i) => {
  const t = MOCK_TICKERS[i % MOCK_TICKERS.length];
  const operation: StandardTransaction["operation"] = i % 7 === 0 ? "dividend" : i % 4 === 0 ? "sell" : "buy";
  const month = String((i % 12) + 1).padStart(2, "0");
  const day = String((i % 27) + 1).padStart(2, "0");
  return {
    id: `${t.isin}-${i}`,
    date: `2024-${month}-${day}`,
    operation,
    quantity: 1 + (i % 15),
    price: Number((50 + (i * 3.37) % 400).toFixed(2)),
    currency: t.currency,
    fees: Number((i % 5).toFixed(2)),
    broker: "Fineco",
    isin: t.isin,
    ticker: t.ticker,
  };
});

export interface PaginatedTransactions {
  items: StandardTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

export const reportService = {
  // GET /v1/reports/?for_user_uuid=... — advisors pass client UUID to fetch their documents
  async getAllDocuments(forUserUuid?: string | null): Promise<Document[]> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<Document[]>(`/v1/reports/${query}`);
  },

  // MOCK: returns one page of the user's already-saved transactions.
  // Simulates server-side pagination since the real endpoint doesn't exist yet.
  async getExistingTransactions(forUserUuid?: string | null, page = 1, pageSize = 10): Promise<PaginatedTransactions> {
    void forUserUuid;
    await new Promise(resolve => setTimeout(resolve, 400));
    const start = (page - 1) * pageSize;
    return {
      items: MOCK_EXISTING_TRANSACTIONS.slice(start, start + pageSize).map(tx => ({ ...tx })),
      total: MOCK_EXISTING_TRANSACTIONS.length,
      page,
      pageSize,
    };
  },

  // MOCK: deletes a saved transaction; no backend endpoint exists yet.
  async deleteTransaction(transactionId: string, forUserUuid?: string | null): Promise<void> {
    void transactionId;
    void forUserUuid;
    await new Promise(resolve => setTimeout(resolve, 300));
  },

  // POST /v1/reports/process-report — advisors pass for_user_uuid to generate for a client
  async processReport(data: StandardTransaction[], filename: string, forUserUuid?: string | null): Promise<void> {
    return apiFetch<void>('/v1/reports/process-report', {
      method: 'POST',
      body: JSON.stringify({ data, filename, for_user_uuid: forUserUuid ?? null }),
    });
  },

  async downloadReport(documentId: string): Promise<PresignedUrl> {
    return apiFetch<PresignedUrl>(`/v1/reports/${documentId}/download`);
  },

  async addTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ name: tagName }),
    });
  },

  async removeTag(documentId: string, tagName: string): Promise<void> {
    return apiFetch<void>(`/v1/reports/${documentId}/tags/${encodeURIComponent(tagName)}`, {
      method: 'DELETE',
    });
  },
};
