"use client";

import { Fragment, useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useSectionTrail } from "./SectionTrail";

export interface Crumb {
  label: string;
  onClick: () => void;
}

/**
 * BREADCRUMB — where a page sits under the Portfolios hub: "Portfolios / Main portfolio /
 * Dividends", "Portfolios / Compare"… On wide screens the Sidebar shows it, as indented rows
 * under Portfolios (this publishes it there, see SectionTrail), so only the page's own action
 * (`right`: a month's report link, "Generate report") is drawn here, at the top right. Below lg
 * the sidebar is tucked away in the menu, so the trail is drawn here too: the pages above as a
 * small gold trail, each leading back, over the current page as the panel's title, and a back
 * button that goes up one level.
 */
export function Breadcrumb({ trail, current, right }: { trail: Crumb[]; current: string; right?: React.ReactNode }) {
  const { setTrail } = useSectionTrail();

  // Published by label, not by the crumbs themselves: their handlers are new on every render,
  // and the Sidebar only needs to call the latest ones.
  const trailRef = useRef(trail);
  useEffect(() => {
    trailRef.current = trail;
  });
  const labelsKey = trail.map((c) => c.label).join("\u0000");
  useEffect(() => {
    setTrail({ labels: labelsKey ? labelsKey.split("\u0000") : [], current, go: (i) => trailRef.current[i]?.onClick() });
    return () => setTrail(null);
  }, [labelsKey, current, setTrail]);

  const up = trail[trail.length - 1];
  return (
    <>
      {right && <div className="hidden lg:flex justify-end">{right}</div>}
      <div className="lg:hidden bg-white rounded-2xl border border-slate-200 shadow-sm px-4 md:px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
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
    </>
  );
}
