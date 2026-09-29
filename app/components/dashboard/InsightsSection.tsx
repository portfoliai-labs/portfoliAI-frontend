// components/dashboard/InsightsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { MAX_COMPARED } from "./PortfolioBar";
import { InsightsHub } from "./InsightsHub";
import { PortfolioHome, PortfolioTransactions, PortfolioReports, PortfolioAlerts, type PortfolioPage } from "./PortfolioHome";
import type { Crumb } from "./Breadcrumb";
import { RealEstatePortfolio, type RealEstatePage } from "../preview/RealEstatePortfolio";
import { ExploreCommunity } from "../preview/ExploreCommunity";
import { StrategyBuilder } from "../preview/StrategyBuilder";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";

type PortfoliosView =
  | { kind: "hub" }
  | { kind: "compare" }
  // Previews of what's coming, on sample data (components/preview).
  | { kind: "realEstate"; page: RealEstatePage }
  | { kind: "explore" }
  | { kind: "strategy" }
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
  pushDashboardEntry({ section: SECTION, investments: view }, window.history.state !== before);
}

// The view the current history entry was on; the hub when it's another section's or none.
const viewFromHistory = (): PortfoliosView => {
  const entry = readDashboardEntry();
  return entry?.section === SECTION && entry.investments ? (entry.investments as PortfoliosView) : { kind: "hub" };
};

/**
 * PORTFOLIOS SECTION (investor; "performance" in the sidebar's ids, labelled Investments) —
 * opens on the hub (InsightsHub): a card per portfolio, plus Compare. A portfolio opens on its
 * own page (PortfolioHome: its key figures, and the way into its Insights, Transactions,
 * Reports and Alerts). Every page under the hub publishes where it is ("Portfolios / Main
 * portfolio / Insights / Dividends") through Breadcrumb, and the Sidebar shows the portfolio
 * (or Compare) under Investments. Opening a portfolio also makes it the selected one
 * (PortfolioContext), which the rest of the dashboard follows. Which page is open is local to
 * this section: leaving and coming back lands on the hub again (unless openPortfoliosPage asked
 * for another), while Compare's picked portfolios are remembered for next time. Every page is a
 * browser history entry, so back and forward move between them (see lib/dashboardHistory). The hub also
 * leads to the previews of what's coming (a sample real estate portfolio, Explore, Strategy),
 * which run on mock data from lib/mock.
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [view, setView] = useState<PortfoliosView>(viewFromHistory);
  const [selection, setSelection] = useState<string[]>([]);

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
    pushDashboardEntry({ section: SECTION, investments: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };
  const toHub = () => go({ kind: "hub" });
  const openPortfolio = (uuid: string) => {
    selectPortfolio(uuid);
    go({ kind: "portfolio", uuid, page: "home" });
  };

  const toggle = (uuid: string) => {
    setSelection((prev) => {
      const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
      rememberCompareSelection(next);
      return next;
    });
  };

  const hub = (
    <InsightsHub
      onOpenPortfolio={openPortfolio}
      onCompare={() => {
        setSelection(initialCompareSelection(portfolios, current?.uuid ?? null));
        go({ kind: "compare" });
      }}
      onOpenRealEstate={() => go({ kind: "realEstate", page: "home" })}
      onExplore={() => go({ kind: "explore" })}
      onStrategy={() => go({ kind: "strategy" })}
    />
  );

  const hubTrail: Crumb[] = [{ label: "Investments", onClick: toHub }];
  if (view.kind === "realEstate") {
    return <RealEstatePortfolio trail={hubTrail} page={view.page} onOpenPage={(page) => go({ kind: "realEstate", page })} />;
  }
  if (view.kind === "explore") return <ExploreCommunity trail={hubTrail} />;
  if (view.kind === "strategy") return <StrategyBuilder trail={hubTrail} />;

  if (view.kind === "compare") {
    return <ComparisonView selection={selection} onToggle={toggle} onHub={toHub} onOpen={openPortfolio} />;
  }

  if (view.kind === "portfolio") {
    const portfolio = portfolios.find((p) => p.uuid === view.uuid);
    // Deleted meanwhile (or a stale link): back to the hub.
    if (!portfolio) return hub;

    const hubCrumb: Crumb = { label: "Investments", onClick: toHub };
    const homeCrumb: Crumb = { label: portfolio.name, onClick: () => go({ kind: "portfolio", uuid: portfolio.uuid, page: "home" }) };
    const pageTrail = [hubCrumb, homeCrumb];
    const openPage = (page: PortfolioPage) => go({ kind: "portfolio", uuid: portfolio.uuid, page });

    switch (view.page) {
      case "insights":
        return (
          // Keyed so switching portfolios drops the month-drilldown cache, which is per year.
          <PerformanceSection
            key={portfolio.uuid}
            portfolioUuid={portfolio.uuid}
            isAggregate={portfolio.isAggregate}
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
        return <PortfolioHome key={portfolio.uuid} portfolio={portfolio} trail={[hubCrumb]} onOpenPage={openPage} onDeleted={toHub} />;
    }
  }

  return hub;
}
