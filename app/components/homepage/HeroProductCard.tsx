"use client";

import { motion } from "framer-motion";
import { TrendingUp, Sparkles } from "lucide-react";

function buildSmoothPath(points: [number, number][]) {
  let d = `M ${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i - 1];
    const [x, y] = points[i];
    const dx = (x - px) / 2;
    d += ` C ${px + dx},${py} ${x - dx},${y} ${x},${y}`;
  }
  return d;
}

const CHART_POINTS: [number, number][] = [
  [0, 150], [70, 165], [140, 130], [210, 145], [280, 95], [350, 110], [420, 60], [500, 40],
];

export default function HeroProductCard() {
  return (
    <div className="relative" style={{ perspective: "1600px" }}>
      {/* back card — depth */}
      <motion.div
        className="absolute inset-0 rounded-[14px]"
        style={{ background: "#1c1917", transform: "rotateY(-8deg) rotateX(3deg) translate(28px, 28px)", transformStyle: "preserve-3d" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      {/* front card */}
      <motion.div
        className="relative rounded-[14px] p-7"
        style={{
          background: "#fff", border: "1px solid #E0DACC",
          boxShadow: "0 60px 100px -30px rgba(28,25,23,0.28)",
          transform: "rotateY(-8deg) rotateX(3deg)", transformStyle: "preserve-3d",
        }}
        initial={{ rotateY: -16, opacity: 0 }}
        animate={{ rotateY: -8, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.25, ease: "easeOut" }}
      >
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: "#8A6A28" }}>Portfolio Value</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(45,106,79,0.1)", color: "#2D6A4F" }}>
            <TrendingUp className="w-3 h-3" /> +1.8%
          </span>
        </div>
        <div className="text-[42px] font-bold leading-none mb-6" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1c1917" }}>
          € 128,940
        </div>
        <svg viewBox="0 0 500 200" className="w-full h-auto mb-6" preserveAspectRatio="none">
          <defs>
            <linearGradient id="heroProductCardGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C49A3C" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#C49A3C" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${buildSmoothPath(CHART_POINTS)} L 500,200 L 0,200 Z`} fill="url(#heroProductCardGrad)" />
          <path d={buildSmoothPath(CHART_POINTS)} fill="none" stroke="#C49A3C" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <div className="flex items-start gap-3 rounded-[8px] p-4" style={{ background: "#F7F5EF" }}>
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#8A6A28" }} />
          <p className="text-[12px] leading-relaxed" style={{ color: "#78716c" }}>
            AI: momentum in your tech holdings is driving today&apos;s gain — no alerts triggered.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
