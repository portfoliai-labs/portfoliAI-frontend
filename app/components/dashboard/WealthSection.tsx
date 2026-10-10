// components/dashboard/WealthSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfoliosService } from "../../services/portfoliosService";
import { transactionService } from "../../services/transactionService";
import { reportService } from "../../services/reportService";
import { usePortfoliosAlertRules } from "../../hooks/useAlertRules";
import { CATEGORICAL_PALETTE, portfolioColorMap } from "../../lib/chartColors";
import { formatCurrency } from "../../lib/format";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { PLAN_SECTION, WEALTH_SECTION, openPlanPage } from "../../lib/dashboardNav";
import { investmentsOf, isBacktest, type Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";
import { PerformanceSection, Module, ModuleHead, MODULE_BODY, Figs, Fig, HBars } from "./PerformanceSection";
import { PageHeader, type PageAction, type PageCounter, type PageFigure } from "./PageHeader";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { FileUploader } from "./FileUploader";
import { AlertsSettings } from "./AlertsSettings";
import { ReportsBrowser } from "./ReportsBrowser";
import { ComparisonView, initialCompareSelection, rememberCompareSelection, MAX_COMPARED } from "./ComparisonView";
import { ManagePortfolios } from "./ManagePortfolios";
import { AssetCategoriesEditor } from "./AssetCategoriesEditor";
import { NewPortfolioDialog } from "./NewPortfolioDialog";
import { RenamePortfolioDialog } from "./RenamePortfolioDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { AdoptStrategyDialog } from "./AdoptStrategyDialog";
import { AdoptedStrategyView } from "./AdoptedStrategyView";
import { adoptionService } from "../../services/adoptionService";
import { BacktestBanner } from "./BacktestMarks";
import { DEMO_DISABLED_TITLE } from "../preview/DemoBanner";
import { PreviewBadge } from "../preview/PreviewKit";
import { walletsSummary } from "../preview/WalletsOverview";
import { monthlySummary } from "../../lib/mock/wallets";
import {
  ALL_WALLETS, WALLET_PAGE_LABELS, WalletView, WalletsHub, isWalletId, walletName, type WalletPage,
} from "../preview/WalletPages";
import { RealEstatePortfolio, type RealEstatePage } from "../preview/RealEstatePortfolio";

// A portfolio's pages: its own (overview), and those its header leads to.
export type PortfolioPage = "overview" | "transactions" | "alerts" | "reports" | "compare" | "portfolios" | "categories" | "strategy";

export type WealthView =
  // Everything the user owns: investments and wallets. A demo account's preview: anyone else
  // opens straight on their investments.
  | { kind: "root" }
  // A portfolio, "All portfolios" (the investments) included. A strategy's backtest is Plan's.
  | { kind: "portfolio"; uuid: string; page: PortfolioPage }
  // A wallet, or every wallet together (ALL_WALLETS); a demo account's preview.
  | { kind: "wallet"; id: string; page: WalletPage }
  // A sample real estate portfolio; a demo account's preview.
  | { kind: "realEstate"; page: RealEstatePage };

const SECTION = WEALTH_SECTION;
const PORTFOLIO_PAGES: PortfolioPage[] = ["overview", "transactions", "alerts", "reports", "compare", "portfolios", "categories", "strategy"];
const PAGE_LABELS: Record<Exclude<PortfolioPage, "overview">, string> = {
  transactions: "Transactions",
  alerts: "Alerts",
  reports: "Reports",
  compare: "Compare",
  portfolios: "Manage portfolios",
  categories: "Asset categories",
  strategy: "Strategy",
};

/** The page the current history entry was on, read for this account. */
function viewFromHistory(isDemo: boolean, portfolios: Portfolio[]): WealthView {
  const entry = readDashboardEntry();
  const view = (entry?.section === SECTION ? entry.view : undefined) as (WealthView | { kind: string; [k: string]: unknown }) | undefined;
  const investments = investmentsOf(portfolios);
  const top: WealthView = isDemo ? { kind: "root" } : { kind: "portfolio", uuid: investments?.uuid ?? "", page: "overview" };
  if (!view) return top;
  switch (view.kind) {
    case "root":
      return top;
    case "portfolio": {
      const v = view as { uuid?: string; page?: string };
      if (!portfolios.some((p) => p.uuid === v.uuid)) return top;
      // A portfolio had tabs (`tab`), then Insights as its first page, before its own page.
      const page = PORTFOLIO_PAGES.includes(v.page as PortfolioPage) ? (v.page as PortfolioPage) : "overview";
      return { kind: "portfolio", uuid: v.uuid!, page };
    }
    // Investments' own pages before they were the investments' (Manage / Investments / Alerts…).
    case "investments":
    case "transactions":
    case "reports":
    case "alerts":
    case "compare":
    case "portfolios": {
      if (!investments) return top;
      const page = view.kind === "investments" ? "overview" : (view.kind as PortfolioPage);
      return { kind: "portfolio", uuid: investments.uuid, page };
    }
    case "wallets":
      return isDemo ? { kind: "wallet", id: ALL_WALLETS, page: "insights" } : top;
    case "wallet": {
      const v = view as { id?: string; page?: WalletPage };
      return isDemo && v.id && isWalletId(v.id) ? { kind: "wallet", id: v.id, page: v.page ?? "insights" } : top;
    }
    case "realEstate":
      return isDemo ? { kind: "realEstate", page: (view as { page?: RealEstatePage }).page ?? "home" } : top;
    default:
      // Manage's hub, Strategy and Explore (now Plan's and Discover's), anything older.
      return top;
  }
}

/**
 * WEALTH SECTION (investor; "performance" in the sidebar's ids) — everything the user owns, as
 * pages to go down through, each one the place to act on what it shows. A demo account opens on
 * Wealth itself (WealthRoot: investments and wallets together); anyone else on their investments,
 * which are "All portfolios" while they have two or more, otherwise their only portfolio.
 *
 * A portfolio's page (PortfolioNode) is its header (value, activity, actions, key figures) over
 * its Insights (PerformanceSection), whose Composition leads down to each portfolio (from All
 * portfolios) or holding. Its activity and its actions open pages of its own, always on that
 * portfolio, so none of them asks which one: Transactions, Alerts and Reports, and on All
 * portfolios Compare and Manage portfolios. A strategy's backtest opens the same page in Plan, under
 * Strategy (a link to one here goes there). Wallets and the real estate portfolio are previews on sample data for a demo account.
 *
 * Every page is a browser history entry, so back and forward move between them (see
 * lib/dashboardHistory). Opening a portfolio also makes it the selected one (PortfolioContext).
 */
export function WealthSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, selectPortfolio } = usePortfolio();
  const { isDemo } = useUser();
  const [view, setView] = useState<WealthView>(() => viewFromHistory(isDemo, portfolios));

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === SECTION && !entry.view) pushDashboardEntry({ section: SECTION, view }, true);
    const onPopState = () => {
      if (readDashboardEntry()?.section !== SECTION) return;
      const next = viewFromHistory(isDemo, portfolios);
      setView((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: a new list of portfolios is read on the next back / forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (next: WealthView) => {
    if (next.kind === "portfolio") selectPortfolio(next.uuid);
    pushDashboardEntry({ section: SECTION, view: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const openPortfolio = (uuid: string, page: PortfolioPage = "overview") => go({ kind: "portfolio", uuid, page });

  const investments = investmentsOf(portfolios);
  // Wealth itself is a page only where there's more than the investments (a demo account's wallets).
  const rootTrail: Crumb[] = isDemo ? [{ label: "Wealth", onClick: () => go({ kind: "root" }) }] : [];

  if (view.kind === "root" && isDemo) {
    return <WealthRoot investments={investments} onOpen={go} />;
  }

  if (view.kind === "wallet" && isDemo) {
    return <WalletNode id={view.id} page={view.page} rootTrail={rootTrail} onOpen={(id, page) => go({ kind: "wallet", id, page })} />;
  }

  if (view.kind === "realEstate" && isDemo) {
    return <RealEstatePortfolio trail={rootTrail} page={view.page} onOpenPage={(page) => go({ kind: "realEstate", page })} />;
  }

  const portfolio = (view.kind === "portfolio" && portfolios.find((p) => p.uuid === view.uuid)) || investments;
  if (!portfolio) return null;
  const page = view.kind === "portfolio" && view.uuid === portfolio.uuid ? view.page : "overview";
  // A backtest is a simulation, not something owned: it's Plan's (see BacktestRedirect).
  if (isBacktest(portfolio)) {
    return <BacktestRedirect uuid={portfolio.uuid} transactions={page === "transactions"} onNavigate={onNavigate} />;
  }

  // The pages above it: a portfolio sits under All portfolios.
  const aggregate = portfolios.find((p) => p.isAggregate);
  const trail: Crumb[] = portfolio.uuid === investments?.uuid || !aggregate
    ? rootTrail
    : [...rootTrail, { label: aggregate.name, onClick: () => openPortfolio(aggregate.uuid) }];

  return (
    <PortfolioNode
      key={portfolio.uuid}
      portfolio={portfolio}
      page={page}
      trail={trail}
      isInvestments={portfolio.uuid === investments?.uuid}
      onOpen={openPortfolio}
      onNavigate={onNavigate}
    />
  );
}

/**
 * A link to a backtest in Wealth (from before it moved, from history, from the Dashboard's
 * selected portfolio): opens it in Plan instead, in place of this entry, so back doesn't land
 * here again only to be sent back to Plan.
 */
function BacktestRedirect({ uuid, transactions, onNavigate }: { uuid: string; transactions: boolean; onNavigate: (section: string) => void }) {
  useEffect(() => {
    pushDashboardEntry({ section: PLAN_SECTION, view: { page: "backtest", uuid, sub: transactions ? "transactions" : "overview" } }, true);
    onNavigate(PLAN_SECTION);
  }, [uuid, transactions, onNavigate]);
  return null;
}

// ── A portfolio's page ────────────────────────────────────────────────────────────────────

const pct = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}%`;
const toneOf = (v: number | null | undefined): "gain" | "loss" | undefined => (v == null || v === 0 ? undefined : v > 0 ? "gain" : "loss");

/** One portfolio's side-by-side figures (GET /v1/portfolios/comparison), for its header. */
function useComparisonEntry(uuid: string) {
  const [entry, setEntry] = useState<{ uuid: string; value: PortfolioComparisonEntry | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare([uuid])
      .then((list) => { if (!cancelled) setEntry({ uuid, value: list[0] ?? null }); })
      .catch(() => { if (!cancelled) setEntry({ uuid, value: null }); });
    return () => { cancelled = true; };
  }, [uuid]);
  // undefined while loading, null when it couldn't be read.
  return entry?.uuid === uuid ? entry.value : undefined;
}

/**
 * Whether a strategy is adopted on the portfolio (GET .../adopted-strategy), for its header's way
 * to it: undefined while loading or for a backtest, which can't adopt one. `reload` after a change.
 */
function useHasAdoption(portfolio: Portfolio) {
  const backtest = isBacktest(portfolio);
  const [state, setState] = useState<{ uuid: string; has: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (backtest) return;
    let cancelled = false;
    adoptionService.get(portfolio.uuid)
      .then((a) => { if (!cancelled) setState({ uuid: portfolio.uuid, has: a !== null }); })
      .catch(() => { if (!cancelled) setState({ uuid: portfolio.uuid, has: false }); });
    return () => { cancelled = true; };
  }, [portfolio.uuid, backtest, reloadKey]);
  return { hasAdoption: state?.uuid === portfolio.uuid ? state.has : undefined, reload: () => setReloadKey((k) => k + 1) };
}

/**
 * How much activity a portfolio has, for its header's counters: its transactions (All portfolios'
 * read every portfolio's), its alert rules and theirs (All portfolios' own, then every
 * portfolio's) and its reports (every real portfolio's on All portfolios, which takes none).
 */
function useActivityCounts(portfolio: Portfolio, real: Portfolio[]) {
  const backtest = isBacktest(portfolio);
  const ruleScope = backtest ? [] : portfolio.isAggregate ? [portfolio.uuid, ...real.map((p) => p.uuid)] : [portfolio.uuid];
  const reportScope = backtest ? [] : portfolio.isAggregate ? real.map((p) => p.uuid) : [portfolio.uuid];
  const reportKey = reportScope.join(",");
  const { rules } = usePortfoliosAlertRules(ruleScope);
  const [transactions, setTransactions] = useState<{ uuid: string; total: number | null } | null>(null);
  const [reports, setReports] = useState<{ key: string; total: number | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    transactionService.getUserTransactions(portfolio.uuid, 1, 0)
      .then((r) => { if (!cancelled) setTransactions({ uuid: portfolio.uuid, total: r.total }); })
      .catch(() => { if (!cancelled) setTransactions({ uuid: portfolio.uuid, total: null }); });
    return () => { cancelled = true; };
  }, [portfolio.uuid]);

  useEffect(() => {
    if (!reportKey) return;
    let cancelled = false;
    Promise.allSettled(reportKey.split(",").map((u) => reportService.getAllDocuments(u))).then((results) => {
      if (cancelled) return;
      const loaded = results.filter((r) => r.status === "fulfilled");
      setReports({ key: reportKey, total: loaded.length ? loaded.reduce((sum, r) => sum + r.value.length, 0) : null });
    });
    return () => { cancelled = true; };
  }, [reportKey]);

  return {
    transactions: transactions?.uuid === portfolio.uuid ? transactions.total : null,
    rules: rules === null ? null : rules.length,
    triggered: rules === null ? 0 : rules.filter((r) => r.enabled && r.isTriggered).length,
    reports: reports?.key === reportKey ? reports.total : null,
  };
}

/**
 * PORTFOLIO NODE — a portfolio's page in Wealth (a backtest's in Plan, under Strategy), or one of
 * the pages its header leads to. Its header says what it's worth and how it moved, counts its
 * activity (each count opens its page) and holds what can be done with it:
 * - All portfolios: Manage portfolios, Compare, and a new portfolio while it's Wealth's first page
 *   (with a Wealth page above it, that's where one is added). It's read only: its transactions
 *   list every portfolio's, and a new one says which it goes in.
 * - a portfolio: its Transactions, Alerts and Reports, rename, delete (not the default one).
 * - a backtest: adopt its strategy, delete. Its figures are a simulation's (returns and risk over
 *   its run), its transactions generated and read only, and its Insights leave out what a
 *   simulation doesn't have (see PerformanceSection's `backtest`).
 * Under the header, its Insights (PerformanceSection), whose Composition opens each portfolio of
 * All portfolios. A demo account sees everything but can't change anything.
 */
export function PortfolioNode({ portfolio, page, trail, isInvestments, onOpen, onBacktestGone, onNavigate }: {
  portfolio: Portfolio;
  page: PortfolioPage;
  trail: Crumb[];
  // It stands for all the investments ("All portfolios", or the only portfolio).
  isInvestments: boolean;
  onOpen: (uuid: string, page?: PortfolioPage) => void;
  // A backtest's page (Plan's): where to go once it's deleted. Strategy by default.
  onBacktestGone?: () => void;
  onNavigate: (section: string) => void;
}) {
  const { portfolios, deletePortfolio } = usePortfolio();
  const { isDemo } = useUser();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const real = useMemo(() => portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault)), [portfolios]);
  const backtest = isBacktest(portfolio);
  const entry = useComparisonEntry(portfolio.uuid);
  const counts = useActivityCounts(portfolio, real);
  const { hasAdoption, reload: reloadAdoption } = useHasAdoption(portfolio);
  const strategyAction: PageAction[] = hasAdoption ? [{ label: "Strategy", onClick: () => open("strategy") }] : [];
  const openCategories = () => {
    const investments = investmentsOf(portfolios);
    if (investments) onOpen(investments.uuid, "categories");
  };
  const [dialog, setDialog] = useState<"new" | "rename" | "delete" | "adopt" | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selection, setSelection] = useState<string[]>(() => initialCompareSelection(portfolios, null));
  // Bumped to start the page over (back at the top, any detail closed) from its own crumb.
  const [visit, setVisit] = useState(0);

  const open = (next: PortfolioPage) => onOpen(portfolio.uuid, next);
  const nodeCrumb: Crumb = {
    label: portfolio.name,
    onClick: () => {
      if (page !== "overview") open("overview");
      else {
        setVisit((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    },
  };
  const demo = isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {};
  // New portfolios (and wallets) are added on Wealth's first page: Wealth itself where it's a page
  // (a demo account's), otherwise the investments.
  const addsPortfolios = isInvestments && !isDemo;

  // ── What can be done with it ──
  const actions: PageAction[] = backtest
    ? [
        { label: "Adopt this strategy", primary: true, onClick: () => setDialog("adopt"), ...demo },
        { label: "Delete backtest", danger: true, onClick: () => setDialog("delete"), ...demo },
      ]
    : portfolio.isAggregate
      ? [
          { label: "Manage portfolios", primary: true, onClick: () => open("portfolios") },
          ...(addsPortfolios ? [{ label: "New portfolio", onClick: () => setDialog("new") }] : []),
          ...(real.length > 1 ? [{ label: "Compare", onClick: () => open("compare") }] : []),
          ...strategyAction,
          { label: "Asset categories", onClick: () => open("categories") },
        ]
      : [
          // Its activity pages: what's there, and where to add to it.
          { label: "Transactions", primary: true, plus: false, onClick: () => open("transactions") },
          { label: "Alerts", onClick: () => open("alerts") },
          ...strategyAction,
          { label: "Reports", onClick: () => open("reports") },
          // The only portfolio stands for the investments: the way to a second one is here, and to
          // the categories of everything held.
          ...(addsPortfolios ? [{ label: "New portfolio", onClick: () => setDialog("new") }] : []),
          ...(isInvestments ? [{ label: "Asset categories", onClick: () => open("categories") }] : []),
          { label: "Rename", onClick: () => setDialog("rename"), ...demo },
          {
            label: "Delete portfolio",
            danger: true,
            onClick: () => setDialog("delete"),
            ...(portfolio.isDefault ? { disabled: true, title: "The default portfolio can't be deleted" } : demo),
          },
        ];

  // ── Its activity ──
  const counters: PageCounter[] = [
    { key: "transactions", label: "transactions", count: counts.transactions, onClick: () => open("transactions") },
    ...(backtest ? [] : [
      { key: "alerts", label: "alerts", count: counts.rules, attention: { count: counts.triggered, label: "triggered" }, onClick: () => open("alerts") },
      { key: "reports", label: "reports", count: counts.reports, onClick: () => open("reports") },
    ]),
  ];

  // ── Its key figures, from the comparison ──
  const currency = entry?.value?.currency ?? "EUR";
  const money = (v: number | null | undefined) => (v == null ? "—" : formatCurrency(v, currency, 0));
  // Each figure is shown once on the page: the header holds what no module below does — what it's
  // worth, what went in, what the holdings still owned have gained, and what it has made in all —
  // and the modules hold the rest (returns, risk, realized P&L, costs).
  const value = entry?.value ?? null;
  // Everything made, sold or not: the value now, less what was put in (buys less sale proceeds),
  // plus the dividends paid out along the way, against what was put in.
  const roi = value && value.netContributed > 0
    ? ((value.marketValue - value.netContributed + value.dividendIncome) / value.netContributed) * 100
    : null;
  const unrealized = value?.unrealizedPnl ?? null;
  // A backtest's value and unrealized P&L are a simulation's end point, not anything held: its
  // header keeps what went in and what that made.
  // How long the simulation runs, back from its last valuation: what gives its return a scale.
  const days = entry?.performance?.lifespanDays ?? null;
  const period: PageFigure | null = backtest && days !== null && days > 0 ? {
    label: "Period",
    value: days >= 365 ? `${(days / 365.25).toFixed(1)} years` : `${Math.round(days / 30.44)} months`,
  } : null;
  const figures: PageFigure[] = entry === undefined ? [] : [
    ...(period ? [period] : []),
    ...(backtest ? [] : [{ label: "Value", value: money(value?.marketValue) }]),
    { label: "Invested", value: money(value?.netContributed) },
    ...(backtest ? [] : [{
      label: "Unrealized P&L",
      value: unrealized === null ? "—" : `${unrealized >= 0 ? "+" : ""}${money(unrealized)}`,
      tone: toneOf(unrealized),
    }]),
    { label: "ROI", value: roi === null ? "—" : pct(roi), tone: toneOf(roi) },
  ];

  const note = portfolio.isAggregate ? `${real.length} portfolios` : undefined;

  const header = (
    <PageHeader
      eyebrow={backtest ? "Backtest" : portfolio.isAggregate || isInvestments ? "Investments" : "Portfolio"}
      notice={backtest ? <BacktestBanner portfolioUuid={portfolio.uuid} /> : undefined}
      title={portfolio.name}
      note={note}
      counters={counters}
      actions={actions}
      figures={figures}
    />
  );

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const left = await deletePortfolio(portfolio.uuid);
      setDialog(null);
      if (backtest) (onBacktestGone ?? (() => openPlanPage(onNavigate, "strategy")))();
      else {
        // From the list as it is now: deleting the second-to-last portfolio takes All portfolios
        // with it, and opening that would select a portfolio that's gone (a blank page).
        const next = investmentsOf(left);
        if (next) onOpen(next.uuid);
      }
    } finally {
      setDeleting(false);
    }
  };

  const dialogs = (
    <>
      {dialog === "new" && <NewPortfolioDialog onClose={() => setDialog(null)} />}
      {dialog === "rename" && <RenamePortfolioDialog portfolio={portfolio} onClose={() => setDialog(null)} />}
      {dialog === "adopt" && (
        <AdoptStrategyDialog
          strategyUuid={portfolio.uuid}
          strategyName={portfolio.name}
          onClose={() => setDialog(null)}
          onAdopted={(uuid) => {
            setDialog(null);
            onOpen(uuid, "strategy");
          }}
          onOpenCategories={() => {
            setDialog(null);
            openCategories();
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title={`Delete "${portfolio.name}"?`}
          description={backtest
            ? "The backtest and its generated transactions are deleted. This can't be undone."
            : "Its transactions, insights, reports and alerts are deleted with it. This can't be undone."}
          confirming={deleting}
          onConfirm={handleDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );

  if (page === "overview") {
    return (
      <>
        <PerformanceSection
          key={`${portfolio.uuid}:${visit}`}
          portfolioUuid={portfolio.uuid}
          isAggregate={portfolio.isAggregate}
          backtest={backtest}
          trail={trail}
          pageLabel={portfolio.name}
          top={header}
          onOpenPortfolio={(uuid) => onOpen(uuid)}
          onNavigate={onNavigate}
          comparison={entry ?? null}
        />
        {dialogs}
      </>
    );
  }

  const pageTrail = [...trail, nodeCrumb];
  if (page === "compare") {
    return (
      <ComparisonView
        selection={selection}
        onToggle={(uuid) => setSelection((prev) => {
          const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
          rememberCompareSelection(next);
          return next;
        })}
        trail={pageTrail}
        onOpen={(uuid) => onOpen(uuid)}
      />
    );
  }
  if (page === "portfolios") {
    return <ManagePortfolios trail={pageTrail} onOpenPortfolio={(uuid) => onOpen(uuid)} onOpenAlerts={(uuid) => onOpen(uuid, "alerts")} />;
  }
  if (page === "strategy") {
    return (
      <AdoptedStrategyView
        key={portfolio.uuid}
        portfolio={portfolio}
        trail={pageTrail}
        onOpenAlerts={() => open("alerts")}
        onNavigate={onNavigate}
        onChanged={reloadAdoption}
      />
    );
  }
  // The user's, whichever portfolio it's opened from: a correction holds in all of them.
  if (page === "categories") {
    return (
      <div className="space-y-6 pb-12">
        <Breadcrumb trail={pageTrail} current={PAGE_LABELS.categories} />
        <p className="text-[13px] text-slate-500 leading-relaxed max-w-3xl">
          The category each of your securities counts in, across all your portfolios: alerts on a category, and adopting a
          strategy by category, weigh a portfolio by it. Each one comes with a suggestion; a category you pick replaces it
          everywhere, until you restore it.
        </p>
        <AssetCategoriesEditor />
      </div>
    );
  }

  // Transactions, Alerts, Reports: on this portfolio. The way between them is the header's,
  // one level up.
  const alertPortfolios = (portfolio.isAggregate ? [portfolio, ...real] : [portfolio])
    .map((p) => ({ uuid: p.uuid, name: p.name, color: colorOf(p.uuid) }));
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={pageTrail} current={PAGE_LABELS[page]} />
      {portfolio.isAggregate && page === "transactions" && (
        <ReadOnlyNote>
          {portfolio.name} reads every portfolio&apos;s transactions. A new one goes in the portfolio you pick for it; to change one, open its portfolio.
        </ReadOnlyNote>
      )}
      {portfolio.isAggregate && page === "reports" && (
        <ReadOnlyNote>Reports are made for one portfolio at a time: pick which when you generate one.</ReadOnlyNote>
      )}
      {page === "transactions" && (
        portfolio.isAggregate
          ? <FileUploader key="all" />
          : <FileUploader key={portfolio.uuid} portfolioUuid={portfolio.uuid} readOnly={backtest} />
      )}
      {page === "alerts" && (
        <AlertsSettings
          key={portfolio.uuid}
          portfolios={alertPortfolios}
          grouped={portfolio.isAggregate ? true : undefined}
          onOpenCategories={openCategories}
          onOpenAdoption={(uuid) => onOpen(uuid, "strategy")}
        />
      )}
      {page === "reports" && (
        portfolio.isAggregate ? <ReportsBrowser key="all" /> : <ReportsBrowser key={portfolio.uuid} portfolioUuid={portfolio.uuid} />
      )}
    </div>
  );
}

function ReadOnlyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-[#C49A3C]/30 bg-[#C49A3C]/10 px-4 py-3 text-[13px] font-semibold text-[#8A6A28]">
      {children}
    </p>
  );
}

// ── Wealth itself (a demo account's preview) ─────────────────────────────────────────────────

const WALLETS_COLOR = "#0f766e";
const INVESTMENTS_COLOR = "#C49A3C";

/**
 * WEALTH ROOT (preview) — everything a demo account owns, the top of Wealth: its net worth, the
 * investments (All portfolios, real) and the wallets (sample data) side by side, each opening its
 * page, and the sample real estate portfolio. New portfolios and wallets are added here, at the top
 * of Wealth (a wallet is coming soon; a demo account, read only, can add neither).
 */
function WealthRoot({ investments, onOpen }: { investments: Portfolio | undefined; onOpen: (view: WealthView) => void }) {
  const { isDemo } = useUser();
  const entry = useComparisonEntry(investments?.uuid ?? "");
  const [creating, setCreating] = useState(false);
  const wallets = useMemo(() => walletsSummary(), []);
  const [hovered, setHovered] = useState<string | null>(null);
  const invested = entry?.value?.marketValue ?? null;
  const currency = entry?.value?.currency ?? wallets.currency;
  const total = (invested ?? 0) + wallets.balance;
  const saved = wallets.income > 0 ? ((wallets.income - wallets.expenses) / wallets.income) * 100 : null;

  const months = useMemo(() => monthlySummary(null), []);
  const recent = months.slice(-6);
  const avgSpending = recent.reduce((sum, m) => sum + m.expenses, 0) / Math.max(recent.length, 1);
  const [breakdown, setBreakdown] = useState<"nav" | "class">("nav");

  // Investments & wallets, each opening its page; or what it's all in, by asset class (the
  // investments' allocation, the wallets as cash), to read only.
  const navParts: RootPart[] = [
    ...(investments ? [{
      key: "investments",
      label: investments.isAggregate ? investments.name : "Investments",
      sub: investments.isAggregate ? "Every portfolio together" : investments.name,
      value: invested ?? 0,
      color: INVESTMENTS_COLOR,
      onOpen: () => onOpen({ kind: "portfolio", uuid: investments.uuid, page: "overview" }),
    }] : []),
    {
      key: "wallets",
      label: "Wallets",
      sub: `${wallets.wallets.length} wallets · sample data`,
      value: wallets.balance,
      color: WALLETS_COLOR,
      preview: true,
      onOpen: () => onOpen({ kind: "wallet", id: ALL_WALLETS, page: "insights" }),
    },
  ];
  const classParts: RootPart[] = [
    ...(entry?.allocation ?? []).map((a, i) => ({
      key: `class:${a.assetClass}`,
      label: a.assetClass,
      value: a.marketValue,
      color: CATEGORICAL_PALETTE[i % CATEGORICAL_PALETTE.length],
    })),
    { key: "class:cash", label: "Cash", sub: "In your wallets · sample data", value: wallets.balance, color: WALLETS_COLOR },
  ].sort((a, b) => b.value - a.value);
  // The largest few slices (ROOT_TOP); any others as one "N more" (named in it, to read only).
  const allParts = breakdown === "nav" ? navParts : classParts;
  const rest = allParts.slice(ROOT_TOP);
  const parts: RootPart[] = rest.length > 0
    ? [
        ...allParts.slice(0, ROOT_TOP),
        { key: "more", label: `${rest.length} more`, sub: rest.map((p) => p.label).join(", "), value: rest.reduce((sum, p) => sum + p.value, 0), color: "#d6d3d1" },
      ]
    : allParts;
  const partsTotal = parts.reduce((sum, p) => sum + p.value, 0);
  const share = (v: number) => (partsTotal > 0 ? (v / partsTotal) * 100 : 0);
  const focus = parts.find((p) => p.key === hovered);

  return (
    <div className="space-y-[22px] pb-12">
      <PageHeader
        eyebrow="Wealth"
        badge={<PreviewBadge />}
        title="Wealth"
        value={invested === null && entry === undefined ? null : formatCurrency(total, currency, 0)}
        note="Your investments and your wallets"
        actions={[
          { label: "Add portfolio", primary: true, onClick: () => setCreating(true), ...(isDemo ? { disabled: true, title: DEMO_DISABLED_TITLE } : {}) },
          // Wallets are a preview: nothing can be connected yet.
          { label: "Add wallet", onClick: () => {}, disabled: true, title: "Coming soon" },
        ]}
        figures={[
          { label: "Net worth", value: formatCurrency(total, currency, 0) },
          { label: "Invested", value: total > 0 ? `${(((invested ?? 0) / total) * 100).toFixed(0)}%` : "—", sub: invested !== null ? `${formatCurrency(invested, currency, 0)} in portfolios` : undefined },
          { label: "Liquidity", value: formatCurrency(wallets.balance, wallets.currency, 0), sub: avgSpending > 0 ? `${(wallets.balance / avgSpending).toFixed(1)} months of spending` : "In your wallets" },
          { label: "Savings rate", value: saved !== null ? `${saved.toFixed(0)}%` : "—", tone: toneOf(saved) },
        ]}
      />

      <Module>
        <ModuleHead
          title="Composition"
          desc="Open a slice or a row to go down a level."
          right={
            <div role="group" aria-label="Breakdown" className="flex flex-wrap gap-1.5">
              {(["nav", "class"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={b === breakdown}
                  onClick={() => { setBreakdown(b); setHovered(null); }}
                  className={`px-2.5 py-1 rounded-full border text-[11.5px] font-semibold transition-colors ${
                    b === breakdown ? "bg-[#1c1917] border-[#1c1917] text-white" : "border-[#E0DACC] text-[#78716c] hover:text-[#1c1917]"
                  }`}
                >
                  {b === "nav" ? "Investments & wallets" : "By asset class"}
                </button>
              ))}
            </div>
          }
        />
        <div className={`${MODULE_BODY} space-y-3`}>
          <div className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] gap-[26px] items-center">
            <div className="relative w-full max-w-[210px] aspect-square mx-auto">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 210 }}>
                <PieChart>
                  <Pie data={parts} dataKey="value" nameKey="label" innerRadius="67%" outerRadius="98%" paddingAngle={1.4} stroke="none" isAnimationActive={false} onMouseLeave={() => setHovered(null)}>
                    {parts.map((p) => (
                      <Cell key={p.key} fill={p.color} opacity={hovered && hovered !== p.key ? 0.25 : 1} cursor={p.onOpen ? "pointer" : "default"} onMouseEnter={() => setHovered(p.key)} onClick={p.onOpen} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-[22%] text-center">
                <span className="text-xl font-bold text-[#1c1917] tabular-nums">
                  {focus ? `${share(focus.value).toFixed(1)}%` : formatCurrency(partsTotal, currency, 0)}
                </span>
                <span className="text-[10.5px] text-[#78716c] truncate max-w-full">{focus ? focus.label : "total"}</span>
              </div>
            </div>
            <ul className="min-w-0">
              {parts.map((p, i) => {
                const content = (
                  <>
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: p.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-[#1c1917] truncate">{p.label}{p.preview && <PreviewBadge />}</span>
                      {p.sub && <span className="block truncate text-[11.5px] font-medium text-[#78716c]">{p.sub}</span>}
                    </span>
                    <span className="shrink-0 font-bold text-[#1c1917] tabular-nums">{formatCurrency(p.value, currency, 0)}</span>
                    <span className="hidden sm:block shrink-0 min-w-[92px] text-right text-xs text-[#78716c] tabular-nums">{share(p.value).toFixed(1)}%</span>
                    <span className="w-[18px] shrink-0">{p.onOpen && <ChevronRight className="h-4 w-4 text-[#a8a29e]" />}</span>
                  </>
                );
                const row = `w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left transition-colors ${i < parts.length - 1 ? "border-b border-[#EEE9DD]" : ""} ${hovered === p.key ? "bg-[#F7F5EF]" : ""}`;
                return (
                  <li key={p.key} onMouseEnter={() => setHovered(p.key)} onMouseLeave={() => setHovered(null)}>
                    {p.onOpen ? (
                      <button type="button" onClick={p.onOpen} className={`${row} hover:bg-[#F7F5EF]`}>{content}</button>
                    ) : (
                      <div className={row}>{content}</div>
                    )}
                  </li>
                );
              })}
              {breakdown === "nav" && (
                <li>
                  <button type="button" onClick={() => onOpen({ kind: "realEstate", page: "home" })} className="w-full flex items-center gap-3 px-2.5 py-[11px] rounded-[14px] text-left border-t border-[#EEE9DD] transition-colors hover:bg-[#F7F5EF]">
                    <span className="h-2.5 w-2.5 rounded-[3px] shrink-0 bg-[#d6d3d1]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold text-[#1c1917]">Real estate <PreviewBadge /></span>
                      <span className="block truncate text-[11.5px] font-medium text-[#78716c]">A sample property portfolio, not counted in the net worth</span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-[#a8a29e] shrink-0" />
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </Module>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        <Module>
          <ModuleHead title="Cash Flow" desc="What came into your wallets and what went out, month by month. Sample data." right={<PreviewBadge />} />
          <div className={`${MODULE_BODY} space-y-4`}>
            <Figs>
              <Fig label="In · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.income, 0), wallets.currency, 0)} tone="gain" strong />
              <Fig label="Out · 6 months" value={formatCurrency(recent.reduce((sum, m) => sum + m.expenses, 0), wallets.currency, 0)} />
              <Fig label="Savings rate" value={savingsRate(recent)} />
            </Figs>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 150 }}>
                <BarChart data={recent.map((m) => ({ label: m.label, income: m.income, expenses: -m.expenses }))} stackOffset="sign" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${Number(v) < 0 ? "−" : ""}€${Math.abs(Math.round(Number(v) / 1000))}k`} tick={{ fontSize: 10, fill: "#a8a29e" }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v, name) => [formatCurrency(Math.abs(Number(v)), wallets.currency, 0), name === "income" ? "In" : "Out"]} contentStyle={{ borderRadius: 12, border: "1px solid #E0DACC", fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#a8a29e" />
                  <Bar dataKey="income" stackId="flow" fill="#1baf7a" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="expenses" stackId="flow" fill="#e11d48" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Module>
        <Module>
          <ModuleHead title="Asset Classes" desc="What your wealth is in, across every portfolio and wallet." />
          <div className={`${MODULE_BODY} space-y-3`}>
            {entry === undefined ? (
              <p className="text-[12.5px] text-[#a8a29e]">Loading…</p>
            ) : (
              <HBars
                max={100}
                rows={classParts.map((p) => {
                  const pctOfAll = classTotal(classParts) > 0 ? (p.value / classTotal(classParts)) * 100 : 0;
                  return { key: p.key, label: p.label, value: pctOfAll, figure: `${pctOfAll.toFixed(0)}%`, color: p.color };
                })}
              />
            )}
          </div>
        </Module>
      </div>
      {creating && <NewPortfolioDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

interface RootPart {
  key: string;
  label: string;
  sub?: string;
  value: number;
  color: string;
  preview?: boolean;
  onOpen?: () => void;
}

// Slices on Wealth's donut before the rest are one "N more".
const ROOT_TOP = 3;

const classTotal = (parts: RootPart[]) => parts.reduce((sum, p) => sum + p.value, 0);

function savingsRate(months: { income: number; expenses: number }[]) {
  const income = months.reduce((sum, m) => sum + m.income, 0);
  const expenses = months.reduce((sum, m) => sum + m.expenses, 0);
  return income > 0 ? `${Math.round(((income - expenses) / income) * 100)}%` : "—";
}

// ── Wallets (a demo account's preview) ───────────────────────────────────────────────────────

const WALLET_PAGES: WalletPage[] = ["transactions", "budgets", "reports", "alerts"];

/**
 * WALLET NODE (preview) — every wallet together, or one, in Wealth: a header leading to its pages
 * (Transactions, Budgets, Reports, Alerts), then its Insights; on every wallet together, the
 * wallets first, each opening its own. All sample data (lib/mock/wallets).
 */
function WalletNode({ id, page, rootTrail, onOpen }: {
  id: string;
  page: WalletPage;
  rootTrail: Crumb[];
  onOpen: (id: string, page: WalletPage) => void;
}) {
  const all = id === ALL_WALLETS;
  const summary = useMemo(() => walletsSummary(), []);
  const balance = all ? summary.balance : summary.wallets.find((w) => w.id === id)?.balance ?? 0;
  const title = all ? "Wallets" : walletName(id);
  const allCrumb: Crumb = { label: "Wallets", onClick: () => onOpen(ALL_WALLETS, "insights") };
  const trail = all ? rootTrail : [...rootTrail, allCrumb];

  if (page !== "insights") {
    return <WalletView id={id} page={page} trail={[...trail, { label: title, onClick: () => onOpen(id, "insights") }]} />;
  }

  const header = (
    <>
      <PageHeader
        eyebrow={all ? "Wallets" : "Wallet"}
        badge={<PreviewBadge />}
        title={title}
        value={formatCurrency(balance, summary.currency, 0)}
        note="Sample data"
        counters={WALLET_PAGES.map((p) => ({ key: p, label: WALLET_PAGE_LABELS[p], onClick: () => onOpen(id, p) }))}
      />
      {all && <WalletsHub trail={[]} onOpen={onOpen} />}
    </>
  );
  return <WalletView id={id} page="insights" trail={trail} pageLabel={title} header={header} />;
}
