// components/dashboard/InsightsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, MAX_COMPARED, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { InsightsHub } from "./InsightsHub";
import { ManageHub } from "./ManageHub";
import { PortfolioActions } from "./PortfolioActions";
import { PortfolioAlertsSection, PortfolioReportsSection, PortfolioTransactionsSection } from "./PortfolioSections";
import type { Crumb } from "./Breadcrumb";
import { RealEstatePortfolio, type RealEstatePage } from "../preview/RealEstatePortfolio";
import { WalletView, WalletsHub, isWalletId, type WalletPage } from "../preview/WalletPages";
import { StrategyBuilder } from "./StrategyBuilder";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { isBacktest } from "../../models/Portfolio";

type PortfoliosView =
  // Manage's own hub: Investments, Wallets…
  | { kind: "manage" }
  // Manage / Investments: the portfolios.
  | { kind: "investments" }
  | { kind: "compare" }
  | { kind: "strategy" }
  // Every portfolio's transactions, reports and alerts, on one page each (PortfolioSections).
  | { kind: InvestmentsPage }
  // Previews of what's coming, on sample data (components/preview).
  | { kind: "realEstate"; page: RealEstatePage }
  // Manage / Wallets, and its pages: a wallet's Insights, and Transactions, Budgets… on one or all.
  | { kind: "wallets" }
  | { kind: "wallet"; id: string; page: WalletPage }
  // A portfolio: its Insights.
  | { kind: "portfolio"; uuid: string };

// The pages under Investments that pick a portfolio at their top.
export type InvestmentsPage = "transactions" | "reports" | "alerts";

// The dashboard's section id for this one (see the dashboard page).
const SECTION = "performance";

/**
 * Opens Manage on one portfolio's Insights rather than on the hub, from elsewhere in the
 * dashboard (the Dashboard's portfolio cards): the page is recorded in the history entry (see
 * lib/dashboardHistory), which InsightsSection reads when it mounts. One entry for the whole
 * move: the one `onNavigate` may have just pushed for the section is replaced by the page.
 */
export function openPortfolioInsights(onNavigate: (section: string) => void, portfolioUuid: string) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "portfolio", uuid: portfolioUuid };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Manage on the portfolios' hub (Manage / Investments), the way openPortfolioInsights does. */
export function openInvestmentsHub(onNavigate: (section: string) => void) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "investments" };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/**
 * Opens Investments' Transactions, Reports or Alerts (on the selected portfolio), the way
 * openPortfolioInsights does: "Manage alerts", "Add transactions".
 */
export function openInvestmentsPage(onNavigate: (section: string) => void, page: InvestmentsPage) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: page };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Manage on the wallets' hub (Manage / Wallets), the way openPortfolioInsights does. */
export function openWalletsHub(onNavigate: (section: string) => void) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "wallets" };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Manage on a wallet's page (all wallets: their Insights), the way openPortfolioInsights does. */
export function openWalletPage(onNavigate: (section: string) => void, walletId: string, page: WalletPage) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "wallet", id: walletId, page };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

// The view the current history entry was on; Manage's hub when it's another section's or none.
const viewFromHistory = (): PortfoliosView => {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as PortfoliosView | undefined) : undefined;
  // An entry from before Manage had a hub of its own: "hub" was the portfolios'. Explore was a page
  // here before it got a section of its own; a wallet's id can outlive the sample data.
  const kind = view?.kind as string | undefined;
  if (kind === "hub") return { kind: "investments" };
  // Manage was called Assets, then Vault.
  if (!view || kind === "assets" || kind === "vault" || kind === "explore" || (view.kind === "wallet" && !isWalletId(view.id))) return { kind: "manage" };
  // A wallet had a page of its own before its card opened on Insights.
  if (view.kind === "wallet" && (view.page as string) === "home") return { ...view, page: "insights" };
  // A portfolio had pages of its own (home, transactions…) before its cards opened on Insights.
  if (view.kind === "portfolio") return { kind: "portfolio", uuid: view.uuid };
  return view;
};

