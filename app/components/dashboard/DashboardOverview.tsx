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
import { InfoTip } from "./PerformanceSection";
import { usePortfolio } from "../../context/PortfolioContext";
import { AlertGaugeCard } from "./AlertGauge";
import { openPortfoliosPage } from "./InsightsSection";
import { DailyArticleModule } from "./NewsSection";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";
import { portfolioColorMap } from "../../lib/chartColors";
import { useUser } from "../../context/UserContext";
import { WalletsOverviewModule } from "../preview/WalletsOverview";

// One portfolio's GET /v1/portfolios/{p}/overview: null snapshot = no data yet (no transactions,
// or the aggregate's first build hasn't landed), `failed` = the request itself errored.
type SnapshotState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; snapshot: PortfolioSnapshot | null };

/**
 * DASHBOARD — every portfolio at a glance, not tied to the selected portfolio: the
 * aggregate "All portfolios" on top (or the only portfolio, for a user with just one), with a
 * tile per portfolio (its market value) along its bottom edge; for a demo account the wallets
 * the same way (a preview on sample data, see components/preview); then every portfolio's
 * alerts and the article of the day. Headline
 * figures only (invested, market value with today's and this month's moves, unrealized P&L):
 * the longer-term figures and the charts live in each portfolio's Insights, reached from its
 * card. The overview endpoint never mixes history with fresh data (no isStale).
 */
export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const { isDemo } = useUser();
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

  // The aggregate, when there is one, is the headline. The per-portfolio tiles along its bottom
  // only show with two or more portfolios of the user's own: with just one, its tile would
  // repeat the headline's figures.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const headline = aggregate ?? portfolios[0];
  const others = useMemo(() => {
    const own = portfolios.filter((p) => !p.isAggregate);
    return aggregate && own.length > 1 ? own : [];
  }, [aggregate, portfolios]);

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

      {/* HEADLINE — the aggregate (or the only portfolio). A lone portfolio with no data yet
          gets the full-page "no data" window, since there's nothing else on the page; the
          aggregate with no data yet just says it's being prepared, the cards below still
          carry each portfolio's own figures. */}
      {headlineState.status === "failed" ? (
        <ErrorBanner message="Failed to load portfolio data" />
      ) : noDataAtAll ? (
        <NoDataEmptyState
          title="No portfolio data yet"
          message="Add or upload your transactions and this is where you'll see what your portfolio is worth today."
          onNavigate={onNavigate ? (section) => openPortfolio(headline.uuid, section) : undefined}
        />
      ) : (
        <HeadlineModule
          portfolio={headline}
          snapshot={headlineState.snapshot}
          onOpen={onNavigate ? () => openPortfolio(headline.uuid, "performance") : undefined}
        >
          {/* EACH PORTFOLIO — part of the headline, since the aggregate is made of them. */}
          {others.length > 0 && (
            <PortfolioTiles
              portfolios={others}
              colorOf={portfolioColorMap(portfolios)}
              snapshots={snapshots}
              onOpen={(uuid, hasData) => openPortfolio(uuid, hasData ? "performance" : "upload")}
            />
          )}
        </HeadlineModule>
      )}

      {/* WALLETS — a preview on sample data, for demo accounts only. */}
      {isDemo && <WalletsOverviewModule onNavigate={onNavigate} />}

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
 * AMOUNT WITH DELTA — a Stat value: the amount on its own line, with the percentage change in
 * its own colored, directional line underneath instead of squeezed into "€X (+Y%)"
 * parentheses — see PerformanceSection.tsx's identical helper for the full rationale.
 */
function AmountWithDelta({ amount, pct }: { amount: string; pct: number | null }) {
  if (pct === null) return <>{amount}</>;
  const isGain = pct >= 0;
  const Icon = isGain ? TrendingUp : TrendingDown;
  return (
    <>
      {amount}
      <div className={`flex items-center gap-1 font-sans text-sm font-bold mt-1 ${isGain ? "text-emerald-600" : "text-rose-600"}`}>
        <Icon className="h-3.5 w-3.5" />
        {formatPct(pct)}
      </div>
    </>
  );
}

/**
 * HEADLINE MODULE — what the whole wealth (the aggregate) or the lone portfolio is worth
 * today, in the user's reference currency. The aggregate's figures are recomputed from every
 * portfolio's transactions combined, so they aren't necessarily the sum of the tiles below.
 * `children`: what's attached along its bottom edge (the per-portfolio tiles).
 */
