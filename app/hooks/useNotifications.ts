"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  notificationService,
  type NotificationResponse,
} from "../services/notificationService";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export type { NotificationResponse };

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // ── Load full history from REST ────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await notificationService.listNotifications();
      setNotifications(items);
      setHasUnread(items.some((n) => n.read_at === null));
    } catch (err) {
      console.error("[useNotifications] Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Mark all currently-unread notifications as read ───────────────────────
  const markAllRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.read_at === null);
    if (unread.length === 0) return;

    // Optimistic update
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n))
    );
    setHasUnread(false);

    // Fire-and-forget — don't block the UI
    await Promise.allSettled(
      unread.map((n) => notificationService.markAsRead(n.notification_id))
    );
  }, [notifications]);

  const dismissAll = useCallback(() => {
    setNotifications([]);
    setHasUnread(false);
  }, []);

  // ── SSE — keeps hasUnread in sync in real-time ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      try {
        const ticket = await notificationService.getTicket();
        if (cancelled) return;

        const url = `${API_BASE_URL}/notifications/stream?ticket=${encodeURIComponent(ticket)}`;
        console.info("[useNotifications] Connecting to SSE with ticket");

        const es = new EventSource(url);
        esRef.current = es;

        es.onopen = () => console.info("[useNotifications] SSE connection opened");

        const handleEvent = () => {
          // A new event arrived: mark badge as unread and let the panel
          // refresh from REST when it opens next time.
          setHasUnread(true);
          // If the panel is already open (notifications loaded), reload silently.
          setNotifications((prev) => {
            if (prev.length > 0) {
              // Trigger a background refresh without blocking render
              notificationService
                .listNotifications()
                .then(setNotifications)
                .catch(() => undefined);
            }
            return prev;
          });
        };

        es.onmessage = handleEvent;
        es.addEventListener("notification", handleEvent);

        es.onerror = (e) => {
          console.error("[useNotifications] SSE error. readyState:", es.readyState, e);
          es.close();
        };
      } catch (err) {
        console.error("[useNotifications] Failed to obtain ticket:", err);
      }
    }

    connect();

    const handleUnauthorized = () => esRef.current?.close();
    window.addEventListener("auth-unauthorized", handleUnauthorized);

    return () => {
      cancelled = true;
      esRef.current?.close();
      window.removeEventListener("auth-unauthorized", handleUnauthorized);
    };
  }, []);

  // ── Init: check for unread count on mount ────────────────────────────────
  useEffect(() => {
    notificationService
      .listNotifications(true)
      .then((items) => {
        if (items.length > 0) setHasUnread(true);
      })
      .catch(() => undefined);
  }, []);

  return {
    notifications,
    hasUnread,
    isLoading,
    loadNotifications,
    markAllRead,
    dismissAll,
  };
}
