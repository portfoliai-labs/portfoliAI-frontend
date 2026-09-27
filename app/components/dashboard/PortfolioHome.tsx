// components/dashboard/PortfolioHome.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BellRing, FileText, Loader2, Receipt, TrendingUp, Pencil } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { reportService } from "../../services/reportService";
import { transactionService } from "../../services/transactionService";
import { useAlertRules } from "../../hooks/useAlertRules";
import { alertState } from "../../lib/alerts";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { ActionCard, PortfolioCardMenu } from "./InsightsHub";
import { ConfirmDialog } from "./ConfirmDialog";
import { FileUploader } from "./FileUploader";
import { ReportsList } from "./ReportsList";
import { AlertsSettings } from "./AlertsSettings";
import { useGenerateReport } from "./GenerateReport";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

export type PortfolioPage = "home" | "insights" | "transactions" | "reports" | "alerts";

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const formatSigned = (amount: number, currency: string) => `${amount >= 0 ? "+" : ""}${formatCurrency(amount, currency, 0)}`;

/**
 * PORTFOLIO HOME — one portfolio's own page, opened from its card on the Portfolios hub: its
 * key figures (value, return, the curve behind it), then the way into its
 * Insights, Transactions, Reports and Alerts, each card with a line of what's there. Rename and
 * delete sit in the "…" at the top right ("All portfolios", built automatically, has neither).
 * The aggregate has no reports (the backend doesn't make them), and its transactions are every
 * portfolio's, added to whichever one is picked.
 */
