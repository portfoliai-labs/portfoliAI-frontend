// components/dashboard/ExploreSection.tsx
"use client";

import { useEffect, useState } from "react";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { EXPLORE_SECTION } from "../../lib/dashboardNav";
import { StrategiesExplore } from "./StrategiesExplore";

// The open strategy's publication, if any.
export type ExploreView = { publicationId?: string };

const SECTION = EXPLORE_SECTION;

const viewFromHistory = (): ExploreView => {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as ExploreView | undefined) : undefined;
  return typeof view?.publicationId === "string" ? { publicationId: view.publicationId } : {};
};

/**
 * EXPLORE SECTION — an advisor's way to the strategies catalog (StrategiesExplore: the strategies
 * advisors publish, simulated, read only). An investor's Explore is Plan's, under Strategy (see
 * PlanSection). Each strategy opened is a browser history entry (see lib/dashboardHistory).
 */
export function ExploreSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const [view, setView] = useState<ExploreView>(viewFromHistory);

  useEffect(() => {
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setView(viewFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const openStrategy = (publicationId: string | null) => {
    const next: ExploreView = publicationId ? { publicationId } : {};
    pushDashboardEntry({ section: SECTION, view: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };

  return <StrategiesExplore trail={[]} publicationId={view.publicationId} onOpen={openStrategy} onNavigate={onNavigate} />;
}
