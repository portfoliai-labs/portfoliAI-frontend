"use client";

import { Check, Zap, Crown, Shield } from "lucide-react";

export function SubscriptionSection() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Scegli il tuo piano</h2>
        <p className="text-slate-500 mt-4 font-medium">
          Sblocca analisi illimitate e report avanzati generati dall'intelligenza artificiale.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Piano Free */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col">
          <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-6">
            <Zap className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-xl font-black text-slate-900">Starter</h3>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Gratis</p>
          
          <ul className="mt-8 space-y-4 flex-1">
            <Feature item="Fino a 3 report/mese" active />
            <Feature item="Importazione CSV standard" active />
            <Feature item="Storage limitato (100MB)" active />
            <Feature item="Analisi AI Avanzata" active={false} />
          </ul>

          <button className="w-full mt-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-slate-100 text-slate-400 cursor-not-allowed">
            Piano Attuale
          </button>
        </div>

        {/* Piano Pro - Highlighting with Gradient */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-200 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 bg-blue-600/20 h-32 w-32 rounded-full blur-3xl group-hover:bg-blue-600/40 transition-colors" />
          
          <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/20">
            <Crown className="h-6 w-6 text-white" />
          </div>
          
          <h3 className="text-xl font-black text-white italic">Professional</h3>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-black text-white">€19</span>
            <span className="text-slate-400 text-sm font-bold">/mese</span>
          </div>

          <ul className="mt-8 space-y-4 flex-1">
            <Feature item="Report illimitati" active isPro />
            <Feature item="Supporto Excel & PDF" active isPro />
            <Feature item="AI Tax Assistant" active isPro />
            <Feature item="Priority Support" active isPro />
          </ul>

          <button className="w-full mt-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 shadow-xl shadow-blue-900/20 transition-all transform active:scale-95">
            Upgrade Ora
          </button>
        </div>
      </div>

      {/* Security Badge */}
      <div className="flex items-center justify-center gap-2 text-slate-400">
        <Shield className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Pagamenti sicuri via Stripe</span>
      </div>
    </div>
  );
}

function Feature({ item, active, isPro }: { item: string; active: boolean; isPro?: boolean }) {
  return (
    <li className={`flex items-center gap-3 text-sm font-bold ${active ? (isPro ? "text-slate-300" : "text-slate-600") : "text-slate-300 line-through opacity-50"}`}>
      <div className={`p-1 rounded-full ${active ? (isPro ? "bg-blue-500/20 text-blue-400" : "bg-emerald-100 text-emerald-600") : "bg-slate-100 text-slate-300"}`}>
        <Check className="h-3 w-3" />
      </div>
      {item}
    </li>
  );
}