/**
 * MANAGE SECTION (investor; "performance" in the sidebar's ids, labelled Manage) — everything
 * the user owns and what they do with it, opening on its own hub (ManageHub): a card per kind of asset, each leading to
 * its hub. Investments (InsightsHub): a card per portfolio, plus Combined, Compare and Strategy.
 * Wallets (WalletsHub, a preview on sample data for a demo account, see WalletPages): a card per
 * wallet opening on its Insights, and Transactions, Budgets, Reports and Alerts on the hub. A
 * portfolio's card opens straight on its Insights, with its Rename and Delete in the corner
 * (PortfolioActions). Transactions, Reports and Alerts sit on Investments with Compare and
 * Strategy, each on every portfolio at once (PortfolioSections). Opening a portfolio also makes it the selected one
 * (PortfolioContext), which the rest of the dashboard follows. Which page is open is local to
 * this section: leaving and coming back lands on Manage's hub again (unless openPortfolioInsights asked
 * for another), while Compare's picked portfolios are remembered for next time. Every page is a
 * browser history entry, so back and forward move between them (see lib/dashboardHistory).
 * Investments also leads to Strategy, which backtests a strategy into a virtual portfolio and then
 * opens it, and, for a demo account, to a sample real estate portfolio (mock data from lib/mock).
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [view, setView] = useState<PortfoliosView>(viewFromHistory);
  const [selection, setSelection] = useState<string[]>([]);
  // Bumped to start Insights over (back at the top of the page), when "All portfolios" is picked
  // in the Sidebar while already on its Insights (see below).
  const [insightsVisit, setInsightsVisit] = useState(0);

  // Back and forward: show the page the entry landed on, if it's one of this section's (another
  // section's entry is the dashboard page's to handle).
  useEffect(() => {
    const onPopState = () => {
      if (readDashboardEntry()?.section !== SECTION) return;
      const next = viewFromHistory();
      setView((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const go = (next: PortfoliosView) => {
    pushDashboardEntry({ section: SECTION, view: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const toManage = () => go({ kind: "manage" });
  const toInvestments = () => go({ kind: "investments" });
  const toWallets = () => go({ kind: "wallets" });
  const openPortfolio = (uuid: string) => {
    selectPortfolio(uuid);
    go({ kind: "portfolio", uuid });
  };

  const toggle = (uuid: string) => {
    setSelection((prev) => {
      const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
      rememberCompareSelection(next);
      return next;
    });
  };

  // Every page publishes the pages above it (see Breadcrumb): "Manage", then the hub it's under.
  const manageTrail: Crumb[] = [{ label: "Manage", onClick: toManage }];
  const investmentsTrail: Crumb[] = [...manageTrail, { label: "Investments", onClick: toInvestments }];
  const walletsTrail: Crumb[] = [...manageTrail, { label: "Wallets", onClick: toWallets }];

  const investmentsHub = (
    <InsightsHub
      trail={manageTrail}
      onOpenPortfolio={openPortfolio}
      onCompare={() => {
        setSelection(initialCompareSelection(portfolios, current?.uuid ?? null));
        go({ kind: "compare" });
      }}
      onOpenRealEstate={() => go({ kind: "realEstate", page: "home" })}
      onStrategy={() => go({ kind: "strategy" })}
      onOpenPage={(page) => go({ kind: page })}
    />
  );

  if (view.kind === "manage") return <ManageHub onInvestments={toInvestments} onWallets={toWallets} />;
  if (view.kind === "investments") return investmentsHub;
  if (view.kind === "wallets") return <WalletsHub trail={manageTrail} onOpen={(id, page) => go({ kind: "wallet", id, page })} />;
  if (view.kind === "wallet") {
    return <WalletView id={view.id} page={view.page} trail={walletsTrail} />;
  }
  if (view.kind === "realEstate") {
    return <RealEstatePortfolio trail={investmentsTrail} page={view.page} onOpenPage={(page) => go({ kind: "realEstate", page })} />;
  }
  if (view.kind === "transactions") return <PortfolioTransactionsSection trail={investmentsTrail} />;
  if (view.kind === "reports") return <PortfolioReportsSection trail={investmentsTrail} />;
  if (view.kind === "alerts") return <PortfolioAlertsSection trail={investmentsTrail} />;
  if (view.kind === "strategy") return <StrategyBuilder trail={investmentsTrail} onCreated={openPortfolio} />;

  if (view.kind === "compare") {
    return <ComparisonView selection={selection} onToggle={toggle} trail={investmentsTrail} onOpen={openPortfolio} />;
  }

  if (view.kind === "portfolio") {
    const portfolio = portfolios.find((p) => p.uuid === view.uuid);
    // Deleted meanwhile (or a stale link): back to the portfolios.
    if (!portfolio) return investmentsHub;

    // Its Insights: from a detail view or a month, back through their history entries (a month
    // sits over a detail), which closes them; from Insights itself, back to the top of it.
    const backToInsights = () => {
      const overlay = readDashboardEntry()?.overlay;
      if (overlay) window.history.go(overlay === "month" ? -2 : -1);
      else {
        setInsightsVisit((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    };
    return (
      // Keyed so switching portfolios drops the month-drilldown cache, which is per year.
      <PerformanceSection
        key={`${portfolio.uuid}:${insightsVisit}`}
        portfolioUuid={portfolio.uuid}
        isAggregate={portfolio.isAggregate}
        backtest={isBacktest(portfolio)}
        trail={[...investmentsTrail, { label: portfolio.name, onClick: backToInsights }]}
        action={<PortfolioActions portfolio={portfolio} onDeleted={toInvestments} />}
        onNavigate={onNavigate}
      />
    );
  }

  return investmentsHub;
}
