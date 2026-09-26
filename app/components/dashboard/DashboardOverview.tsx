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
  Briefcase,
  BellRing,
} from "lucide-react";
import { portfolioService } from "../../services/portfolioService";
import type { Portfolio, PortfolioSnapshot } from "../../models/Portfolio";
import { formatCurrency } from "../../lib/format";
import { NoDataEmptyState } from "./NoDataEmptyState";
import { MonthToDateModule } from "./PerformanceSection";
import { usePortfolio } from "../../context/PortfolioContext";
import { AlertGaugeCard } from "./AlertGauge";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { alertState, type AlertState, type AlertTone } from "../../lib/alerts";

// One portfolio's GET /v1/portfolios/{p}/overview: null snapshot = no data yet (no transactions,
// or the aggregate's first build hasn't landed), `failed` = the request itself errored.
type SnapshotState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; snapshot: PortfolioSnapshot | null };

/**
 * DASHBOARD — every portfolio at a glance, not tied to the one selected in the sidebar: the
 * aggregate "All portfolios" on top (or the only portfolio, for a user with just one), then a
 * card per portfolio, with every portfolio's alerts in between. Headline figures (invested,
 * market value, unrealized P&L) and the headline's moves this month; the longer-term figures
 * and the charts live in each portfolio's Insights, which a card opens. The overview endpoint
 * never mixes history with fresh data (no isStale); this month's module polls on its own.
 */
export default function DashboardOverview({ onNavigate }: { onNavigate?: (section: string) => void } = {}) {
  const { portfolios, selectPortfolio } = usePortfolio();
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

  // The backend lists the aggregate first while there are 2+ portfolios; with just one, that
  // one is the headline and there's no per-portfolio grid underneath.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const headline = aggregate ?? portfolios[0];
  const others = useMemo(() => (aggregate ? portfolios.filter((p) => !p.isAggregate) : []), [aggregate, portfolios]);

  // Alerts are managed in Settings; "Manage alerts" (and the empty state's button) open it on
  // its Alerts tab via the URL hash, which SettingsSection reads when it mounts.
  const openAlertSettings = () => {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#alerts`);
    onNavigate?.("settings");
  };

  const openPortfolio = (uuid: string, section: string) => {
    selectPortfolio(uuid);
    onNavigate?.(section);
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
    <div className="px-0 py-6 space-y-8">

      {/* MASTHEAD */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">Overview</p>
          <h1
            className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Dashboard
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            {aggregate ? "All your portfolios at a glance." : "Your portfolio at a glance."}
          </p>
        </div>
      </div>

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
        />
      )}

      {/* THIS MONTH — the headline's short-term moves, once it has figures at all. */}
      {headlineState.status === "ready" && headlineState.snapshot !== null && (
        <MonthToDateModule portfolioUuid={headline.uuid} />
      )}

      {/* ALERTS — every portfolio's, aggregate included, as one list sorted by urgency. */}
      {!noDataAtAll && (
        <AlertsModule
          portfolios={portfolios}
          onManage={onNavigate ? openAlertSettings : undefined}
        />
      )}

      {/* EACH PORTFOLIO */}
      {others.length > 0 && (
        <div className="space-y-4">
          <h2
            className="text-lg md:text-xl font-black text-slate-900 px-1"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Your portfolios
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {others.map((p) => (
              <PortfolioCard
                key={p.uuid}
                portfolio={p}
                state={snapshots[p.uuid] ?? { status: "loading" }}
                onOpen={(section) => openPortfolio(p.uuid, section)}
              />
            ))}
          </div>
        </div>
      )}
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
 * portfolio's transactions combined, so they aren't necessarily the sum of the cards below.
 */
function HeadlineModule({
  portfolio, snapshot, onOpen,
}: { portfolio: Portfolio; snapshot: PortfolioSnapshot | null; onOpen?: () => void }) {
  const openButton = onOpen && (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
    >
      Open insights <ArrowRight className="h-3.5 w-3.5" />
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
          description="Capital deployed to date"
          color="gold"
        />
        <Stat
          title="Market Value"
          value={formatCurrency(snapshot.totalMarketValue, currency, 0)}
          icon={<Coins className="h-4 w-4" />}
          description="What your positions are worth today"
          color="gold"
        />
        <Stat
          title="Unrealized P&L"
          value={<AmountWithDelta amount={signedCurrency(snapshot.totalUnrealizedPnl, currency)} pct={unrealizedPct(snapshot)} />}
          icon={pnlIsGain ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          description="Vs your invested capital"
          color={pnlIsGain ? "emerald" : "red"}
        />
      </div>
    </Module>
  );
}

/**
 * PORTFOLIO CARD — one portfolio's headline figures. The whole card opens its Insights; with
 * no data yet it offers to add transactions to it instead.
 */
function PortfolioCard({
  portfolio, state, onOpen,
}: { portfolio: Portfolio; state: SnapshotState; onOpen: (section: string) => void }) {
  const snapshot = state.status === "ready" ? state.snapshot : null;
  const hasData = snapshot !== null;

  return (
    <button
      onClick={() => onOpen(hasData ? "performance" : "upload")}
      className="group text-left bg-white rounded-4xl border border-slate-200 shadow-sm hover:border-[#C49A3C]/50 transition-colors p-6 md:p-7 flex flex-col gap-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl border flex items-center justify-center bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20 shrink-0">
            <Briefcase className="h-4 w-4" />
          </div>
          <span className="text-base font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {portfolio.name}
          </span>
          {portfolio.isDefault && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Default</span>
          )}
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors shrink-0" />
      </div>

      {state.status === "loading" ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="animate-spin h-5 w-5 text-[#C49A3C]" />
        </div>
      ) : state.status === "failed" ? (
        <p className="text-sm text-rose-600 font-semibold">Unable to load this portfolio right now.</p>
      ) : snapshot === null ? (
        <p className="text-sm text-slate-500">
          No transactions yet. <span className="font-bold text-[#C49A3C]">Add transactions</span>
        </p>
      ) : (
        <PortfolioCardFigures snapshot={snapshot} />
      )}
    </button>
  );
}

