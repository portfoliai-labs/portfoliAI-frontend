// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Wallet,
  Coins,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import type { Portfolio, PortfolioSnapshot, TodayDashboard } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { usePortfolio } from "../../context/PortfolioContext";
import { AlertGaugeCard } from "./AlertGauge";
import { openPortfoliosPage } from "./InsightsSection";
import { DailyArticleModule } from "./NewsSection";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";
import { useUser } from "../../context/UserContext";
import { walletsSummary, type WalletsSummary } from "../preview/WalletsOverview";
import { PreviewBadge } from "../preview/PreviewKit";

// One portfolio's GET /v1/portfolios/{p}/overview: null snapshot = no data yet (no transactions,
// or the aggregate's first build hasn't landed), `failed` = the request itself errored.
type SnapshotState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; snapshot: PortfolioSnapshot | null };

/**
 * DASHBOARD — the whole wealth at a glance, not tied to the selected portfolio: the net worth
 * on top (every portfolio's market value, from the aggregate "All portfolios" or the only
 * portfolio, plus, for a demo account, the wallets' balance — a preview on sample data, see
 * components/preview), with a summary of the portfolios and of the wallets under it; then every
 * portfolio's alerts and the article of the day. Headline figures only: the rest lives under
 * Investments and Wallets, which the summaries open. The overview endpoint never mixes history
 * with fresh data (no isStale).
 */
export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const { isDemo } = useUser();
  // Wallets are a preview on sample data that only demo accounts see.
  const wallets = useMemo(() => (isDemo ? walletsSummary() : null), [isDemo]);
  const [snapshots, setSnapshots] = useState<Record<string, SnapshotState>>({});

  // Refetch only when the set of portfolios changes, not on every new array from the context
  // (a rename replaces the array but not the uuids). A portfolio with no entry yet reads as
  // loading; on a refetch the previous figures stay up until the new ones land.
  const uuidsKey = portfolios.map((p) => p.uuid).join(",");
  useEffect(() => {
    const uuids = uuidsKey ? uuidsKey.split(",") : [];
    let cancelled = false;
    uuids.forEach(async (uuid) => {
      let next: SnapshotState;
      try {
        next = { status: "ready", snapshot: await portfolioService.getPortfolioOverview(uuid) };
      } catch (err) {
        console.error(`Failed to fetch overview for portfolio ${uuid}:`, err);
        next = { status: "failed" };
      }
      if (!cancelled) setSnapshots((prev) => ({ ...prev, [uuid]: next }));
    });
    return () => { cancelled = true; };
  }, [uuidsKey]);

  // Every portfolio together: the aggregate when there is one, otherwise the only portfolio.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const headline = aggregate ?? portfolios[0];

  // Alerts are managed on each portfolio's page under Portfolios; "Manage alerts" (and the
  // empty state's button) open the selected portfolio's (see openPortfoliosPage).
  const openAlertSettings = () => {
    const target = current ?? headline;
    if (onNavigate && target) openPortfoliosPage(onNavigate, target.uuid, "alerts");
  };

  // A portfolio's page (and its Transactions) live under Portfolios, opened directly rather
  // than through the Portfolios hub.
  const openPortfolio = (uuid: string, section: string) => {
    selectPortfolio(uuid);
    if (!onNavigate) return;
    if (section === "performance") openPortfoliosPage(onNavigate, uuid, "home");
    else if (section === "upload") openPortfoliosPage(onNavigate, uuid, "transactions");
    else onNavigate(section);
  };

  if (!headline) return null;
  const headlineState = snapshots[headline.uuid] ?? { status: "loading" };
  // A lone portfolio with no data gets the full-page "no data" window and nothing else: an
  // alert with no portfolio to watch has nothing to measure.
  const noDataAtAll = headlineState.status === "ready" && headlineState.snapshot === null && !aggregate;

  if (headlineState.status === "loading") {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* NET WORTH — a lone portfolio with no data yet gets the full-page "no data" window
          instead (unless there are wallets to add up), since there's nothing else on the page. */}
      {headlineState.status === "failed" ? (
        <ErrorBanner message="Failed to load portfolio data" />
      ) : noDataAtAll && !wallets ? (
        <NoDataEmptyState
          title="No portfolio data yet"
          message="Add or upload your transactions and this is where you'll see what your portfolio is worth today."
          onNavigate={onNavigate ? (section) => openPortfolio(headline.uuid, section) : undefined}
        />
      ) : (
        <NetWorthModule
          portfolio={headline}
          snapshot={headlineState.snapshot}
          wallets={wallets}
          onOpenPortfolios={onNavigate ? () => onNavigate("performance") : undefined}
          onOpenWallets={onNavigate ? () => onNavigate("wallets") : undefined}
        />
      )}

      {/* ALERTS — every portfolio's, aggregate included, as one list sorted by urgency. */}
      {!noDataAtAll && (
        <AlertsModule
          portfolios={portfolios}
          onManage={onNavigate ? openAlertSettings : undefined}
        />
      )}

      {/* ARTICLE OF THE DAY — the same pick for everyone; renders nothing on a day without one. */}
      <DailyArticleModule />
    </div>
  );
}

const chartDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
// Unrealized P&L relative to what's invested; null when nothing is (a fully sold-out
// portfolio), where a percentage would be meaningless.
const unrealizedPct = (s: PortfolioSnapshot) =>
  s.totalInvestedCapital > 0 ? (s.totalUnrealizedPnl / s.totalInvestedCapital) * 100 : null;
const signedCurrency = (value: number, currency: string) => `${value >= 0 ? "+" : ""}${formatCurrency(value, currency, 0)}`;

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <p className="text-sm font-bold">{message}</p>
    </div>
  );
}

/**
 * NET WORTH MODULE — everything the user owns, in their reference currency: every portfolio at
 * today's market prices plus the wallets' balance, with a bar showing how it splits, then a
 * summary of each: the portfolios (market value, how the market moved it today and this month,
 * unrealized P&L) and the wallets (balance, this month's money in and out). The summaries open
 * Investments and Wallets. The portfolios' figures are the aggregate's (recomputed from every
 * portfolio's transactions combined) or the only portfolio's. Wallets in another currency than
 * the portfolios' are shown but not added in, since there's no rate to convert them with.
 */
function NetWorthModule({
  portfolio, snapshot, wallets, onOpenPortfolios, onOpenWallets,
}: {
  portfolio: Portfolio;
  // null: nothing computed yet (the aggregate's first build, or a portfolio with no data).
  snapshot: PortfolioSnapshot | null;
  wallets: WalletsSummary | null;
  onOpenPortfolios?: () => void;
  onOpenWallets?: () => void;
}) {
  const moves = useRecentMoves(portfolio.uuid);
  const currency = snapshot?.currency ?? wallets?.currency ?? "EUR";
  const investments = snapshot?.totalMarketValue ?? 0;
  const walletsCount = wallets && wallets.currency === currency ? wallets.balance : 0;
  const total = investments + walletsCount;
  const shareOf = (value: number) => (total > 0 ? Math.max(0, (value / total) * 100) : 0);
  const pnlPct = snapshot ? unrealizedPct(snapshot) : null;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title="Net Worth"
        desc={wallets ? "Everything you own: your portfolios at today's prices, plus your wallets' balance." : "Your portfolios at today's market prices."}
      />
      <div className="p-6 md:p-7 space-y-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total</p>
          <p className="text-4xl md:text-5xl font-black text-slate-900 tabular-nums mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {formatCurrency(total, currency, 0)}
          </p>
          {snapshot && <p className="text-[13px] text-slate-500 mt-1.5">As of {chartDateLabel(snapshot.snapshotAt)}, from daily market prices.</p>}
        </div>
        {wallets && walletsCount !== 0 && total > 0 && (
          <div className="space-y-2">
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
              <div className="h-full" style={{ width: `${shareOf(investments)}%`, background: PORTFOLIOS_COLOR }} />
              <div className="h-full" style={{ width: `${shareOf(walletsCount)}%`, background: WALLETS_COLOR }} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PORTFOLIOS_COLOR }} />Portfolios {shareOf(investments).toFixed(0)}%</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: WALLETS_COLOR }} />Wallets {shareOf(walletsCount).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
      <div className={`grid grid-cols-1 ${wallets ? "md:grid-cols-2 md:divide-x" : ""} divide-y md:divide-y-0 divide-slate-100 border-t border-slate-100`}>
        <SummaryTile
          icon={<Coins className="h-4 w-4" />}
          color={PORTFOLIOS_COLOR}
          title="All portfolios"
          value={snapshot ? formatCurrency(snapshot.totalMarketValue, snapshot.currency, 0) : null}
          pending={portfolio.isAggregate
            ? "The combined figures across your portfolios are being prepared. Check back in a few minutes."
            : "No transactions yet: add some to see what your portfolio is worth."}
          onOpen={onOpenPortfolios}
        >
          {snapshot && moves && (
            <>
              <MoveLine label="today" amount={moves.dayMarketEffect} pct={moves.previousDayValue !== 0 ? moves.dayMarketEffectPct : null} currency={moves.currency} />
              <MoveLine label="this month" amount={moves.mtdMarketEffect} pct={moves.monthStartValue !== 0 ? moves.mtdMarketEffectPct : null} currency={moves.currency} />
            </>
          )}
          {snapshot && (
            <MoveLine
              label="unrealized"
              amount={snapshot.totalUnrealizedPnl}
              pct={pnlPct}
              currency={snapshot.currency}
            />
          )}
        </SummaryTile>
        {wallets && (
          <SummaryTile
            icon={<Wallet className="h-4 w-4" />}
            color={WALLETS_COLOR}
            title="All wallets"
            badge={<PreviewBadge label="Sample data" />}
            value={formatCurrency(wallets.balance, wallets.currency, 0)}
            onOpen={onOpenWallets}
          >
            <MoveLine label="in this month" amount={wallets.income} pct={null} currency={wallets.currency} />
            <MoveLine label="out this month" amount={-wallets.expenses} pct={null} currency={wallets.currency} />
          </SummaryTile>
        )}
      </div>
    </Module>
  );
}

