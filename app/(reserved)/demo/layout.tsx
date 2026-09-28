// app/(reserved)/demo/layout.tsx
"use client";

import React from "react";
import { NotificationsProvider } from "../../context/NotificationsContext";
import { PortfolioProvider } from "../../context/PortfolioContext";

/**
 * DashboardLayout component
 * Same providers as /dashboard: the demo dashboard is the same app (see lib/demo).
 * The UserProvider is inherited from the parent (reserved) layout.
 * * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 */
interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DemoLayout({ children }: DashboardLayoutProps) {
  return (
    <PortfolioProvider>
      <NotificationsProvider>
        <div className="dashboard-container">
          {children}
        </div>
      </NotificationsProvider>
    </PortfolioProvider>
  );
}