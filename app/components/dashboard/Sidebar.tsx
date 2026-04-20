"use client";

import { LayoutDashboard, FileText, Settings, UploadCloud, ChevronRight } from "lucide-react";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export function Sidebar({ activeSection, setActiveSection }: SidebarProps) {
  const menuItems = [
    { id: 'upload', label: 'Nuovo Upload', icon: UploadCloud },
    { id: 'reports', label: 'I Miei Report', icon: FileText },
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
    </aside>
  );
}