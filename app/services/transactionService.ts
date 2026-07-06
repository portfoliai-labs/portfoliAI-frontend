// services/transactionService.ts
import type {
  TransactionInput,
  TransactionResponse,
  TransactionListResponse,
  TransactionUpdatePayload,
} from "../models/Transaction";
import { apiFetch } from "./apiClient";

export const transactionService = {
  // GET /v1/transactions/ — advisors pass for_user_uuid to fetch a client's transactions
  async getUserTransactions(forUserUuid?: string | null, limit = 50, offset = 0): Promise<TransactionListResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (forUserUuid) params.set("for_user_uuid", forUserUuid);
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
