// components/preview/ExploreCommunity.tsx
"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { Heart, Search, Share2, Users } from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { MACRO_CATEGORIES, MACRO_COLORS, SHARED_PORTFOLIOS, type SharedPortfolio } from "../../lib/mock/community";
import { ComingSoonButton, Pills, PreviewBanner, formatPct, serif } from "./PreviewKit";

type Sort = "trending" | "likes" | "return" | "newest";
type RiskFilter = "all" | SharedPortfolio["risk"];

const RISK_STYLE: Record<SharedPortfolio["risk"], string> = {
  Low: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  High: "bg-rose-50 text-rose-700",
};

/**
 * EXPLORE (preview) — portfolios other users have chosen to share, opened from the Portfolios
 * hub: each card shows its author, what it's made of, how it did and how many people liked or
 * copied it. Liking works on the page (it's local state, forgotten on leaving); sharing yours is
 * shown as coming soon. Every entry is invented
 * (lib/mock/community).
 */
export function ExploreCommunity({ trail }: { trail: Crumb[] }) {
  const [sort, setSort] = useState<Sort>("trending");
  const [risk, setRisk] = useState<RiskFilter>("all");
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<Set<string>>(() => new Set());

  const toggleLike = (id: string) =>
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = SHARED_PORTFOLIOS.filter(
      (p) =>
        (risk === "all" || p.risk === risk) &&
        (!q || [p.name, p.author, p.description, ...p.tags, ...p.topHoldings].some((s) => s.toLowerCase().includes(q))),
    );
    const trending = (p: SharedPortfolio) => p.likes / (p.sharedDaysAgo + 2);
    const by: Record<Sort, (p: SharedPortfolio) => number> = {
      trending, likes: (p) => p.likes, return: (p) => p.return1y, newest: (p) => -p.sharedDaysAgo,
    };
    return [...list].sort((a, b) => by[sort](b) - by[sort](a));
  }, [sort, risk, query]);

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Explore" right={<ComingSoonButton icon={<Share2 className="h-3.5 w-3.5" />}>Share a portfolio</ComingSoonButton>} />
      <PreviewBanner feature="Explore">
        A glimpse of the community: portfolios other investors could share, to browse and like. The people and
        figures below are invented; likes are kept only while you&apos;re on this page.
      </PreviewBanner>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, author, tag or ticker"
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C49A3C]/60 focus:ring-4 focus:ring-[#C49A3C]/10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Pills<Sort>
            options={[{ value: "trending", label: "Trending" }, { value: "likes", label: "Most liked" }, { value: "return", label: "Best 1Y" }, { value: "newest", label: "Newest" }]}
            value={sort}
            onChange={setSort}
          />
          <span className="hidden sm:block w-px h-6 bg-slate-200" />
          <Pills<RiskFilter>
            options={[{ value: "all", label: "Any risk" }, { value: "Low", label: "Low" }, { value: "Medium", label: "Medium" }, { value: "High", label: "High" }]}
            value={risk}
            onChange={setRisk}
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500 text-center py-12">No shared portfolios match.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {shown.map((p) => (
            <SharedPortfolioCard key={p.id} portfolio={p} liked={liked.has(p.id)} onLike={() => toggleLike(p.id)} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-slate-400 text-center max-w-xl mx-auto leading-relaxed">
        Shared portfolios will show weights and returns only, never amounts. Nothing here is investment advice; past returns
        don&apos;t predict future ones.
      </p>
    </div>
  );
}

function SharedPortfolioCard({ portfolio: p, liked, onLike }: { portfolio: SharedPortfolio; liked: boolean; onLike: () => void }) {
  const color = p.return1y >= 0 ? "#10b981" : "#f43f5e";
  const initials = p.author.split(" ").map((w) => w[0]).join("");
  const shared = p.sharedDaysAgo === 1 ? "yesterday" : `${p.sharedDaysAgo} days ago`;

  return (
    <article className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col gap-4 hover:border-[#C49A3C]/50 hover:shadow-md transition-all">
      <header className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-[#1c1917] text-[#E8C97A] text-xs font-black flex items-center justify-center shrink-0">{initials}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 truncate">{p.author}</p>
          <p className="text-[11px] font-semibold text-slate-400 truncate">{p.handle} · shared {shared}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${RISK_STYLE[p.risk]}`}>{p.risk} risk</span>
      </header>

      <div>
        <h3 className="text-lg font-black text-slate-900" style={serif}>{p.name}</h3>
        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed line-clamp-2">{p.description}</p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-2xl font-black tabular-nums" style={{ ...serif, color }}>{formatPct(p.return1y)}</p>
          <p className="text-[11px] font-semibold text-slate-400">last 12 months · {formatPct(p.returnTotal)} over 3 years</p>
        </div>
        <div className="w-28 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 112, height: 48 }}>
            <LineChart data={p.series} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <div className="flex h-2 rounded-full overflow-hidden">
          {MACRO_CATEGORIES.filter((c) => p.allocation[c]).map((c) => (
            <span key={c} style={{ width: `${p.allocation[c]}%`, background: MACRO_COLORS[c] }} title={`${c} ${p.allocation[c]}%`} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {MACRO_CATEGORIES.filter((c) => p.allocation[c]).map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <span className="h-2 w-2 rounded-full" style={{ background: MACRO_COLORS[c] }} />{c} {p.allocation[c]}%
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {p.tags.map((t) => (
          <span key={t} className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{t}</span>
        ))}
        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500">{p.holdings} holdings</span>
      </div>

      <footer className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onLike}
          aria-pressed={liked}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
            liked ? "bg-rose-50 text-rose-600" : "text-slate-500 hover:bg-slate-100"
          }`}
        >
          <Heart className={`h-4 w-4 transition-transform ${liked ? "fill-rose-500 text-rose-500 scale-110" : ""}`} />
          <span className="tabular-nums">{(p.likes + (liked ? 1 : 0)).toLocaleString("en-US")}</span>
        </button>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
          <Users className="h-3.5 w-3.5" /> {p.copies} copied
        </span>
      </footer>
    </article>
  );
}
