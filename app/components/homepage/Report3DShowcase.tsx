"use client";

import React, { useState, ReactNode } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { 
  PieChart, Hand, 
  ShieldCheck, Wallet, 
  Receipt, Activity
} from "lucide-react";
import {
  LineChart, Line, PieChart as RePieChart, Pie,
  CartesianGrid, Cell
} from 'recharts';

// --- INTERFACCE E TIPI ---
interface Asset {
  name: string;
  roi: string;
  weight: string;
  status: 'positive' | 'neutral' | 'negative';
}

interface CardData {
  id: string;
  chapter: string;
  title: string;
  description: string;
  icon: ReactNode;
  visual: ReactNode;
}

interface LineDataItem {
  m: string;
  v: number;
}

interface PieDataItem {
  name: string;
  value: number;
  fill: string;
}

// --- DATI DI ESEMPIO ---
const performanceData: LineDataItem[] = [
  { m: 'J', v: 400 }, { m: 'F', v: 300 }, { m: 'M', v: 500 },
  { m: 'A', v: 450 }, { m: 'M', v: 700 }, { m: 'J', v: 600 }
];

const volatilityData: LineDataItem[] = [
  { m: '1', v: 12 }, { m: '2', v: 18 }, { m: '3', v: 15 },
  { m: '4', v: 25 }, { m: '5', v: 14 }, { m: '6', v: 10 }
];

const pieData: PieDataItem[] = [
  { name: 'Equities', value: 65, fill: '#06b6d4' },
  { name: 'Fixed Income', value: 25, fill: '#3b82f6' },
  { name: 'Crypto', value: 10, fill: '#1e293b' },
];

const topAssets: Asset[] = [
  { name: "S&P 500 ETF", roi: "+12.4%", weight: "45%", status: 'positive' },
  { name: "BTC/EUR", roi: "+42.1%", weight: "10%", status: 'positive' },
  { name: "Global Bonds", roi: "-2.1%", weight: "25%", status: 'negative' },
];

const platformCosts: Asset[] = [
  { name: "Interactive Brokers", roi: "€ 152", weight: "62%", status: 'negative' },
  { name: "Binance", roi: "€ 45", weight: "18%", status: 'negative' },
];

// --- COMPONENTI UI ATOMICI ---

