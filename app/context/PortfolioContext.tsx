// app/context/PortfolioContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { portfoliosService } from "../services/portfoliosService";
import { useUser } from "./UserContext";
import type { Portfolio } from "../models/Portfolio";

const LAST_SELECTED_KEY = "last_selected_portfolio_uuid";

/**
 * PORTFOLIO CONTEXT — the investor's OWN list of portfolios and which one is currently
 * selected. Advisors reach a CLIENT's portfolio through a different, local (non-context) path:
 * the advisor screens (AdvisorUploadSection, AdvisorReportsList, AdvisorPerformanceSection,
 * ClientsSection) pick a client first, then resolve that client's own portfolio list via
 * useClientDefaultPortfolio — a client's portfolios were never "the current user's own",
 * so they don't belong in this context. This context is only meaningful for role USER; an
 * ADVISOR's personal default portfolio (every user gets one) has no UI surface today, so this
 * provider simply doesn't fetch anything for that role (see the `enabled` gate below).
 */
interface PortfolioContextType {
  portfolios: Portfolio[];
  // The selected portfolio's full record — never null once `loading` is false and the user has
  // at least the one default portfolio every account is created with.
  current: Portfolio | null;
  loading: boolean;
  selectPortfolio: (uuid: string) => void;
  refreshPortfolios: () => Promise<void>;
  createPortfolio: (name: string) => Promise<Portfolio>;
  renamePortfolio: (uuid: string, name: string) => Promise<Portfolio>;
  // Throws (with the backend's own message) on the default portfolio's 409 — callers show it.
  deletePortfolio: (uuid: string) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const enabled = user?.role !== "ADVISOR";

  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPortfolios = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    // No setLoading(true) here: `loading` starts true for the first fetch, and later refetches
    // (after create/delete) stay silent instead of swapping the dashboard for its loader.
    try {
      const list = await portfoliosService.list();
      setPortfolios(list);
      setCurrentUuid((prevUuid) => {
        if (prevUuid && list.some((p) => p.uuid === prevUuid)) return prevUuid;
        // Open the last one selected in a previous session if it still exists, else the
        // default portfolio — not list[0], which is the aggregate when there is one.
        const lastSelected = typeof window !== "undefined" ? localStorage.getItem(LAST_SELECTED_KEY) : null;
        const remembered = lastSelected ? list.find((p) => p.uuid === lastSelected) : undefined;
        return (remembered ?? list.find((p) => p.isDefault) ?? list[0])?.uuid ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const selectPortfolio = useCallback((uuid: string) => {
    setCurrentUuid(uuid);
    if (typeof window !== "undefined") localStorage.setItem(LAST_SELECTED_KEY, uuid);
  }, []);

  // Create and delete refetch the whole list rather than patching it locally: the aggregate
  // portfolio appears when the 2nd one is created and disappears when back to 1.
  const createPortfolio = useCallback(async (name: string) => {
    const created = await portfoliosService.create(name);
    await fetchPortfolios();
    selectPortfolio(created.uuid);
    return created;
  }, [selectPortfolio, fetchPortfolios]);

  const renamePortfolio = useCallback(async (uuid: string, name: string) => {
    const updated = await portfoliosService.rename(uuid, name);
    setPortfolios((prev) => prev.map((p) => (p.uuid === uuid ? updated : p)));
    return updated;
  }, []);

  // If the deleted one (or the aggregate, gone once only one portfolio is left) was selected,
  // fetchPortfolios falls back to the default on its own.
  const deletePortfolio = useCallback(async (uuid: string) => {
    await portfoliosService.remove(uuid);
    await fetchPortfolios();
  }, [fetchPortfolios]);

  const current = useMemo(
    () => portfolios.find((p) => p.uuid === currentUuid) ?? null,
    [portfolios, currentUuid],
  );

  const contextValue: PortfolioContextType = useMemo(() => ({
    portfolios, current, loading, selectPortfolio,
    refreshPortfolios: fetchPortfolios, createPortfolio, renamePortfolio, deletePortfolio,
  }), [portfolios, current, loading, selectPortfolio, fetchPortfolios, createPortfolio, renamePortfolio, deletePortfolio]);

  return <PortfolioContext.Provider value={contextValue}>{children}</PortfolioContext.Provider>;
}

export const usePortfolio = (): PortfolioContextType => {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
};
