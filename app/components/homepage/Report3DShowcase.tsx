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
  { name: "GOLD", roi: "+17%", weight: "20%", status: "positive"}
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
      description: "Focusing on the defensive side of your strategy, this analysis examines your exposure to market turbulence and the overall stability of your investments. It carefully tracks your portfolio's realized risk over a moving 21-trading-day window, visually highlighting the sudden spikes that correlate with periods of significant market stress and uncertainty. By contrasting these high-pressure moments with periods of calm, this chapter helps you understand exactly how resilient your portfolio is when facing unexpected market shocks.",
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
            High spikes indicate periods of significant market stress. Volatility is currently lower than the reference benchmark, showing resilience against sector-specific shocks.
          </div>
        </div>
      )
    },
    {
      id: "performance",
      chapter: "Chapter 4.2",
      title: "Performance & ROI",
      description: "Acting as the core analytical framework for your returns, this chapter focuses on the historical sustainability and growth trends of your investments. It traces the exact trajectory of your Return on Investment over time, utilizing detailed charts and monthly heatmaps to clearly map out phases of growth, stagnation, or decline. Furthermore, by comparing your portfolio's cumulative returns directly against industry benchmarks, it paints a vivid picture of how well your strategy is actually performing in the broader market.",
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
          <MiniTable assets={topAssets} col2="Roi" col3="Weight" />
          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            Net ROI is outperforming the S&P 500 by 2.1% this quarter. The trajectory visualizes the moment the investment recovered initial costs, transitioning into net profit.
          </div>
        </div>
      )
    },
    {
      id: "allocation",
      chapter: "Chapter 4.1",
      title: "Portfolio Composition",
      description: "This part of the report evaluates the efficiency of your capital allocation by providing a detailed look at exactly how your investments are structured. It offers a granular breakdown of your current holdings, detailing the exact market value, unrealized profit or loss, and the overall weight of each asset within your portfolio. By exploring this composition, you gain a clear, strategic view of where your money is concentrated, making it easier to spot imbalances and plan your future rebalancing moves.",
      icon: <PieChart className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-3">
          <div className="w-full flex items-center justify-center py-2">
            <RePieChart width={250} height={150}>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
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
            Portfolio is currently overweight in Equities. Increasing fixed income exposure would better align with your moderate risk target.
          </div>
        </div>
      )
    },
    {
      id: "costs",
      chapter: "Chapter 3",
      title: "Cost Analysis & Fees",
      description: "To truly understand your net performance, this section dives deep into the expenses incurred while managing your portfolio. It peels back the layers on both the explicit costs—such as trading commissions and platform fees—and the hidden, implicit costs like bid-ask spreads. By breaking down these expenses across different brokers and asset categories, and tracking their cumulative impact over time, this analysis empowers you to clearly identify your most and least cost-efficient trading platforms.",
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
            This breakdown highlights the cost efficiency of each broker. Reducing transaction frequency on small ETF orders could optimize the Cost-to-Value Ratio.
          </div>
        </div>
      )
    },
    {
      id: "cashflow",
      chapter: "Chapter 2",
      title: "Financial Overview & Cash Flow",
      description: "Diving into the mechanics of your wealth accumulation, this chapter offers a detailed exploration of your historical purchases, sales, and the overall evolution of your cash flow. By mapping out your precise capital allocation and tracking realized profits across various assets, it provides a highly transparent view of your past trading activity. Furthermore, by visualizing your buy and sell patterns over time, this analysis allows you to understand exactly how your capital has been deployed and where your most significant financial moves have occurred.",
      icon: <Activity className="w-6 h-6 text-cyan-400" />, // Tip: puoi importare "ArrowRightLeft" da lucide-react per un'icona più specifica
      visual: (
        <div className="flex flex-col h-full gap-3">
          
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] text-slate-500 uppercase font-bold">Net Realized P/L</span>
              <span className="text-xl font-bold text-emerald-400">€ 4,250.00</span>
            </div>
            <div className="flex justify-between text-[10px] font-medium text-slate-400 border-t border-slate-800 pt-2 mt-1">
              <span>Total Purchases: <span className="text-white">€ 15,300</span></span>
              <span>Total Sales: <span className="text-white">€ 8,400</span></span>
            </div>
          </div>

          <div className="w-full flex flex-col justify-center bg-slate-900/50 rounded-2xl p-4 border border-slate-800 flex-1">
            <span className="text-[10px] text-slate-500 mb-4 uppercase font-bold text-center">Capital Flow (Buy vs Sell)</span>
            
            <div className="flex flex-col gap-3 w-full">
               <div className="flex items-center text-[10px] text-slate-300 w-full">
                  <span className="w-16 text-right mr-3 font-medium">Equities</span>
                  <div className="flex-1 grid grid-cols-2 gap-1 items-center">
                      <div className="flex justify-end"><div className="h-3 bg-rose-500/80 rounded-l" style={{width: '20%'}}></div></div>
                      <div className="flex justify-start"><div className="h-3 bg-emerald-500/80 rounded-r" style={{width: '80%'}}></div></div>
                  </div>
               </div>
               
               <div className="flex items-center text-[10px] text-slate-300 w-full">
                  <span className="w-16 text-right mr-3 font-medium">Crypto</span>
                  <div className="flex-1 grid grid-cols-2 gap-1 items-center">
                      <div className="flex justify-end"><div className="h-3 bg-rose-500/80 rounded-l" style={{width: '60%'}}></div></div>
                      <div className="flex justify-start"><div className="h-3 bg-emerald-500/80 rounded-r" style={{width: '30%'}}></div></div>
                  </div>
               </div>

               <div className="flex items-center text-[10px] text-slate-300 w-full">
                  <span className="w-16 text-right mr-3 font-medium">Bonds</span>
                  <div className="flex-1 grid grid-cols-2 gap-1 items-center">
                      <div className="flex justify-end"><div className="h-3 bg-rose-500/80 rounded-l" style={{width: '10%'}}></div></div>
                      <div className="flex justify-start"><div className="h-3 bg-emerald-500/80 rounded-r" style={{width: '45%'}}></div></div>
                  </div>
               </div>
            </div>

            <div className="flex justify-center gap-4 mt-5 text-[9px] text-slate-500 uppercase font-bold">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-rose-500/80 rounded-full"></span> Sales</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500/80 rounded-full"></span> Purchases</span>
            </div>
          </div>

          <div className="mt-auto bg-cyan-950/30 p-3 rounded-lg border border-cyan-900/30 text-[11px] text-slate-300 leading-snug">
            Strong accumulation in Equities over the selected period. Profit-taking (sales) in Crypto has successfully secured significant realized gains.
          </div>

        </div>
      )
    },
    {
      id: "overview",
      chapter: "Chapter 1",
      title: "Overview",
      description: "This chapter serves as your portfolio's high-level snapshot, designed to give you an immediate and clear sense of your financial standing over the selected period. It weaves together the most critical metrics into one accessible narrative, contrasting your total invested capital against your current market value to reveal unrealized profits, losses, and your overall Return on Investment. By visualizing your portfolio's value over time, this summary provides the perfect starting point to understand the broader trajectory of your wealth",
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
    },
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
    <section className="py-12 lg:py-32 bg-slate-950 w-full overflow-hidden font-sans">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center gap-8 lg:gap-24">
        
        <div className="w-full lg:w-1/2 flex flex-col text-center lg:text-left">

          <div className="min-h-[220px] lg:min-h-[300px] flex flex-col justify-center">
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
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white mb-4 sm:mb-6 leading-tight">
                  {topCard.title}
                </h3>
                <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
                  {topCard.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 lg:mt-12 flex items-center justify-center lg:justify-start gap-3 text-sm text-slate-500">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
              <Hand className="w-4 h-4 text-cyan-500" />
            </div>
            Swipe to explore the chapters
          </div>
        </div>

        <div className="w-full lg:w-1/2 h-[580px] lg:h-[650px] relative perspective-[2000px] flex justify-center items-center">
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
                  y: isTop ? 0 : isMiddle ? -15 : -30, 
                  x: isTop ? 0 : isMiddle ? 10 : 20,
                  scale: isTop ? 1 : isMiddle ? 0.94 : 0.88,
                  rotateZ: isTop ? 0 : isMiddle ? 2 : 4,
                  zIndex: index,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                drag={isTop}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDragEnd={handleDragEnd}
                whileDrag={{ scale: 1.02, cursor: "grabbing" }}
                className={`absolute inset-0 m-auto w-[310px] sm:w-[340px] md:w-[380px] h-[540px] sm:h-[580px] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 border flex flex-col transition-colors duration-500 ${
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