const MiniTable = ({ assets, col2 = "ROI", col3 = "Weight" }: { assets: Asset[], col2?: string, col3?: string }): React.JSX.Element => (
  <div className="w-full bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden mt-2">
    <table className="w-full text-left text-[10px]">
      <thead className="bg-slate-800/50 text-slate-500 uppercase font-bold">
        <tr>
          <th className="px-3 py-2">Asset/Item</th>
          <th className="px-3 py-2 text-right">{col2}</th>
          <th className="px-3 py-2 text-right">{col3}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800">
        {assets.map((a: Asset, i: number) => (
          <tr key={i} className="text-slate-300">
            <td className="px-3 py-2 font-medium">{a.name}</td>
            <td className={`px-3 py-2 text-right ${a.status === 'positive' ? 'text-emerald-400' : a.status === 'negative' ? 'text-rose-400' : 'text-slate-300'}`}>{a.roi}</td>
            <td className="px-3 py-2 text-right">{a.weight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// --- MAIN COMPONENT ---

export default function Report3DShowcase(): React.JSX.Element {
  
  // Struttura allineata esattamente ai capitoli del PDF
  const initialCards: CardData[] = [
    {
      id: "risk",
      chapter: "Chapter 4.3",
      title: "Risk & Volatility",
      description: "Evaluation of portfolio risk and downside exposure.",
      icon: <ShieldCheck className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 uppercase">Max Drawdown</span>
              <div className="text-rose-400 font-bold">-14.2%</div>
            </div>
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-center flex flex-col justify-center">
              <span className="text-[9px] text-slate-500 uppercase">Sharpe Ratio</span>
              <div className="text-emerald-400 font-bold">1.82</div>
            </div>
          </div>
          <div className="w-full flex flex-col justify-center bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
            <span className="text-[10px] text-slate-500 mb-2 uppercase font-bold">21-Day Volatility Window</span>
            <LineChart width={250} height={100} data={volatilityData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <Line type="monotone" dataKey="v" stroke="#f43f5e" strokeWidth={2} dot={false} />
            </LineChart>
          </div>
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            <strong>AI Insight:</strong> High spikes indicate periods of significant market stress. Volatility is currently lower than the reference benchmark, showing resilience against sector-specific shocks.
          </div>
        </div>
      )
    },
    {
      id: "performance",
      chapter: "Chapter 4.2",
      title: "Performance & ROI",
      description: "Return analysis over time and performance trends.",
      icon: <Activity className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="w-full flex flex-col justify-center bg-slate-900/50 rounded-2xl p-4 border border-slate-800">
            <span className="text-[10px] text-slate-500 mb-2 uppercase font-bold">ROI History</span>
            <LineChart width={250} height={120} data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
              <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={3} dot={false} />
            </LineChart>
          </div>
          <MiniTable assets={topAssets} col2="Unrealized P/L" col3="Weight" />
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            <strong>AI Insight:</strong> Net ROI is outperforming the S&P 500 by 2.1% this quarter. The trajectory visualizes the moment the investment recovered initial costs, transitioning into net profit.
          </div>
        </div>
      )
    },
    {
      id: "allocation",
      chapter: "Chapter 4.1",
      title: "Portfolio Composition",
      description: "Current holdings and concentration analysis.",
      icon: <PieChart className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="w-full flex items-center justify-center py-2">
            <RePieChart width={270} height={150}>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={5} dataKey="value" stroke="none">
                {pieData.map((entry: PieDataItem, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </RePieChart>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {pieData.map((item: PieDataItem) => (
              <div key={item.name} className="flex items-center justify-between px-4 py-2 bg-slate-900/50 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-xs text-white font-medium">{item.name}</span>
                </div>
                <div className="text-xs font-bold text-slate-300">{item.value}%</div>
              </div>
            ))}
          </div>
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            <strong>AI Insight:</strong> Portfolio is currently overweight in Equities. Increasing fixed income exposure would better align with your moderate risk target.
          </div>
        </div>
      )
    },
    {
      id: "costs",
      chapter: "Chapter 3",
      title: "Cost Analysis & Fees",
      description: "In-depth analysis of direct commissions and implicit trading spreads.",
      icon: <Receipt className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-end mb-2">
              <span className="text-xs text-slate-400">Total Management Costs</span>
              <span className="text-xl font-bold text-rose-400">€ 242.10</span>
            </div>
            <div className="flex justify-between text-[10px] font-medium text-slate-400 border-t border-slate-800 pt-3 mt-1">
              <span>Explicit: <span className="text-white">€ 197.10</span></span>
              <span>Implicit: <span className="text-white">€ 45.00</span></span>
            </div>
          </div>
          <MiniTable assets={platformCosts} col2="Total Costs" col3="% of Total" />
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            <strong>AI Insight:</strong> This breakdown highlights the cost efficiency of each broker. Reducing transaction frequency on small ETF orders could optimize the Cost-to-Value Ratio.
          </div>
        </div>
      )
    },
    {
      id: "overview",
      chapter: "Chapter 1",
      title: "Overview",
      description: "A high-level snapshot of the portfolio, including total invested capital and current value.",
      icon: <Wallet className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="grid grid-cols-2 gap-2">
             <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
               <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Total Invested</span>
               <div className="text-lg font-black text-white">€ 35,920</div>
             </div>
             <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
               <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Current Value</span>
               <div className="text-lg font-black text-cyan-400">€ 48,320</div>
             </div>
             <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
               <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Unrealized P/L</span>
               <div className="text-lg font-black text-emerald-400">+€ 12,400</div>
             </div>
             <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
               <span className="text-[9px] text-slate-500 uppercase font-bold mb-1">Overall ROI</span>
               <div className="text-lg font-black text-emerald-400">+34.5%</div>
             </div>
          </div>
          <div className="w-full flex flex-col justify-center bg-slate-900/50 rounded-2xl p-4 border border-slate-800 mt-2">
            <span className="text-[10px] text-slate-500 mb-2 uppercase font-bold">Portfolio Value Over Time</span>
            <LineChart width={250} height={90} data={performanceData}>
              <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </div>
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            This report provides a structured overview of the investment portfolio over the selected period. Its purpose is to present a clear and accessible summary of the portfolio’s current status.
          </div>
        </div>
      )
    }
  ];

  const [cards, setCards] = useState<CardData[]>(initialCards);

  const topCard: CardData = cards[cards.length - 1];

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo): void => {
    if (Math.abs(info.offset.x) > 100 || Math.abs(info.offset.y) > 100) {
      setCards((prev: CardData[]) => {
        const newCards: CardData[] = [...prev];
        const top: CardData | undefined = newCards.pop();
        if (top) newCards.unshift(top);
        return newCards;
      });
    }
  };

  return (
    <section className="py-32 bg-slate-950 w-full overflow-hidden font-sans">
      <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        {/* COLONNA SINISTRA */}
        <div className="w-full lg:w-1/2 flex flex-col text-center lg:text-left">
          <div className="inline-flex items-center justify-center lg:justify-start gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-8 h-px bg-cyan-800"></span>
            Intelligence Report
          </div>

          <div className="min-h-[300px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={topCard.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                    {topCard.icon}
                  </div>
                  <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">{topCard.chapter}</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                  {topCard.title}
                </h3>
                <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                  {topCard.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-12 flex items-center justify-center lg:justify-start gap-3 text-sm text-slate-500">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
              <Hand className="w-4 h-4 text-cyan-500" />
            </div>
            Swipe to explore the chapters
          </div>
        </div>

        {/* COLONNA DESTRA */}
        <div className="w-full lg:w-1/2 h-[650px] relative perspective-[2000px] flex justify-center items-center">
          {cards.map((card: CardData, index: number) => {
            const isTop: boolean = index === cards.length - 1;
            const isMiddle: boolean = index === cards.length - 2;
            const isBottom: boolean = index === cards.length - 3;
            
            return (
              <motion.div
                key={card.id}
                layout
                animate={{
                  opacity: isTop ? 1 : isMiddle ? 0.8 : isBottom ? 0.4 : 0,
                  y: isTop ? 0 : isMiddle ? -25 : -50, 
                  x: isTop ? 0 : isMiddle ? 20 : 40,
                  scale: isTop ? 1 : isMiddle ? 0.94 : 0.88,
                  rotateZ: isTop ? 0 : isMiddle ? 2 : 4,
                  zIndex: index,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                drag={isTop}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDragEnd={handleDragEnd}
                whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                className={`absolute inset-0 m-auto w-[340px] sm:w-[380px] h-[580px] rounded-[2.5rem] p-8 border flex flex-col transition-colors duration-500 ${
                  isTop ? "bg-slate-950 border-cyan-500/50 shadow-[0_0_60px_rgba(6,182,212,0.15)] cursor-grab" : 
                  "bg-slate-900 border-slate-800 shadow-2xl overflow-hidden"
                }`}
              >
                {card.visual}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}