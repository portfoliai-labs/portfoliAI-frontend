// components/dashboard/PortfolioPageHeader.tsx
"use client";

/**
 * PORTFOLIO PAGE HEADER — the top of Insights (single portfolio and compare mode): one panel
 * holding "which portfolio" (the PortfolioBar, investor only) over a line of context (`nav`:
 * the month drilldown's way back, compare mode's status). No page title: the sidebar already
 * says which page this is. It scrolls away with the page rather than staying pinned.
 */
export function PortfolioPageHeader({ bar, nav }: { bar?: React.ReactNode; nav?: React.ReactNode }) {
  if (!bar && !nav) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      {bar && <div className="px-4 md:px-5 py-3">{bar}</div>}
      {nav && <div className={`px-4 md:px-5 ${bar ? "border-t border-slate-100" : ""}`}>{nav}</div>}
    </div>
  );
}

/** A plain line of text for the panel's `nav` row, where there are no tabs to show. */
export function PortfolioPageHeaderNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] font-semibold text-slate-500">{children}</p>;
}
