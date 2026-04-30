"use client";

import { LayoutDashboard, FileText, Settings, UploadCloud, ChevronRight, Sparkles } from "lucide-react";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ activeSection, setActiveSection, isOpen = false, onClose }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Documents', icon: UploadCloud },
    { id: 'reports', label: 'Reports Archive', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed lg:sticky top-[73px] left-0 h-[calc(100vh-73px)] z-50 lg:z-0
        w-72 bg-slate-50/80 backdrop-blur-xl border-r border-slate-200/50 p-5 flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        
        <nav className="flex flex-col gap-1.5 flex-1">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`group relative flex items-center justify-between px-4 py-3 rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] ${
                  isActive 
                    ? "bg-white text-blue-600 shadow-sm border border-blue-100" 
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-900 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
                  <span className="text-sm">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pb-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 rounded-[1.5rem] border border-slate-700 text-white relative overflow-hidden group shadow-lg">
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/20 blur-2xl rounded-full" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Pro Version</p>
              </div>
              <p className="text-[13px] font-medium text-slate-300 leading-tight mb-4">
                Unlock unlimited analysis and tax insights.
              </p>
              <button 
                onClick={() => handleNavClick('subscription')}
                className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-blue-400 transition-colors shadow-lg shadow-blue-500/20"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}