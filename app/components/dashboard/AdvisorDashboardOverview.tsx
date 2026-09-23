"use client";

import { useState, useEffect } from "react";
import {
  Users, TrendingUp, Sparkles,
  ArrowRight, BellRing, ChevronRight,
  Loader2, Crown,
} from "lucide-react";
import { useUser } from "../../context/UserContext";
import { advisorService } from "../../services/advisorService";
import { useClientAlertRules } from "../../hooks/useAlertRules";
import { alertFigures, alertState, alertUrgency, describeAlert, type AlertTone } from "../../lib/alerts";
import { TONE_STYLES } from "./AlertGauge";
import { CLIENT_HASH_PREFIX, clientDisplayName } from "./ClientsSection";
import type { Client, AdvisorProfile } from "../../models/Advisor";

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
      {client.currency && (
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-[#F7F5EF] text-[#78716c]">
          {client.currency}
        </span>
      )}
    </div>
  );
}

// How many alerts the dashboard lists before pointing to the Clients section for the rest.
const CLIENT_ALERTS_SHOWN = 6;

const BAR_COLOR: Record<AlertTone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-red-500",
  muted: "bg-slate-300",
};

/**
 * CLIENT ALERTS — every alert the advisor set on their clients' portfolios, the most pressing
 * first (triggered, then closest to the threshold), each with how far along it is. A row opens that
 * client in the Clients section, where the alerts are managed. Refreshed every minute, since the
 * backend re-checks the rules about every 5 minutes.
 */