function PortfolioCardFigures({ snapshot }: { snapshot: PortfolioSnapshot }) {
  const { currency } = snapshot;
  const pnlIsGain = snapshot.totalUnrealizedPnl >= 0;
  const pct = unrealizedPct(snapshot);

  return (
    <>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Market Value</p>
        <p className="font-black text-slate-900 text-2xl mt-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {formatCurrency(snapshot.totalMarketValue, currency, 0)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Invested</p>
          <p className="text-sm font-bold text-slate-700 mt-1">{formatCurrency(snapshot.totalInvestedCapital, currency, 0)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unrealized P&L</p>
          <p className={`text-sm font-bold mt-1 ${pnlIsGain ? "text-emerald-600" : "text-rose-600"}`}>
            {signedCurrency(snapshot.totalUnrealizedPnl, currency)}
            {pct !== null && <span className="font-semibold"> ({formatPct(pct)})</span>}
          </p>
        </div>
      </div>
    </>
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
 * dial until the user asks for all of them. With no rules it invites the user to create one.
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
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
        </div>
      ) : error ? (
        <p className="text-sm text-slate-500 p-6 md:p-7">Unable to load your alerts right now.</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-3 px-6 py-10">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
            <BellRing className="h-5 w-5 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 max-w-sm">
            You haven&apos;t set up any alerts. Get notified when your portfolio moves by a set amount, or when a
            single holding grows past a share you choose.
          </p>
          {onManage && (
            <button
              onClick={onManage}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors"
            >
              Create an alert
            </button>
          )}
        </div>
      ) : (
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
      )}
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
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2
          className="text-lg md:text-xl font-black text-slate-900"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
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
  description: string;
  color: "emerald" | "red" | "gold";
}

function Stat({ title, value, icon, description, color }: StatProps) {
  const colorMap = {
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  };

  return (
    <div className="p-6 md:p-7 flex flex-col gap-2.5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div
        className="font-black text-slate-900 text-xl md:text-2xl"
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {value}
      </div>
      <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{description}</p>
    </div>
  );
}
