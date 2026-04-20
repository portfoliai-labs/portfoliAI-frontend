"use client";

import { useState, useEffect } from "react";
import { LogOut, Bell, User, Star } from "lucide-react";
import { userService } from "../../services/userService";

interface DashboardHeaderProps {
  onLogout: () => void;
}

export function DashboardHeader({ onLogout }: DashboardHeaderProps) {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileData = await userService.getUserProfile();
        setUser(profileData);
      } catch (err) {
        console.error("Could not load user profile", err);
      }
    };
    fetchProfile();
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-8 py-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <div className="text-2xl font-black tracking-tighter bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
          PortfoliAI
        </div>
        
        {/* Messaggio di benvenuto dinamico */}
        {user?.first_name && (
          <div className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1 bg-slate-100 rounded-full border border-slate-200 animate-in fade-in slide-in-from-left-2 duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase text-slate-500">
              Welcome back, {user.first_name}!
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell con indicatori */}
        <button className="relative p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-white"></span>
        </button>

        <div className="h-8 w-[1px] bg-slate-200 mx-2" />

        {/* User Profile Unique Style */}
        <div className="flex items-center gap-3 p-1.5 pr-4 rounded-[1.25rem] bg-slate-50 border border-slate-200 hover:border-blue-300 hover:bg-white transition-all cursor-pointer group shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
            {user?.picture ? (
               <img src={user.picture} alt="Avatar" className="rounded-xl object-cover h-full w-full" />
            ) : (
               <span className="font-black text-sm">{user?.first_name?.[0]}{user?.last_name?.[0]}</span>
            )}
          </div>
          
          <div className="flex flex-col">
            <span className="text-xs font-black text-slate-900 leading-none mb-0.5">
              {user?.full_name || "User Account"}
            </span>
            <div className="flex items-center gap-1">
              <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                Pro Investor
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={onLogout}
          className="ml-2 p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all group"
          title="Logout"
        >
          <LogOut className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </header>
  );
}