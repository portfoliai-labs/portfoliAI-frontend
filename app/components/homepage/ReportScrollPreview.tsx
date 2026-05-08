"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ─── DATA ──────────────────────────────────────────────────────────────────────

const portfolioOverTime = [
  { d: "Sep'23", v: 10200 }, { d: "Jan'24", v: 13800 }, { d: "May'24", v: 19400 },
  { d: "Sep'24", v: 25100 }, { d: "Jan'25", v: 29800 }, { d: "May'25", v: 27200 },
  { d: "Sep'25", v: 34600 }, { d: "Jan'26", v: 38900 }, { d: "May'26", v: 41742 },
];

const roiVsBenchmark = [
  { d: "Sep'23", p: 0,     b: 0    }, { d: "Jan'24", p: 4.7,  b: 5.1  },
  { d: "May'24", p: 12.3,  b: 13.8 }, { d: "Sep'24", p: 18.6, b: 22.4 },
  { d: "Jan'25", p: 26.1,  b: 30.2 }, { d: "May'25", p: 18.4, b: 24.1 },
  { d: "Sep'25", p: 34.8,  b: 37.6 }, { d: "Jan'26", p: 43.2, b: 44.9 },
  { d: "May'26", p: 47.48, b: 48.56 },
];

const volatilityData = [
  { d: "Sep'23", v: 5.2  }, { d: "Jan'24", v: 7.1  }, { d: "May'24", v: 9.8  },
  { d: "Sep'24", v: 14.3 }, { d: "Jan'25", v: 12.1 }, { d: "May'25", v: 35.7 },
  { d: "Sep'25", v: 11.4 }, { d: "Jan'26", v: 13.2 }, { d: "May'26", v: 8.9  },
];

const ASSETS = [
  { name: "Vanguard North America ETF",    roi: "+34.66%", weight: "39.3%", positive: true  },
  { name: "Vanguard Emerging Markets ETF", roi: "+38.76%", weight: "16.6%", positive: true  },
  { name: "Vanguard Developed Europe ETF", roi: "+33.66%", weight: "12.0%", positive: true  },
  { name: "Bitcoin EUR",                   roi: "−4.25%",  weight: "10.5%", positive: false },
  { name: "Vanguard Japan ETF",            roi: "+36.75%", weight: "8.9%",  positive: true  },
  { name: "Vanguard Asia Pacific ETF",     roi: "+62.82%", weight: "6.9%",  positive: true  },
];

const CHAPTERS = ["Overview", "Composition", "Performance", "Costs", "Risk"];

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

// ─── REPORT CONTENT ────────────────────────────────────────────────────────────

