// services/importService.ts
// The frontend never calls an AI model directly — it exposes the locally-selected sample
// (never the whole file) to the backend, which runs the actual inference.
import type {
  AnalyzeColumnsRequest,
  AnalyzeValuesRequest,
  ColumnMappingResponse,
  CommitImportResponse,
  CommitMappingPayload,
  ValueMappingResponse,
} from "../models/Import";
import { apiFetch, apiFetchForm } from "./apiClient";

export const importService = {
  // POST /v1/transactions/import/analyze-columns — headers + structural sample + full
  // per-column profiles, never the raw file.
  async analyzeColumns(payload: AnalyzeColumnsRequest): Promise<ColumnMappingResponse> {
    return apiFetch<ColumnMappingResponse>("/v1/transactions/import/analyze-columns", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // POST /v1/transactions/import/analyze-values — every distinct value of the one column
  // mapped to `type`.
  async analyzeValues(payload: AnalyzeValuesRequest): Promise<ValueMappingResponse> {
    return apiFetch<ValueMappingResponse>("/v1/transactions/import/analyze-values", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // POST /v1/transactions/import/commit — the confirmed mapping plus the original file. The
  // frontend never sends pre-transformed rows: the authoritative transform runs on the
  // backend so the saved data can never drift from what analyze-columns/analyze-values
  // reasoned about. `forUserUuid` mirrors transactionService — an advisor importing on
  // behalf of a client.
  async commit(file: File, payload: CommitMappingPayload, forUserUuid?: string | null): Promise<CommitImportResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("mapping", JSON.stringify(payload));
    const query = forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : "";
    return apiFetchForm<CommitImportResponse>(`/v1/transactions/import/commit${query}`, formData, { method: "POST" });
  },
};
