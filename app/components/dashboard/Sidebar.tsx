"use client";

import { LayoutDashboard, Settings, Receipt, ChevronRight, Sparkles, Users, TrendingUp, Newspaper } from "lucide-react";
import { UserRole, SubscriptionTier } from "../../models/User";
import { PortfolioSwitcher } from "./PortfolioSwitcher";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

// Sections that belong to the portfolio selected in the sidebar; everything else (Dashboard,
// News, Settings) is the same whichever portfolio is selected.
const PORTFOLIO_SECTIONS = ['upload', 'performance'];

type NavItem = { id: string; label: string; icon: typeof LayoutDashboard };

export function Sidebar({ activeSection, setActiveSection, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const isAdvisor = role === 'ADVISOR';

  // Investor: Dashboard on top, then the portfolio group (switcher + that portfolio's pages),
  // then the sections that aren't about any one portfolio.
  const investorTop: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  ];
  const investorPortfolioItems: NavItem[] = [
    { id: 'performance', label: 'Insights', icon: TrendingUp },
    { id: 'upload', label: 'Transactions', icon: Receipt },
  ];
  const investorBottom: NavItem[] = [
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Advisors pick a client's portfolio per screen instead (see useClientDefaultPortfolio), so
  // their menu stays flat.
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

  // Picking a portfolio from a section that isn't about one opens that portfolio's Insights;
  // from Insights/Transactions it just swaps the portfolio in place.
  const handlePortfolioSelect = () => {
    if (!PORTFOLIO_SECTIONS.includes(activeSection)) handleNavClick('performance');
  };

  const renderItem = (item: NavItem, nested = false) => {
    const isActive = activeSection === item.id;
    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item.id)}
        className={`group relative flex items-center justify-between rounded-xl font-semibold transition-all duration-200 active:scale-[0.98] ${
          nested ? "px-4 py-2.5" : "px-4 py-3"
        } ${
          isActive
            ? "bg-[#C49A3C]/15 text-[#C49A3C] border border-[#C49A3C]/30"
            : "text-[#a8a29e] hover:bg-white/5 hover:text-white border border-transparent"
        }`}
      >
        <div className="flex items-center gap-3">
          <item.icon className={`${nested ? "h-4 w-4" : "h-5 w-5"} transition-transform duration-200 ${isActive ? "" : "group-hover:scale-110"}`} />
          <span className="text-sm">{item.label}</span>
        </div>
        {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
      </button>
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
          {isAdvisor ? consultantItems.map((item) => renderItem(item)) : (
            <>
              {investorTop.map((item) => renderItem(item))}

              {/* The selected portfolio and its own pages. The switcher's dropdown is
                  absolutely positioned, so it opens over the items below it. */}
              <div className="mt-5 mb-1 px-1">
                <p className="px-3 mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#78716c]">Portfolio</p>
                <PortfolioSwitcher onSelect={handlePortfolioSelect} />
              </div>
              <div className="flex flex-col gap-1 ml-4 pl-3 border-l border-white/10">
                {investorPortfolioItems.map((item) => renderItem(item, true))}
              </div>

              <div className="my-4 border-t border-white/10" />
              {investorBottom.map((item) => renderItem(item))}
            </>
          )}
        </nav>

        {subscriptionTier !== 'TESTER' && (
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
