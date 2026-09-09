// app/hooks/useNews.ts
"use client";

import { useEffect, useState } from "react";
import { newsService } from "../services/newsService";
import type { NewsItem } from "../models/News";

// Fetches news for a given calendar month (year+month), or today's news when both are
// omitted — re-fetches whenever year/month/limit change.
export function useNews(year?: number, month?: number, limit?: number) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await newsService.getNews(year, month, limit);
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load news");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, limit]);

  return { items, loading, error };
}
