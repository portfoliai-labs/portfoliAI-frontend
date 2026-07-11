"use client";

import { useState, useEffect } from "react";
import { Crown, Infinity as InfinityIcon, FileText, AlertCircle, Loader2 } from "lucide-react";
import { userService } from "../../services/userService";
import type { SubscriptionResponse, UserMetrics } from "../../models/User";
import SubscriptionSection from "./SubscriptionSection";

export function SettingsSection() {
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([userService.getSubscription(), userService.getUserMetrics()])
      .then(([sub, m]) => {
        setSubscription(sub);
        setMetrics(m);
      })
      .catch((error) => console.error("Failed to load subscription:", error))
      .finally(() => setLoading(false));
  }, []);

  const remaining = metrics?.reports_remaining ?? null;
  const used = metrics?.report_generated_this_month ?? 0;
  const unlimited = subscription?.has_unlimited_reports ?? false;
  const exhausted = !unlimited && remaining !== null && remaining <= 0;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h2
          className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Settings
        </h2>
        <p className="text-sm md:text-base text-[#78716c] font-medium mt-1">
          Manage your subscription and plan
        </p>
      </div>

      {/* Current plan */}
      <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-[rgba(196,154,60,0.2)] shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-[rgba(196,154,60,0.15)] pb-4">
          <div className="p-2.5 bg-[#F7F5EF] text-[#C49A3C] rounded-xl">
            <Crown className="w-5 h-5" />
          </div>
          <span className="font-bold text-sm text-[#1c1917]">Current Plan</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
          </div>
        ) : !subscription ? (
          <p className="text-sm text-[#78716c]">Unable to load subscription.</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#78716c] mb-1">Plan</p>
              <p className="text-xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {subscription.plan_name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                exhausted ? "bg-rose-50" : "bg-[#C49A3C]/10"
              }`}>
                {unlimited ? (
                  <InfinityIcon className="w-5 h-5 text-[#C49A3C]" />
                ) : exhausted ? (
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                ) : (
                  <FileText className="w-5 h-5 text-[#C49A3C]" />
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

      {/* Available plans */}
      <SubscriptionSection />
    </div>
  );
}
