// services/alertService.ts
import type { AlertRuleResponse, AlertRuleCreateRequest, AlertRuleUpdateRequest } from "../models/Alert";
import { apiFetch } from "./apiClient";

// Errors come back as ApiError with the backend's `detail` as the message: 404 (no such rule),
// 409 (already at the 20-rule limit), 422 (a portfolio_change whose window the history doesn't
// cover yet, or a value out of range).
export const alertService = {
  // GET /v1/alerts/rules — the user's rules, oldest first; an empty list (never null) if none.
  async listRules(): Promise<AlertRuleResponse[]> {
    return apiFetch<AlertRuleResponse[]>(`/v1/alerts/rules`);
  },

  // POST /v1/alerts/rules — notifyEmail / notifyInApp default to true when omitted.
  async createRule(payload: AlertRuleCreateRequest): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(`/v1/alerts/rules`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // PATCH /v1/alerts/rules/{ruleId} — only the fields sent change.
  async updateRule(ruleId: string, payload: AlertRuleUpdateRequest): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(`/v1/alerts/rules/${encodeURIComponent(ruleId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  // DELETE /v1/alerts/rules/{ruleId}
  async deleteRule(ruleId: string): Promise<void> {
    await apiFetch<{ status: string }>(`/v1/alerts/rules/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  },
};
