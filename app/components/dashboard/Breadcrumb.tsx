"use client";

import { useEffect, useRef } from "react";
import { useSectionTrail } from "./SectionTrail";

export interface Crumb {
  label: string;
  onClick: () => void;
}

/**
 * BREADCRUMB — where a page sits under a section's hub: "Portfolios / Main portfolio /
 * Dividends", "Portfolios / Compare"… Not drawn on the page: it's published to the Sidebar (see
 * SectionTrail), which shows the page right under the section (the portfolio, Compare) as a row
 * under it, and the browser's back button goes up a level (see lib/dashboardHistory). Only the
 * page's own action (`right`: a month's report link, "Generate report") is drawn here, at the
 * top right.
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

  return right ? <div className="flex justify-end">{right}</div> : null;
}
