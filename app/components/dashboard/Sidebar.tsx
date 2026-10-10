"use client";

import { LayoutDashboard, Settings, Receipt, ChevronRight, Sparkles, Users, TrendingUp, Newspaper, Compass, Map as MapIcon, PieChart, BookOpen } from "lucide-react";
import { PreviewBadge } from "../preview/PreviewKit";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { useDashboardEntry } from "../../lib/dashboardHistory";
import { EXPLORE_SECTION, JOURNAL_SECTION, PLAN_SECTION, WEALTH_SECTION } from "../../lib/dashboardNav";
import { portfolioColorMap } from "../../lib/chartColors";
import { ALL_WALLETS, WALLET_OPTIONS } from "../preview/WalletPages";
import { PLAN_PAGE_LABELS, planPages } from "./PlanSection";
import { UserRole, SubscriptionTier } from "../../models/User";

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  // Opens a section on one of its pages (a row under it: a portfolio, Plan's Goals…).
  onOpenPage?: (section: string, view: unknown) => void;
  isOpen?: boolean;
  onClose?: () => void;
  role?: UserRole;
  subscriptionTier?: SubscriptionTier | null;
}

// A row under a section: one of its pages. `active`: the page open now. `depth`: 1 for a row
// under another (a portfolio under All portfolios), with `color` its dot.
type SubItem = { key: string; label: string; view: unknown; active: boolean; preview?: boolean; depth?: number; color?: string };
// `preview`: a feature shown on sample data, not available yet (see components/preview).
type NavItem = { id: string; label: string; icon: typeof LayoutDashboard; preview?: boolean; subs?: SubItem[] };

export function Sidebar({ activeSection, setActiveSection, onOpenPage, isOpen = false, onClose, role, subscriptionTier }: SidebarProps) {
  const isAdvisor = role === 'ADVISOR';
  // The previews of what's coming (Wallets, Plan's profile…) are for demo accounts only (see lib/demo).
  const { isDemo } = useUser();
  const { portfolios } = usePortfolio();
  // Which page the open section is on, to mark its row.
  const entry = useDashboardEntry();
  const view = (entry?.section === activeSection ? entry.view : undefined) as
    { kind?: string; uuid?: string; id?: string; page?: string } | undefined;

  // Investor: the sections, and under the open one its pages. Under Wealth, what it's made of:
  // All portfolios and each real portfolio under it (only the portfolios while Wealth opens on
  // All portfolios itself), then for a demo account the wallets and the real estate (previews).
  const colorOf = portfolioColorMap(portfolios);
  const aggregate = portfolios.find((p) => p.isAggregate);
  const real = portfolios.filter((p) => !p.isVirtual).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const portfolioRow = (p: (typeof portfolios)[number], depth: number): SubItem => ({
    key: p.uuid,
    label: p.name,
    view: { kind: 'portfolio', uuid: p.uuid, page: 'overview' },
    active: view?.kind === 'portfolio' && view.uuid === p.uuid,
    depth,
    color: p.isAggregate ? undefined : colorOf(p.uuid),
  });
  const walletRows: SubItem[] = isDemo ? [
    { key: ALL_WALLETS, label: 'Wallets', view: { kind: 'wallet', id: ALL_WALLETS, page: 'insights' }, active: view?.kind === 'wallet' && view.id === ALL_WALLETS, preview: true },
    ...WALLET_OPTIONS.filter((w) => w.id !== ALL_WALLETS).map((w) => ({
      key: w.id,
      label: w.name,
      view: { kind: 'wallet', id: w.id, page: 'insights' },
      active: view?.kind === 'wallet' && view.id === w.id,
      depth: 1,
      color: w.color,
    })),
    { key: 'real-estate', label: 'Real estate', view: { kind: 'realEstate', page: 'home' }, active: view?.kind === 'realEstate', preview: true },
  ] : [];
  const wealthRows: SubItem[] = isDemo
    ? [...(aggregate ? [portfolioRow(aggregate, 0)] : []), ...real.map((p) => portfolioRow(p, aggregate ? 1 : 0)), ...walletRows]
    : real.length > 1 ? real.map((p) => portfolioRow(p, 0)) : [];
  const planRows: SubItem[] = planPages(isDemo).map((page) => ({
    key: page,
    label: PLAN_PAGE_LABELS[page],
    view: { page },
    // Strategy's form for a new backtest, each backtest and Explore are under Strategy.
    active: view?.page === page || (page === 'strategy' && (view?.page === 'builder' || view?.page === 'backtest' || view?.page === 'explore')),
    preview: page !== 'strategy',
  }));

  const investorItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: WEALTH_SECTION, label: 'Wealth', icon: PieChart, subs: wealthRows },
    { id: PLAN_SECTION, label: 'Plan', icon: MapIcon, subs: planRows },
    { id: 'news', label: 'News', icon: Newspaper },
    ...(isDemo ? [{ id: JOURNAL_SECTION, label: 'Journal', icon: BookOpen, preview: true }] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // Advisors pick a client's portfolio per screen instead (see useClientDefaultPortfolio).
  const consultantItems: NavItem[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'upload', label: 'Transactions', icon: Receipt },
    { id: 'performance', label: 'Insights', icon: TrendingUp },
    // The strategies catalog (an investor's is under Plan's Strategy).
    { id: EXPLORE_SECTION, label: 'Explore', icon: Compass },
    { id: 'news', label: 'News', icon: Newspaper },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveSection(id);
    if (onClose) onClose();
  };

  const handleSubClick = (section: string, sub: SubItem) => {
    onOpenPage?.(section, sub.view);
    if (onClose) onClose();
  };

  const renderItem = (item: NavItem) => {
    const isActive = activeSection === item.id;
    const subs = isActive && onOpenPage ? item.subs ?? [] : [];
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
          {isActive && <ChevronRight className="h-4 w-4 opacity-50" />}
        </button>
        {subs.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1 mb-2 ml-6 pl-3 border-l border-white/10">
            {subs.map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={() => handleSubClick(item.id, sub)}
                aria-current={sub.active ? "page" : undefined}
                className={`flex items-center gap-2 min-h-9 px-3 rounded-lg text-left text-[13px] transition-colors ${sub.depth ? "pl-6 text-[12.5px]" : ""} ${
                  sub.active ? "bg-white/10 text-white font-bold" : "text-[#a8a29e] font-medium hover:text-white hover:bg-white/5"
                }`}
              >
                {sub.color && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: sub.color }} />}
                <span className="truncate">{sub.label}</span>
                {sub.preview && <PreviewBadge dark />}
              </button>
            ))}
          </div>
        )}
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
