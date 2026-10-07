"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Bell, Mail, Plus, Pencil, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { alertService } from "../../services/alertService";
import { portfolioService } from "../../services/portfolioService";
import { usePortfoliosAlertRules, type PortfolioAlertRule } from "../../hooks/useAlertRules";
import { ConfirmDialog } from "./ConfirmDialog";
import { Toggle } from "./Toggle";
import { TONE_STYLES } from "./AlertGauge";
import { PortfolioGroupCard } from "./PortfolioGroupCard";
import { useUser } from "../../context/UserContext";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { PreviewBadge } from "../preview/PreviewKit";
import { isSampleRule, sampleAlertRules } from "../../lib/mock/alerts";
import {
  alertFigures, alertState, describeAlert, describeParams, sameParams, ALERT_RULE_LIMIT, WINDOW_LABEL, type AlertTone,
} from "../../lib/alerts";
import type {
  AlertParams, AlertRuleUpdateRequest, AlertDirection, AlertWindow, GroupWeightParams,
} from "../../models/Alert";

interface AssetOption {
  assetId: string;
  label: string;
}

/** A portfolio whose alerts are managed here; `color` marks its group (its colour elsewhere). */
export type AlertPortfolio = { uuid: string; name: string; color?: string };

const FIELD_LABEL = "block text-[10px] font-bold text-[#78716c] uppercase tracking-wider mb-1.5";
const FIELD_INPUT =
  "w-full h-11 px-3.5 rounded-xl bg-white border border-[rgba(196,154,60,0.2)] text-[#1c1917] text-sm font-semibold outline-none focus:border-[#C49A3C] transition-colors";

// The progress bar's fill, by the rule's state.
const BAR_TONE: Record<AlertTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
  muted: "bg-slate-300",
};

