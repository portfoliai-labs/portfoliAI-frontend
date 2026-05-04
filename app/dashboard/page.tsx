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
  // Authorization hook to handle session and logout logic
  const { isAuthorized, handleLogout } = useProtectedRoute();
  
  // States to manage current navigation section and mobile sidebar visibility
  const [activeSection, setActiveSection] = useState('upload');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Prevent rendering content if the user is not authorized
  if (!isAuthorized) return <div className="min-h-screen bg-slate-50" />;

  /**
   * Content Switcher:
   * Returns the appropriate component based on the active sidebar selection.
   */
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
      
      {/* 
        Fixed Dashboard Header: 
        Passes logout logic and the hamburger menu toggle for mobile devices. 
      */}
      <DashboardHeader 
        onLogout={handleLogout} 
        isMenuOpen={isSidebarOpen}
        onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        
        {/* 
          Fixed Sidebar:
          - Logic for navigation state management.
          - Mobile overlay and drawer toggle functionality.
        */}
        <Sidebar 
          activeSection={activeSection} 
          setActiveSection={setActiveSection} 
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        {/* 
          Main Content Area:
          - IMPORTANT: Added 'lg:ml-72' to create space for the fixed Sidebar on desktop.
          - 'overflow-y-auto' ensures the main content area scrolls independently.
          - Uses a subtle radial gradient for a modern UI look.
        */}
        <main className="flex-1 overflow-y-auto lg:ml-72 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-50/50 via-white to-white p-4 md:p-12 transition-all duration-300">
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}