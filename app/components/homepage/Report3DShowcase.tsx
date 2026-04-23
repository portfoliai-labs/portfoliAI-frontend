"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BarChart3, PieChart, Hand, 
  TrendingUp, ArrowUpRight 
} from "lucide-react";
import {
  LineChart, Line, PieChart as RePieChart, Pie,
  ResponsiveContainer, Tooltip, CartesianGrid
} from 'recharts';

// --- DATA FOR CHARTS ---
const lineData = [
  { m: 'J', v: 400 }, { m: 'F', v: 300 }, { m: 'M', v: 500 },
  { m: 'A', v: 450 }, { m: 'M', v: 700 }, { m: 'J', v: 600 }
];

const pieData = [
  { name: 'Stocks', value: 65, fill: '#06b6d4' },
  { name: 'Bonds', value: 25, fill: '#3b82f6' },
  { name: 'Cash', value: 10, fill: '#1e293b' },
];

export default function Report3DShowcase() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Abbiamo separato il testo (che va a sinistra) dal contenuto visivo (che va nella carta)
  const initialCards = [
    {
      id: "performance",
      chapter: "Chapter 4.2",
      title: "Performance & ROI",
      description: "Track your historical returns and understand your exposure to market volatility. The AI calculates your true net growth by factoring in all hidden fees and spreads.",
      icon: <TrendingUp className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-4">
          <div className="flex-1 w-full min-h-[200px] bg-slate-900/50 rounded-2xl p-4 border border-slate-800 flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-2">Growth Trajectory</span>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
                  <Line type="monotone" dataKey="v" stroke="#06b6d4" strokeWidth={3} dot={{ r: 3, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 h-28">
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Yearly ROI</span>
              <div className="text-emerald-400 font-bold text-xl mt-1">+14.2%</div>
            </div>
            <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Volatility</span>
              <div className="text-white font-bold text-xl mt-1">Low</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "allocation",
      chapter: "Chapter 4.1",
      title: "Asset Allocation",
      description: "A granular look at how your capital is distributed. Ensure your portfolio is perfectly balanced for your risk profile across stocks, bonds, and alternative assets.",
      icon: <PieChart className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full gap-6">
          <div className="flex-1 w-full min-h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', fontSize: '10px' }} />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3 bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-inner" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm text-white font-medium">{item.name}</span>
                </div>
                <div className="text-sm font-bold text-slate-300">{item.value}%</div>
              </div>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "overview",
      chapter: "Chapter 1",
      title: "Executive Summary",
      description: "Get a bird's-eye view of your entire financial health. We clean and categorize thousands of rows of broker data to give you this simple, clear starting point.",
      icon: <BarChart3 className="w-6 h-6 text-cyan-400" />,
      visual: (
        <div className="flex flex-col h-full items-center justify-center text-center gap-8 py-8">
          <div className="w-20 h-20 bg-cyan-900/30 rounded-full flex items-center justify-center border border-cyan-800 mb-4">
             <BarChart3 className="w-10 h-10 text-cyan-400" />
          </div>
          <div className="w-full space-y-4">
             <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl">
               <span className="text-xs text-slate-500 uppercase font-bold tracking-wider block mb-2">Total Value</span>
               <div className="text-4xl font-black text-white">€ 48,320<span className="text-2xl text-slate-600">.50</span></div>
             </div>
             <div className="bg-cyan-950/30 border border-cyan-800/50 p-6 rounded-3xl">
               <span className="text-xs text-cyan-500 uppercase font-bold tracking-wider block mb-2">Net Growth</span>
               <div className="text-3xl font-black text-cyan-400 flex items-center justify-center gap-2">
                 <ArrowUpRight className="w-6 h-6" /> 12.4%
               </div>
             </div>
          </div>
        </div>
      )
    }
  ];

  const [cards, setCards] = useState(initialCards);

  // La carta in cima è sempre l'ultima dell'array
  const topCard = cards[cards.length - 1];

  const handleDragEnd = (event: any, info: any) => {
    if (Math.abs(info.offset.x) > 100 || Math.abs(info.offset.y) > 100) {
      setCards((prev) => {
        const newCards = [...prev];
        const top = newCards.pop();
        if (top) newCards.unshift(top);
        return newCards;
      });
    }
  };

  if (!isMounted) return null;

  return (
    <section className="py-32 bg-slate-950 w-full overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16 lg:gap-24">
        
        {/* ==========================================
            COLONNA SINISTRA: TESTO DINAMICO
            ========================================== */}
        <div className="w-full lg:w-1/2 flex flex-col pt-10 lg:pt-0 text-center lg:text-left">
          
          <div className="inline-flex items-center justify-center lg:justify-start gap-2 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-6">
            <span className="w-8 h-px bg-cyan-800"></span>
            Inside the Report
          </div>

          {/* AnimatePresence gestisce il crossfade del testo quando cambi carta */}
          <div className="min-h-[250px] flex flex-col justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={topCard.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
                  {topCard.icon}
                  <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">{topCard.chapter}</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-extrabold text-white mb-6 leading-tight">
                  {topCard.title}
                </h3>
                <p className="text-lg text-slate-400 leading-relaxed">
                  {topCard.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div 
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            className="mt-12 inline-flex items-center justify-center lg:justify-start gap-3 text-sm text-slate-500 font-medium"
          >
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
              <Hand className="w-4 h-4 text-cyan-500" />
            </div>
            Swipe the card to explore
          </motion.div>

        </div>

        {/* ==========================================
            COLONNA DESTRA: 3D STACK
            ========================================== */}
        <div className="w-full lg:w-1/2 h-[600px] relative perspective-[2000px] flex justify-center items-center">
          {cards.map((card, index) => {
            const isTop = index === cards.length - 1;
            const isMiddle = index === cards.length - 2;
            
            return (
              <motion.div
                key={card.id}
                layout
                animate={{
                  opacity: 1,
                  // Offset verso l'alto e a destra per un effetto mazzo asimmetrico
                  y: isTop ? 0 : isMiddle ? -20 : -40, 
                  x: isTop ? 0 : isMiddle ? 15 : 30,
                  scale: isTop ? 1 : isMiddle ? 0.95 : 0.90,
                  rotateZ: isTop ? 0 : isMiddle ? 3 : 6,
                  zIndex: index * 10,
                }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                drag={isTop}
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                onDragEnd={handleDragEnd}
                whileDrag={{ scale: 1.05, rotateZ: -2, cursor: "grabbing" }}
                
                // Misure compatte: w-[340px] a w-[400px], h-[500px]. Nessun rischio di taglio.
                className={`absolute inset-0 m-auto w-[340px] sm:w-[400px] h-[520px] rounded-[2rem] p-6 border flex flex-col ${
                  isTop ? "bg-slate-950 border-cyan-800 shadow-[0_0_50px_rgba(6,182,212,0.2)] cursor-grab" : 
                  isMiddle ? "bg-slate-900 border-slate-700 shadow-2xl" : "bg-slate-800 border-slate-700 shadow-xl"
                }`}
              >
                {/* Visual Content Only */}
                {card.visual}
              </motion.div>
            );
          })}
        </div>

      </div>
    </section>
  );
}