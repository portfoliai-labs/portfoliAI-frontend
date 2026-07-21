// services/transactionService.ts
import type {
  TransactionInput,
  TransactionOperation,
  TransactionResponse,
  TransactionListResponse,
  TransactionUpdatePayload,
} from "../models/Transaction";
import { apiFetch } from "./apiClient";

export interface TransactionFilters {
  ticker?: string | null;
  isin?: string | null;
  broker?: string | null;
  operation?: TransactionOperation | null;
  dateFrom?: string | null; // ISO date-time — only transactions on or after this date
  dateTo?: string | null; // ISO date-time — only transactions on or before this date
}

export const transactionService = {
  // GET /v1/transactions/ — advisors pass for_user_uuid to fetch a client's transactions
  async getUserTransactions(
    forUserUuid?: string | null,
    limit = 50,
    offset = 0,
    filters?: TransactionFilters
  ): Promise<TransactionListResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (forUserUuid) params.set("for_user_uuid", forUserUuid);
    if (filters?.ticker) params.set("ticker", filters.ticker);
    if (filters?.isin) params.set("isin", filters.isin);
    if (filters?.broker) params.set("broker", filters.broker);
    if (filters?.operation) params.set("operation", filters.operation);
    if (filters?.dateFrom) params.set("date_from", filters.dateFrom);
    if (filters?.dateTo) params.set("date_to", filters.dateTo);
    return apiFetch<TransactionListResponse>(`/v1/transactions/?${params.toString()}`);
  },

  // POST /v1/transactions/ — persists one or more new transactions
  async saveTransactions(transactions: TransactionInput[], forUserUuid?: string | null): Promise<TransactionResponse[]> {
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : '';
    return apiFetch<TransactionResponse[]>(`/v1/transactions/${query}`, {
      method: 'POST',
      body: JSON.stringify(transactions),
    });
  },

  // PATCH /v1/transactions/{transaction_uuid}
  async updateTransaction(transactionUuid: string, payload: TransactionUpdatePayload): Promise<TransactionResponse> {
    return apiFetch<TransactionResponse>(`/v1/transactions/${transactionUuid}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  // DELETE /v1/transactions/{transaction_uuid}
  async deleteTransaction(transactionUuid: string): Promise<void> {
    return apiFetch<void>(`/v1/transactions/${transactionUuid}`, {
      method: 'DELETE',
    });
  },
};
