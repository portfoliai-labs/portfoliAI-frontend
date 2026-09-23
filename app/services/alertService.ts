// services/alertService.ts
import type {
  AlertRuleResponse, AlertRuleCreateRequest, AlertRuleUpdateRequest, ClientAlertRuleResponse,
} from "../models/Alert";
import { apiFetch } from "./apiClient";

// An advisor passes a client's uuid to manage the rules they put on that client's portfolio.
// Those rules are the advisor's: the client doesn't see them, and the advisor is the one notified.
// Without it, the caller's own rules.
const forUserUuidQuery = (forUserUuid?: string | null) =>
  forUserUuid ? `?for_user_uuid=${encodeURIComponent(forUserUuid)}` : "";

// Errors come back as ApiError with the backend's `detail` as the message: 404 (no such rule),
// 409 (already at the 20-rule limit), 422 (a portfolio_change whose window the history doesn't
// cover yet, or a value out of range), 403 (a for_user_uuid that isn't the advisor's client).
export const alertService = {
  // GET /v1/alerts/rules — the rules, oldest first; an empty list (never null) if none.
  async listRules(forUserUuid?: string | null): Promise<AlertRuleResponse[]> {
    return apiFetch<AlertRuleResponse[]>(`/v1/alerts/rules${forUserUuidQuery(forUserUuid)}`);
  },

  // GET /v1/alerts/client-rules — advisors only: every rule they put on any client, oldest first.
  async listClientRules(): Promise<ClientAlertRuleResponse[]> {
    return apiFetch<ClientAlertRuleResponse[]>(`/v1/alerts/client-rules`);
  },

  // POST /v1/alerts/rules — notifyEmail / notifyInApp default to true when omitted.
  async createRule(payload: AlertRuleCreateRequest, forUserUuid?: string | null): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(`/v1/alerts/rules${forUserUuidQuery(forUserUuid)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // PATCH /v1/alerts/rules/{ruleId} — only the fields sent change.
  async updateRule(
    ruleId: string, payload: AlertRuleUpdateRequest, forUserUuid?: string | null,
  ): Promise<AlertRuleResponse> {
    return apiFetch<AlertRuleResponse>(
      `/v1/alerts/rules/${encodeURIComponent(ruleId)}${forUserUuidQuery(forUserUuid)}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
  },

  // DELETE /v1/alerts/rules/{ruleId}
  async deleteRule(ruleId: string, forUserUuid?: string | null): Promise<void> {
    await apiFetch<{ status: string }>(
      `/v1/alerts/rules/${encodeURIComponent(ruleId)}${forUserUuidQuery(forUserUuid)}`,
      { method: "DELETE" },
    );
  },
};