const PORTFOLIOS_COLOR = "#C49A3C";
const WALLETS_COLOR = "#0f766e";

/**
 * SUMMARY TILE — one part of the net worth: its total, with a few lines under it, opening the
 * section it summarises. `value` null: nothing to show yet, `pending` says why.
 */
function SummaryTile({
  icon, color, title, badge, value, pending, onOpen, children,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  badge?: React.ReactNode;
  value: string | null;
  pending?: string;
  onOpen?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="group text-left p-6 md:p-7 flex flex-col gap-2.5 enabled:hover:bg-slate-50/70 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C49A3C]/40"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="w-9 h-9 rounded-xl border flex items-center justify-center" style={{ color, background: `${color}14`, borderColor: `${color}33` }}>
          {icon}
        </span>
        {onOpen && <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors" />}
      </div>
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}{badge}</p>
      {value === null ? (
        <p className="text-sm text-slate-500">{pending}</p>
      ) : (
        <div>
          <p className="font-black text-slate-900 text-xl md:text-2xl tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {value}
          </p>
          {children}
        </div>
      )}
    </button>
  );
}

/**
 * Today's and this month's market moves for the headline (GET /v1/portfolios/{p}/today, net of
 * money added or withdrawn), shown under its market value; the day-by-day detail is in its
 * Insights ("This month"). Null while there's nothing yet, or while the document is stale (it
 * can mix two versions of the portfolio then).
 */
