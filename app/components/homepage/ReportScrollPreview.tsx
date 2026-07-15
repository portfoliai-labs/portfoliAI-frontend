"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── DATA ──────────────────────────────────────────────────────────────────────
// Figures below are a point-in-time snapshot from a generated PortfoliAI report
// (2026-06-28) — portfolio values move with market prices, so they're not an
// evergreen "real" number, hence the "Illustrative example" badge rather than
// any claim of live/current data. This card recreates that report in the
// site's own visual language, not a screenshot of the PDF.

const portfolioOverTime = [
  { d: "Sep'23", v: 7600 },  { d: "Jan'24", v: 8300 },  { d: "Feb'24", v: 17000 },
  { d: "Sep'24", v: 22400 }, { d: "Jan'25", v: 26200 }, { d: "Apr'25", v: 26600 },
  { d: "Sep'25", v: 34400 }, { d: "Jan'26", v: 38700 }, { d: "May'26", v: 44232 },
];

const roiVsBenchmark = [
  { d: "Sep'23", p: 0,     b: 0    }, { d: "Jan'24", p: 5.1,  b: 5.6  },
  { d: "Feb'24", p: 13.9,  b: 15.2 }, { d: "Sep'24", p: 21.2, b: 23.8 },
  { d: "Jan'25", p: 27.4,  b: 30.1 }, { d: "Apr'25", p: 19.6, b: 22.9 },
  { d: "Sep'25", p: 35.1,  b: 38.4 }, { d: "Jan'26", p: 43.8, b: 46.5 },
  { d: "May'26", p: 50.11, b: 52.67 },
];

const volatilityData = [
  { d: "Sep'23", v: 4.1  }, { d: "Jan'24", v: 5.8  }, { d: "Aug'24", v: 9.2  },
  { d: "Nov'24", v: 9.5  }, { d: "Jan'25", v: 6.4  }, { d: "Apr'25", v: 26.4 },
  { d: "Sep'25", v: 8.1  }, { d: "Jan'26", v: 6.9  }, { d: "May'26", v: 5.0  },
];

const ASSETS = [
  { name: "Vanguard FTSE North America",   roi: "+40.87%",  weight: "41.99%", positive: true  },
  { name: "Vanguard FTSE Emerging Markets", roi: "+42.42%",  weight: "16.67%", positive: true  },
  { name: "Vanguard FTSE Developed Europe", roi: "+38.65%",  weight: "12.56%", positive: true  },
  { name: "Vanguard FTSE Japan",            roi: "+43.06%",  weight: "9.59%",  positive: true  },
  { name: "Vanguard Asia Pacific ex Japan", roi: "+90.82%",  weight: "7.70%",  positive: true  },
  { name: "Bitcoin EUR",                    roi: "−447.19%", weight: "4.08%",  positive: false },
];

const CHAPTERS = ["Overview", "Costs", "Composition", "Performance", "Risk"];

// ─── TOOLTIP ───────────────────────────────────────────────────────────────────

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "#fff",
    borderColor: "#E0DACC",
    color: "#1c1917",
    borderRadius: "4px",
    fontSize: "10px",
    padding: "5px 9px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  cursor: { stroke: "rgba(196,154,60,0.3)", strokeWidth: 1 },
};

// ─── SUB-COMPONENTS ────────────────────────────────────────────────────────────

const DocHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="flex items-center gap-2 mb-3">
    <span className="w-[3px] h-3 rounded-full flex-shrink-0" style={{ background: "#C49A3C" }} />
    <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#1c1917" }}>
      {children}
    </span>
  </h4>
);

const KpiTile = ({
  label, value, sub, valueColor = "#1c1917",
}: { label: string; value: string; sub?: string; valueColor?: string }) => (
  <div className="rounded-[4px] p-3 flex flex-col gap-0.5" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
    <span className="text-[8px] uppercase tracking-widest" style={{ color: "#a8a29e" }}>{label}</span>
    <span className="text-[17px] font-bold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: valueColor }}>
      {value}
    </span>
    {sub && <span className="text-[8px]" style={{ color: "#c4bdb5" }}>{sub}</span>}
  </div>
);

