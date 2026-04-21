"use client";

import { BarChart3, FileText, Zap, ShieldCheck, Lightbulb, TrendingUp } from "lucide-react";

export function DashboardOverview() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* --- STATS SECTION --- */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon={<FileText className="h-5 w-5 text-blue-600" />} 
          label="Documenti Totali" 
          value="12" 
          detail="Pronti per l'analisi" 
        />
        <StatCard 
          icon={<Zap className="h-5 w-5 text-amber-500" />} 
          label="Velocità Media" 
          value="0.8s" 
          detail="Performance Ottima" 
        />
        <StatCard 
          icon={<BarChart3 className="h-5 w-5 text-indigo-600" />} 
          label="Data Points" 
          value="1.2k" 
          detail="Estratti dai file" 
        />
        <StatCard 
          icon={<ShieldCheck className="h-5 w-5 text-emerald-500" />} 
          label="Protezione" 
          value="Attiva" 
          detail="Dati Crittografati" 
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* --- MAIN CONTENT (2/3) - SPAZIO PER FUTURI WIDGET --- */}
        <div className="lg:col-span-2 space-y-6">
          <div className="h-[400px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center p-12 text-center group hover:border-blue-200 transition-colors">
            <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Area Analisi Futura</h3>
            <p className="text-sm text-slate-400 max-w-xs mt-2 font-medium">
              Qui potremo visualizzare grafici di crescita, allocazione asset o trend estratti dai tuoi documenti.
            </p>
          </div>
        </div>

        {/* --- SIDEBAR CONTENT (1/3) --- */}
        <aside className="space-y-8">
          {/* Pro Tip Card */}
          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 bg-blue-600/20 h-24 w-24 rounded-full blur-2xl group-hover:bg-blue-600/40 transition-colors" />
            <Lightbulb className="h-8 w-8 text-blue-400 mb-4" />
            <h3 className="font-black text-lg mb-2">Suggerimento AI</h3>
            <p className="text-sm text-slate-400 leading-relaxed font-medium">
              Carica file in formato CSV o Excel direttamente nella nuova sezione "Upload" per aggiornare le tue statistiche in tempo reale.
            </p>
          </div>

          {/* Quick Info Box */}
          <div className="p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">Info Account</h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Piano Attuale</span>
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Premium</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Storage</span>
                <span className="text-xs font-black text-slate-900">82% Disponibile</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[18%]" />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, detail }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all group">
      <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-50 group-hover:scale-110 transition-all">
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-baseline gap-2 mt-1">
        <h4 className="text-2xl font-black text-slate-900">{value}</h4>
        <span className="text-[10px] font-bold text-emerald-500">{detail}</span>
      </div>
    </div>
  );
}