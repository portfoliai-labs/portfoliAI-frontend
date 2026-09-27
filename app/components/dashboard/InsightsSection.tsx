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

type PortfoliosView =
  | { kind: "hub" }
  | { kind: "compare" }
  | { kind: "portfolio"; uuid: string; page: PortfolioPage };

const PORTFOLIO_PAGES: PortfolioPage[] = ["home", "insights", "transactions", "reports", "alerts"];

/**
 * Opens Portfolios on one portfolio's page rather than on the hub, from elsewhere in the
 * dashboard (the Dashboard's portfolio cards, "Manage alerts", "Add transactions"): the page
 * rides in the URL hash (#portfolio=<uuid>/<page>), which InsightsSection reads when it mounts
 * and then clears.
 */
export function openPortfoliosPage(onNavigate: (section: string) => void, portfolioUuid: string, page: PortfolioPage = "home") {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#portfolio=${encodeURIComponent(portfolioUuid)}/${page}`);
  onNavigate("performance");
}

const viewFromHash = (): PortfoliosView => {
  if (typeof window === "undefined") return { kind: "hub" };
  const match = window.location.hash.match(/^#portfolio=([^/]+)\/(\w+)$/);
  if (!match) return { kind: "hub" };
  const page = PORTFOLIO_PAGES.find((p) => p === match[2]) ?? "home";
  return { kind: "portfolio", uuid: decodeURIComponent(match[1]), page };
};

/**
 * PORTFOLIOS SECTION (investor; "performance" in the sidebar's ids, labelled Portfolios) —
 * opens on the hub (InsightsHub): a card per portfolio, plus Compare. A portfolio opens on its
 * own page (PortfolioHome: its key figures, and the way into its Insights, Transactions,
 * Reports and Alerts). Every page under the hub shows where it is ("Portfolios / Main
 * portfolio / Insights / Dividends") through Breadcrumb: in the Sidebar on wide screens, at the
 * top of the page below that. Opening a portfolio also makes it the selected one
 * (PortfolioContext), which the rest of the dashboard follows. Which page is open is local to
 * this section: leaving and coming back lands on the hub again (unless openPortfoliosPage asked
 * for another), while Compare's picked portfolios are remembered for next time.
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [view, setView] = useState<PortfoliosView>(viewFromHash);
  const [selection, setSelection] = useState<string[]>([]);

  // The hash only carries the request to open a page (openPortfoliosPage); clear it so coming
  // back later, from the sidebar, lands on the hub.
  useEffect(() => {
    if (window.location.hash.startsWith("#portfolio=")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const go = (next: PortfoliosView) => {
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
    />
  );

  if (view.kind === "compare") {
    return <ComparisonView selection={selection} onToggle={toggle} onHub={toHub} onOpen={openPortfolio} />;
  }

  if (view.kind === "portfolio") {
    const portfolio = portfolios.find((p) => p.uuid === view.uuid);
    // Deleted meanwhile (or a stale link): back to the hub.
    if (!portfolio) return hub;

    const hubCrumb: Crumb = { label: "Portfolios", onClick: toHub };
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
