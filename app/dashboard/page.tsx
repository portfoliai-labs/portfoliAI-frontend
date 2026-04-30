"use client";

import { useState } from "react";
import { useProtectedRoute } from "../hooks/useProtectedRoute";
import { DashboardHeader } from "../components/dashboard/DashboardHeader";
import { Sidebar } from "../components/dashboard/Sidebar";
import { FileUploader } from "../components/dashboard/FileUploader";
import { SettingsSection } from "../components/dashboard/SettingsSection";
import { ReportsList } from "../components/dashboard/ReportsList";
import DashboardOverview from "../components/dashboard/DashboardOverview";
import SubscriptionSection from "../components/dashboard/SubscriptionSection";

export default function DashboardPage() {
  const { isAuthorized, handleLogout } = useProtectedRoute();
  
  // States to manage the active view and the mobile sidebar toggle
  const [activeSection, setActiveSection] = useState('upload');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (!isAuthorized) return <div className="min-h-screen bg-slate-50" />;

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard': 
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
  };

  return (
    <div className="min-h-screen bg-white flex flex-col selection:bg-blue-100 selection:text-blue-900">
      
      {/* Header with hamburger menu toggle passed as props */}
      <DashboardHeader 
        onLogout={handleLogout} 
        isMenuOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        
        {/* Sidebar controlled by the mobile state */}
        <Sidebar 
          activeSection={activeSection} 
          setActiveSection={setActiveSection} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        {/* Main content area - optimized padding for mobile (p-4) and desktop (md:p-12) */}
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white p-4 md:p-12">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}