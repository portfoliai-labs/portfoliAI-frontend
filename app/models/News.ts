// models/News.ts
// Matches NewsItemResponse (GET /v1/news/) — news for a given calendar month, or for today
// when no month is requested. As of the live schema checked 2026-09-09, the backend does not
// yet return an image for a story — `imageUrl` is modeled defensively (optional, not just
// nullable) so the UI starts rendering real photos the moment it's added, with no code change
// needed here. Until then — and for any story whose image URL 404s/fails to load — NewsSection
// falls back to a generated placeholder derived from `topic`/`title` (see themeFor there).

interface NewsItem {
  topic: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  url: string | null;
  source: string | null;
  imageUrl?: string | null;
}

export type { NewsItem };
