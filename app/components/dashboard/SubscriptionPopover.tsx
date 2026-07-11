"use client";

import { useEffect, useRef } from "react";
import { Crown, Infinity as InfinityIcon, FileText, Loader2, AlertCircle } from "lucide-react";
import type { SubscriptionResponse, UserMetrics } from "../../models/User";

interface SubscriptionPopoverProps {
  subscription: SubscriptionResponse | null;
  metrics: UserMetrics | null;
  isLoading: boolean;
  onClose: () => void;
}

export function SubscriptionPopover({ subscription, metrics, isLoading, onClose }: SubscriptionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  const remaining = metrics?.reports_remaining ?? null;
  const used = metrics?.report_generated_this_month ?? 0;
  const unlimited = subscription?.has_unlimited_reports ?? false;
  const exhausted = !unlimited && remaining !== null && remaining <= 0;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-3 w-72 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="bg-[#F7F5EF] border border-[rgba(196,154,60,0.25)] rounded-[1.5rem] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[rgba(196,154,60,0.15)]">
          <Crown className="w-4 h-4 text-[#C49A3C]" />
          <span
            className="font-bold text-sm text-[#1c1917]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Subscription
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
            </div>
          ) : !subscription ? (
            <p className="text-sm text-[#78716c] py-2">Unable to load subscription.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8a29e] mb-1">Plan</p>
                <p className="text-sm font-bold text-[#1c1917]">{subscription.plan_name}</p>
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-[rgba(196,154,60,0.15)]">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  exhausted ? "bg-rose-50" : "bg-[#C49A3C]/10"
                }`}>
                  {unlimited ? (
                    <InfinityIcon className="w-4.5 h-4.5 text-[#C49A3C]" />
                  ) : exhausted ? (
                    <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
                  ) : (
                    <FileText className="w-4.5 h-4.5 text-[#C49A3C]" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-bold ${exhausted ? "text-rose-600" : "text-[#1c1917]"}`}>
                    {unlimited ? "Unlimited reports" : `${used} of ${subscription.monthly_reports_limit ?? 0} reports generated`}
                  </p>
                  <p className={`text-xs ${exhausted ? "text-rose-500 font-semibold" : "text-[#78716c]"}`}>
                    {unlimited
                      ? "No monthly limit"
                      : exhausted
                      ? "Monthly limit reached"
                      : `${remaining} remaining this month`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
