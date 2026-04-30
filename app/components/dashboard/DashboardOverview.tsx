"use client";
"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  Layers, 
  Lightbulb, 
  CheckCircle2, 
  Clock, 
  CreditCard 
} from "lucide-react";

/**
 * TYPES DEFINITION
 */
interface UserStats {
  subscriptionStatus: "Basic" | "Pro" | "Enterprise";
  generatedReports: number;
  inProgressReports: number;
}

interface AISuggestion {
  id: number;
  text: string;
}

/**
 * MOCK DATA
 */
const SUGGESTIONS: AISuggestion[] = [
  { id: 1, text: "Remember to set your financial goals in the settings page." },
  { id: 2, text: "Upgrade to Pro to access the latest GPT-4o analysis models." },
  { id: 3, text: "You can upload raw CSVs from major brokers; we'll handle the conversion." },
  { id: 4, text: "Analyze your dividend history to optimize your passive income." },
  { id: 5, text: "Check your portfolio's risk score after every new trade import." }
];

export default function DashboardOverview() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [currentSuggestion, setCurrentSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    /**
     * MOCK API CALLS
     * Simulating data fetching from the backend
     */
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        
        setStats({
          subscriptionStatus: "Pro",
          generatedReports: 24,
          inProgressReports: 2
        });

        // Pick a random suggestion
        const randomIdx = Math.floor(Math.random() * SUGGESTIONS.length);
        setCurrentSuggestion(SUGGESTIONS[randomIdx]);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
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
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
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
        {/* Subscription Status Card */}
        <StatCard 
          title="Subscription"
          value={stats?.subscriptionStatus || "N/A"}
          icon={<CreditCard className="h-5 w-5 text-blue-600" />}
          description="Your current active plan"
          color="blue"
        />

        {/* Reports Generated Card */}
        <StatCard 
          title="Reports Generated"
          value={stats?.generatedReports?.toString() || "0"}
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          description="Total successfully analyzed"
          color="emerald"
        />

        {/* In Progress Card */}
        <StatCard 
          title="Processing"
          value={stats?.inProgressReports?.toString() || "0"}
          icon={<Clock className="h-5 w-5 text-violet-600" />}
          description="Reports currently being analyzed"
          color="violet"
        />
      </div>

      {/* MAIN CONTENT PLACEHOLDER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="h-64 bg-white border border-slate-200 rounded-[2rem] p-8 flex items-center justify-center border-dashed">
          <div className="text-center">
            <BarChart3 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">Chart data will be available soon.</p>
          </div>
        </div>
        <div className="h-64 bg-white border border-slate-200 rounded-[2rem] p-8 flex items-center justify-center border-dashed">
          <div className="text-center">
            <Layers className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 font-bold">Asset allocation details incoming.</p>
          </div>
        </div>
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
  color: "blue" | "emerald" | "violet";
}

function StatCard({ title, value, icon, description, color }: StatCardProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100"
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