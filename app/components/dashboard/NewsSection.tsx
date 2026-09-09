// components/dashboard/NewsSection.tsx
"use client";

import { useState } from "react";
import {
  Loader2, AlertCircle, ChevronLeft, ChevronRight, ExternalLink,
  Newspaper, TrendingUp, Globe2, LineChart, Landmark, Coins,
} from "lucide-react";
import { useNews } from "../../hooks/useNews";
import type { NewsItem } from "../../models/News";

/**
 * NEWS SECTION — shared building blocks for showing market news, used by both the Dashboard
 * Overview (NewsCarouselModule, today only, one story at a time) and the Insights section
 * (NewsModule, today's or a given month's stories as a grid). Each card shows the backend's
 * `imageUrl` when the story has one; otherwise (or if that URL fails to load) it falls back to
 * a stylized placeholder derived from the story's own topic/title (see themeFor below).
 */

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// PLACEHOLDER THEMES — a fixed palette of brand-consistent gradients + icon, picked
// deterministically per story (same topic/title always renders the same card art) rather than
// randomly, so a re-render or refetch doesn't make cards flicker between looks.
const PLACEHOLDER_THEMES: { gradient: string; icon: typeof Newspaper }[] = [
  { gradient: "linear-gradient(135deg, #C49A3C 0%, #8A6A28 100%)", icon: TrendingUp },
  { gradient: "linear-gradient(135deg, #1e293b 0%, #475569 100%)", icon: Newspaper },
  { gradient: "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)", icon: Globe2 },
  { gradient: "linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)", icon: LineChart },
  { gradient: "linear-gradient(135deg, #b45309 0%, #78350f 100%)", icon: Landmark },
  { gradient: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)", icon: Coins },
];

// Dashboard carousel shows one story at a time (paging through the rest), so it only ever
// needs a small buffer; Insights grids show every story at once, so they get a roomier cap.
const DASHBOARD_NEWS_LIMIT = 4;
const INSIGHTS_NEWS_LIMIT = 10;

function themeFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PLACEHOLDER_THEMES[hash % PLACEHOLDER_THEMES.length];
}

/**
 * MODULE / MODULE HEAD — same card shell + header used across DashboardOverview.tsx and
 * PerformanceSection.tsx, kept as its own local copy here (those two files each already carry
 * their own copy rather than sharing one) so this file has no dependency on either.
 */
function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({ eyebrow, title, desc, right }: { eyebrow: string; title: string; desc?: string; right?: React.ReactNode }) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
        <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {title}
        </h2>
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-md leading-relaxed">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * NEWS CARD — grid variant used by NewsModule. Clickable (opens the article in a new tab)
 * only when the backend supplied a url; otherwise renders as a plain, non-interactive card
 * rather than a dead link.
 */
function NewsCard({ item }: { item: NewsItem }) {
  const theme = themeFor(item.topic || item.title);
  const Icon = theme.icon;
  const published = item.publishedAt ? dateLabel(item.publishedAt) : null;
  const clickable = !!item.url;
  // Falls back to the placeholder on a missing URL as well as a broken/expired one — `onError`
  // alone only catches the latter.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!item.imageUrl && !imageFailed;

  const inner = (
    <>
      <div
        className="h-28 flex items-center justify-center relative shrink-0 overflow-hidden"
        style={showImage ? undefined : { backgroundImage: theme.gradient }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl!}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-9 w-9 text-white/85" />
        )}
        <span className="absolute top-2.5 left-2.5 text-[9px] font-black uppercase tracking-wider text-white px-2 py-1 rounded-full bg-black/25 backdrop-blur-sm">
          {item.topic}
        </span>
        {clickable && <ExternalLink className="absolute top-2.5 right-2.5 h-3.5 w-3.5 text-white/70" />}
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{item.title}</h3>
        {item.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{item.description}</p>}
        <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto">
          <span className="text-[11px] font-semibold text-slate-400 truncate">{item.source ?? "—"}</span>
          {published && <span className="text-[11px] text-slate-400 shrink-0">{published}</span>}
        </div>
      </div>
    </>
  );

  const className = "flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md hover:border-slate-300 transition-all";

  return clickable ? (
    <a href={item.url!} target="_blank" rel="noreferrer" className={className}>{inner}</a>
  ) : (
    <div className={className}>{inner}</div>
  );
}