const AllocBar = ({ name, pct, color }: { name: string; pct: number; color: string }) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between">
      <span className="text-[9px]" style={{ color: "#78716c" }}>{name}</span>
      <span className="text-[9px] font-mono font-medium" style={{ color: "#292524" }}>{pct}%</span>
    </div>
    <div className="h-[2px] rounded-full overflow-hidden" style={{ background: "#E8E4DC" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
    </div>
  </div>
);

const CostRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center py-1.5" style={{ borderBottom: "1px solid #F0EDE6" }}>
    <span className="text-[9px]" style={{ color: "#78716c" }}>{label}</span>
    <span className="text-[9px] font-mono font-medium" style={{ color: "#292524" }}>{value}</span>
  </div>
);

const RiskBadge = ({ label, value, valueColor }: { label: string; value: string; valueColor: string }) => (
  <div className="rounded-[4px] py-2 px-2 text-center" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
    <div className="text-[14px] font-bold leading-none mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: valueColor }}>
      {value}
    </div>
    <div className="text-[7px] uppercase tracking-wider" style={{ color: "#a8a29e" }}>{label}</div>
  </div>
);

const AnalysisPanel = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4">
    {children}
  </div>
);

const AnalysisHeading = ({ children }: { children: React.ReactNode }) => (
  <h5 className="text-[8px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "#8A6A28" }}>
    {children}
  </h5>
);

const AnalysisP = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[9px] leading-[1.65]" style={{ color: "#5b5650" }}>{children}</p>
);

const RiskAlert = ({ lead, children }: { lead: string; children: React.ReactNode }) => (
  <li className="flex items-start gap-1.5 text-[9px] leading-[1.6]" style={{ color: "#5b5650" }}>
    <span className="shrink-0 mt-[5px] w-1 h-1 rounded-full" style={{ background: "#9B2226" }} />
    <span><strong style={{ color: "#292524" }}>{lead}</strong> {children}</span>
  </li>
);

// ─── REPORT CONTENT ────────────────────────────────────────────────────────────
// Real figures from the report generated 2026-06-28 (period Sep 2023 – May 2026).

