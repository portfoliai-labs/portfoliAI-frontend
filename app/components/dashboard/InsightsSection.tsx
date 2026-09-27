// components/dashboard/InsightsSection.tsx
"use client";

import { useEffect, useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { MAX_COMPARED } from "./PortfolioBar";
import { InsightsHub, InsightsReports, InsightsAlerts } from "./InsightsHub";

type InsightsView =
  | { kind: "hub" }
  | { kind: "portfolio"; uuid: string }
  | { kind: "compare" }
  | { kind: "reports" }
  | { kind: "alerts" };

/**
 * Opens Portfolios on one of its pages rather than on the hub, from elsewhere in the dashboard
 * (the Dashboard's portfolio cards and "Manage alerts"): the page rides in the URL hash, which
 * InsightsSection reads when it mounts and then clears.
 */
export function openPortfoliosPage(onNavigate: (section: string) => void, page: { portfolio: string } | "alerts") {
  const hash = page === "alerts" ? "alerts" : `portfolio=${encodeURIComponent(page.portfolio)}`;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
  onNavigate("performance");
}

const viewFromHash = (): InsightsView => {
  if (typeof window === "undefined") return { kind: "hub" };
  const hash = window.location.hash.slice(1);
  if (hash === "alerts") return { kind: "alerts" };
  if (hash.startsWith("portfolio=")) return { kind: "portfolio", uuid: decodeURIComponent(hash.slice("portfolio=".length)) };
  return { kind: "hub" };
};

/**
 * PORTFOLIOS SECTION (investor; "performance" in the sidebar's ids, labelled Portfolios) —
 * opens on the hub (InsightsHub): a card per portfolio (opened, renamed or deleted from
 * there), plus Compare, Reports and Alerts. Every page under it starts with the same
 * breadcrumb, "Portfolios / …", whose first crumb comes back here. Opening a portfolio also
 * makes it the selected one (PortfolioContext), which the rest of the dashboard follows.
 * Which page is open is local to this section: leaving and coming back lands on the hub again
 * (unless openPortfoliosPage asked for another), while Compare's picked portfolios are
 * remembered for next time.
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [view, setView] = useState<InsightsView>(viewFromHash);

  // The hash only carries the request to open a page (openPortfoliosPage); clear it so coming
  // back later, from the sidebar, lands on the hub.
  useEffect(() => {
    if (window.location.hash.startsWith("#portfolio=") || window.location.hash === "#alerts") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);
  const [selection, setSelection] = useState<string[]>([]);

  const toHub = () => {
    setView({ kind: "hub" });
    window.scrollTo({ top: 0 });
  };
  const openPortfolio = (uuid: string) => {
    selectPortfolio(uuid);
    setView({ kind: "portfolio", uuid });
    window.scrollTo({ top: 0 });
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
        setView({ kind: "compare" });
      }}
      onReports={() => setView({ kind: "reports" })}
      onAlerts={() => setView({ kind: "alerts" })}
    />
  );

  if (view.kind === "portfolio") {
    const portfolio = portfolios.find((p) => p.uuid === view.uuid);
    // Deleted from Settings meanwhile: back to the hub.
    if (!portfolio) return hub;
    return (
      // Keyed so switching portfolios drops the month-drilldown cache, which is per year.
      <PerformanceSection
        key={portfolio.uuid}
        portfolioUuid={portfolio.uuid}
        portfolioName={portfolio.name}
        isAggregate={portfolio.isAggregate}
        onNavigate={onNavigate}
        onHub={toHub}
      />
    );
  }

  if (view.kind === "compare") {
    return <ComparisonView selection={selection} onToggle={toggle} onHub={toHub} onOpen={openPortfolio} />;
  }

  if (view.kind === "reports") {
    return <InsightsReports onHub={toHub} />;
  }

  if (view.kind === "alerts") {
    return <InsightsAlerts onHub={toHub} />;
  }

  return hub;
}
