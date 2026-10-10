// components/dashboard/ClientStrategySharing.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { adoptionService } from "../../services/adoptionService";
import { ApiError } from "../../services/apiClient";
import { targetLabel } from "../../models/Strategy";
import type { AdoptedStrategy } from "../../models/AdoptedStrategy";
import { describeRebalancing } from "./BacktestMarks";
import { Toggle } from "./Toggle";

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });

/**
 * CLIENT STRATEGY SHARING — in an advisor's client panel: the strategy the advisor adopted on the
 * client's portfolio (their own copy, GET .../adopted-strategy), and a switch sharing it with the
 * client (PUT .../adopted-strategy/sharing). Shared, the client sees it read-only on their
 * portfolio's Strategy page, with the strategy portfolio it came from, and is notified; adopting it
 * again un-shares it.
 */
export function ClientStrategySharing({ portfolioUuid, portfolioName, clientName }: { portfolioUuid: string; portfolioName: string; clientName: string }) {
  const [adoption, setAdoption] = useState<{ uuid: string; value: AdoptedStrategy | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    adoptionService.get(portfolioUuid)
      .then((a) => { if (!cancelled) setAdoption({ uuid: portfolioUuid, value: a }); })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Unable to load the strategy."); });
    return () => { cancelled = true; };
  }, [portfolioUuid]);

  const current = adoption?.uuid === portfolioUuid ? adoption.value : undefined;

  const setShared = async (shared: boolean) => {
    setSaving(true);
    setError(null);
    try {
      setAdoption({ uuid: portfolioUuid, value: await adoptionService.setShared(portfolioUuid, shared) });
    } catch (err) {
      setError(err instanceof ApiError && err.errorType === "AdoptionNotShareableError"
        ? "Only a strategy you adopted on a client's portfolio can be shared."
        : err instanceof Error ? err.message : "Unable to change the sharing.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-[rgba(196,154,60,0.2)] space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#C49A3C]">Strategy</p>
        <p className="text-xs text-[#78716c] mt-1">
          The strategy you adopted on {portfolioName}. Shared, {clientName} sees it read-only, with your simulation, and is notified.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-rose-500">{loadError}</p>
      ) : current === undefined ? (
        <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 animate-spin text-[#C49A3C]" /></div>
      ) : current === null ? (
        <p className="text-sm text-[#78716c]">No strategy adopted on {portfolioName} yet.</p>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm font-bold text-[#1c1917]">
              {current.strategy.targets.filter((t) => t.weightPct > 0).map((t) => `${targetLabel(t)} ${t.weightPct}%`).join(" · ")}
            </p>
            <p className="text-xs text-[#78716c]">
              {describeRebalancing(current.strategy.rebalancing)} · adopted {dateLabel(current.createdAt)}
              {current.updatedAt !== current.createdAt && `, refined ${dateLabel(current.updatedAt)}`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F7F5EF] px-4 py-3">
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-[#1c1917]">Share with {clientName}</span>
              <span className="block text-[11px] text-[#78716c]">
                {current.sharedWithClient && current.sharedAt ? `Shared since ${dateLabel(current.sharedAt)}` : "Not shared: only you see it"}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              {saving && <Loader2 className="w-4 h-4 animate-spin text-[#C49A3C]" />}
              <Toggle checked={current.sharedWithClient} onChange={(v) => { if (!saving) void setShared(v); }} label={`Share the strategy with ${clientName}`} />
            </span>
          </div>
        </>
      )}

      {error && <p className="flex items-center gap-2 text-sm text-rose-500"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</p>}
    </div>
  );
}