function HeadlineModule({
  portfolio, snapshot, onOpen, children,
}: { portfolio: Portfolio; snapshot: PortfolioSnapshot | null; onOpen?: () => void; children?: React.ReactNode }) {
  const moves = useRecentMoves(portfolio.uuid);
  const openButton = onOpen && (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
    >
      Open portfolio <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );

  if (snapshot === null) {
    return (
      <Module>
        <ModuleHead eyebrow="Combined" title={portfolio.name} right={openButton} />
        <div className="flex flex-col items-center text-center gap-2 px-6 py-10">
          <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
          <p className="text-sm text-slate-500 max-w-sm">
            The combined figures across your portfolios are being prepared. Check back in a few minutes.
          </p>
        </div>
        {children}
      </Module>
    );
  }

  const currency = snapshot.currency;
  const pnlIsGain = snapshot.totalUnrealizedPnl >= 0;

  return (
    <Module>
      <ModuleHead
        eyebrow={currency}
        title={portfolio.name}
        desc={`As of ${chartDateLabel(snapshot.snapshotAt)} — from daily market prices.`}
        right={openButton}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <Stat
          title="Total Invested"
          value={formatCurrency(snapshot.totalInvestedCapital, currency, 0)}
          icon={<Wallet className="h-4 w-4" />}
          info="Capital deployed to date."
          color="gold"
        />
        <Stat
          title="Market Value"
          value={
            <>
              {formatCurrency(snapshot.totalMarketValue, currency, 0)}
              {moves && (
                <>
                  <MoveLine label="today" amount={moves.dayMarketEffect} pct={moves.previousDayValue !== 0 ? moves.dayMarketEffectPct : null} currency={moves.currency} />
                  <MoveLine label="this month" amount={moves.mtdMarketEffect} pct={moves.monthStartValue !== 0 ? moves.mtdMarketEffectPct : null} currency={moves.currency} />
                </>
              )}
            </>
          }
          icon={<Coins className="h-4 w-4" />}
          info="What your positions are worth today. Below it, how the market moved it today and this month, leaving out money you added or withdrew."
          color="gold"
        />
        <Stat
          title="Unrealized P&L"
          value={<AmountWithDelta amount={signedCurrency(snapshot.totalUnrealizedPnl, currency)} pct={unrealizedPct(snapshot)} />}
          icon={pnlIsGain ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          info="Against your invested capital."
          color={pnlIsGain ? "emerald" : "red"}
        />
      </div>
      {children}
    </Module>
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

/**
 * PORTFOLIO TILES — a strip along the bottom of the headline, one small tile per portfolio
 * with its market value only (the rest is on its page). A tile opens its portfolio; one with no
 * data yet offers to add transactions to it instead.
 */
function PortfolioTiles({
  portfolios, colorOf, snapshots, onOpen,
}: {
  portfolios: Portfolio[];
  colorOf: (uuid: string) => string;
  snapshots: Record<string, SnapshotState>;
  onOpen: (uuid: string, hasData: boolean) => void;
}) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/60 p-4 md:p-5">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Portfolios</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {portfolios.map((p) => {
          const state = snapshots[p.uuid] ?? { status: "loading" };
          const snapshot = state.status === "ready" ? state.snapshot : null;
          return (
            <button
              key={p.uuid}
              onClick={() => onOpen(p.uuid, snapshot !== null)}
              className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-[#C49A3C]/50 transition-colors px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-bold text-slate-700 truncate">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(p.uuid) }} />
                  <span className="truncate">{p.name}</span>
                </p>
                <div className="mt-1 pl-4.5">
                  {state.status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#C49A3C]" />
                  ) : state.status === "failed" ? (
                    <p className="text-xs font-semibold text-rose-600">Unavailable</p>
                  ) : snapshot === null ? (
                    <p className="text-xs font-semibold text-slate-400">No transactions yet</p>
                  ) : (
                    <p className="text-lg font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {formatCurrency(snapshot.totalMarketValue, snapshot.currency, 0)}
                    </p>
                  )}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors shrink-0" />
            </button>
          );
        })}
      </div>
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

/**
 * STAT — one segment of a Module's stat strip.
 */
interface StatProps {
  title: string;
  // A plain string for a single figure, or richer content (see AmountWithDelta) for a figure
  // that needs more than one line.
  value: React.ReactNode;
  icon: React.ReactNode;
  // Shown in a tooltip when the user hovers (or focuses) the icon.
  info: string;
  color: "emerald" | "red" | "gold";
}

function Stat({ title, value, icon, info, color }: StatProps) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  };

  return (
    <div className="p-6 md:p-7 flex flex-col gap-2.5">
      <InfoTip text={info}>
        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center cursor-help ${colorMap[color]}`}>
          {icon}
        </div>
      </InfoTip>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div
        className="font-black text-slate-900 text-xl md:text-2xl"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </div>
    </div>
  );
}
