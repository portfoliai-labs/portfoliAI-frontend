// components/dashboard/DiscoverSection.tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { DISCOVER_SECTION } from "../../lib/dashboardNav";
import { NewsPageSection } from "./NewsSection";
import { JournalSection } from "./JournalSection";
import { StrategiesExplore } from "./StrategiesExplore";

export type DiscoverPage = "news" | "journal" | "explore";
// The Journal adds the open article's slug, Explore the open strategy's publication.
export type DiscoverView = { page: DiscoverPage; slug?: string; publicationId?: string };

const SECTION = DISCOVER_SECTION;

export const DISCOVER_PAGE_LABELS: Record<DiscoverPage, string> = {
  news: "News",
  journal: "Journal",
  explore: "Explore",
};

// The pages a demo account sees only: previews, with no backend behind them yet.
const PREVIEW_PAGES: DiscoverPage[] = ["journal"];

/**
 * The pages listed under Discover for this account, in order. An advisor's Discover is Explore
 * only: they keep a News section of their own.
 */
export const discoverPages = (isDemo: boolean, isAdvisor = false): DiscoverPage[] =>
  isAdvisor ? ["explore"] : isDemo ? ["news", "journal", "explore"] : ["news", "explore"];

/**
 * DISCOVER SECTION — what's out there, beyond the user's own money: today's News
 * (NewsPageSection), Explore (StrategiesExplore: the strategies advisors publish, simulated, read
 * only) and, as a demo account's preview, the Journal (PortfoliAI's own articles). An advisor sees
 * Explore only. Its pages are picked in the Sidebar, under Discover; each, and each strategy opened
 * in Explore, is a browser history entry (see lib/dashboardHistory).
 */
export function DiscoverSection({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const { isDemo, user } = useUser();
  const pages = discoverPages(isDemo, user?.role === "ADVISOR");

  const viewFromHistory = (): DiscoverView => {
    const entry = readDashboardEntry();
    const view = entry?.section === SECTION ? (entry.view as DiscoverView | undefined) : undefined;
    if (!view?.page || !pages.includes(view.page) || (!isDemo && PREVIEW_PAGES.includes(view.page))) return { page: pages[0] };
    if (view.page === "explore" && typeof view.publicationId === "string") return { page: "explore", publicationId: view.publicationId };
    return { page: view.page };
  };
  const [view, setView] = useState<DiscoverView>(viewFromHistory);
  const page = view.page;

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === SECTION && !(entry.view as DiscoverView | undefined)?.page) {
      pushDashboardEntry({ section: SECTION, view }, true);
    }
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setView(viewFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: later pages come from the Sidebar (a new visit) or back / forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openStrategy = (publicationId: string | null) => {
    const next: DiscoverView = publicationId ? { page: "explore", publicationId } : { page: "explore" };
    pushDashboardEntry({ section: SECTION, view: next });
    setView(next);
    window.scrollTo({ top: 0 });
  };

  if (page === "journal") return <JournalSection />;
  if (page === "explore") {
    return <StrategiesExplore trail={[]} publicationId={view.publicationId} onOpen={openStrategy} onNavigate={onNavigate} />;
  }
  return <NewsPageSection />;
}
