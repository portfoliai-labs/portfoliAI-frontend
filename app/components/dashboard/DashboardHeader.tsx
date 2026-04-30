"use client";

import { useState } from "react";
import { LogOut, Bell, Star, Menu, X } from "lucide-react";
import Image from "next/image";

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  picture?: string;
  full_name?: string;
}

interface DashboardHeaderProps {
  onLogout: () => void;
  // New props for mobile sidebar toggle
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export function DashboardHeader({ onLogout, onMenuToggle, isMenuOpen }: DashboardHeaderProps) {
  const [user] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const name = localStorage.getItem("user_name");
      const email = localStorage.getItem("user_email");
      const picture = localStorage.getItem("user_picture");

      if (name && email) {
        const nameParts = name.split(" ");
        return {
          first_name: nameParts[0] || "",
          last_name: nameParts[nameParts.length - 1] || "",
          full_name: name,
          email: email,
          picture: picture || undefined,
        };
      }
    } catch (error) {
      console.error("Error reading from localStorage:", error);
    }
    return null;
  });

  return (
    <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-2xl border-b border-slate-200/50 px-4 md:px-8 py-4 flex justify-between items-center transition-all">
      {/* LEFT SECTION: Hamburger & Branding */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Mobile Hamburger Button */}
        <button 
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
        >
          {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        <div className="text-xl md:text-2xl font-black tracking-tighter bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
          PortfoliAI
        </div>
        
        {user?.first_name && (
          <div className="hidden lg:flex items-center gap-2 ml-4 px-4 py-1.5 bg-slate-100/50 rounded-full border border-slate-200/50">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              Welcome back, {user.first_name}!
            </span>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: Actions */}
      <div className="flex items-center gap-2 md:gap-3">
        <button className="relative p-2 md:p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl md:rounded-2xl transition-all">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 md:top-2.5 md:right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="hidden md:block h-8 w-px bg-slate-200 mx-2" />

        {/* User Profile - Compact on Mobile */}
        <div className="flex items-center gap-3 p-1 md:p-1.5 md:pr-4 rounded-full md:rounded-[1.25rem] bg-slate-50/50 border border-slate-200/50 hover:bg-white hover:shadow-sm transition-all cursor-pointer group">
          <div className="relative h-8 w-8 md:h-9 md:w-9 rounded-full md:rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-inner overflow-hidden">
            {user?.picture ? (
               <Image 
                 src={user.picture} 
                 alt="Profile" 
                 fill
                 sizes="36px"
                 className="object-cover"
                 referrerPolicy="no-referrer"
               />
            ) : (
               <span className="font-bold text-xs uppercase">
                 {user?.first_name?.[0]}{user?.last_name?.[0] || 'U'}
               </span>
            )}
          </div>
          
          <div className="hidden md:flex flex-col">
            <span className="text-sm font-bold text-slate-700 leading-none mb-1">
              {user?.full_name || "User Account"}
            </span>
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
              <span className="text-[10px] font-semibold text-slate-400">
                PRO PLAN
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="ml-1 md:ml-2 p-2 md:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl md:rounded-2xl transition-all group"
          title="Sign Out"
        >
          <LogOut className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </header>
  );
}