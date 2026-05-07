// app/components/dashboard/DashboardOverview.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Layers, 
  Lightbulb, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from "lucide-react";

import { userService } from "../../services/userService";
import type { UserMetrics } from "../../models/User";

interface AISuggestion {
  id: number;
  text: string;
}

const SUGGESTIONS: AISuggestion[] = [
  { id: 1, text: "Remember to set your financial goals in the settings page." },
  { id: 2, text: "Upgrade to Pro to access the latest GPT-4o analysis models." },
  { id: 3, text: "You can upload raw CSVs from major brokers; we'll handle the conversion." },
  { id: 4, text: "Analyze your dividend history to optimize your passive income." },
  { id: 5, text: "Check your portfolio's risk score after every new trade import." }
];

export default function DashboardOverview() {
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [currentSuggestion, setCurrentSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const data = await userService.getUserMetrics();
        setMetrics(data);
        const randomIdx = Math.floor(Math.random() * SUGGESTIONS.length);
        setCurrentSuggestion(SUGGESTIONS[randomIdx]);
      } catch (error) {
        console.error("Failed to fetch dashboard metrics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-0 py-6 space-y-8">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 font-medium">Track your portfolio performance and AI insights.</p>
        </div>
        
        {/* AI SUGGESTION BOX */}
        {currentSuggestion && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl max-w-md shadow-sm">
            <Lightbulb className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">AI Suggestion</span>
              <p className="text-xs font-bold text-amber-900 leading-relaxed italic">
                &quot;{currentSuggestion.text}&quot;
              </p>
            </div>
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Reports Generated"
          value={metrics?.report_generated?.toString() || "0"}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          description="Total successfully analyzed"
          color="emerald"
        />

        <StatCard 
          title="Processing"
          value={metrics?.report_in_progress?.toString() || "0"}
          icon={<Clock className="h-5 w-5 text-violet-600" />}
          description="Reports currently active"
          color="violet"
        />

        <StatCard 
          title="Errors"
          value={metrics?.report_in_error?.toString() || "0"}
          icon={<AlertCircle className="h-5 w-5 text-red-600" />}
          description="Reports with analysis errors"
          color="red"
        />
      </div>

    </div>
  );
}

/**
 * REUSABLE STAT CARD COMPONENT
 */
interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: "blue" | "emerald" | "violet" | "red";
}

function StatCard({ title, value, icon, description, color }: StatCardProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100",
    red: "bg-red-50 text-red-600 border-red-100"
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-900">{value}</h3>
        <p className="text-xs font-medium text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  );
}