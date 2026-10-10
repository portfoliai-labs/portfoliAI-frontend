// lib/dashboardNav.ts
//
// DASHBOARD NAVIGATION — opening a section on one of its own pages from elsewhere in the dashboard
// (the Dashboard's cards, Plan's Strategy opening a backtest, the Sidebar's rows under a section).
// The page is recorded in the history entry (see lib/dashboardHistory), which the section reads
// when it mounts. One entry for the whole move: the one `onNavigate` may have just pushed for the
// section is replaced by the page.

import { pushDashboardEntry } from "./dashboardHistory";
import type { WealthView, PortfolioPage } from "../components/dashboard/WealthSection";
import type { PlanPage } from "../components/dashboard/PlanSection";
import type { DiscoverView } from "../components/dashboard/DiscoverSection";
import type { WalletPage } from "../components/preview/WalletPages";

// The dashboard's section ids (see the dashboard page). Wealth keeps "performance", the id it had
// as Insights, then Manage, so old links and history entries still land on it.
export const WEALTH_SECTION = "performance";
export const PLAN_SECTION = "plan";
export const DISCOVER_SECTION = "discover";

type Navigate = (section: string) => void;

/** Opens `section` on `view`, one history entry for the move. */
export function openSectionView(onNavigate: Navigate, section: string, view: unknown) {
  const before = window.history.state;
  onNavigate(section);
  pushDashboardEntry({ section, view }, window.history.state !== before);
}

export const openWealthView = (onNavigate: Navigate, view: WealthView) =>
  openSectionView(onNavigate, WEALTH_SECTION, view);

/** A portfolio (All portfolios included) on one of its pages: its own page unless said. */
export const openPortfolioPage = (onNavigate: Navigate, portfolioUuid: string, page: PortfolioPage = "overview") =>
  openWealthView(onNavigate, { kind: "portfolio", uuid: portfolioUuid, page });

/** A wallet (or "all", every wallet) on one of its pages. A demo account's preview. */
export const openWalletPage = (onNavigate: Navigate, id: string, page: WalletPage = "insights") =>
  openWealthView(onNavigate, { kind: "wallet", id, page });

export const openPlanPage = (onNavigate: Navigate, page: Exclude<PlanPage, "backtest">) =>
  openSectionView(onNavigate, PLAN_SECTION, { page });

/** A backtest's page, under Plan's Strategy. */
export const openBacktestPage = (onNavigate: Navigate, portfolioUuid: string) =>
  openSectionView(onNavigate, PLAN_SECTION, { page: "backtest", uuid: portfolioUuid, sub: "overview" });

export const openDiscoverView = (onNavigate: Navigate, view: DiscoverView) =>
  openSectionView(onNavigate, DISCOVER_SECTION, view);
