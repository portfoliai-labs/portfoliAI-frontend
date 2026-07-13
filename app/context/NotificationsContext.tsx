"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useNotifications } from "../hooks/useNotifications";
import type { NotificationResponse } from "../services/notificationService";

interface NotificationsContextType {
  notifications: NotificationResponse[];
  hasUnread: boolean;
  isLoading: boolean;
  loadNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  dismissAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

// Single shared SSE connection + notification list for the whole (reserved)/dashboard
// subtree, so components other than the header (e.g. FileUploader) can react to
// job-status events without opening a second EventSource.
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotifications();
  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotificationsContext(): NotificationsContextType {
  const ctx = useContext(NotificationsContext);
  if (ctx === undefined) {
    throw new Error("useNotificationsContext must be used within a NotificationsProvider");
  }
  return ctx;
}
