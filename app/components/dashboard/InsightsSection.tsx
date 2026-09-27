// components/dashboard/InsightsSection.tsx
"use client";

import { useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { MAX_COMPARED, openPortfolioSettings } from "./PortfolioBar";
import { InsightsHub, InsightsReports } from "./InsightsHub";

type InsightsView =
  | { kind: "hub" }
  | { kind: "portfolio"; uuid: string }
  | { kind: "compare" }
  | { kind: "reports" };

/**
 * INSIGHTS SECTION (investor) — opens on the hub (InsightsHub): a card per portfolio, plus
 * Compare, Reports and managing portfolios. Every page under it starts with the same
 * breadcrumb, "Insights / …", whose first crumb comes back here. Opening a portfolio also makes
 * it the selected one (PortfolioContext), which the rest of the dashboard follows. Which page
 * is open is local to this section: leaving Insights and coming back lands on the hub again,
 * while Compare's picked portfolios are remembered for next time.
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [view, setView] = useState<InsightsView>({ kind: "hub" });
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
      onManage={() => openPortfolioSettings(onNavigate)}
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

  return hub;
}
