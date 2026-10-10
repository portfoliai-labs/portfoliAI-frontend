// components/dashboard/JournalSection.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Clock } from "lucide-react";
import { JOURNAL_ARTICLES, findJournalArticle, type JournalArticle, type JournalCategory } from "../../lib/journal";
import { pushDashboardEntry, readDashboardEntry } from "../../lib/dashboardHistory";
import { JOURNAL_SECTION } from "../../lib/dashboardNav";
import { Pills, serif } from "../preview/PreviewKit";

// An open article adds its slug to the view.
const SECTION = JOURNAL_SECTION;

type JournalView = { page: "journal"; slug?: string } | undefined;
type Filter = "all" | JournalCategory;

const CATEGORIES: JournalCategory[] = ["Performance", "Risk", "Strategy", "Costs"];

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// The article the current history entry is on, if it's this section's and the article still exists.
const articleFromHistory = (): JournalArticle | undefined => {
  const entry = readDashboardEntry();
  const view = entry?.section === SECTION ? (entry.view as JournalView) : undefined;
  return view?.page === "journal" && view.slug ? findJournalArticle(view.slug) : undefined;
};

/**
 * JOURNAL (a demo account's preview for now) — PortfoliAI's own
 * articles on investing (lib/journal): the newest on a large card, the rest in a grid that can be
 * narrowed to one category, each opening on the article itself. Opening one is a history entry,
 * so the browser's back button returns to the list (see lib/dashboardHistory).
 */
export function JournalSection() {
  const [article, setArticle] = useState<JournalArticle | undefined>(articleFromHistory);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const onPopState = () => {
      if (readDashboardEntry()?.section === SECTION) setArticle(articleFromHistory());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const open = (next: JournalArticle | undefined) => {
    pushDashboardEntry({ section: SECTION, view: { page: "journal", ...(next ? { slug: next.slug } : {}) } });
    setArticle(next);
    window.scrollTo({ top: 0 });
  };

  if (article) return <ArticleView article={article} onBack={() => open(undefined)} />;

  const shown = JOURNAL_ARTICLES.filter((a) => filter === "all" || a.category === filter);
  const [lead, ...rest] = shown;

  return (
    <div className="space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">PortfoliAI</p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900" style={serif}>Journal</h1>
          <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed max-w-xl">
            Plain-spoken notes on investing: the ideas behind the numbers on your dashboard.
          </p>
        </div>
        <Pills<Filter>
          options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]}
          value={filter}
          onChange={setFilter}
        />
      </header>

      {lead ? (
        <>
          <LeadCard article={lead} onOpen={() => open(lead)} />
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {rest.map((a) => <ArticleCard key={a.slug} article={a} onOpen={() => open(a)} />)}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm font-semibold text-slate-500 text-center py-12">No articles in this category yet.</p>
      )}
    </div>
  );
}

function Meta({ article, dark = false }: { article: JournalArticle; dark?: boolean }) {
  return (
    <p className={`flex items-center gap-2 text-[11px] font-semibold ${dark ? "text-stone-400" : "text-slate-400"}`}>
      <span className="font-black uppercase tracking-wider text-[#C49A3C]">{article.category}</span>
      <span>·</span>
      <span>{dateLabel(article.publishedAt)}</span>
      <span>·</span>
      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{article.readMinutes} min read</span>
    </p>
  );
}

/** The newest article: dark and full width, the way into the page. */
function LeadCard({ article, onOpen }: { article: JournalArticle; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left bg-[#1c1917] rounded-3xl p-6 md:p-9 shadow-md relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60"
    >
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-[#C49A3C]/10 blur-3xl rounded-full" />
      <div className="relative flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <Meta article={article} dark />
          <h2 className="text-2xl md:text-3xl font-black text-white mt-3 leading-tight" style={serif}>{article.title}</h2>
          <p className="text-sm md:text-[15px] text-stone-400 mt-3 leading-relaxed">{article.dek}</p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />
      </div>
    </button>
  );
}

function ArticleCard({ article, onOpen }: { article: JournalArticle; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group h-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col gap-3 hover:border-[#C49A3C]/50 hover:shadow-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60"
    >
      <Meta article={article} />
      <h3 className="text-lg font-black text-slate-900 leading-snug" style={serif}>{article.title}</h3>
      <p className="text-[13px] text-slate-500 leading-relaxed">{article.dek}</p>
      <span className="mt-auto pt-2 flex items-center gap-1 text-xs font-bold text-slate-400 group-hover:text-[#C49A3C] transition-colors">
        Read <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function ArticleView({ article, onBack }: { article: JournalArticle; onBack: () => void }) {
  return (
    <div className="pb-12">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#C49A3C] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Journal
      </button>
      <article className="mt-5 bg-white rounded-3xl border border-slate-200 shadow-sm px-6 py-8 md:px-14 md:py-12">
        <div className="max-w-2xl mx-auto">
          <Meta article={article} />
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 mt-3 leading-tight" style={serif}>{article.title}</h1>
          <p className="text-base md:text-lg text-slate-500 mt-4 leading-relaxed">{article.dek}</p>
          <div className="mt-8 pt-8 border-t border-slate-100 space-y-5 text-[15px] text-slate-700 leading-[1.8]">
            {article.body.map((block, i) =>
              block.type === "h" ? (
                <h2 key={i} className="text-xl font-black text-slate-900 pt-3" style={serif}>{block.text}</h2>
              ) : block.type === "ul" ? (
                <ul key={i} className="space-y-2 pl-5 list-disc marker:text-[#C49A3C]">
                  {block.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : (
                <p key={i}>{block.text}</p>
              ),
            )}
          </div>
          <p className="mt-10 pt-6 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
            For education only, not investment advice. Past returns don&apos;t predict future ones.
          </p>
        </div>
      </article>
    </div>
  );
}
