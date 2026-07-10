"use client";

import { useState, useEffect } from "react";
import {
  Users, TrendingUp, Sparkles,
  CheckCircle2, Clock, AlertCircle, ArrowRight,
  Loader2, Crown,
} from "lucide-react";
import { useUser } from "../../context/UserContext";
import { advisorService } from "../../services/advisorService";
import { userService } from "../../services/userService";
import type { Client, AdvisorProfile } from "../../models/Advisor";
import type { UserMetrics } from "../../models/User";
import { QuotaBar, FREE_MONTHLY_REPORTS } from "./QuotaBar";

function formatCurrency(value: number, currency = "EUR") {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(".0", "")}M ${currency}`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}k ${currency}`;
  }
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  accent?: boolean;
}

function StatCard({ label, value, sub, icon, iconBg, accent }: StatCardProps) {
  return (
    <div className={`bg-white rounded-[1.75rem] border p-6 flex flex-col gap-4 transition-shadow hover:shadow-sm ${
      accent ? "border-[#C49A3C]/40" : "border-[rgba(196,154,60,0.2)]"
    }`}>
      <div className="flex items-center justify-between">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#a8a29e]">{label}</span>
      </div>
      <div>
        <div className="text-2xl font-bold text-[#1c1917]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {value}
        </div>
        {sub && <p className="text-xs text-[#78716c] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function RecentClientRow({ client }: { client: Client }) {
  const name =
    client.first_name || client.last_name
      ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
      : client.email;
  const initials =
    ((client.first_name?.[0] ?? "") + (client.last_name?.[0] ?? "")).toUpperCase() ||
    client.email[0].toUpperCase();

  return (
    <div className="flex items-center gap-3 py-3 border-b border-[rgba(196,154,60,0.1)] last:border-0">
      <div className="w-9 h-9 rounded-xl bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] text-xs shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-[#1c1917] truncate">{name}</p>
        <p className="text-xs text-[#78716c] truncate">{client.email}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        {client.estimated_wealth != null && (
          <span className="text-xs font-bold text-[#1c1917]">
            {formatCurrency(client.estimated_wealth, client.currency ?? "EUR")}
          </span>
        )}
        {client.risk_tolerance && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${
            client.risk_tolerance === "high"
              ? "bg-rose-50 text-rose-500"
              : client.risk_tolerance === "low"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-600"
          }`}>
            {client.risk_tolerance}
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdvisorDashboardOverview({
  onNavigate,
}: {
  onNavigate?: (section: string) => void;
}) {
  const { user } = useUser();
  const [clients, setClients] = useState<Client[]>([]);
  const [advisorProfile, setAdvisorProfile] = useState<AdvisorProfile | null>(null);
  const [metrics, setMetrics] = useState<UserMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cls, profile, m] = await Promise.all([
          advisorService.getClients(),
          advisorService.getAdvisorProfile(),
          userService.getUserMetrics(),
        ]);
        setClients(cls);
        setAdvisorProfile(profile);
        setMetrics(m);
      } catch (err) {
        console.error("Failed to load advisor dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const firstName = user?.first_name ?? user?.email?.split("@")[0] ?? "Advisor";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";

  // AUM: prefer advisor-set value; fallback to sum of client wealth
  const totalAum =
    advisorProfile?.aum != null
      ? advisorProfile.aum
      : clients.reduce((sum, c) => sum + (c.estimated_wealth ?? 0), 0);

  const reportsUsed = metrics?.report_generated ?? 0;
  const isTester = user?.subscription_tier === "TESTER";

  const recentClients = [...clients]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-7 h-7 animate-spin text-[#C49A3C]" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#C49A3C] mb-1">
          {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-[#78716c] mt-1">Ecco il riepilogo della tua attività.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Clienti in gestione"
          value={clients.length}
          sub={clients.length === 1 ? "cliente registrato" : "clienti registrati"}
          icon={<Users className="w-5 h-5 text-[#C49A3C]" />}
          iconBg="bg-[#C49A3C]/10"
        />
        <StatCard
          label="Patrimonio gestito"
          value={totalAum > 0 ? formatCurrency(totalAum) : "—"}
          sub={advisorProfile?.aum != null ? "valore dichiarato" : "somma patrimoni clienti"}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Piano attivo"
          value={
            <span className="flex items-center gap-2">
              Free
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#F7F5EF] text-[#78716c] uppercase tracking-wider">
                Piano base
              </span>
            </span>
          }
          sub="Upgrade per report illimitati"
          icon={<Crown className="w-5 h-5 text-[#C49A3C]" />}
          iconBg="bg-[#C49A3C]/10"
          accent
        />
        {/* Quota card is wider / separate — testers aren't capped, so there's no quota to show */}
        {!isTester && (
          <div className="sm:col-span-2 xl:col-span-1">
            <QuotaBar used={reportsUsed} total={FREE_MONTHLY_REPORTS} />
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent clients */}
        <div className="xl:col-span-2 bg-white rounded-[1.75rem] border border-[rgba(196,154,60,0.2)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-bold text-[#1c1917]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Clienti recenti
            </h2>
            {onNavigate && (
              <button
                onClick={() => onNavigate("clients")}
                className="flex items-center gap-1 text-xs font-bold text-[#C49A3C] hover:text-[#d4aa4c] transition-colors"
              >
                Vedi tutti <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {recentClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#C49A3C]" />
              </div>
              <p className="text-sm font-bold text-[#1c1917] mb-1">Nessun cliente ancora</p>
              <p className="text-xs text-[#78716c] mb-4">Aggiungi il tuo primo cliente per iniziare.</p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("clients")}
                  className="px-4 py-2 bg-[#1c1917] text-white rounded-xl text-xs font-bold hover:bg-[#C49A3C] transition-colors"
                >
                  Aggiungi Cliente
                </button>
              )}
            </div>
          ) : (
            <div>
              {recentClients.map((c) => (
                <RecentClientRow key={c.uuid} client={c} />
              ))}
            </div>
          )}
        </div>

        {/* Activity summary + quick actions */}
        <div className="flex flex-col gap-4">
          {/* Report status */}
          <div className="bg-white rounded-[1.75rem] border border-[rgba(196,154,60,0.2)] p-6 flex-1">
            <h2
              className="text-base font-bold text-[#1c1917] mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Stato report
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#78716c]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Completati
                </div>
                <span className="text-sm font-bold text-[#1c1917]">{metrics?.report_generated ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#78716c]">
                  <Clock className="w-4 h-4 text-amber-500" />
                  In elaborazione
                </div>
                <span className="text-sm font-bold text-[#1c1917]">{metrics?.report_in_progress ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-[#78716c]">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  Errori
                </div>
                <span className="text-sm font-bold text-[#1c1917]">{metrics?.report_in_error ?? 0}</span>
              </div>
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="bg-[#1c1917] rounded-[1.75rem] p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#C49A3C]/15 blur-2xl rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#C49A3C]" />
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C49A3C]">Pro Version</p>
              </div>
              <p className="text-sm font-medium text-[#a8a29e] leading-tight mb-4">
                Report illimitati e modelli AI avanzati per i tuoi clienti.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("subscription")}
                  className="w-full py-2.5 bg-[#C49A3C] text-[#131210] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#d4aa4c] transition-colors"
                >
                  Scopri Pro
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
