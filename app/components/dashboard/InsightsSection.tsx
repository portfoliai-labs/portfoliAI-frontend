// components/dashboard/InsightsSection.tsx
"use client";

import { useState } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { PerformanceSection } from "./PerformanceSection";
import { ComparisonView, initialCompareSelection, rememberCompareSelection } from "./ComparisonView";
import { PortfolioBar, MAX_COMPARED, openPortfolioSettings } from "./PortfolioBar";

/**
 * INSIGHTS SECTION (investor) — the PortfolioBar on top, and under it either the selected
 * portfolio's Insights or, in compare mode, the comparison of the portfolios picked in that
 * same bar. Compare mode is local to this page: leaving Insights and coming back starts from
 * the single portfolio again, while the picked portfolios are remembered for next time.
 */
export function InsightsSection({ onNavigate }: { onNavigate: (section: string) => void }) {
  const { portfolios, current, selectPortfolio } = usePortfolio();
  const [comparing, setComparing] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);

  if (!current) return null;

  const enterCompare = () => {
    setSelection(initialCompareSelection(portfolios, current.uuid));
    setComparing(true);
  };

  const toggle = (uuid: string) => {
    setSelection((prev) => {
      const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_COMPARED ? prev : [...prev, uuid];
      rememberCompareSelection(next);
      return next;
    });
  };

  const bar = (
    <PortfolioBar
      comparing={comparing}
      compareSelection={selection}
      onToggleCompare={toggle}
      onEnterCompare={enterCompare}
      onExitCompare={() => setComparing(false)}
      onManage={() => openPortfolioSettings(onNavigate)}
    />
  );

  return comparing ? (
    <ComparisonView
      selection={selection}
      portfolioBar={bar}
      onOpen={(uuid) => { selectPortfolio(uuid); setComparing(false); }}
    />
  ) : (
    // Keyed so switching portfolios drops the month-drilldown cache, which is per year.
    <PerformanceSection
      key={current.uuid}
      portfolioUuid={current.uuid}
      isAggregate={current.isAggregate}
      onNavigate={onNavigate}
      portfolioBar={bar}
    />
  );
}