const ReportContent = () => (
  <div style={{ background: "#FAFAF8" }}>

    {/* Overview */}
    <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <div className="text-[8px] uppercase tracking-[0.14em] mb-1 font-medium" style={{ color: "#C49A3C" }}>
        PortfoliAI · Report generated 2026-06-28
      </div>
      <div className="text-[18px] font-bold leading-tight mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
        Chapter 1 — Overview
      </div>
      <div className="text-[8px] font-mono mb-4" style={{ color: "#c4bdb5" }}>
        Period: Sep 2023 → May 2026 · Brokers: Fineco, Conio
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <KpiTile label="Capital Invested" value="€ 29,874.57" sub="Cumulative" />
        <KpiTile label="Current Value"    value="€ 44,232.07" sub="Market value" valueColor="#8A6A28" />
        <KpiTile label="Unrealized P/L"   value="+€ 14,357.50" sub="vs cost basis" valueColor="#2D6A4F" />
        <KpiTile label="Overall ROI"      value="+48.06%"     sub="Return on capital" valueColor="#2D6A4F" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "#a8a29e" }}>Portfolio Value Over Time</div>
        <ResponsiveContainer width="100%" height={56}>
          <LineChart data={portfolioOverTime} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <Line type="monotone" dataKey="v" stroke="#C49A3C" strokeWidth={1.5} dot={false} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`€ ${Number(v).toLocaleString()}`, ""]} labelFormatter={() => ""} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <AnalysisPanel>
        <AnalysisHeading>Growth Narrative</AnalysisHeading>
        <AnalysisP>
          The €29,874.57 invested grew into a market value of €44,232.07 — an overall ROI of 48.06%.
          The period&apos;s only notable pullback, between February and April 2025, was fully recovered
          within the year without any change in strategy.
        </AnalysisP>
      </AnalysisPanel>
    </div>

    {/* Costs */}
    <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <DocHeading>Chapter 3 — Costs &amp; Fees</DocHeading>
      <CostRow label="Explicit commissions"      value="€ 59.00"  />
      <CostRow label="Implicit costs (spread)"   value="€ 342.39" />
      <CostRow label="Conio (33.8%)"             value="€ 135.69" />
      <CostRow label="Fineco (66.2%)"            value="€ 265.70" />
      <div className="flex justify-between items-center mt-3 rounded-[4px] px-3 py-2.5"
        style={{ background: "rgba(196,154,60,0.07)", border: "1px solid rgba(196,154,60,0.2)" }}>
        <span className="text-[9px]" style={{ color: "#8A6A28" }}>Simulated TER · Cost-to-Value</span>
        <span className="text-[12px] font-semibold font-mono" style={{ color: "#8A6A28" }}>1.22%</span>
      </div>
      <AnalysisPanel>
        <AnalysisHeading>Cost Composition</AnalysisHeading>
        <AnalysisP>
          85.3% of the €401.39 total cost comes from implicit spreads, not commissions. The two main
          drivers are Bitcoin EUR via Conio (€99.27) and the Asia Pacific ex Japan ETF via Fineco
          (€98.21) — both thinner-liquidity instruments.
        </AnalysisP>
      </AnalysisPanel>
    </div>

    {/* Composition */}
    <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <DocHeading>Chapter 4.1 — Portfolio Composition</DocHeading>
      <div className="rounded-[4px] overflow-hidden mb-3" style={{ border: "1px solid #E8E4DC" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid #E8E4DC", background: "#F7F5EF" }}>
              <th className="text-left text-[7px] uppercase tracking-wider px-3 py-2" style={{ color: "#a8a29e" }}>Asset</th>
              <th className="text-right text-[7px] uppercase tracking-wider px-3 py-2" style={{ color: "#a8a29e" }}>ROI</th>
              <th className="text-right text-[7px] uppercase tracking-wider px-3 py-2" style={{ color: "#a8a29e" }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {ASSETS.map((a, i) => (
              <tr key={a.name} style={{ borderBottom: i < ASSETS.length - 1 ? "1px solid #F5F2EC" : "none" }}>
                <td className="text-[9px] px-3 py-1.5 truncate max-w-[150px]" style={{ color: "#292524" }}>{a.name}</td>
                <td className="text-right text-[9px] px-3 py-1.5 font-mono font-medium" style={{ color: a.positive ? "#2D6A4F" : "#9B2226" }}>{a.roi}</td>
                <td className="text-right text-[9px] px-3 py-1.5 font-mono" style={{ color: "#78716c" }}>{a.weight}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2">
        <AllocBar name="ETF (6 holdings)" pct={95.3} color="#C49A3C" />
        <AllocBar name="Cryptocurrency"   pct={4.7}  color="rgba(196,154,60,0.35)" />
      </div>
      <AnalysisPanel>
        <AnalysisHeading>Executive Summary</AnalysisHeading>
        <AnalysisP>
          Over 95% of the value sits in Vanguard ETFs across developed and emerging markets; the
          crypto sleeve is only 4.7% of the book but has averaged −414.43%, an isolated idiosyncratic
          risk relative to the rest of the allocation.
        </AnalysisP>
        <div className="mt-3">
          <AnalysisHeading>Risk Alerts</AnalysisHeading>
          <ul className="flex flex-col gap-2">
            <RiskAlert lead="Concentration in the top 5 holdings.">
              The top five instruments make up 88.51% of the portfolio, all within the same FTSE index
              family — same provider, same replication methodology.
            </RiskAlert>
            <RiskAlert lead="North America is the single biggest bet.">
              The Vanguard FTSE North America position alone accounts for 41.99% of the total.
            </RiskAlert>
          </ul>
        </div>
      </AnalysisPanel>
    </div>

    {/* Performance */}
    <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <DocHeading>Chapter 4.2 — Performance &amp; ROI</DocHeading>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <RiskBadge label="Total Return"  value="48.06%" valueColor="#2D6A4F" />
        <RiskBadge label="Return / Risk" value="4.3×"  valueColor="#8A6A28" />
        <RiskBadge label="Beta"          value="0.78"   valueColor="#1c1917" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "#a8a29e" }}>ROI vs Benchmark</div>
        <ResponsiveContainer width="100%" height={56}>
          <LineChart data={roiVsBenchmark} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <Line type="monotone" dataKey="p" stroke="#C49A3C" strokeWidth={1.5} dot={false} name="Portfolio" />
            <Line type="monotone" dataKey="b" stroke="#c4bdb5" strokeWidth={1}   dot={false} strokeDasharray="4 3" name="Benchmark" />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v).toFixed(2)}%`]} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1.5">
          <span className="flex items-center gap-1.5 text-[8px]" style={{ color: "#8A6A28" }}>
            <span className="inline-block w-4 h-[1.5px] rounded" style={{ background: "#C49A3C" }} />Portfolio +50.1%
          </span>
          <span className="flex items-center gap-1.5 text-[8px]" style={{ color: "#c4bdb5" }}>
            <span className="inline-block w-4 h-[1px] rounded" style={{ background: "#c4bdb5" }} />Benchmark +52.7%
          </span>
        </div>
      </div>
      <AnalysisPanel>
        <AnalysisHeading>Efficiency Audit</AnalysisHeading>
        <AnalysisP>
          The unrealized 48.06% return comes with an annualized volatility of 11.04% — a return/risk
          ratio of roughly 4.3×. The Vanguard FTSE North America position alone generates about 37%
          of total profit.
        </AnalysisP>
      </AnalysisPanel>
    </div>

    {/* Risk */}
    <div className="px-6 py-5 pb-10">
      <DocHeading>Chapter 4.3 — Risk &amp; Volatility</DocHeading>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <RiskBadge label="Max Drawdown"    value="−18.83%" valueColor="#9B2226" />
        <RiskBadge label="Ann. Volatility" value="11.04%"  valueColor="#8A6A28" />
        <RiskBadge label="Beta"            value="0.78"    valueColor="#1c1917" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "#a8a29e" }}>Realized Volatility · 21-Day Window</div>
        <ResponsiveContainer width="100%" height={56}>
          <BarChart data={volatilityData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#F0EDE6" />
            <Bar dataKey="v" fill="rgba(196,154,60,0.25)" radius={[2, 2, 0, 0]} />
            <Tooltip {...tooltipStyle} formatter={(v) => [`${Number(v)}%`, "Volatility"]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AnalysisPanel>
        <AnalysisHeading>Risk Profile</AnalysisHeading>
        <AnalysisP>
          Annualized volatility stays contained at 11.04%, but with pronounced tails: the 26.36% spike
          in April 2025 coincides with the &quot;Liberation Day&quot; tariff shock, then fully absorbed
          over the following months.
        </AnalysisP>
        <div className="mt-3">
          <AnalysisHeading>Strategic Risk Alerts</AnalysisHeading>
          <ul className="flex flex-col gap-2">
            <RiskAlert lead="Sensitive to macro shocks.">
              The 26.36% volatility spike in April 2025 confirms exposure to systemic tariff and
              geopolitical events.
            </RiskAlert>
            <RiskAlert lead="ETFs drive the volatility.">
              The cryptocurrency sleeve contributes just 0.02% against 0.11% for ETFs — not a
              material risk driver.
            </RiskAlert>
          </ul>
        </div>
      </AnalysisPanel>
    </div>

  </div>
);

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────────

export default function ReportScrollPreview() {
  const contentRef  = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef      = useRef<number>(0);
  const posRef      = useRef(0);
  const dirRef      = useRef(1);
  const pausedRef   = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [activeChapter, setActiveChapter] = useState(0);

  useEffect(() => {
    const content  = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const tick = () => {
      if (!pausedRef.current) {
        const max = content.scrollHeight - viewport.clientHeight;
        posRef.current += dirRef.current * 0.45;
        if (posRef.current >= max) { posRef.current = max; dirRef.current = -1; setTimeout(() => { dirRef.current = 1; posRef.current = 0; }, 1800); }
        if (posRef.current < 0) posRef.current = 0;
        content.style.transform = `translateY(-${posRef.current}px)`;
        setActiveChapter(Math.min(Math.floor((posRef.current / (max || 1)) * CHAPTERS.length), CHAPTERS.length - 1));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    pausedRef.current = true;
    const content  = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const max = content.scrollHeight - viewport.clientHeight;
    posRef.current = Math.max(0, Math.min(max, posRef.current + e.deltaY * 0.4));
    content.style.transform = `translateY(-${posRef.current}px)`;
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { pausedRef.current = false; }, 2200);
  };

  const jumpToChapter = (i: number) => {
    const content  = contentRef.current;
    const viewport = viewportRef.current;
    if (!content || !viewport) return;
    const max = content.scrollHeight - viewport.clientHeight;
    posRef.current = (i / (CHAPTERS.length - 1)) * max;
    content.style.transform = `translateY(-${posRef.current}px)`;
    setActiveChapter(i);
  };

  return (
    <div className="relative w-full max-w-[min(640px,46vw)] min-w-[340px] select-none">
      {/* ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "-32px",
          borderRadius: "40px",
          background: "radial-gradient(ellipse at 55% 50%, rgba(196,154,60,0.09) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />

      {/* floating document with 3D tilt */}
      <motion.div
        initial={{ opacity: 0, y: 28, rotateY: -5, rotateX: 2 }}
        animate={{ opacity: 1, y: 0,  rotateY: -2, rotateX: 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        whileHover={{ rotateY: 0, rotateX: 0, y: -6, transition: { duration: 0.35 } }}
        style={{
          transformStyle: "preserve-3d",
          perspective: 1000,
          filter: [
            "drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
            "drop-shadow(0 6px 16px rgba(0,0,0,0.10))",
            "drop-shadow(0 20px 48px rgba(0,0,0,0.09))",
            "drop-shadow(0 40px 80px rgba(0,0,0,0.06))",
          ].join(" "),
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{ background: "#FAFAF8", borderRadius: "5px", border: "1px solid #DDD8CE" }}
        >
          {/* illustrative-example badge — stays fixed, doesn't scroll with content */}
          <div
            className="absolute top-3 right-4 z-10 flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{ background: "rgba(250,250,248,0.92)", border: "1px solid #E8E4DC", backdropFilter: "blur(2px)" }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#C49A3C" }} />
            <span className="text-[7.5px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8A6A28" }}>
              Illustrative example
            </span>
          </div>

          {/* viewport */}
          <div
            ref={viewportRef}
            className="relative overflow-hidden"
            style={{ height: 520, boxShadow: "inset 0 1px 0 #E8E4DC, inset 0 -1px 0 #E8E4DC" }}
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
            onWheel={handleWheel}
          >
            <div ref={contentRef} className="will-change-transform">
              <ReportContent />
            </div>

            {/* chapter scrubber */}
            <div className="absolute right-0 top-0 bottom-0 flex flex-col" style={{ width: 3, background: "#E8E4DC" }}>
              {CHAPTERS.map((ch, i) => (
                <button
                  key={ch}
                  title={ch}
                  onClick={() => jumpToChapter(i)}
                  className="flex-1 relative group transition-colors duration-200"
                  style={{ background: activeChapter === i ? "#C49A3C" : "transparent" }}
                >
                  <span
                    className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2 text-[8px] uppercase tracking-wider whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ color: "#a8a29e" }}
                  >
                    {ch}
                  </span>
                </button>
              ))}
            </div>

            {/* bottom fade */}
            <div
              className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
              style={{ background: "linear-gradient(transparent, #FAFAF8)" }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
