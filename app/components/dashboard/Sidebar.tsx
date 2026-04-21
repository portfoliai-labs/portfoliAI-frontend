"use client";

import { LayoutDashboard, FileText, Settings, UploadCloud, ChevronRight } from "lucide-react";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Carica Documenti', icon: UploadCloud },
    { id: 'reports', label: 'Archivio Report', icon: FileText },
    { id: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  return (
    <aside className="w-72 bg-slate-50/50 border-r border-slate-200/60 p-6 flex flex-col gap-8">
      <nav className="flex flex-col gap-2">
        {menuItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              // RIMOSSO transition-all, AGGIUNTO transition-[background-color,color,transform]
              // Usiamo duration-150 per una risposta più secca e veloce
              className={`group relative flex items-center justify-between px-4 py-3.5 rounded-2xl font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.98] ${
                isActive 
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200" 
                  : "text-slate-500 hover:bg-white/40 hover:text-slate-900"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Usiamo transition-transform specifica qui */}
                <item.icon className={`h-5 w-5 transition-transform duration-200 ease-out ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 opacity-50 animate-in fade-in zoom-in duration-200" />}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto pt-6 border-t border-slate-200/60">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-[2rem] border border-blue-100/50">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2 italic">Pro Version</p>
          <p className="text-xs font-bold text-slate-700 leading-relaxed mb-4">
            Analisi illimitate e suggerimenti fiscali personalizzati.
          </p>
          <button 
            onClick={() => setActiveSection('subscription')}
            className="w-full py-3 bg-white border border-blue-200 text-blue-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm"
          >
            Upgrade
          </button>
        </div>
      </div>
    </aside>
  );
}