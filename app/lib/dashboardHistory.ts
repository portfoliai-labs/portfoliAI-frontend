// lib/dashboardHistory.ts
//
// DASHBOARD HISTORY — lets the browser's back and forward buttons move through the dashboard,
// which is one URL whose pages are all component state: the section open (dashboard page), the
// page inside Investments (InsightsSection) and, on a portfolio's Insights, the detail view or
// month open over it (PerformanceSection). Each history entry carries where the dashboard was,
// under its own key next to Next.js's (Next copies its keys into every pushState / replaceState,
// so a popstate never reloads the page); each of those components pushes an entry when the user
// moves deeper and listens for popstate to show the entry it lands on.
//
// A detail view or a month can't be rebuilt from an entry (its state lives in the module that
// opened it), so its entry is never left behind: closing it goes back past it, and moving
// elsewhere from it replaces it (see pushDashboardEntry).

export type DashboardOverlay = "explore" | "month";

export interface DashboardEntry {
  section: string;
  // InsightsSection's view (see PortfoliosView there), when the section is Investments.
  investments?: unknown;
  overlay?: DashboardOverlay;
}

export function readDashboardEntry(): DashboardEntry | null {
  if (typeof window === "undefined") return null;
  return (window.history.state?.dashboard as DashboardEntry | undefined) ?? null;
}

/**
 * Records where the dashboard is now: a new entry, or (`replace`) in place of the current one. An
 * entry for a detail view or month that's being left for somewhere else is always replaced, so
 * going back from there doesn't land on a detail that can't be shown again.
 */
export function pushDashboardEntry(entry: DashboardEntry, replace = false) {
  const state = { ...window.history.state, dashboard: entry };
  if (replace || (readDashboardEntry()?.overlay && !entry.overlay)) window.history.replaceState(state, "");
  else window.history.pushState(state, "");
}
