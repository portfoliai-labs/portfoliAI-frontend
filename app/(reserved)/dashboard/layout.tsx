// app/(reserved)/dashboard/layout.tsx
"use client";

import React from "react";
import { NotificationsProvider } from "../../context/NotificationsContext";

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
    <NotificationsProvider>
      <div className="dashboard-container">
        {children}
      </div>
    </NotificationsProvider>
  );
}