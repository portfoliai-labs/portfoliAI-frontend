// app/(reserved)/dashboard/page.tsx
"use client";

import { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "../../context/UserContext";
import { usePortfolio } from "../../context/PortfolioContext";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { FileUploader } from "../../components/dashboard/FileUploader";
import { ProfileSection } from "../../components/dashboard/ProfileSection";
import { AdvisorProfileSection } from "../../components/dashboard/AdvisorProfileSection";
import { ReportsList } from "../../components/dashboard/ReportsList";
import { ClientsSection } from "../../components/dashboard/ClientsSection";
import { AdvisorUploadSection } from "../../components/dashboard/AdvisorUploadSection";
import { AdvisorReportsList } from "../../components/dashboard/AdvisorReportsList";
import { AdvisorPerformanceSection } from "../../components/dashboard/AdvisorPerformanceSection";
import DashboardOverview from "../../components/dashboard/DashboardOverview";
import AdvisorDashboardOverview from "../../components/dashboard/AdvisorDashboardOverview";
import { SettingsSection } from "../../components/dashboard/SettingsSection";
import { NotificationsSection } from "../../components/dashboard/NotificationsSection";
import { NewsPageSection } from "../../components/dashboard/NewsSection";
import { InsightsSection } from "../../components/dashboard/InsightsSection";
import { Loader2 } from "lucide-react";

// 'reports' and 'profile' are omitted here on purpose: neither investors nor advisors have a
// sidebar entry for them anymore (Reports and Profile are hidden for now, Profile's
// language/currency moved into Settings), so a stale deep link should fall back to overview
// rather than open them.
const VALID_SECTIONS = ['overview', 'clients', 'upload', 'performance', 'news', 'settings', 'notifications'];

/**
 * DashboardPage - Main protected dashboard view.
 * It consumes UserContext to manage profile data and global loading states.
 */
function DashboardPageContent() {
  const { user, loading, logout } = useUser();
  // Only meaningful for role USER (see PortfolioContext) — advisor sections resolve a
  // client's portfolio locally instead, so `current` stays null for an advisor and that's fine.
  const { current: portfolio, loading: portfolioLoading } = usePortfolio();
  const searchParams = useSearchParams();
  // Lets links into the dashboard land on a specific tab via `?section=...` instead of
  // always resetting to overview.
  const requestedSection = searchParams.get('section');

  const [activeSection, setActiveSection] = useState<string>(
    requestedSection && VALID_SECTIONS.includes(requestedSection) ? requestedSection : 'overview'
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  // Bumped when the sidebar picks the section already open, so a section with pages of its own
  // (Insights' hub and what's under it) starts over from its first one, as a fresh visit would.
  const [sectionVisit, setSectionVisit] = useState(0);
  const openSectionFromSidebar = (section: string) => {
    if (section === activeSection) setSectionVisit((n) => n + 1);
    setActiveSection(section);
  };

  const isAdvisor = user?.role === 'ADVISOR';

  const renderContent = useMemo(() => {
    // Every investor-facing case below needs a resolved portfolio; advisor cases never read
    // `portfolio` at all (they resolve a client's own via useClientDefaultPortfolio), so this
    // guard only ever blocks the investor branches while PortfolioContext is still loading.
    if (!isAdvisor && !portfolio) return null;

    switch (activeSection) {
      case 'overview':
        return isAdvisor
          ? <AdvisorDashboardOverview onNavigate={setActiveSection} />
          : <DashboardOverview onNavigate={setActiveSection} />;
      case 'clients':
        return <ClientsSection />;
      case 'upload':
        // Every portfolio at once: the list filters by portfolio, and new rows say where they go.
        return isAdvisor ? <AdvisorUploadSection /> : <FileUploader />;
      case 'reports':
        return isAdvisor ? <AdvisorReportsList /> : <ReportsList portfolioUuid={portfolio!.uuid} />;
      case 'performance':
        return isAdvisor
          ? <AdvisorPerformanceSection />
          : <InsightsSection key={sectionVisit} onNavigate={setActiveSection} />;
      case 'news':
        return <NewsPageSection />;
      case 'profile':
        return isAdvisor ? <AdvisorProfileSection /> : <ProfileSection />;
      case 'settings':
        return <SettingsSection />;
      case 'notifications':
        return <NotificationsSection />;
      default:
        return <DashboardOverview onNavigate={setActiveSection} />;
    }
  }, [activeSection, isAdvisor, portfolio, sectionVisit]);

  if (loading || (!isAdvisor && portfolioLoading)) {
    return (
      <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#C49A3C]" />
          <p className="text-[#78716c] font-medium animate-pulse">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If loading is finished but there is no user, the layout/context 
  // protection will typically handle the redirect.
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F7F5EF] flex flex-col selection:bg-[#C49A3C]/20 selection:text-[#1c1917]">
      <DashboardHeader
        onLogout={logout}
        isMenuOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        subscriptionTier={user.subscription_tier}
        onNavigate={setActiveSection}
      />

      {/* The window scrolls the page (the header above is sticky to it), so nothing between it
          and the content may be a scroll container: one that never scrolls would pin every
          sticky element inside it (Insights' section timeline) in place.
          Hence overflow-x-clip here rather than overflow-hidden, and no overflow on <main>. */}
      <div className="flex flex-1 overflow-x-clip">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={openSectionFromSidebar}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          role={user?.role}
          subscriptionTier={user.subscription_tier}
        />

        <main className="flex-1 min-w-0 lg:ml-72 bg-[#F7F5EF] p-4 md:p-12 transition-all duration-300">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {renderContent}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#C49A3C]" />
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}