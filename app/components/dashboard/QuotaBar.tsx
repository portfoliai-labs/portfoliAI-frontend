"use client";

import { FileText } from "lucide-react";

// Free tier quota — update when paid plans go live
export const FREE_MONTHLY_REPORTS = 1;

export function QuotaBar({ used, total }: { used: number; total: number }) {
  const pct = total === 0 ? 100 : Math.min(100, (used / total) * 100);
  const remaining = Math.max(0, total - used);
  const color = pct >= 100 ? "bg-rose-400" : pct >= 75 ? "bg-amber-400" : "bg-[#C49A3C]";
  return (
    <div className="bg-white rounded-[1.75rem] border border-[rgba(196,154,60,0.2)] p-6 flex flex-col gap-4 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#C49A3C]/10">
          <FileText className="w-5 h-5 text-[#C49A3C]" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8a29e]">Report mensili</span>
      </div>
      <div>
        <div className="flex items-end justify-between mb-2">
          <span className="text-2xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {remaining}
            <span className="text-base font-medium text-[#78716c]">/{total}</span>
          </span>
          <span className="text-xs font-bold text-[#78716c]">{used} usati</span>
        </div>
        <div className="h-2 rounded-full bg-[#F7F5EF] overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-[#78716c] mt-2">
          {pct >= 100 ? "Limite raggiunto — considera un upgrade" : `${remaining} report disponibili questo mese`}
        </p>
      </div>
    </div>
  );
}
