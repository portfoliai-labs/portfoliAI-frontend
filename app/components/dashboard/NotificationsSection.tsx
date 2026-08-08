"use client";

import { useEffect } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useNotificationsContext } from "../../context/NotificationsContext";
import { NotificationList } from "./NotificationList";

// Full-page notifications view. On mobile the header bell routes here instead
// of opening NotificationPanel's dropdown, since a fixed-width absolutely
// positioned panel has nowhere to sit without overflowing a narrow viewport.
export function NotificationsSection() {
  const {
    notifications,
    isLoading,
    loadNotifications,
    markAllRead,
    dismissAll,
  } = useNotificationsContext();

  useEffect(() => {
    loadNotifications().then((items) => markAllRead(items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2
            className="text-2xl md:text-3xl font-bold text-[#1c1917] tracking-tight flex items-center gap-2.5"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            <Bell className="w-6 h-6 text-[#C49A3C]" />
            Notifications
            {unreadCount > 0 && (
              <span className="text-xs font-bold bg-[#C49A3C] text-white rounded-full px-2 py-0.5 leading-none">
                {unreadCount}
              </span>
            )}
          </h2>
          <p className="text-sm md:text-base text-[#78716c] font-medium mt-1">
            Report job updates and account alerts
          </p>
        </div>

        {notifications.length > 0 && (
          <button
            onClick={dismissAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#a8a29e] hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear all
          </button>
        )}
      </div>

      <div className="bg-white border border-[rgba(196,154,60,0.2)] rounded-[1.5rem] shadow-sm overflow-hidden">
        <NotificationList notifications={notifications} isLoading={isLoading} />
      </div>
    </div>
  );
}
