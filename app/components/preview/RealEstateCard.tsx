// components/preview/RealEstateCard.tsx
"use client";

import { useMemo } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { ArrowUpRight, Building2 } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { PROPERTIES, portfolioValueSeries, propertyValue } from "../../lib/mock/realEstate";
import { PreviewBadge, formatPct, serif } from "./PreviewKit";

/**
 * REAL ESTATE CARD (preview) — the sample real estate portfolio's tile on the Portfolios hub,
 * shaped like a portfolio's card but dashed and badged, since it isn't one of the user's own.
 */
export function RealEstateCard({ onOpen }: { onOpen: () => void }) {
  const series = useMemo(() => portfolioValueSeries(), []);
  const value = PROPERTIES.reduce((s, p) => s + propertyValue(p), 0);
  const invested = PROPERTIES.reduce((s, p) => s + p.purchasePrice + p.purchaseCosts, 0);
  const gain = (value / invested - 1) * 100;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-h-44 h-full text-left bg-white rounded-3xl border-2 border-dashed border-violet-200 shadow-sm p-5 md:p-6 flex flex-col gap-4 transition-all hover:border-violet-300 hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <Building2 className="h-4 w-4 shrink-0 text-[#eb6834]" />
          <span className="text-lg font-black text-slate-900 truncate" style={serif}>Real estate</span>
          <PreviewBadge />
        </div>
        <span className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#C49A3C] group-hover:text-white transition-colors shrink-0">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="flex-1 flex items-end justify-between gap-4 w-full">
        <div className="min-w-0">
          <p className="text-2xl font-black text-slate-900 tabular-nums truncate" style={serif}>{formatCurrency(value, "EUR", 0)}</p>
          <p className="text-[13px] font-bold tabular-nums mt-1">
            <span className={gain >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(gain, 2)}</span>
            <span className="text-slate-400 font-semibold"> · {PROPERTIES.length} sample properties</span>
          </p>
        </div>
        <div className="w-28 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 112, height: 48 }}>
            <AreaChart data={series} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area type="monotone" dataKey="value" stroke="#eb6834" fill="#eb6834" fillOpacity={0.1} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  );
}