function useRecentMoves(portfolioUuid: string) {
  const [today, setToday] = useState<TodayDashboard | null>(null);
  useEffect(() => {
    let cancelled = false;
    portfolioService.getTodayDashboard(portfolioUuid)
      .then((data) => { if (!cancelled) setToday(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [portfolioUuid]);
  return today && !today.isStale ? today : null;
}

/**
 * One move under the market value: "▲ +1,240 € · +0.84% today", in the same small coloured line
 * as the unrealized P&L's percentage. The percentage is dropped without a baseline (a
 * portfolio newer than the day or the month).
 */
function MoveLine({ label, amount, pct, currency }: { label: string; amount: number; pct: number | null; currency: string }) {
  const isGain = amount >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  return (
    <div className="flex items-center gap-1.5 font-sans text-sm font-bold mt-1">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${isGain ? "text-emerald-600" : "text-rose-600"}`} />
      <span className={`tabular-nums ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
        {signedCurrency(amount, currency)}{pct !== null && ` · ${formatPct(pct)}`}
      </span>
      <span className="text-slate-400 font-semibold">{label}</span>
    </div>
  );
}

// Most urgent first: a triggered alert leads, a switched-off one comes last. Rules of the same
// state keep the backend's order (portfolio by portfolio, oldest first).
const ALERT_ORDER: Record<AlertState["kind"], number> = {
  triggered: 0, reached: 1, approaching: 2, ok: 3, pending: 4, unavailable: 5, off: 6,
};

// A user can have up to 20 alerts per portfolio, far too many dials to show at once. The most
// urgent get a dial each; the rest sit behind "Show all".
const ALERTS_SHOWN_COLLAPSED = 6;

// How the states roll up into the one-line summary above the dials.
const SUMMARY_GROUPS: { tone: AlertTone; label: string; dot: string }[] = [
  { tone: "danger", label: "triggered", dot: "bg-red-500" },
  { tone: "warn", label: "approaching", dot: "bg-amber-500" },
  { tone: "ok", label: "within range", dot: "bg-emerald-500" },
  { tone: "muted", label: "not active", dot: "bg-slate-400" },
];

/**
 * ALERTS MODULE — the rules on all of the user's portfolios as dials, refreshed every minute
 * (the backend re-checks every rule about every 5 minutes, so a reading changes while the page
 * is open). With more than one portfolio each dial is labelled with the portfolio it watches.
 * A one-line summary counts them by state; only the ALERTS_SHOWN_COLLAPSED most urgent get a
 * dial until the user asks for all of them. With no rules it isn't shown at all.
 */
function AlertsModule({ portfolios, onManage }: { portfolios: Portfolio[]; onManage?: () => void }) {
  const uuids = useMemo(() => portfolios.map((p) => p.uuid), [portfolios]);
  const { rules, loading, error } = usePortfoliosAlertRules(uuids, 60_000);
  const [showAll, setShowAll] = useState(false);

  const nameOf = (uuid: string) => portfolios.find((p) => p.uuid === uuid)?.name ?? "";
  const sorted = rules === null
    ? []
    : [...rules].sort((a, b) => ALERT_ORDER[alertState(a).kind] - ALERT_ORDER[alertState(b).kind]);
  const visible = showAll ? sorted : sorted.slice(0, ALERTS_SHOWN_COLLAPSED);
  const counts = SUMMARY_GROUPS
    .map((g) => ({ ...g, count: sorted.filter((r) => alertState(r).tone === g.tone).length }))
    .filter((g) => g.count > 0);

  // Only there when there's something to show: no alerts (or none loaded yet, or a failed
  // request) means no module at all. They're set up on each portfolio's page (Portfolios).
  if (loading || error || sorted.length === 0) return null;

  return (
    <Module>
      <ModuleHead
        eyebrow="Alerts"
        title="Your alerts"
        desc="How close each alert is to its limit. Checked about every 5 minutes."
        right={onManage && (
          <button
            onClick={onManage}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
          >
            Manage alerts
          </button>
        )}
      />
      <div className="p-6 md:p-7 space-y-5">
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-bold text-slate-600">
          {counts.map((g) => (
            <li key={g.tone} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${g.dot}`} />
              {g.count} {g.label}
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((rule) => (
            <div key={`${rule.portfolioUuid}:${rule.ruleId}`} className="flex flex-col gap-1.5">
              {portfolios.length > 1 && (
                <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">
                  {nameOf(rule.portfolioUuid)}
                </p>
              )}
              <AlertGaugeCard rule={rule} />
            </div>
          ))}
        </div>
        {sorted.length > ALERTS_SHOWN_COLLAPSED && (
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll((v) => !v)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
            >
              {showAll ? "Show fewer" : `Show all ${sorted.length}`}
            </button>
          </div>
        )}
      </div>
    </Module>
  );
}

/**
 * MODULE — the card shell every group of related content lives in.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({
  eyebrow, title, desc, right,
}: {
  eyebrow: string; title: string; desc?: string; right?: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2
          className="text-lg md:text-xl font-black text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}
