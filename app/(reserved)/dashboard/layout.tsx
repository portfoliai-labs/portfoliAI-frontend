// app/(reserved)/dashboard/layout.tsx
"use client";

import React from "react";

/**
 * DashboardLayout component
 * This layout wraps all routes under /dashboard.
 * The UserProvider is inherited from the parent (reserved) layout.
 * * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="dashboard-container">
      {/* You can add dashboard-wide components here, 
          like a persistent global notification bar 
      */}
      {children}
    </div>
  );
}