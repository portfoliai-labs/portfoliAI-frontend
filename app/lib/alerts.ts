import type { AlertParams, AlertRuleResponse, AlertWindow } from "../models/Alert";

// The backend caps a user at 20 rules (a 409 beyond that).
export const ALERT_RULE_LIMIT = 20;

// From this share of the way to the threshold a rule reads as "approaching". The backend has no
// notion of "near" (it only says whether the condition holds), so this cut-off is the frontend's.
export const APPROACHING_FROM_PCT = 60;

export const WINDOW_LABEL: Record<AlertWindow, string> = {
  day: "1 day",
  week: "7 days",
  month: "30 days",
};

/** A percentage with at most two decimals and no trailing zeros; `signed` adds "+" to positives. */
export function formatAlertPct(value: number, signed = false): string {
  return `${signed && value > 0 ? "+" : ""}${Number(value.toFixed(2))}%`;
}

export type AlertTone = "ok" | "warn" | "danger" | "muted";

export interface AlertState {
  kind: "off" | "pending" | "unavailable" | "triggered" | "reached" | "approaching" | "ok";
  label: string;
  tone: AlertTone;
  // The gauge position, null when there's nothing to draw (off, waiting, not measurable).
  progressPct: number | null;
  // The condition holds right now, which turns the gauge's upper zone red.
  breached: boolean;
}

/**
 * The state of a rule, worked out from what the backend sends: a disabled rule is "off" (its
 * reading is stale, so it's ignored); no reading yet is "pending"; an unmeasurable one is
 * "unavailable"; isTriggered means it fired and still holds; `breached` alone means the condition
 * holds but hasn't yet held for two checks; otherwise it's "approaching" from
 * APPROACHING_FROM_PCT of the way to the threshold, and "ok" below that.
 */
export function alertState(rule: AlertRuleResponse): AlertState {
  const reading = rule.reading;
  const base = { progressPct: null, breached: false };

  if (!rule.enabled) return { kind: "off", label: "Off", tone: "muted", ...base };
  if (reading === null) return { kind: "pending", label: "Waiting for first check", tone: "muted", ...base };
  if (reading.status === "unavailable") return { kind: "unavailable", label: "Not enough history", tone: "muted", ...base };

  const progressPct = reading.progressPct;
  if (rule.isTriggered) return { kind: "triggered", label: "Triggered", tone: "danger", progressPct, breached: true };
  if (reading.breached) return { kind: "reached", label: "Threshold reached", tone: "danger", progressPct, breached: true };
  if (progressPct !== null && progressPct >= APPROACHING_FROM_PCT) {
    return { kind: "approaching", label: "Approaching", tone: "warn", progressPct, breached: false };
  }
  return { kind: "ok", label: "Within range", tone: "ok", progressPct, breached: false };
}

/**
 * A short title and subtitle for a rule, in neutral factual wording. `clientName` words it for an
 * advisor's rule on that client's portfolio.
 */
export function describeAlert(rule: AlertRuleResponse, clientName?: string): { title: string; subtitle: string } {
  const { params, reading } = rule;

  if (params.type === "portfolio_change") {
    return {
      title: `Portfolio ${params.direction === "down" ? "down" : "up"} ${formatAlertPct(params.thresholdPct)}`,
      subtitle: `Over ${WINDOW_LABEL[params.window]}`,
    };
  }

  const assetLabel = params.assetId === null ? "Any asset" : reading?.ticker ?? reading?.assetName ?? "Selected asset";
  return {
    title: `${assetLabel} above ${formatAlertPct(params.thresholdPct)}`,
    subtitle: params.assetId === null && reading?.ticker
      ? `Heaviest now: ${reading.ticker}`
      : `Share of ${clientName ? `${clientName}'s` : "your"} portfolio`,
  };
}

/** "Now" and "limit" figures for the gauge, or null when the rule has no measurement to show. */
export function alertFigures(rule: AlertRuleResponse): { current: string; limit: string } | null {
  const reading = rule.reading;
  if (!rule.enabled || reading === null || reading.status !== "ok") return null;
  if (reading.currentValue === null || reading.thresholdValue === null) return null;

  // portfolio_change readings are signed (a fall is negative); asset weights are plain shares.
  const signed = rule.params.type === "portfolio_change";
  return {
    current: formatAlertPct(reading.currentValue, signed),
    limit: formatAlertPct(reading.thresholdValue, signed),
  };
}

/**
 * One sentence saying what a set of params means, for the form's preview. `clientName` words it
 * for an advisor's rule on that client's portfolio.
 */
export function describeParams(params: AlertParams, assetLabel?: string, clientName?: string): string {
  const portfolio = clientName ? `${clientName}'s portfolio` : "my portfolio";
  if (params.type === "portfolio_change") {
    const verb = params.direction === "down" ? "falls" : "rises";
    return `Notify me when the result of ${portfolio} ${verb} by ${formatAlertPct(params.thresholdPct)} or more over ${WINDOW_LABEL[params.window]}.`;
  }
  const subject = params.assetId === null ? "any single holding" : assetLabel ?? "the selected asset";
  return `Notify me when ${subject} is above ${formatAlertPct(params.thresholdPct)} of ${portfolio}.`;
}

/**
 * How pressing a rule is, for ordering a list with the most urgent first: triggered or at the
 * threshold, then approaching, then within range (each by how close it is), then the rules with
 * nothing to show (waiting, not measurable, off).
 */
export function alertUrgency(rule: AlertRuleResponse): number {
  const state = alertState(rule);
  const progress = state.progressPct ?? 0;
  switch (state.kind) {
    case "triggered": return 400 + progress;
    case "reached": return 300 + progress;
    case "approaching": return 200 + progress;
    case "ok": return 100 + progress;
    case "pending": return 2;
    case "unavailable": return 1;
    default: return 0;
  }
}

/** Whether two sets of params describe the same condition, so an edit can skip resending them. */
export function sameParams(a: AlertParams, b: AlertParams): boolean {
  if (a.type === "portfolio_change" && b.type === "portfolio_change") {
    return a.direction === b.direction && a.window === b.window && a.thresholdPct === b.thresholdPct;
  }
  if (a.type === "asset_weight" && b.type === "asset_weight") {
    return a.assetId === b.assetId && a.thresholdPct === b.thresholdPct;
  }
  return false;
}