function NewsGridBody({ items }: { items: NewsItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400 p-6 md:p-7">No news for this period.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6 md:p-7 pt-5">
      {items.map((item, i) => <NewsCard key={item.url ?? `${item.title}-${i}`} item={item} />)}
    </div>
  );
}

/**
 * NEWS MODULE — Insights variant: a grid of every story for the requested period (today when
 * year/month are both omitted, otherwise that calendar month). Fetches on its own so callers
 * (TodayPage, MonthDetail) don't need to thread news state through their own data loading.
 */
export function NewsModule({ year, month, title, desc }: { year?: number; month?: number; title: string; desc: string }) {
  const { items, loading, error } = useNews(year, month, INSIGHTS_NEWS_LIMIT);

  return (
    <Module>
      <ModuleHead eyebrow="Market News" title={title} desc={desc} />
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
        </div>
      ) : error ? (
        <div className="p-6 md:p-7 flex items-center gap-3 text-rose-600">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      ) : (
        <NewsGridBody items={items} />
      )}
    </Module>
  );
}

/**
 * FEATURED NEWS CARD — the carousel's one-at-a-time layout: bigger placeholder art alongside
 * the full title/description/meta, rather than the compact grid card above.
 */
function FeaturedNewsCard({ item }: { item: NewsItem }) {
  const theme = themeFor(item.topic || item.title);
  const Icon = theme.icon;
  const published = item.publishedAt ? dateLabel(item.publishedAt) : null;
  const clickable = !!item.url;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!item.imageUrl && !imageFailed;

  const body = (
    <div className="flex flex-col sm:flex-row">
      <div
        className="sm:w-56 h-40 sm:h-auto shrink-0 flex items-center justify-center relative overflow-hidden"
        style={showImage ? undefined : { backgroundImage: theme.gradient }}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl!}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Icon className="h-12 w-12 text-white/85" />
        )}
        <span className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-wider text-white px-2.5 py-1 rounded-full bg-black/25 backdrop-blur-sm">
          {item.topic}
        </span>
      </div>
      <div className="flex-1 p-6 md:p-7 flex flex-col gap-2.5 min-w-0">
        <h3 className="text-lg font-black text-slate-900 leading-snug" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {item.title}
        </h3>
        {item.description && <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>}
        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mt-1">
          {item.source && <span>{item.source}</span>}
          {item.source && published && <span>·</span>}
          {published && <span>{published}</span>}
        </div>
        {clickable && (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C49A3C] mt-2 group-hover:underline w-fit">
            Read article <ExternalLink className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
    </div>
  );

  return clickable ? (
    <a href={item.url!} target="_blank" rel="noreferrer" className="group block hover:bg-slate-50/60 transition-colors">{body}</a>
  ) : (
    <div>{body}</div>
  );
}

/**
 * NEWS CAROUSEL MODULE — Dashboard variant: today's stories, one at a time, with
 * arrows/dots in the module head to page through the rest (same nav pattern as
 * PerformanceSection's CurrencyCarouselModule). Renders nothing at all — not an empty card —
 * when there's no news today or the fetch fails, so a non-critical, supplementary module
 * doesn't clutter the main dashboard when it has nothing to show.
 */
export function NewsCarouselModule() {
  const { items, loading, error } = useNews(undefined, undefined, DASHBOARD_NEWS_LIMIT);
  const [index, setIndex] = useState(0);
  // Clamped rather than reset via an effect: a shorter `items` array (e.g. a refetch) could
  // otherwise leave `index` pointing past the end.
  const activeIndex = items.length > 0 ? Math.min(index, items.length - 1) : 0;

  if (loading) {
    return (
      <Module>
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin h-6 w-6 text-[#C49A3C]" />
        </div>
      </Module>
    );
  }

  if (error || items.length === 0) return null;

  const active = items[activeIndex];
  const multi = items.length > 1;

  return (
    <Module>
      <ModuleHead
        eyebrow="Market News"
        title="Today's Headlines"
        desc="Stories published today, one at a time."
        right={multi && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIndex(i => (i - 1 + items.length) % items.length)}
              aria-label="Previous story"
              className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-1">
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to story ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === activeIndex ? "w-4 bg-slate-900" : "w-1.5 bg-slate-300"}`}
                />
              ))}
            </div>
            <button
              onClick={() => setIndex(i => (i + 1) % items.length)}
              aria-label="Next story"
              className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      />
      <FeaturedNewsCard item={active} />
    </Module>
  );
}
