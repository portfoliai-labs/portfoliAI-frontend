"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// --- DATA WITH MODERN FILL PROPERTY ---
const barData = [
  { name: 'Mon', value: 120 }, { name: 'Tue', value: 180 }, 
  { name: 'Wed', value: 150 }, { name: 'Thu', value: 240 }, 
  { name: 'Fri', value: 190 }, { name: 'Sat', value: 110 }
];

const lineData = [
  { name: 'Jan', value: 2400 }, { name: 'Feb', value: 1398 },
  { name: 'Mar', value: 3800 }, { name: 'Apr', value: 3908 },
  { name: 'May', value: 4800 }, { name: 'Jun', value: 3800 },
  { name: 'Jul', value: 4300 }
];

const pieData = [
  { name: 'Commissions', value: 400, fill: '#0891b2' },
  { name: 'Spread', value: 300, fill: '#06b6d4' },
  { name: 'Taxes', value: 150, fill: '#67e8f9' },
];

const breakdownData = [
  { label: 'Stocks', percent: 65.4, color: '#0891b2' },
  { label: 'Bonds', percent: 22.1, color: '#06b6d4' },
  { label: 'Crypto', percent: 8.3, color: '#67e8f9' },
  { label: 'Cash', percent: 4.2, color: '#cffafe' },
];

export default function RealPricesReport() {
  const [isMounted, setIsMounted] = useState(false);

  // Evita problemi di idratazione e calcolo dimensioni pre-mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="h-[600px] bg-slate-900 rounded-3xl animate-pulse" />;
  }

  return (
    <motion.div 
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
      className="bg-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-800 w-full mx-auto text-left"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
        <h2 className="text-xl font-bold tracking-widest text-white uppercase flex items-center gap-3">
          <div className="w-2 h-6 bg-cyan-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]"></div>
          Real Prices Report
        </h2>
        <div className="px-3 py-1 bg-cyan-900/30 border border-cyan-800 text-cyan-400 rounded-full text-xs font-semibold">
          Live Sync
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BAR CHART: REAL VALUE */}
        <div className="col-span-1 flex flex-col bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-1">Real Value</h3>
          <p className="text-3xl font-extrabold text-white mb-4">€ 24,500</p>
          <div className="h-32 w-full min-h-[128px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                  cursor={{ fill: '#1e293b' }}
                />
                <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* LINE CHART: TREND ANALYSIS */}
        <div className="col-span-1 flex flex-col bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-1">Trend Analysis</h3>
          <p className="text-3xl font-extrabold text-emerald-400 mb-4">+11.18%</p>
          <div className="h-32 w-full min-h-[128px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={lineData}>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PIE CHART: COST BREAKDOWN */}
        <div className="col-span-1 flex flex-col bg-slate-950/50 p-5 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-1">Cost Breakdown</h3>
          <p className="text-3xl font-extrabold text-white mb-4">23.78%</p>
          <div className="h-32 w-full min-h-[128px] relative overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <PieChart>
                <Pie 
                  data={pieData} 
                  innerRadius={35} 
                  outerRadius={55} 
                  paddingAngle={5} 
                  dataKey="value" 
                  stroke="none"
                />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* HISTORICAL TREND (LARGER) */}
        <div className="col-span-1 lg:col-span-2 flex flex-col bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
          <h3 className="text-sm font-semibold text-slate-400 mb-6">Historical Trend (6 Months)</h3>
          <div className="h-48 w-full min-h-[192px] overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" debounce={100}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="value" stroke="#06b6d4" strokeWidth={4} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ASSET ALLOCATION PROGRESS BARS */}
        <div className="col-span-1 flex flex-col justify-center bg-slate-950/50 p-6 rounded-2xl border border-slate-800/50">
           <h3 className="text-sm font-semibold text-slate-400 mb-6">Asset Allocation</h3>
           <div className="space-y-5">
              {breakdownData.map((item, index) => (
                <div key={index} className="w-full">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-slate-300">{item.label}</span>
                    <span className="font-bold text-white">{item.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${item.percent}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: index * 0.2, ease: "easeOut" }}
                      className="h-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    ></motion.div>
                  </div>
                </div>
              ))}
           </div>
        </div>
      </div>
    </motion.div>
  );
}