const ReportContent = () => (
  <div style={{ background: "#FAFAF8" }}>

    {/* Overview */}
    <div className="px-6 pt-6 pb-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <div className="text-[8px] uppercase tracking-[0.14em] mb-1 font-medium" style={{ color: "#C49A3C" }}>
        PortfoliAI · Report generated 2026-05-04
      </div>
      <div className="text-[18px] font-bold leading-tight mb-0.5" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
        Chapter 1 — Overview
      </div>
      <div className="text-[8px] font-mono mb-4" style={{ color: "#c4bdb5" }}>
        Analysis period: Sep 2023 → May 2026 · Brokers: Fineco, Conio
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <KpiTile label="Total Invested"  value="€ 32,336" sub="Cumulative" />
        <KpiTile label="Current Value"   value="€ 41,742" sub="Market value"     valueColor="#8A6A28" />
        <KpiTile label="Unrealized P/L"  value="+€ 9,405" sub="vs cost basis"    valueColor="#2D6A4F" />
        <KpiTile label="Overall ROI"     value="+29.09%"  sub="Return on capital" valueColor="#2D6A4F" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "#a8a29e" }}>Portfolio Value Over Time</div>
        <ResponsiveContainer width="100%" height={56}>
          <LineChart data={portfolioOverTime} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <Line type="monotone" dataKey="v" stroke="#C49A3C" strokeWidth={1.5} dot={false} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`€ ${v.toLocaleString()}`, ""]} labelFormatter={() => ""} />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
        <AllocBar name="ETF (6 positions)" pct={88.7} color="#C49A3C" />
        <AllocBar name="Cryptocurrency"    pct={11.3} color="rgba(196,154,60,0.35)" />
      </div>
    </div>

    {/* Performance */}
    <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <DocHeading>Chapter 4.2 — Performance & ROI</DocHeading>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <RiskBadge label="Total Return"  value="47.48%" valueColor="#2D6A4F" />
        <RiskBadge label="Return / Risk" value="2.76×"  valueColor="#8A6A28" />
        <RiskBadge label="Beta"          value="0.75"   valueColor="#1c1917" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-2" style={{ color: "#a8a29e" }}>ROI vs Benchmark</div>
        <ResponsiveContainer width="100%" height={56}>
          <LineChart data={roiVsBenchmark} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <Line type="monotone" dataKey="p" stroke="#C49A3C" strokeWidth={1.5} dot={false} name="Portfolio" />
            <Line type="monotone" dataKey="b" stroke="#c4bdb5" strokeWidth={1}   dot={false} strokeDasharray="4 3" name="Benchmark" />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(2)}%`]} />
          </LineChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-1.5">
          <span className="flex items-center gap-1.5 text-[8px]" style={{ color: "#8A6A28" }}>
            <span className="inline-block w-4 h-[1.5px] rounded" style={{ background: "#C49A3C" }} />Portfolio +47.5%
          </span>
          <span className="flex items-center gap-1.5 text-[8px]" style={{ color: "#c4bdb5" }}>
            <span className="inline-block w-4 h-[1px] rounded" style={{ background: "#c4bdb5" }} />Benchmark +48.6%
          </span>
        </div>
      </div>
    </div>

    {/* Costs */}
    <div className="px-6 py-5" style={{ borderBottom: "1px solid #E8E4DC" }}>
      <DocHeading>Chapter 3 — Cost Analysis & Fees</DocHeading>
      <CostRow label="Explicit commissions"     value="€ 0.00"   />
      <CostRow label="Implicit bid-ask spreads" value="€ 524.59" />
      <CostRow label="Conio (50.77%)"           value="€ 266.33" />
      <CostRow label="Fineco (49.23%)"          value="€ 258.26" />
      <div className="flex justify-between items-center mt-3 rounded-[4px] px-3 py-2.5"
        style={{ background: "rgba(196,154,60,0.07)", border: "1px solid rgba(196,154,60,0.2)" }}>
        <span className="text-[9px]" style={{ color: "#8A6A28" }}>Simulated TER · Cost-to-Value</span>
        <span className="text-[12px] font-semibold font-mono" style={{ color: "#8A6A28" }}>1.38%</span>
      </div>
    </div>

    {/* Risk */}
    <div className="px-6 py-5 pb-10">
      <DocHeading>Chapter 4.3 — Risk & Volatility</DocHeading>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <RiskBadge label="Max Drawdown"    value="−21.2%"  valueColor="#9B2226" />
        <RiskBadge label="Sharpe Ratio"    value="1.82"    valueColor="#2D6A4F" />
        <RiskBadge label="Ann. Volatility" value="10.57%"  valueColor="#8A6A28" />
      </div>
      <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
        <div className="text-[8px] uppercase tracking-widest mb-1" style={{ color: "#a8a29e" }}>21-Day Rolling Volatility Window</div>
        <ResponsiveContainer width="100%" height={56}>
          <BarChart data={volatilityData} margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#F0EDE6" />
            <Bar dataKey="v" fill="rgba(196,154,60,0.25)" radius={[2, 2, 0, 0]} />
            <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, "Volatility"]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();
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
    <div className="relative w-full max-w-[500px] select-none">
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
          className="overflow-hidden"
          style={{ background: "#FAFAF8", borderRadius: "5px", border: "1px solid #DDD8CE" }}
        >
          {/* PDF top bar */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ background: "#EDEBE4", borderBottom: "1px solid #DDD8CE" }}
          >
            <span className="text-[9px] font-mono tracking-wider" style={{ color: "#a8a29e" }}>
              portfolio_report_2026-05-04.pdf
            </span>
            <span className="text-[9px] font-mono" style={{ color: "#c4bdb5" }}>15 pages</span>
          </div>

          {/* viewport */}
          <div
            ref={viewportRef}
            className="relative overflow-hidden"
            style={{ height: 520 }}
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
