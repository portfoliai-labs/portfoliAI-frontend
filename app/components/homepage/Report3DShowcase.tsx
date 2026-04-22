"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, PieChart, CalendarDays, Hand } from "lucide-react";

export default function Report3DShowcase() {
  // Funzione helper per i colori della heatmap
  const getHeatmapColor = (yearIndex: number, monthIndex: number) => {
    const pattern = [
      "bg-emerald-500", "bg-emerald-700/60", "bg-rose-500", "bg-emerald-900/40",
      "bg-emerald-600/50", "bg-rose-700/60", "bg-emerald-500", "bg-emerald-800/40",
      "bg-rose-900/40", "bg-emerald-500", "bg-emerald-700/60", "bg-rose-600/50"
    ];
    return pattern[(yearIndex + monthIndex) % pattern.length];
  };

  // Definiamo il contenuto delle 3 "carte" del report
  const initialCards = [
    {
      id: "heatmap",
      className: "bg-slate-900 border-slate-700 shadow-2xl",
      content: (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4 text-slate-400">
            <CalendarDays className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wider uppercase">Chapter 4.2 - Performance & ROI</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Annual Returns & Heatmap</h3>
          <p className="text-sm text-slate-500 mb-8">A detailed breakdown of performance by year and month. The color scale highlights volatility and seasonal trends.</p>
          
          <div className="grid grid-cols-13 gap-1">
            <div className="col-span-1"></div> 
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
              <div key={m} className="text-[10px] text-slate-500 text-center">{m}</div>
            ))}
            {[2024, 2025, 2026].map((year, yIdx) => (
              <React.Fragment key={year}>
                <div className="text-xs text-slate-400 font-bold flex items-center">{year}</div>
                {[...Array(12)].map((_, mIdx) => (
                  <div key={mIdx} className={`h-8 rounded-sm ${getHeatmapColor(yIdx, mIdx)}`}></div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      )
    },
    {
      id: "asset",
      className: "bg-slate-800 border-slate-600 shadow-2xl",
      content: (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4 text-slate-300">
            <PieChart className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wider uppercase">Chapter 4.1 - Portfolio Composition</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Asset Allocation</h3>
          <p className="text-sm text-slate-400 mb-8">Analysis of concentration and capital distribution by investment category.</p>
          
          <div className="flex items-center justify-center gap-10 mt-10">
            <div className="w-48 h-48 rounded-full border-[16px] border-cyan-500 border-r-blue-500 border-b-emerald-400 border-l-cyan-900 shadow-inner rotate-45"></div>
            <div className="space-y-4 w-1/2">
               {['Stocks (65%)', 'Bonds (22%)', 'Crypto (8%)', 'Cash (5%)'].map((item, i) => (
                 <div key={i} className="flex items-center gap-3">
                   <div className={`w-3 h-3 rounded-full ${i===0 ? 'bg-cyan-500' : i===1 ? 'bg-blue-500' : i===2 ? 'bg-emerald-400' : 'bg-cyan-900'}`}></div>
                   <span className="text-sm text-white font-medium">{item}</span>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cover",
      className: "bg-slate-950 border-cyan-800 shadow-[0_0_60px_rgba(6,182,212,0.15)]",
      content: (
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4 text-cyan-500">
            <BarChart3 className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wider uppercase">Chapter 1 - Overview</span>
          </div>
          <h3 className="text-4xl font-extrabold text-white mb-2 leading-tight">Investment Portfolio Report</h3>
          <p className="text-base text-slate-400 mb-10 max-w-lg">This report provides a comprehensive overview and analysis of the investment portfolio, covering historical transactions, current holdings, and risk metrics.</p>
          
          <div className="grid grid-cols-2 gap-4 mt-auto">
             <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
               <span className="text-xs text-slate-500 font-bold uppercase">Total Invested Capital</span>
               <div className="text-2xl font-bold text-white mt-1">€ 42,150.00</div>
             </div>
             <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-xl">
               <span className="text-xs text-slate-500 font-bold uppercase">Current Value</span>
               <div className="text-2xl font-bold text-cyan-400 mt-1">€ 48,320.50</div>
             </div>
          </div>
        </div>
      )
    }
  ];

  // Stato che gestisce l'ordine delle carte. L'ultima carta nell'array è quella visibile in cima.
  const [cards, setCards] = useState(initialCards);

  // Funzione per spostare la carta in cima alla fine del mazzo
  const handleDragEnd = (event: any, info: any) => {
    // Se la carta è stata trascinata per più di 100px a destra/sinistra o su/giù
    if (Math.abs(info.offset.x) > 100 || Math.abs(info.offset.y) > 100) {
      setCards((prevCards) => {
        const newCards = [...prevCards];
        const topCard = newCards.pop(); // Rimuove l'ultima carta (quella in cima)
        if (topCard) newCards.unshift(topCard); // La inserisce all'inizio (in fondo al mazzo)
        return newCards;
      });
    }
  };

  return (
    <section className="py-32 bg-slate-950 relative overflow-hidden flex flex-col items-center justify-center">
      
      <div className="text-center mb-16 z-10 relative px-6">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-3xl md:text-5xl font-bold text-white mb-6"
        >
          Look inside the report
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1 }}
          className="text-slate-400 max-w-2xl mx-auto text-lg mb-8"
        >
          A granular breakdown of your portfolio, from asset allocation to historical monthly heatmaps.
        </motion.p>
        
        {/* Suggerimento visivo per il drag */}
        <motion.div 
          initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ delay: 0.5 }} viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full text-cyan-400 text-sm font-semibold border border-cyan-900/50 animate-pulse"
        >
          <Hand className="w-4 h-4" /> Try dragging the top card
        </motion.div>
      </div>

      {/* CONTAINER CARTE. Usa whileInView per l'animazione di entrata dell'intero blocco */}
      <motion.div 
        initial={{ opacity: 0, y: 100 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="relative w-full max-w-4xl h-[550px] flex justify-center items-start mt-4 perspective-[2000px]"
      >
        {cards.map((card, index) => {
          // Calcoliamo se la carta è in cima, in mezzo o in fondo
          const isTop = index === cards.length - 1;
          const isMiddle = index === cards.length - 2;
          
          // Definiamo stili e posizioni in base al livello nel mazzo
          const animateProps = isTop
            ? { opacity: 1, y: 0, scale: 1.05, rotateZ: -2, zIndex: 30 }
            : isMiddle
            ? { opacity: 1, y: 30, scale: 0.95, rotateZ: 4, zIndex: 20 }
            : { opacity: 1, y: 60, scale: 0.85, rotateZ: -8, zIndex: 10 };

          return (
            <motion.div
              key={card.id}
              layout // Gestisce automaticamente l'animazione fluida quando cambia l'ordine
              initial={false}
              animate={animateProps}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              
              // Impostazioni di Drag (attive solo per la carta in cima)
              drag={isTop} 
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} // Fa tornare indietro la carta se non supera la soglia
              dragElastic={0.6} // Rende il trascinamento "gommoso"
              onDragEnd={isTop ? handleDragEnd : undefined}
              whileDrag={{ scale: 1.1, cursor: "grabbing" }}
              
              className={`absolute w-[90%] md:w-[700px] h-[480px] rounded-2xl p-8 border overflow-hidden ${card.className} ${isTop ? "cursor-grab" : "cursor-auto"}`}
            >
              {card.content}
            </motion.div>
          );
        })}
      </motion.div>

    </section>
  );
}