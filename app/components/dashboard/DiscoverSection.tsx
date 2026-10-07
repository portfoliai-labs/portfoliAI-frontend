// components/dashboard/DiscoverSection.tsx
"use client";

import { useEffect, useState } from "react";
import { useUser } from "../../context/UserContext";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { DISCOVER_SECTION } from "../../lib/dashboardNav";
import { NewsPageSection } from "./NewsSection";
import { JournalSection } from "./JournalSection";
import { ExploreCommunity } from "../preview/ExploreCommunity";

export type DiscoverPage = "news" | "journal" | "explore";
// The Journal adds the open article's slug.
export type DiscoverView = { page: DiscoverPage; slug?: string };

const SECTION = DISCOVER_SECTION;

export const DISCOVER_PAGE_LABELS: Record<DiscoverPage, string> = {
  news: "News",
  journal: "Journal",
  explore: "Explore",
};

// The pages a demo account sees only: previews, with no backend behind them yet.
const PREVIEW_PAGES: DiscoverPage[] = ["journal", "explore"];

/** The pages listed under Discover for this account, in order. */
export const discoverPages = (isDemo: boolean): DiscoverPage[] => (isDemo ? ["news", "journal", "explore"] : ["news"]);

/**
 * DISCOVER SECTION — what's out there, beyond the user's own money: today's News
 * (NewsPageSection) and, as a demo account's previews, the Journal (PortfoliAI's own articles) and
 * Explore (portfolios other investors share). Its pages are picked in the Sidebar, under Discover;
 * each is a browser history entry (see lib/dashboardHistory).
 */
export function DiscoverSection() {
  const { isDemo } = useUser();

  const pageFromHistory = (): DiscoverPage => {
    const entry = readDashboardEntry();
    const page = entry?.section === SECTION ? (entry.view as DiscoverView | undefined)?.page : undefined;
    if (!page || (!isDemo && PREVIEW_PAGES.includes(page))) return "news";
    return page;
  };
  const [page, setPage] = useState<DiscoverPage>(pageFromHistory);

  useEffect(() => {
    // Record the page it opened on, so the Sidebar marks it.
    const entry = readDashboardEntry();
    if (entry?.section === SECTION && !(entry.view as DiscoverView | undefined)?.page) {
      pushDashboardEntry({ section: SECTION, view: { page } }, true);
    }
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setPage(pageFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // Once: later pages come from the Sidebar (a new visit) or back / forward.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (page === "journal") return <JournalSection />;
  if (page === "explore") return <ExploreCommunity trail={[]} />;
  return <NewsPageSection />;
}
