// components/dashboard/InsightsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { MAX_COMPARED } from "./PortfolioBar";
import { InsightsHub } from "./InsightsHub";
import { AssetsHub } from "./AssetsHub";
import { PortfolioHome, PortfolioTransactions, PortfolioReports, PortfolioAlerts, type PortfolioPage } from "./PortfolioHome";
import type { Crumb } from "./Breadcrumb";
import { RealEstatePortfolio, type RealEstatePage } from "../preview/RealEstatePortfolio";
import { WalletView, WalletsHub, isWalletId, type WalletPage } from "../preview/WalletPages";
import { StrategyBuilder } from "./StrategyBuilder";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { isBacktest } from "../../models/Portfolio";

type PortfoliosView =
  // Assets' own hub: Investments, Wallets…
  | { kind: "assets" }
  // Assets / Investments: the portfolios.
  | { kind: "investments" }
  | { kind: "compare" }
  | { kind: "strategy" }
  // Previews of what's coming, on sample data (components/preview).
  | { kind: "realEstate"; page: RealEstatePage }
  // Assets / Wallets, and a wallet's pages.
  | { kind: "wallets" }
  | { kind: "wallet"; id: string; page: WalletPage }
  | { kind: "portfolio"; uuid: string; page: PortfolioPage };

// The dashboard's section id for this one (see the dashboard page).
const SECTION = "performance";

/**
 * Opens Portfolios on one portfolio's page rather than on the hub, from elsewhere in the
 * dashboard (the Dashboard's portfolio cards, "Manage alerts", "Add transactions"): the page is
 * recorded in the history entry (see lib/dashboardHistory), which InsightsSection reads when it
 * mounts. One entry for the whole move: the one `onNavigate` may have just pushed for the
 * section is replaced by the page.
 */
export function openPortfoliosPage(onNavigate: (section: string) => void, portfolioUuid: string, page: PortfolioPage = "home") {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "portfolio", uuid: portfolioUuid, page };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Assets on the portfolios' hub (Assets / Investments), the way openPortfoliosPage does. */
export function openInvestmentsHub(onNavigate: (section: string) => void) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "investments" };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Assets on the wallets' hub (Assets / Wallets), the way openPortfoliosPage does. */
export function openWalletsHub(onNavigate: (section: string) => void) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "wallets" };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

/** Opens Assets on a wallet's page (all wallets: their Insights), the way openPortfoliosPage does. */
export function openWalletPage(onNavigate: (section: string) => void, walletId: string, page: WalletPage) {
  const before = window.history.state;
  onNavigate(SECTION);
  const view: PortfoliosView = { kind: "wallet", id: walletId, page };
  pushDashboardEntry({ section: SECTION, view }, window.history.state !== before);
}

// The view the current history entry was on; Assets' hub when it's another section's or none.
const viewFromHistory = (): PortfoliosView => {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as PortfoliosView | undefined) : undefined;
  // An entry from before Assets had a hub of its own: "hub" was the portfolios'. Explore was a page
  // here before it got a section of its own; a wallet's id can outlive the sample data.
  const kind = view?.kind as string | undefined;
  if (kind === "hub") return { kind: "investments" };
  if (!view || kind === "explore" || (view.kind === "wallet" && !isWalletId(view.id))) return { kind: "assets" };
  return view;
};

