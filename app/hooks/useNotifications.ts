"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export function useNotifications() {
  const [hasUnread, setHasUnread] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const clearNotifications = useCallback(() => {
    setHasUnread(false);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;

    const url = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = () => {
      setHasUnread(true);
    };

    // Named events (in case server uses `event: notification`)
    es.addEventListener("notification", () => {
      setHasUnread(true);
    });

    es.onerror = () => {
      es.close();
    };

    const handleUnauthorized = () => {
      es.close();
    };
    window.addEventListener("auth-unauthorized", handleUnauthorized);

    return () => {
      es.close();
      window.removeEventListener("auth-unauthorized", handleUnauthorized);
    };
  }, []);

  return { hasUnread, clearNotifications };
}