// The card header's summary: how many rules are in each state, most pressing first.
const TONE_SUMMARY: { tone: AlertTone; label: string }[] = [
  { tone: "danger", label: "triggered" },
  { tone: "warn", label: "approaching" },
  { tone: "ok", label: "within range" },
  { tone: "muted", label: "off or waiting" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * ALERTS SETTINGS — managing alert rules: list them (with their state, a switch to turn each on or
 * off, edit, delete) and create new ones. The Dashboard shows the same rules as dials; this is
 * where they're configured. At most ALERT_RULE_LIMIT per portfolio.
 *
 * Every alert-rule route is nested under a portfolio, so the rules are those of `portfolios`.
 * Without `clientName` they're the investor's own (a portfolio's Alerts page in Wealth, All
 * portfolios' passing itself and every portfolio): with two or more, each portfolio gets a card
 * of its own, with its rules and its own
 * "New alert", whose form opens in that card. With `clientName` it's an advisor's
 * rules on that client's portfolio (the Clients section, passed that client's default one): the
 * asset picker lists the client's holdings, and the advisor is the one notified. A demo account
 * (read only) also sees sample rules on two of its portfolios that have none (lib/mock/alerts),
 * to show what the page looks like with some.
 */
// `grouped`: the per-portfolio card even for a single portfolio, so it's named (one portfolio's
// alerts, opened from Manage portfolios).
export function AlertsSettings({ portfolios, clientName, grouped: forceGrouped }: { portfolios: AlertPortfolio[]; clientName?: string; grouped?: boolean }) {
  const uuids = portfolios.map((p) => p.uuid);
  const { rules, setRules, loading, error, reload } = usePortfoliosAlertRules(uuids);
  const grouped = forceGrouped ?? portfolios.length > 1;
  // A demo account (see lib/demo) sees its rules but can't create, change or delete them.
  const { isDemo } = useUser();
  // null = form closed; { rule: null } = creating on `portfolioUuid`; { rule } = editing that rule.
  const [form, setForm] = useState<{ rule: PortfolioAlertRule | null; portfolioUuid: string } | null>(null);
  // The asset picker's options per portfolio, from its current holdings, fetched the first time
  // the form needs them.
  const [assetOptions, setAssetOptions] = useState<Record<string, AssetOption[]>>({});
  const [toDelete, setToDelete] = useState<PortfolioAlertRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formPortfolio = form?.portfolioUuid ?? null;
  useEffect(() => {
    if (!formPortfolio || assetOptions[formPortfolio]) return;
    let cancelled = false;
    portfolioService.getInsightsComposition(formPortfolio)
      .then((res) => {
        if (cancelled) return;
        setAssetOptions((prev) => ({
          ...prev,
          [formPortfolio]: (res.holdings?.holdings ?? []).map((h) => ({
            assetId: h.assetId,
            label: h.ticker ? `${h.ticker} — ${h.name}` : h.name,
          })),
        }));
      })
      .catch(() => { if (!cancelled) setAssetOptions((prev) => ({ ...prev, [formPortfolio]: [] })); });
    return () => { cancelled = true; };
  }, [formPortfolio, assetOptions]);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(id);
  }, [message]);

  const replaceRule = (updated: PortfolioAlertRule) =>
    setRules((prev) => (prev ? prev.map((r) => (r.ruleId === updated.ruleId ? updated : r)) : prev));

  const handleToggleEnabled = async (rule: PortfolioAlertRule) => {
    setBusyId(rule.ruleId);
    setMessage(null);
    try {
      const updated = await alertService.updateRule(rule.portfolioUuid, rule.ruleId, { enabled: !rule.enabled });
      replaceRule({ ...updated, portfolioUuid: rule.portfolioUuid });
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
      await alertService.deleteRule(toDelete.portfolioUuid, toDelete.ruleId);
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

  const handleSaved = (saved: PortfolioAlertRule, created: boolean) => {
    if (created) setRules((prev) => [...(prev ?? []), saved]);
    else replaceRule(saved);
    setForm(null);
    setMessage({ type: "success", text: created ? "Alert created." : "Alert updated." });
  };

  // The rules shown: a demo account's own, plus the samples.
  const shown = useMemo(() => {
    if (!isDemo || clientName || rules === null) return rules;
    const bare = portfolios.filter((p) => !rules.some((r) => r.portfolioUuid === p.uuid)).map((p) => p.uuid);
    return [...rules, ...sampleAlertRules(bare)];
  }, [isDemo, clientName, rules, portfolios]);
  const rulesOf = (uuid: string) => (shown ?? []).filter((r) => r.portfolioUuid === uuid);
  const atLimit = (uuid: string) => rulesOf(uuid).length >= ALERT_RULE_LIMIT;
  const count = shown?.length ?? 0;
  const openNew = (portfolioUuid: string) => {
    setMessage(null);
    setForm({ rule: null, portfolioUuid });
  };
  const newDisabled = isDemo || form !== null || loading || rules === null;

  // One rule per row, across the card: what it watches and how it notifies; where it stands (now
  // against the limit, and how far along the way it is); then its switch, edit and delete.
  const renderRule = (rule: PortfolioAlertRule) => {
    const { title, subtitle } = describeAlert(rule, clientName);
    const state = alertState(rule);
    const figures = alertFigures(rule);
    const busy = busyId === rule.ruleId;
    return (
      <li key={rule.ruleId} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-8 gap-y-4 py-5">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-black text-[#1c1917]">
            {title}{isSampleRule(rule) && <PreviewBadge label="Sample" />}
          </p>
          <p className="text-[13px] text-[#78716c] mt-1">
            {subtitle}
            {rule.lastTriggeredAt && ` · Last triggered ${formatDate(rule.lastTriggeredAt)}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-[#78716c]">
            {rule.notifyEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>}
            {rule.notifyInApp && <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" /> In-app</span>}
            {!rule.notifyEmail && !rule.notifyInApp && <span>Dashboard only</span>}
            {rule.policyConstraintId && <span>Kept by the portfolio&apos;s policy</span>}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[state.tone].chip}`}>{state.label}</span>
            {figures && (
              <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">
                {figures.current} <span className="text-[#a8a29e] font-semibold">of {figures.limit}</span>
              </span>
            )}
          </div>
          <div className="mt-2.5 h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
            {state.progressPct !== null && (
              <div className={`h-full rounded-full ${BAR_TONE[state.tone]}`} style={{ width: `${Math.max(3, state.progressPct)}%` }} />
            )}
          </div>
          <p className="text-[11px] font-semibold text-[#a8a29e] mt-1.5">
            {state.progressPct !== null ? `${Math.round(state.progressPct)}% of the way to the limit` : state.kind === "off" ? "Not being checked" : "Nothing measured yet"}
          </p>
        </div>

        {/* A policy's rule changes with the policy (PATCH / DELETE on it are a 409). */}
        {!isDemo && !rule.policyConstraintId ? (
          <div className="flex items-center gap-1.5 md:justify-end">
            <div className={busy ? "pointer-events-none opacity-60" : ""}>
              <Toggle
                checked={rule.enabled}
                onChange={() => handleToggleEnabled(rule)}
                label={rule.enabled ? `Turn off ${title}` : `Turn on ${title}`}
              />
            </div>
            <button
              onClick={() => { setMessage(null); setForm({ rule, portfolioUuid: rule.portfolioUuid }); }}
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
        ) : <div className="hidden md:block" />}
      </li>
    );
  };

  const messageBanner = message && (
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
  );

  const newButton = (p: AlertPortfolio) => (
    <button
      onClick={() => openNew(p.uuid)}
      disabled={newDisabled || atLimit(p.uuid)}
      title={isDemo ? DEMO_DISABLED_TITLE : atLimit(p.uuid) ? `The limit is ${ALERT_RULE_LIMIT} alerts per portfolio. Delete one to add another.` : undefined}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
    >
      <Plus className="w-4 h-4" /> New alert
    </button>
  );

  // The form, in the card of the portfolio it's for.
  const formFor = (p: AlertPortfolio) => form && form.portfolioUuid === p.uuid && (
    <AlertForm
      key={form.rule?.ruleId ?? `new:${p.uuid}`}
      rule={form.rule}
      portfolio={p}
      named={grouped}
      clientName={clientName}
      holdings={assetOptions[p.uuid] ?? null}
      onSaved={handleSaved}
      onCancel={() => setForm(null)}
    />
  );

  const status = loading ? (
    <div className="flex justify-center py-6">
      <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
    </div>
  ) : error ? (
    <div className="flex items-center gap-3 text-sm text-[#78716c]">
      <p>{error}</p>
      <button onClick={reload} className="font-bold text-[#C49A3C] underline underline-offset-2">Try again</button>
    </div>
  ) : null;

  const confirmDelete = toDelete && (
    <ConfirmDialog
      title="Delete this alert?"
      description={`"${describeAlert(toDelete).title}" will stop being checked and disappear from your dashboard. This can't be undone.`}
      confirming={deleting}
      onConfirm={handleDelete}
      onClose={() => setToDelete(null)}
    />
  );

  // Several portfolios: one card each — its colour, name and count, its "New alert", the form when
  // it's open on it, then its rules.
  if (grouped) {
    return (
      <div className="space-y-5">
        {messageBanner}
        {status && <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm">{status}</div>}
        {!status && shown !== null && portfolios.map((p) => {
          const own = rulesOf(p.uuid);
          // How many rules are in each state, most pressing first, for the header's pills.
          const byTone = TONE_SUMMARY
            .map((t) => ({ ...t, count: own.filter((r) => alertState(r).tone === t.tone).length }))
            .filter((t) => t.count > 0);
          return (
            <PortfolioGroupCard
              key={p.uuid}
              name={p.name}
              color={p.color}
              subtitle={<>
                {own.length === 0 ? "No alerts yet" : `${own.length} of ${ALERT_RULE_LIMIT} alerts`}
                <span className="text-[#a8a29e]"> · checked about every 5 minutes</span>
              </>}
              right={<>
                {byTone.map((t) => (
                  <span key={t.tone} className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${TONE_STYLES[t.tone].chip}`}>
                    {t.count} {t.label}
                  </span>
                ))}
                {newButton(p)}
              </>}
            >
              {form?.portfolioUuid === p.uuid && <div className="px-6 md:px-8 pb-5">{formFor(p)}</div>}
              {own.length === 0 ? (
                <p className="px-6 md:px-8 py-5 border-t border-[rgba(196,154,60,0.12)] text-sm text-[#a8a29e]">
                  Nothing watched on this portfolio. Create an alert to be told when it moves by a set amount, or when a holding grows past a share you choose.
                </p>
              ) : (
                <ul className="px-6 md:px-8 border-t border-[rgba(196,154,60,0.12)] divide-y divide-[rgba(196,154,60,0.1)]">{own.map(renderRule)}</ul>
              )}
            </PortfolioGroupCard>
          );
        })}
        {confirmDelete}
      </div>
    );
  }

  // One portfolio (an advisor's client, or an investor with just one): a single card.
  const only = portfolios[0];
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
          {only && newButton(only)}
        </div>

        {messageBanner}

        {only && atLimit(only.uuid) && (
          <p className="text-xs text-[#78716c]">
            You&apos;ve reached the limit of {ALERT_RULE_LIMIT} alerts. Delete one to add another.
          </p>
        )}

        {only && formFor(only)}

        {status ?? (shown !== null && shown.length === 0 ? (
          <p className="text-sm text-[#78716c] py-2">
            {clientName
              ? `No alerts on ${clientName}'s portfolio yet. Create one to be told when it moves by a set amount, or when a single holding grows past a share you choose.`
              : "You have no alerts yet. Create one to be told when your portfolio moves by a set amount, or when a single holding grows past a share you choose."}
          </p>
        ) : (
          <ul className="divide-y divide-[rgba(196,154,60,0.1)]">{(shown ?? []).map(renderRule)}</ul>
        ))}
      </div>

      {confirmDelete}
    </div>
  );
}

/**
 * ALERT FORM — create a rule or edit one. The rule's type is fixed once created (an edit changes
 * its threshold, direction, period, asset and channels, not what kind of alert it is). Params are
 * only sent on an edit if they actually changed, because changing them restarts the rule.
 * Backend errors (the 20-rule limit, a portfolio-change period the history doesn't cover yet)
 * are shown as the backend words them. It's always on one portfolio (`portfolio`); `named` words
 * it by that portfolio's name, when the user has several.
 */
type FormParams = Exclude<AlertParams, GroupWeightParams>;

function AlertForm({
  rule, portfolio: target, named, clientName, holdings, onSaved, onCancel,
}: {
  rule: PortfolioAlertRule | null;
  portfolio: AlertPortfolio;
  named: boolean;
  clientName?: string;
  // The portfolio's holdings for the asset picker; null while they load.
  holdings: AssetOption[] | null;
  onSaved: (saved: PortfolioAlertRule, created: boolean) => void;
  onCancel: () => void;
}) {
  const editing = rule !== null;
  // A policy's group-weight rules are never edited here (see renderRule), so the form only knows
  // the two kinds it creates.
  const initial = rule?.params.type === "group_weight" ? undefined : rule?.params;
  const portfolioUuid = target.uuid;
  const portfolio = clientName ? `${clientName}'s portfolio` : named ? target.name : "your portfolio";

  const [type, setType] = useState<FormParams["type"]>(initial?.type ?? "portfolio_change");
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
  const options = [...(holdings ?? [])];
  if (assetId && !options.some((o) => o.assetId === assetId)) {
    options.push({ assetId, label: rule?.reading?.assetName ?? "Selected asset (no longer held)" });
  }
  const assetLabel = options.find((o) => o.assetId === assetId)?.label;

  const params: FormParams | null = !thresholdValid
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
        onSaved({ ...await alertService.createRule(portfolioUuid, { params, notifyEmail, notifyInApp }), portfolioUuid }, true);
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
      onSaved({ ...await alertService.updateRule(portfolioUuid, rule.ruleId, changes), portfolioUuid }, false);
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
            {holdings === null && " Loading the holdings…"}
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
          {describeParams(params, assetLabel, clientName, named ? target.name : undefined)}
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
