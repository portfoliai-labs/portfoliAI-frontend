// app/(reserved)/dashboard/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useUser } from "../../context/UserContext";
import { DashboardHeader } from "../../components/dashboard/DashboardHeader";
import { Sidebar } from "../../components/dashboard/Sidebar";
import { FileUploader } from "../../components/dashboard/FileUploader";
import { SettingsSection } from "../../components/dashboard/SettingsSection";
import { ReportsList } from "../../components/dashboard/ReportsList";
import DashboardOverview from "../../components/dashboard/DashboardOverview";
import SubscriptionSection from "../../components/dashboard/SubscriptionSection";
import { Loader2 } from "lucide-react";

/**
 * DashboardPage - Main protected dashboard view.
 * It consumes UserContext to manage profile data and global loading states.
 */
export default function DashboardPage() {
  const { user, loading, logout } = useUser();
  
  const [activeSection, setActiveSection] = useState<string>('upload');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  /**
   * Component switcher based on the active sidebar section.
   * Uses useMemo for a slight performance optimization during re-renders.
   */
  const renderContent = useMemo(() => {
    switch (activeSection) {
      case 'overview':
        return <DashboardOverview />;
      case 'upload':
        return <FileUploader />;
      case 'reports':
        return <ReportsList />;
      case 'settings':
        return <SettingsSection />;
      case 'subscription':
        return <SubscriptionSection />;
      default:
        return <DashboardOverview />;
    }
  }, [activeSection]);

  if (loading) {
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
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeSection={activeSection}
          setActiveSection={setActiveSection}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          role={user?.role}
        />

        <main className="flex-1 overflow-y-auto lg:ml-72 bg-[#F7F5EF] p-4 md:p-12 transition-all duration-300">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {renderContent}
          </div>
        </main>
      </div>
    </div>
  );
}