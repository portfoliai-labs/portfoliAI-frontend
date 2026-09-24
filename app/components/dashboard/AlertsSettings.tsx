"use client";

import { useEffect, useState } from "react";
import { BellRing, Bell, Mail, Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { alertService } from "../../services/alertService";
import { portfolioService } from "../../services/portfolioService";
import { useAlertRules } from "../../hooks/useAlertRules";
import { ConfirmDialog } from "./ConfirmDialog";
import { Toggle } from "./Toggle";
import { TONE_STYLES } from "./AlertGauge";
import {
  alertState, describeAlert, describeParams, sameParams, ALERT_RULE_LIMIT, WINDOW_LABEL,
} from "../../lib/alerts";
import type {
  AlertParams, AlertRuleResponse, AlertRuleUpdateRequest, AlertDirection, AlertWindow,
} from "../../models/Alert";

interface AssetOption {
  assetId: string;
  label: string;
}

const FIELD_LABEL = "block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5";
const FIELD_INPUT =
  "w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.2)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] transition-colors";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * ALERTS SETTINGS — managing alert rules: list them (with their state, a switch to turn each on or
 * off, edit, delete) and create new ones. The Dashboard shows the same rules as dials; this is
 * where they're configured. At most ALERT_RULE_LIMIT per portfolio.
 *
 * `portfolioUuid` is always required now (every alert-rule route is nested under one). Without
 * `clientName` it's the caller's own rules (the Settings tab, passed the current portfolio from
 * PortfolioContext). With `clientName` it's an advisor's rules on that client's portfolio (the
 * Clients section, passed that client's default portfolio uuid): the asset picker lists the
 * client's holdings, and the advisor is the one notified.
 */
export function AlertsSettings({ portfolioUuid, clientName }: { portfolioUuid: string; clientName?: string }) {
  const { rules, setRules, loading, error, reload } = useAlertRules(portfolioUuid);
  // null = form closed; { rule: null } = creating; { rule } = editing that rule.
  const [form, setForm] = useState<{ rule: AlertRuleResponse | null } | null>(null);
  const [assetOptions, setAssetOptions] = useState<AssetOption[] | null>(null);
  const [toDelete, setToDelete] = useState<AlertRuleResponse | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // The asset picker's options come from the current holdings, fetched the first time the form opens.
  useEffect(() => {
    if (form === null || assetOptions !== null) return;
    let cancelled = false;
    portfolioService.getHoldings(portfolioUuid)
      .then((res) => {
        if (cancelled) return;
        setAssetOptions((res?.holdings ?? []).map((h) => ({
          assetId: h.assetId,
          label: h.ticker ? `${h.ticker} — ${h.name}` : h.name,
        })));
      })
      .catch(() => { if (!cancelled) setAssetOptions([]); });
    return () => { cancelled = true; };
  }, [form, assetOptions, portfolioUuid]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message]);

  const replaceRule = (updated: AlertRuleResponse) =>
    setRules((prev) => (prev ? prev.map((r) => (r.ruleId === updated.ruleId ? updated : r)) : prev));

  const handleToggleEnabled = async (rule: AlertRuleResponse) => {
    setBusyId(rule.ruleId);
    setMessage(null);
    try {
      replaceRule(await alertService.updateRule(portfolioUuid, rule.ruleId, { enabled: !rule.enabled }));
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unable to update this alert." });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await alertService.deleteRule(portfolioUuid, toDelete.ruleId);
      setRules((prev) => (prev ? prev.filter((r) => r.ruleId !== toDelete.ruleId) : prev));
      setMessage({ type: "success", text: "Alert deleted." });
      setToDelete(null);
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unable to delete this alert." });
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = (saved: AlertRuleResponse, created: boolean) => {
    if (created) setRules((prev) => [...(prev ?? []), saved]);
    else replaceRule(saved);
    setForm(null);
    setMessage({ type: "success", text: created ? "Alert created." : "Alert updated." });
  };

  const count = rules?.length ?? 0;
  const atLimit = count >= ALERT_RULE_LIMIT;

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(196,154,60,0.15)] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-[#1c1917]">
                {clientName ? `Alerts on ${clientName}'s portfolio` : "Your alerts"}
              </span>
              <p className="text-xs text-[#78716c] mt-0.5">
                {count} of {ALERT_RULE_LIMIT} · checked about every 5 minutes
              </p>
            </div>
          </div>
          <button
            onClick={() => { setMessage(null); setForm({ rule: null }); }}
            disabled={atLimit || form !== null || loading || rules === null}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> New alert
          </button>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl border text-sm font-bold ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                : "bg-rose-50 border-rose-200 text-rose-700"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}

        {atLimit && (
          <p className="text-xs text-[#78716c]">
            You&apos;ve reached the limit of {ALERT_RULE_LIMIT} alerts. Delete one to add another.
          </p>
        )}

        {form && (
          <AlertForm
            key={form.rule?.ruleId ?? "new"}
            rule={form.rule}
            portfolioUuid={portfolioUuid}
            clientName={clientName}
            assetOptions={assetOptions}
            onSaved={handleSaved}
            onCancel={() => setForm(null)}
          />
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-sm text-[#78716c]">
            <p>{error}</p>
            <button onClick={reload} className="font-bold text-[#C49A3C] underline underline-offset-2">Try again</button>
          </div>
        ) : rules !== null && rules.length === 0 ? (
          <p className="text-sm text-[#78716c] py-2">
            {clientName
              ? `No alerts on ${clientName}'s portfolio yet. Create one to be told when it moves by a set amount, or when a single holding grows past a share you choose.`
              : "You have no alerts yet. Create one to be told when your portfolio moves by a set amount, or when a single holding grows past a share you choose."}
          </p>
        ) : (
          <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
            {(rules ?? []).map((rule) => {
              const { title, subtitle } = describeAlert(rule, clientName);
              const state = alertState(rule);
              const busy = busyId === rule.ruleId;
              return (
                <li key={rule.ruleId} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
                  <div className="flex-1 min-w-48">
                    <p className="text-sm font-bold text-[#1c1917]">{title}</p>
                    <p className="text-xs text-[#78716c] mt-0.5">
                      {subtitle}
                      {rule.lastTriggeredAt && ` · Last triggered ${formatDate(rule.lastTriggeredAt)}`}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#78716c]">
                      <span className={`px-2.5 py-0.5 rounded-full ${TONE_STYLES[state.tone].chip}`}>{state.label}</span>
                      {rule.notifyEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email</span>}
                      {rule.notifyInApp && <span className="flex items-center gap-1"><Bell className="w-3 h-3" /> In-app</span>}
                      {!rule.notifyEmail && !rule.notifyInApp && <span>Dashboard only</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={busy ? "pointer-events-none opacity-60" : ""}>
                      <Toggle
                        checked={rule.enabled}
                        onChange={() => handleToggleEnabled(rule)}
                        label={rule.enabled ? `Turn off ${title}` : `Turn on ${title}`}
                      />
                    </div>
                    <button
                      onClick={() => { setMessage(null); setForm({ rule }); }}
                      aria-label={`Edit ${title}`}
                      className="p-2 rounded-lg text-[#78716c] hover:text-[#1c1917] hover:bg-[#F7F5EF] transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setToDelete(rule)}
                      aria-label={`Delete ${title}`}
                      className="p-2 rounded-lg text-[#78716c] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete this alert?"
          description={`"${describeAlert(toDelete).title}" will stop being checked and disappear from your dashboard. This can't be undone.`}
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

/**
 * ALERT FORM — create a rule or edit one. The rule's type is fixed once created (an edit changes
 * its threshold, direction, period, asset and channels, not what kind of alert it is). Params are
 * only sent on an edit if they actually changed, because changing them restarts the rule.
 * Backend errors (the 20-rule limit, a portfolio-change period the history doesn't cover yet)
 * are shown as the backend words them.
 */
function AlertForm({
  rule, portfolioUuid, clientName, assetOptions, onSaved, onCancel,
}: {
  rule: AlertRuleResponse | null;
  portfolioUuid: string;
  clientName?: string;
  assetOptions: AssetOption[] | null;
  onSaved: (saved: AlertRuleResponse, created: boolean) => void;
  onCancel: () => void;
}) {
  const editing = rule !== null;
  const initial = rule?.params;
  const portfolio = clientName ? `${clientName}'s portfolio` : "your portfolio";

  const [type, setType] = useState<AlertParams["type"]>(initial?.type ?? "portfolio_change");
  const [direction, setDirection] = useState<AlertDirection>(initial?.type === "portfolio_change" ? initial.direction : "down");
  const [span, setSpan] = useState<AlertWindow>(initial?.type === "portfolio_change" ? initial.window : "day");
  const [threshold, setThreshold] = useState(initial ? String(initial.thresholdPct) : "");
  const [assetId, setAssetId] = useState(initial?.type === "asset_weight" ? initial.assetId ?? "" : "");
  const [notifyEmail, setNotifyEmail] = useState(rule?.notifyEmail ?? true);
  const [notifyInApp, setNotifyInApp] = useState(rule?.notifyInApp ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const maxThreshold = type === "portfolio_change" ? 1000 : 100;
  const thresholdNumber = Number(threshold.replace(",", "."));
  const thresholdValid = threshold.trim() !== "" && Number.isFinite(thresholdNumber) && thresholdNumber > 0 && thresholdNumber <= maxThreshold;

  // The picker lists current holdings; an edited rule may point at an asset no longer held, which
  // still needs an option so the select doesn't silently switch it to "any asset".
  const options = [...(assetOptions ?? [])];
  if (assetId && !options.some((o) => o.assetId === assetId)) {
    options.push({ assetId, label: rule?.reading?.assetName ?? "Selected asset (no longer held)" });
  }
  const assetLabel = options.find((o) => o.assetId === assetId)?.label;

  const params: AlertParams | null = !thresholdValid
    ? null
    : type === "portfolio_change"
      ? { type, direction, thresholdPct: thresholdNumber, window: span }
      : { type, thresholdPct: thresholdNumber, assetId: assetId || null };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!params) return;
    setSaving(true);
    setFormError(null);
    try {
      if (rule === null) {
        onSaved(await alertService.createRule(portfolioUuid, { params, notifyEmail, notifyInApp }), true);
        return;
      }
      const changes: AlertRuleUpdateRequest = {};
      if (!sameParams(params, rule.params)) changes.params = params;
      if (notifyEmail !== rule.notifyEmail) changes.notifyEmail = notifyEmail;
      if (notifyInApp !== rule.notifyInApp) changes.notifyInApp = notifyInApp;
      if (Object.keys(changes).length === 0) {
        onCancel();
        return;
      }
      onSaved(await alertService.updateRule(portfolioUuid, rule.ruleId, changes), false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to save this alert.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-[rgba(196,154,60,0.3)] bg-[#FBFAF6] p-5 md:p-6 space-y-5">
      <h3 className="text-sm font-black text-[#1c1917]">{editing ? "Edit alert" : "New alert"}</h3>

      <div>
        <span className={FIELD_LABEL}>Alert type</span>
        <div className="inline-flex gap-1 p-1 bg-white rounded-xl border border-[rgba(196,154,60,0.2)]">
          {([
            { id: "portfolio_change", label: "Portfolio change" },
            { id: "asset_weight", label: "Asset weight" },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={editing}
              onClick={() => setType(t.id)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                type === t.id ? "bg-[#1c1917] text-white" : "text-[#78716c] hover:text-[#1c1917]"
              } ${editing && type !== t.id ? "opacity-40" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {type === "portfolio_change" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Direction</span>
              <select value={direction} onChange={(e) => setDirection(e.target.value as AlertDirection)} className={FIELD_INPUT}>
                <option value="down">Falls</option>
                <option value="up">Rises</option>
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>By at least (%)</span>
              <input
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="5"
                className={FIELD_INPUT}
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Over</span>
              <select value={span} onChange={(e) => setSpan(e.target.value as AlertWindow)} className={FIELD_INPUT}>
                {(Object.keys(WINDOW_LABEL) as AlertWindow[]).map((w) => (
                  <option key={w} value={w}>{WINDOW_LABEL[w]}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-[#78716c]">
            Measured on the result of {portfolio}, net of deposits and withdrawals. It isn&apos;t the time-weighted
            return shown in the reports.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className={FIELD_LABEL}>Asset</span>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)} className={FIELD_INPUT}>
                <option value="">Any asset</option>
                {options.map((o) => <option key={o.assetId} value={o.assetId}>{o.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Above (% of portfolio)</span>
              <input
                type="text"
                inputMode="decimal"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="30"
                className={FIELD_INPUT}
              />
            </label>
          </div>
          <p className="text-xs text-[#78716c]">
            Triggers when the asset&apos;s share of {portfolio} goes above this value.
            {assetOptions === null && " Loading the holdings…"}
          </p>
        </div>
      )}

      {threshold.trim() !== "" && !thresholdValid && (
        <p className="text-xs font-bold text-rose-600">Enter a number above 0 and up to {maxThreshold}.</p>
      )}

      <div>
        <span className={FIELD_LABEL}>Notify me by</span>
        <div className="divide-y divide-[rgba(196,154,60,0.1)] rounded-xl border border-[rgba(196,154,60,0.2)] bg-white px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <p className="text-sm font-bold text-[#1c1917] flex items-center gap-2"><Mail className="w-4 h-4 text-[#78716c]" /> Email</p>
            <Toggle checked={notifyEmail} onChange={setNotifyEmail} label="Notify by email" />
          </div>
          <div className="flex items-center justify-between gap-4 py-3">
            <p className="text-sm font-bold text-[#1c1917] flex items-center gap-2"><Bell className="w-4 h-4 text-[#78716c]" /> In-app notification</p>
            <Toggle checked={notifyInApp} onChange={setNotifyInApp} label="Notify in the app" />
          </div>
        </div>
        {!notifyEmail && !notifyInApp && (
          <p className="text-xs text-[#78716c] mt-2">With both off, this alert only shows on your dashboard.</p>
        )}
      </div>

      {params && (
        <p className="text-sm text-[#1c1917] bg-white border border-[rgba(196,154,60,0.2)] rounded-xl px-4 py-3 leading-relaxed">
          {describeParams(params, assetLabel, clientName)}
        </p>
      )}

      {editing && (
        <p className="text-xs text-[#78716c]">
          Changing the condition restarts the alert: its next check is a fresh starting point and can&apos;t trigger it.
        </p>
      )}

      {formError && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p className="text-sm font-bold">{formError}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#78716c] hover:bg-white transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!params || saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {editing ? "Save changes" : "Create alert"}
        </button>
      </div>
    </form>
  );
}