/**
 * ASSETS SECTION (investor; "performance" in the sidebar's ids, labelled Assets) — everything
 * the user owns, opening on its own hub (AssetsHub): a card per kind of asset, each leading to
 * its hub. Investments (InsightsHub): a card per portfolio, plus Combined, Compare and Strategy.
 * Wallets (WalletsHub, a preview on sample data for a demo account, see WalletPages): a card per
 * wallet, each opening its own page the same way a portfolio does. A portfolio opens on its
 * own page (PortfolioHome: its key figures, and the way into its Insights, Transactions,
 * Reports and Alerts). Every page under the hub publishes where it is ("Assets / Investments /
 * Main portfolio / Insights") through Breadcrumb, and the Sidebar shows the hub it's under
 * (Investments, Wallets) under Assets. Opening a portfolio also makes it the selected one
 * (PortfolioContext), which the rest of the dashboard follows. Which page is open is local to
 * this section: leaving and coming back lands on Assets' hub again (unless openPortfoliosPage asked
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
  const toAssets = () => go({ kind: "assets" });
  const toInvestments = () => go({ kind: "investments" });
  const toWallets = () => go({ kind: "wallets" });
  // "All portfolios" (the hub's Combined) opens straight on its Insights: for now it has no page
  // of its own in between (no transactions of its own, and its alerts and reports are its
  // portfolios').
  const openPortfolio = (uuid: string) => {
    selectPortfolio(uuid);
    const isAggregate = portfolios.find((p) => p.uuid === uuid)?.isAggregate ?? false;
    go({ kind: "portfolio", uuid, page: isAggregate ? "insights" : "home" });
  };

  const toggle = (uuid: string) => {
    setSelection((prev) => {
      const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
      rememberCompareSelection(next);
      return next;
    });
  };

  // Every page publishes the pages above it (see Breadcrumb): "Assets", then the hub it's under.
  const assetsTrail: Crumb[] = [{ label: "Assets", onClick: toAssets }];
  const investmentsTrail: Crumb[] = [...assetsTrail, { label: "Investments", onClick: toInvestments }];
  const walletsTrail: Crumb[] = [...assetsTrail, { label: "Wallets", onClick: toWallets }];

  const investmentsHub = (
    <InsightsHub
      trail={assetsTrail}
      onOpenPortfolio={openPortfolio}
      onCompare={() => {
        setSelection(initialCompareSelection(portfolios, current?.uuid ?? null));
        go({ kind: "compare" });
      }}
      onOpenRealEstate={() => go({ kind: "realEstate", page: "home" })}
      onStrategy={() => go({ kind: "strategy" })}
    />
  );

  if (view.kind === "assets") return <AssetsHub onInvestments={toInvestments} onWallets={toWallets} />;
  if (view.kind === "investments") return investmentsHub;
  if (view.kind === "wallets") return <WalletsHub trail={assetsTrail} onOpen={(id, page) => go({ kind: "wallet", id, page })} />;
  if (view.kind === "wallet") {
    return <WalletView id={view.id} page={view.page} trail={walletsTrail} onOpenPage={(page) => go({ kind: "wallet", id: view.id, page })} />;
  }
  if (view.kind === "realEstate") {
    return <RealEstatePortfolio trail={investmentsTrail} page={view.page} onOpenPage={(page) => go({ kind: "realEstate", page })} />;
  }
  if (view.kind === "strategy") return <StrategyBuilder trail={investmentsTrail} onCreated={openPortfolio} />;

  if (view.kind === "compare") {
    return <ComparisonView selection={selection} onToggle={toggle} trail={investmentsTrail} onOpen={openPortfolio} />;
  }

  if (view.kind === "portfolio") {
    const portfolio = portfolios.find((p) => p.uuid === view.uuid);
    // Deleted meanwhile (or a stale link): back to the portfolios.
    if (!portfolio) return investmentsHub;

    // The portfolio's own page; for "All portfolios", which skips it, its Insights: from a detail
    // view or a month, back through their history entries (a month sits over a detail), which
    // closes them; from Insights itself, back to the top of it.
    const backToInsights = () => {
      const overlay = readDashboardEntry()?.overlay;
      if (overlay) window.history.go(overlay === "month" ? -2 : -1);
      else {
        setInsightsVisit((n) => n + 1);
        window.scrollTo({ top: 0 });
      }
    };
    const homeCrumb: Crumb = portfolio.isAggregate
      ? { label: portfolio.name, onClick: backToInsights }
      : { label: portfolio.name, onClick: () => go({ kind: "portfolio", uuid: portfolio.uuid, page: "home" }) };
    const pageTrail = [...investmentsTrail, homeCrumb];
    const openPage = (page: PortfolioPage) => go({ kind: "portfolio", uuid: portfolio.uuid, page });

    switch (view.page) {
      case "insights":
        return (
          // Keyed so switching portfolios drops the month-drilldown cache, which is per year.
          <PerformanceSection
            key={`${portfolio.uuid}:${insightsVisit}`}
            portfolioUuid={portfolio.uuid}
            isAggregate={portfolio.isAggregate}
            backtest={isBacktest(portfolio)}
            trail={pageTrail}
            // Its "add transactions" empty state leads to this portfolio's own Transactions.
            onNavigate={(section) => (section === "upload" ? openPage("transactions") : onNavigate(section))}
          />
        );
      case "transactions":
        return <PortfolioTransactions key={portfolio.uuid} portfolio={portfolio} trail={pageTrail} />;
      case "reports":
        return <PortfolioReports key={portfolio.uuid} portfolio={portfolio} trail={pageTrail} />;
      case "alerts":
        return <PortfolioAlerts key={portfolio.uuid} portfolio={portfolio} trail={pageTrail} />;
      default:
        return <PortfolioHome key={portfolio.uuid} portfolio={portfolio} trail={investmentsTrail} onOpenPage={openPage} onDeleted={toInvestments} />;
    }
  }

  return investmentsHub;
}