function ClientAlertsCard({
  clients,
  onNavigate,
}: {
  clients: Client[];
  onNavigate?: (section: string) => void;
}) {
  const { rules, loading, error } = useClientAlertRules(60_000);
  const byUuid = new Map(clients.map((c) => [c.uuid, c]));
  const sorted = [...(rules ?? [])]
    .filter((r) => byUuid.has(r.clientUuid))
    .sort((a, b) => alertUrgency(b) - alertUrgency(a));
  const triggered = sorted.filter((r) => alertState(r).tone === "danger").length;
  const watchedClients = new Set(sorted.map((r) => r.clientUuid)).size;

  const openClient = (uuid?: string) => {
    if (!onNavigate) return;
    if (uuid) {
      window.history.replaceState(
        null, "", `${window.location.pathname}${window.location.search}${CLIENT_HASH_PREFIX}${encodeURIComponent(uuid)}`,
      );
    }
    onNavigate("clients");
  };

  return (
    <div className="bg-white rounded-[1.75rem] border border-[rgba(196,154,60,0.2)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold text-[#1c1917] flex items-center gap-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Client alerts
            {triggered > 0 && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${TONE_STYLES.danger.chip}`} style={{ fontFamily: "inherit" }}>
                {triggered} triggered
              </span>
            )}
          </h2>
          {sorted.length > 0 && (
            <p className="text-xs text-[#78716c] mt-0.5">
              {sorted.length} {sorted.length === 1 ? "alert" : "alerts"} on {watchedClients} {watchedClients === 1 ? "client" : "clients"} · checked about every 5 minutes
            </p>
          )}
        </div>
        {onNavigate && sorted.length > 0 && (
          <button
            onClick={() => openClient()}
            className="flex items-center gap-1 text-xs font-bold text-[#C49A3C] hover:text-[#d4aa4c] transition-colors"
          >
            Manage in Clients <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#C49A3C]" />
        </div>
      ) : error ? (
        <p className="text-sm text-[#78716c] py-4">Unable to load your clients&apos; alerts.</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 py-4">
          <div className="w-11 h-11 rounded-2xl bg-[#1c1917] flex items-center justify-center shrink-0">
            <BellRing className="w-5 h-5 text-[#C49A3C]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-[#1c1917]">No alerts on your clients yet</p>
            <p className="text-xs text-[#78716c] mt-0.5">
              Open a client to be told when their portfolio moves by a set amount, or when a single holding grows past a share you choose.
            </p>
          </div>
          {onNavigate && clients.length > 0 && (
            <button
              onClick={() => openClient()}
              className="px-4 py-2 bg-[#1c1917] text-white rounded-xl text-xs font-bold hover:bg-[#C49A3C] transition-colors self-start sm:self-auto"
            >
              Set up alerts
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-[rgba(196,154,60,0.1)]">
          {sorted.slice(0, CLIENT_ALERTS_SHOWN).map((rule) => {
            const client = byUuid.get(rule.clientUuid)!;
            const name = clientDisplayName(client);
            const state = alertState(rule);
            const figures = alertFigures(rule);
            const { title } = describeAlert(rule, name);
            return (
              <li key={rule.ruleId}>
                <button
                  onClick={() => openClient(rule.clientUuid)}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-[#F7F5EF]/60 rounded-xl px-2 -mx-2 transition-colors"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#1c1917] flex items-center justify-center font-bold text-[#C49A3C] text-xs shrink-0">
                    {((client.first_name?.[0] ?? "") + (client.last_name?.[0] ?? "")).toUpperCase() || client.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-bold text-[#1c1917] truncate">{name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TONE_STYLES[state.tone].chip}`}>
                        {state.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#78716c] truncate">{title}</p>
                    {state.progressPct !== null && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 flex-1 max-w-56 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${BAR_COLOR[state.tone]}`}
                            style={{ width: `${Math.max(2, Math.min(100, state.progressPct))}%` }}
                          />
                        </div>
                        {figures && (
                          <span className="text-[11px] font-bold text-[#78716c] whitespace-nowrap">
                            {figures.current} / {figures.limit}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#a8a29e] shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {sorted.length > CLIENT_ALERTS_SHOWN && onNavigate && (
        <p className="text-xs text-[#78716c] pt-3">
          {sorted.length - CLIENT_ALERTS_SHOWN} more in the Clients section.
        </p>
      )}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [cls, profile] = await Promise.all([
          advisorService.getClients(),
          advisorService.getAdvisorProfile(),
        ]);
        setClients(cls);
        setAdvisorProfile(profile);
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
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // AUM: prefer advisor-set value; fallback to sum of client wealth
  const totalAum =
    advisorProfile?.aum != null
      ? advisorProfile.aum
      : clients.reduce((sum, c) => sum + (c.estimated_wealth ?? 0), 0);

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
          {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1
          className="text-3xl font-bold text-[#1c1917]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-[#78716c] mt-1">Here&apos;s a summary of your activity.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard
          label="Clients managed"
          value={clients.length}
          sub={clients.length === 1 ? "registered client" : "registered clients"}
          icon={<Users className="w-5 h-5 text-[#C49A3C]" />}
          iconBg="bg-[#C49A3C]/10"
        />
        <StatCard
          label="Assets under management"
          value={totalAum > 0 ? formatCurrency(totalAum) : "—"}
          sub={advisorProfile?.aum != null ? "declared value" : "sum of client assets"}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Active plan"
          value={
            <span className="flex items-center gap-2">
              Free
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#F7F5EF] text-[#78716c] uppercase tracking-wider">
                Basic plan
              </span>
            </span>
          }
          sub="Upgrade for advanced AI models"
          icon={<Crown className="w-5 h-5 text-[#C49A3C]" />}
          iconBg="bg-[#C49A3C]/10"
          accent
        />
      </div>

      <ClientAlertsCard clients={clients} onNavigate={onNavigate} />

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent clients */}
        <div className="xl:col-span-2 bg-white rounded-[1.75rem] border border-[rgba(196,154,60,0.2)] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-bold text-[#1c1917]"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Recent clients
            </h2>
            {onNavigate && (
              <button
                onClick={() => onNavigate("clients")}
                className="flex items-center gap-1 text-xs font-bold text-[#C49A3C] hover:text-[#d4aa4c] transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {recentClients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#1c1917] flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-[#C49A3C]" />
              </div>
              <p className="text-sm font-bold text-[#1c1917] mb-1">No clients yet</p>
              <p className="text-xs text-[#78716c] mb-4">Add your first client to get started.</p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("clients")}
                  className="px-4 py-2 bg-[#1c1917] text-white rounded-xl text-xs font-bold hover:bg-[#C49A3C] transition-colors"
                >
                  Add Client
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
          {/* Upgrade CTA */}
          <div className="bg-[#1c1917] rounded-[1.75rem] p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#C49A3C]/15 blur-2xl rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#C49A3C]" />
                <p className="text-[9px] font-black uppercase tracking-widest text-[#C49A3C]">Pro Version</p>
              </div>
              <p className="text-sm font-medium text-[#a8a29e] leading-tight mb-4">
                Advanced AI models for your clients.
              </p>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("settings")}
                  className="w-full py-2.5 bg-[#C49A3C] text-[#131210] rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#d4aa4c] transition-colors"
                >
                  Discover Pro
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
