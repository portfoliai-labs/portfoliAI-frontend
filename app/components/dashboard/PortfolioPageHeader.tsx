// components/dashboard/PortfolioPageHeader.tsx
"use client";

/**
 * PORTFOLIO PAGE HEADER — the top of a portfolio page (Insights, Transactions), read from the
 * general to the particular: the page's title, then one panel holding "which portfolio" (the
 * PortfolioBar, investor only) over "which part of it" (`nav`: Insights' section tabs, the
 * month drilldown's way back, compare mode's status). Everything under the panel is the
 * page's content, so the panel is where every control lives. It stays pinned while the page
 * scrolls, since Insights' pages run long.
 */
export function PortfolioPageHeader({
  title, bar, nav,
}: { title: string; bar?: React.ReactNode; nav?: React.ReactNode }) {
  return (
    <>
      <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {title}
      </h1>
      {(bar || nav) && (
        <div className="sticky top-3 z-20 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-sm">
          {bar && <div className="px-4 md:px-5 py-3">{bar}</div>}
          {nav && <div className={`px-4 md:px-5 ${bar ? "border-t border-slate-100" : ""}`}>{nav}</div>}
        </div>
      )}
    </>
  );
}

/** A plain line of text for the panel's `nav` row, where there are no tabs to show. */
export function PortfolioPageHeaderNote({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-[13px] font-semibold text-slate-500">{children}</p>;
}
