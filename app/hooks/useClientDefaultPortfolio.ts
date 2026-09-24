// app/hooks/useClientDefaultPortfolio.ts
"use client";

import { useEffect, useState } from "react";
import { portfoliosService } from "../services/portfoliosService";
import type { Portfolio } from "../models/Portfolio";

/**
 * Resolves a client's DEFAULT portfolio so the advisor screens (which today only ever act on
 * one portfolio per client) can pass its uuid to the same portfolio-scoped components an
 * investor uses for themselves. Every client has exactly one portfolio at least (their
 * default, created with the account); if they've since added more from their own side, this
 * still only ever picks the default one — there's no advisor-facing picker for a client's
 * other portfolios yet.
 */
export function useClientDefaultPortfolio(clientUuid: string | null) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No setState here for the no-clientUuid case (that's just derived below at return time,
    // not an effect's job) — this effect's only real work is the fetch once there is one.
    if (!clientUuid) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await portfoliosService.listForClient(clientUuid);
        if (!cancelled) setPortfolio(list.find((p) => p.isDefault) ?? list[0] ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this client's portfolio");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => { cancelled = true; };
  }, [clientUuid]);

  if (!clientUuid) return { portfolio: null, loading: false, error: null };
  return { portfolio, loading, error };
}
