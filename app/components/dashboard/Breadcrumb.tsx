"use client";

import { Fragment } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  onClick: () => void;
}

/**
 * BREADCRUMB — the header of every page under the Insights hub: "Insights / Growth /
 * Dividends", "Insights / Compare", "Insights / Reports"… The pages above the current one run
 * as a small gold trail, each leading back to its page, over the current page as the panel's
 * title; the back button goes up one level. `right` holds the page's own action, if any (a
 * month's report link, "Generate report").
 */
export function Breadcrumb({ trail, current, right }: { trail: Crumb[]; current: string; right?: React.ReactNode }) {
  const up = trail[trail.length - 1];
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        {up && (
          <button
            type="button"
            onClick={up.onClick}
            aria-label={`Back to ${up.label}`}
            className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center shrink-0 text-slate-500 hover:text-white hover:bg-[#C49A3C] hover:border-[#C49A3C] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex flex-wrap items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em]">
            {trail.map((crumb) => (
              <Fragment key={crumb.label}>
                <li className="min-w-0">
                  <button type="button" onClick={crumb.onClick} className="text-[#C49A3C] hover:text-[#8A6A28] transition-colors truncate max-w-48">
                    {crumb.label}
                  </button>
                </li>
                <li aria-hidden><ChevronRight className="h-3 w-3 text-slate-300" /></li>
              </Fragment>
            ))}
          </ol>
          <h1
            aria-current="page"
            className="text-xl md:text-2xl font-black text-slate-900 truncate mt-0.5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {current}
          </h1>
        </nav>
      </div>
      {right}
    </div>
  );
}
