// models/Alert.ts
//
// Types for the alert rules under /v1/alerts/rules (backend branch feature/user-alerts,
// schemas AlertRuleResponse / AlertRuleCreateRequest / AlertRuleUpdateRequest). Every key of a
// response is always present; a value that doesn't apply is `null`. Every threshold is a
// percentage (5 = 5%) — there are no absolute-value thresholds, and no per-category alerts.

type AlertDirection = "up" | "down";

// "day" / "week" / "month" are 1 / 7 / 30 calendar days.
type AlertWindow = "day" | "week" | "month";

// The portfolio's result (change in total P&L, net of deposits and withdrawals, as a % of the
// portfolio's value at the window's reference day) moved by at least thresholdPct in `direction`.
// Not the time-weighted return the reports show. thresholdPct is > 0 and <= 1000.
interface PortfolioChangeParams {
  type: "portfolio_change";
  direction: AlertDirection;
  thresholdPct: number;
  window: AlertWindow;
}

// An asset's weight in the portfolio is strictly above thresholdPct (> 0 and <= 100).
// assetId is a holdings assetId; null means any held asset.
interface AssetWeightParams {
  type: "asset_weight";
  thresholdPct: number;
  assetId: string | null;
}

type AlertParams = PortfolioChangeParams | AssetWeightParams;

type AlertReadingStatus = "ok" | "unavailable";

type AlertUnavailableReason = "insufficient_history";

// The latest check of a rule, rewritten by the backend's snapshot worker about every 5 minutes.
// currentValue and thresholdValue are in % on the same scale and with the same sign (for a
// "down" rule the threshold is negative and a fall is a negative currentValue). progressPct is
// currentValue / thresholdValue * 100, already clamped to 0..100: 0 = at the threshold's level
// or moving away from it, 100 = reached or passed. It's what the gauge draws, so nothing is
// recomputed here.
interface AlertRuleReading {
  status: AlertReadingStatus;
  evaluatedAt: string;
  unavailableReason: AlertUnavailableReason | null;
  breached: boolean | null;
  currentValue: number | null;
  thresholdValue: number | null;
  progressPct: number | null;
  // asset_weight: which asset the reading is about (the heaviest one for "any asset").
  assetId: string | null;
  assetName: string | null;
  ticker: string | null;
  // portfolio_change: the P&L move in `currency`, and the day it is measured against.
  pnlChange: number | null;
  currency: string | null;
  referenceDate: string | null;
}

interface AlertRuleResponse {
  ruleId: string;
  params: AlertParams;
  notifyEmail: boolean;
  notifyInApp: boolean;
  enabled: boolean;
  // true once the condition has held for two consecutive checks (5–10 minutes) and stays true
  // while it does; null = never evaluated.
  isTriggered: boolean | null;
  lastTriggeredAt: string | null;
  // null = just created / changed / re-enabled, waiting for its first check (within ~5 min).
  // A disabled rule isn't re-checked, so its reading goes stale: ignore it while enabled is false.
  reading: AlertRuleReading | null;
  createdAt: string;
  updatedAt: string;
}

interface AlertRuleCreateRequest {
  params: AlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

// Only the fields that are sent change. Changing `params`, or turning a disabled rule back on,
// restarts the rule: its next reading is a fresh baseline and never fires.
interface AlertRuleUpdateRequest {
  params?: AlertParams;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
  enabled?: boolean;
}

export type {
  AlertDirection, AlertWindow, PortfolioChangeParams, AssetWeightParams, AlertParams,
  AlertReadingStatus, AlertUnavailableReason, AlertRuleReading, AlertRuleResponse,
  AlertRuleCreateRequest, AlertRuleUpdateRequest,
};
