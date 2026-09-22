"use client";

import { motion } from "framer-motion";
import { Clock, TrendingUp, ShieldCheck, Bell } from "lucide-react";

const ALLOCATION = [
  { name: "ETF", pct: 62, color: "#C49A3C" },
  { name: "Equities", pct: 23, color: "#8A6A28" },
  { name: "Bonds", pct: 10, color: "#E8C97A" },
  { name: "Cash", pct: 5, color: "rgba(196,154,60,0.25)" },
];

function AllocationDonut() {
  const stops = ALLOCATION.reduce<{ text: string[]; cursor: number }>(
    (acc, slice) => {
      const end = acc.cursor + slice.pct;
      acc.text.push(`${slice.color} ${acc.cursor}% ${end}%`);
      return { text: acc.text, cursor: end };
    },
    { text: [], cursor: 0 }
  ).text.join(", ");

  return (
    <div className="relative w-[92px] h-[92px] shrink-0">
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(${stops})` }} />
      <div className="absolute inset-[10px] rounded-full flex flex-col items-center justify-center" style={{ background: "#fff" }}>
        <span className="text-[15px] font-bold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>4</span>
        <span className="text-[8px] uppercase tracking-widest mt-0.5" style={{ color: "#a8a29e" }}>classes</span>
      </div>
    </div>
  );
}

export default function PortfolioSnapshot() {
  return (
    <motion.div
      className="w-full max-w-[380px] rounded-[8px] p-6"
      style={{ background: "#fff", border: "1px solid #E0DACC", boxShadow: "0 24px 60px rgba(28,25,23,0.08)" }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#8A6A28" }}>Insights · Today</span>
        <span className="flex items-center gap-1 text-[9px]" style={{ color: "#a8a29e" }}>
          <Clock className="w-3 h-3" /> Updated after close
        </span>
      </div>

      <div className="mb-5">
        <div className="text-[11px]" style={{ color: "#a8a29e" }}>Portfolio Value</div>
        <div className="flex items-end gap-3">
          <span className="text-[30px] font-bold leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
            € 128,940
          </span>
          <span className="flex items-center gap-1 text-[12px] font-semibold mb-0.5" style={{ color: "#2D6A4F" }}>
            <TrendingUp className="w-3.5 h-3.5" /> +1.8% today
          </span>
        </div>
      </div>

      <div className="flex items-center gap-5 rounded-[4px] p-4 mb-4" style={{ background: "#F7F5EF", border: "1px solid #E8E4DC" }}>
        <AllocationDonut />
        <div className="flex-1 flex flex-col gap-2">
          {ALLOCATION.map((slice) => (
            <div key={slice.name} className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "#5b5650" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: slice.color }} />
                {slice.name}
              </span>
              <span className="text-[11px] font-mono font-medium" style={{ color: "#292524" }}>{slice.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-[4px] p-3" style={{ background: "rgba(196,154,60,0.07)", border: "1px solid rgba(196,154,60,0.25)" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3 h-3" style={{ color: "#8A6A28" }} strokeWidth={1.5} />
            <span className="text-[8.5px] uppercase tracking-widest" style={{ color: "#8A6A28" }}>Risk Score</span>
          </div>
          <span className="text-[15px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>Moderate</span>
        </div>
        <div className="rounded-[4px] p-3" style={{ background: "#fff", border: "1px solid #E8E4DC" }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Bell className="w-3 h-3" style={{ color: "#a8a29e" }} strokeWidth={1.5} />
            <span className="text-[8.5px] uppercase tracking-widest" style={{ color: "#a8a29e" }}>Alerts</span>
          </div>
          <span className="text-[15px] font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>0 active</span>
        </div>
      </div>
    </motion.div>
  );
}