export function PortfolioHome({
  portfolio, trail, onOpenPage, onDeleted,
}: {
  portfolio: Portfolio;
  trail: Crumb[];
  onOpenPage: (page: PortfolioPage) => void;
  onDeleted: () => void;
}) {
  const { deletePortfolio } = usePortfolio();
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deletePortfolio(portfolio.uuid);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this portfolio.");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb
        trail={trail}
        current={portfolio.name}
        right={!portfolio.isAggregate && (
          <PortfolioCardMenu canDelete={!portfolio.isDefault} onRename={() => setRenaming(true)} onDelete={() => setConfirmDelete(true)} />
        )}
      />
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}

      <PortfolioHeadline portfolioUuid={portfolio.uuid} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard
          className="md:col-span-3 min-h-0"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Insights"
          text="What it holds, what it earned and cost, how it performed and how much it swings."
          onClick={() => onOpenPage("insights")}
        >
          <div className="flex flex-wrap gap-1.5">
            {["Composition", "Income & Costs", "Performance", "Risk"].map((label) => (
              <span key={label} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-stone-300">{label}</span>
            ))}
          </div>
        </ActionCard>
        <TransactionsCard portfolio={portfolio} onOpen={() => onOpenPage("transactions")} />
        <ReportsCard portfolio={portfolio} onOpen={() => onOpenPage("reports")} />
        <AlertsCard portfolio={portfolio} onOpen={() => onOpenPage("alerts")} />
      </div>

      {renaming && <RenamePortfolioDialog portfolio={portfolio} onClose={() => setRenaming(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title={`Delete "${portfolio.name}"?`}
          description="This permanently deletes this portfolio and every transaction, alert and report in it. This can't be undone."
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

/**
 * PORTFOLIO HEADLINE — the portfolio's figures at a glance, from its column of GET
 * /v1/portfolios/comparison: what it's worth, its return since inception and per year, the
 * gain on what's still held, and the return curve since its first day.
 */
function PortfolioHeadline({ portfolioUuid }: { portfolioUuid: string }) {
  const [state, setState] = useState<{ entry: PortfolioComparisonEntry | null; loading: boolean }>({ entry: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare([portfolioUuid])
      .then((list) => { if (!cancelled) setState({ entry: list[0] ?? null, loading: false }); })
      .catch(() => { if (!cancelled) setState({ entry: null, loading: false }); });
    return () => { cancelled = true; };
  }, [portfolioUuid]);

  const value = state.entry?.value ?? null;
  const performance = state.entry?.performance ?? null;
  const points = useMemo(() => (performance?.cumulativeReturnPct ? toChartPoints(performance.cumulativeReturnPct) : []), [performance]);
  const totalReturn = performance?.totalReturnPct ?? null;
  const lineColor = totalReturn === null || totalReturn >= 0 ? "#10b981" : "#f43f5e";

  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {state.loading ? (
        <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C49A3C]" /></div>
      ) : value === null ? (
        <p className="p-6 md:p-7 text-sm font-semibold text-slate-500">No figures yet — add transactions and they&apos;ll show up here.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="p-6 md:p-7 flex flex-col justify-between gap-6">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">Value today</p>
              <p className="text-3xl md:text-4xl font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {formatCurrency(value.marketValue, value.currency, 0)}
              </p>
              {totalReturn !== null && (
                <p className="text-[13px] font-bold tabular-nums mt-2">
                  <span className={totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(totalReturn)}</span>
                  <span className="text-slate-400 font-semibold"> since inception</span>
                </p>
              )}
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <HeadlineFigure label="Invested" value={formatCurrency(value.investedCapital, value.currency, 0)} />
              <HeadlineFigure
                label="Unrealized P&L"
                value={formatSigned(value.unrealizedPnl, value.currency)}
                tone={value.unrealizedPnl >= 0 ? "gain" : "loss"}
              />
              <HeadlineFigure
                label="Per year"
                value={performance?.annualizedReturnPct == null ? "—" : formatPct(performance.annualizedReturnPct)}
                tone={performance?.annualizedReturnPct == null ? undefined : performance.annualizedReturnPct >= 0 ? "gain" : "loss"}
              />
              <HeadlineFigure label="Dividends" value={formatCurrency(value.dividendIncome, value.currency, 0)} />
            </dl>
          </div>
          {points.length >= 2 && (
            <div className="h-56 lg:h-auto lg:min-h-64 border-t lg:border-t-0 lg:border-l border-slate-100 p-4">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 240 }}>
                <AreaChart data={points} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
                  <YAxis hide domain={["auto", "auto"]} />
                  <Area type="monotone" dataKey="value" stroke={lineColor} strokeWidth={2} fill={lineColor} fillOpacity={0.1} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HeadlineFigure({ label, value, tone }: { label: string; value: string; tone?: "gain" | "loss" }) {
  return (
    <div>
      <dt className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</dt>
      <dd className={`text-base font-black tabular-nums mt-1 ${tone === "gain" ? "text-emerald-600" : tone === "loss" ? "text-rose-600" : "text-slate-900"}`}>
        {value}
      </dd>
    </div>
  );
}

// The line of live detail on each destination card: a spinner until it's known.
function CardDetail({ children }: { children: React.ReactNode | null }) {
  return (
    <p className="text-xs font-bold text-[#C49A3C]">
      {children ?? <Loader2 className="h-3.5 w-3.5 animate-spin" />}
    </p>
  );
}

function TransactionsCard({ portfolio, onOpen }: { portfolio: Portfolio; onOpen: () => void }) {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    transactionService.getUserTransactions(portfolio.uuid, 1, 0)
      .then((res) => { if (!cancelled) setTotal(res.total); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portfolio.uuid]);

  return (
    <ActionCard
      icon={<Receipt className="h-5 w-5" />}
      title="Transactions"
      text={portfolio.isAggregate ? "Every portfolio's buys, sells and dividends, in one list." : "Its buys, sells and dividends: add, import or edit them."}
      onClick={onOpen}
    >
      <CardDetail>{total === null ? null : `${total.toLocaleString("en-US")} ${total === 1 ? "transaction" : "transactions"}`}</CardDetail>
    </ActionCard>
  );
}

function ReportsCard({ portfolio, onOpen }: { portfolio: Portfolio; onOpen: () => void }) {
  const [latest, setLatest] = useState<{ count: number; date: string | null } | null>(null);
  useEffect(() => {
    if (portfolio.isAggregate) return;
    let cancelled = false;
    reportService.getAllDocuments(portfolio.uuid)
      .then((docs) => {
        if (cancelled) return;
        const newest = [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        setLatest({ count: docs.length, date: newest?.created_at ?? null });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portfolio.uuid, portfolio.isAggregate]);

  if (portfolio.isAggregate) {
    return (
      <ActionCard icon={<FileText className="h-5 w-5" />} title="Reports" text="Reports are made for each portfolio on its own — open one to generate its report." />
    );
  }

  return (
    <ActionCard icon={<FileText className="h-5 w-5" />} title="Reports" text="Full-history PDF reports, generated on demand." onClick={onOpen}>
      <CardDetail>
        {latest === null
          ? null
          : latest.count === 0 || !latest.date
            ? "No reports yet"
            : `${latest.count} ${latest.count === 1 ? "report" : "reports"} · last ${new Date(latest.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
      </CardDetail>
    </ActionCard>
  );
}

function AlertsCard({ portfolio, onOpen }: { portfolio: Portfolio; onOpen: () => void }) {
  const { rules, loading } = useAlertRules(portfolio.uuid);
  const triggered = (rules ?? []).filter((r) => alertState(r).breached).length;
  const active = (rules ?? []).filter((r) => r.enabled).length;

  return (
    <ActionCard icon={<BellRing className="h-5 w-5" />} title="Alerts" text="Get notified when it or one of its holdings moves past your limits." onClick={onOpen}>
      <CardDetail>
        {loading || rules === null
          ? null
          : rules.length === 0
            ? "No alerts set"
            : `${active} active${triggered > 0 ? ` · ${triggered} triggered` : ""}`}
      </CardDetail>
    </ActionCard>
  );
}

/** "Portfolios / Main portfolio / Transactions". The aggregate lists every portfolio's. */
export function PortfolioTransactions({ portfolio, trail }: { portfolio: Portfolio; trail: Crumb[] }) {
  return (
    <div className="space-y-6">
      <Breadcrumb trail={trail} current="Transactions" />
      {/* A standard portfolio is fixed: its own list, and new rows go into it. The aggregate
          can't hold transactions itself, so it gets the all-portfolios list, where each new
          row picks the portfolio it goes into. */}
      {portfolio.isAggregate ? <FileUploader /> : <FileUploader portfolioUuid={portfolio.uuid} />}
    </div>
  );
}

/** "Portfolios / Main portfolio / Reports": its archive, and "Generate report" for it. */
export function PortfolioReports({ portfolio, trail }: { portfolio: Portfolio; trail: Crumb[] }) {
  const { generate, sending, toast } = useGenerateReport();
  return (
    <div className="space-y-6">
      <Breadcrumb
        trail={trail}
        current="Reports"
        right={!portfolio.isAggregate && (
          <button
            type="button"
            onClick={() => generate(portfolio)}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-60 shrink-0"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Generate report
          </button>
        )}
      />
      {toast}
      <ReportsList portfolioUuid={portfolio.uuid} />
    </div>
  );
}

/** "Portfolios / Main portfolio / Alerts": its alert rules. */
export function PortfolioAlerts({ portfolio, trail }: { portfolio: Portfolio; trail: Crumb[] }) {
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Alerts" />
      <AlertsSettings portfolioUuid={portfolio.uuid} />
    </div>
  );
}

/**
 * RENAME PORTFOLIO DIALOG — the portfolio page's Rename: a small dialog with the name, in the
 * same shell as ConfirmDialog.
 */
function RenamePortfolioDialog({ portfolio, onClose }: { portfolio: Portfolio; onClose: () => void }) {
  const { renamePortfolio } = usePortfolio();
  const [name, setName] = useState(portfolio.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === portfolio.name) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await renamePortfolio(portfolio.uuid, trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this portfolio.");
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={() => !saving && onClose()}>
      <div className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-md w-full p-6 md:p-8 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C49A3C]/10 rounded-xl shrink-0">
            <Pencil className="h-5 w-5 text-[#C49A3C]" />
          </div>
          <h3 className="text-lg font-black text-slate-900">Rename portfolio</h3>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") onClose();
          }}
          maxLength={80}
          aria-label="Portfolio name"
          className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-900 outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
        />
        {error && <p className="text-xs font-medium text-rose-600">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#1c1917] hover:bg-[#C49A3C] transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
