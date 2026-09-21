// app/hooks/useAlertRules.ts
"use client";

import { useEffect, useState } from "react";
import { alertService } from "../services/alertService";
import type { AlertRuleResponse } from "../models/Alert";

/**
 * The user's alert rules. `rules` is null until the first load. With `pollMs` the list is
 * refetched on that interval while the tab is visible, since the backend re-checks every rule
 * about every 5 minutes and a reading changes underneath the page; a failed refetch keeps the
 * rules already shown. `setRules` lets callers apply the result of a create / update / delete
 * directly, without another round trip.
 */
export function useAlertRules(pollMs?: number) {
  const [rules, setRules] = useState<AlertRuleResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async (initial: boolean) => {
      try {
        const data = await alertService.listRules();
        if (!cancelled) {
          setRules(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && initial) setError(err instanceof Error ? err.message : "Failed to load your alerts");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    };

    load(true);
    const id = pollMs ? setInterval(() => { if (!document.hidden) load(false); }, pollMs) : undefined;
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, [pollMs, reloadKey]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  };

  return { rules, setRules, loading, error, reload };
}
