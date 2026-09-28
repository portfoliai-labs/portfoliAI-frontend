"use client";

import { useSectionTrail } from "./SectionTrail";
import { LayoutDashboard, Briefcase, Settings, Receipt, ChevronRight, Sparkles, Users, TrendingUp, Newspaper, Wallet } from "lucide-react";
import { PreviewBadge } from "../preview/PreviewKit";
import { useUser } from "../../context/UserContext";
import { UserRole, SubscriptionTier } from "../../models/User";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

// `preview`: a feature shown on sample data, not available yet (see components/preview).
type NavItem = { id: string; label: string; icon: typeof LayoutDashboard; preview?: boolean };

export function Sidebar({ activeSection, setActiveSection, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const isAdvisor = role === 'ADVISOR';
  // The previews of what's coming (Wallets…) are for demo accounts only (see lib/demo).
  const { isDemo } = useUser();

  // Investor: "which page" only. Which portfolio is picked on the pages themselves: Portfolios
  // opens on a hub of them, each with its own Insights, Transactions, Reports and Alerts.
  const investorItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'performance', label: 'Investments', icon: Briefcase },
    ...(isDemo ? [{ id: 'wallets', label: 'Wallets', icon: Wallet, preview: true }] : []),
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Advisors pick a client's portfolio per screen instead (see useClientDefaultPortfolio).
  const consultantItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'upload', label: 'Transactions', icon: Receipt },
    { id: 'performance', label: 'Insights', icon: TrendingUp },
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  // The page open inside the active section, if it's not the section's first (see SectionTrail).
  const { trail } = useSectionTrail();

  const goToCrumb = (index: number) => {
    trail?.go(index);
    if (onClose) onClose();
  };

  /**
   * The trail under its section's entry: one row per page below the section (labels[0] is the
   * section itself, the entry above), each indented a step further, the current page last and
   * highlighted. The rows above it lead back to their page.
   */
  const renderTrail = () => {
    if (!trail) return null;
    const rows = [...trail.labels.slice(1).map((label, i) => ({ label, index: i + 1 })), { label: trail.current, index: -1 }];
    return (
      <div className="flex flex-col gap-0.5 mt-1 mb-1">
        {rows.map((row, depth) => {
          const isCurrent = row.index === -1;
          return (
            <button
              key={`${depth}-${row.label}`}
              type="button"
              onClick={isCurrent ? undefined : () => goToCrumb(row.index)}
              aria-current={isCurrent ? "page" : undefined}
              style={{ marginLeft: `${1.25 + depth * 0.875}rem` }}
              className={`flex items-center gap-2.5 rounded-lg pl-3 pr-3 py-2 text-left border-l-2 transition-colors ${
                isCurrent
                  ? "border-[#C49A3C] text-white bg-white/5 cursor-default"
                  : "border-white/10 text-[#a8a29e] hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="text-[13px] font-semibold truncate">{row.label}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeSection === item.id;
    return (
      <div key={item.id} className="flex flex-col">
        <button
          onClick={() => handleNavClick(item.id)}
          className={`group relative flex items-center justify-between rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] px-4 py-3 ${
            isActive
              ? "bg-[#C49A3C]/15 text-[#C49A3C] border border-[#C49A3C]/30"
              : "text-[#a8a29e] hover:bg-white/5 hover:text-white border border-transparent"
          }`}
        >
          <div className="flex items-center gap-3">
            <item.icon className={`h-5 w-5 transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
            <span className="text-sm">{item.label}</span>
            {item.preview && <PreviewBadge dark />}
          </div>
          {isActive && <ChevronRight className={`h-4 w-4 opacity-50 transition-transform ${trail ? "rotate-90" : ""}`} />}
        </button>
        {isActive && renderTrail()}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-40
        w-72 bg-[#1c1917]
        flex flex-col h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${isOpen ? "pointer-events-auto" : "pointer-events-none lg:pointer-events-auto"}
      `}>

        <nav className="flex flex-col gap-1 p-5 pt-[100px] flex-1 overflow-y-auto custom-scrollbar">
          {(isAdvisor ? consultantItems : investorItems).map((item) => renderItem(item))}
        </nav>

        {/* Nothing to upgrade for a tester, nor for a demo account (see lib/demo). */}
        {subscriptionTier !== 'TESTER' && subscriptionTier !== 'DEMO' && (
          <div className="p-5 border-t border-white/10">
            <div className="bg-[#131210] p-5 rounded-[1.5rem] border border-[#C49A3C]/20 text-white relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#C49A3C]/10 blur-2xl rounded-full" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-[#C49A3C]" />
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#C49A3C]">Pro Version</p>
                </div>
                <p className="text-[13px] font-medium text-[#a8a29e] leading-tight mb-4">
                  Unlock unlimited analysis and a more advanced AI model.
                </p>
                <button
                  onClick={() => handleNavClick('settings')}
                  className="w-full py-2.5 bg-[#C49A3C] text-[#131210] rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-[#d4aa4c] transition-colors"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
