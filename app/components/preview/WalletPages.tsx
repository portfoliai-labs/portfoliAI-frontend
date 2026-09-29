// components/preview/WalletPages.tsx
"use client";

import { useMemo, useState } from "react";
import {
  Bar, Line, LineChart, BarChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  BellRing, FileText, Lightbulb, Plus, Receipt, Search, Target, Upload,
} from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { PortfolioGroupCard } from "../dashboard/PortfolioGroupCard";
import { ReportFileTile } from "../dashboard/ReportFileTile";
import { GenerateReportDialog } from "../dashboard/GenerateReportDialog";
import { TONE_STYLES } from "../dashboard/AlertGauge";
import { FeaturedCard, PortfolioHolder, type HolderItem } from "../dashboard/PortfolioHolder";
import { VIRTUAL_COLOR } from "../dashboard/BacktestMarks";
import { ActionCard } from "../dashboard/InsightsHub";
import { DataTable, type DataColumn } from "../dashboard/ExploreView";
import { Toggle } from "../dashboard/Toggle";
import { formatCompact, formatCurrency } from "../../lib/format";
import {
  BUDGETS, CATEGORY_COLORS, INCOME_CATEGORIES, MONTHS, RECURRING, WALLETS, WALLET_ALERTS, WALLET_REPORTS,
  monthlySummary, spendingByCategory, topMerchants, transactionsOf,
  type Category, type WalletAlert, type WalletTransaction,
} from "../../lib/mock/wallets";
import { AXIS_TICK, ComingSoonButton, Panel, Pills, PreviewBadge, PreviewBanner, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

export type WalletPage = "insights" | "transactions" | "reports" | "budgets" | "alerts";

/** The id of all wallets together (the Wallets hub's "All wallets"). */
export const ALL_WALLETS = "all";
const ALL = ALL_WALLETS;

/** Whether `id` is a wallet (or all of them): a history entry can outlive the sample data. */
export const isWalletId = (id: string) => id === ALL || WALLETS.some((w) => w.id === id);

const eur = (v: number, d = 0) => formatCurrency(v, "EUR", d);
const scopeOf = (id: string) => (id === ALL ? null : id);
const nameOf = (id: string) => (id === ALL ? "All wallets" : WALLETS.find((w) => w.id === id)!.name);
const CURRENT_MONTH = MONTHS.at(-1)!.key;
// Day 28 of September's 30: how far into the month budgets should be.
const MONTH_ELAPSED = 28 / 30;

const PAGE_LABELS: Record<WalletPage, string> = {
  transactions: "Transactions", insights: "Insights", reports: "Reports", budgets: "Budgets", alerts: "Alerts",
};

/**
 * WALLET PAGES (preview) — everyday money, next to the investments under Manage (see
 * InsightsSection), from Manage / Wallets (WalletsHub): current accounts, cards, savings and cash,
 * with what comes in and goes out. Built like Investments: a wallet's card opens straight on its
 * Insights, and Transactions, Budgets, Reports and Alerts sit on the hub, each on every wallet at
 * once — Transactions filtered by wallet in its list, Reports as files (each saying its wallet),
 * Alerts a card per wallet. All figures come from lib/mock/wallets.
 */
export function WalletView({ id, page, trail }: {
  // The wallet, for its Insights (the other pages are on every wallet).
  id: string;
  page: WalletPage;
  // The pages above ("Manage / Wallets").
  trail: Crumb[];
}) {
  const scope = scopeOf(id);

  if (page === "insights") {
    return (
      <div className="space-y-6 pb-12">
        {/* Its row in the Sidebar leads back to the top of its Insights. */}
        <Breadcrumb trail={[...trail, { label: nameOf(id), onClick: () => window.scrollTo({ top: 0 }) }]} current="Insights" />
        <WalletInsights scope={scope} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current={PAGE_LABELS[page]} right={pageAction(page)} />
      {page === "transactions" && <WalletTransactions />}
      {page === "budgets" && <WalletBudgets scope={null} />}
      {page === "reports" && <WalletReports />}
      {page === "alerts" && <WalletAlerts />}
    </div>
  );
}

function pageAction(page: WalletPage) {
  switch (page) {
    case "transactions":
      return (
        <div className="flex gap-2">
          <ComingSoonButton dark={false} icon={<Upload className="h-3.5 w-3.5" />}>Import statement</ComingSoonButton>
          <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>Add</ComingSoonButton>
        </div>
      );
    case "budgets":
      return <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>New budget</ComingSoonButton>;
    default:
      return undefined;
  }
}

// ── Hub ────────────────────────────────────────────────────────────────────────────────────

const signed = (v: number) => `${v >= 0 ? "+" : "−"}${eur(Math.abs(v))}`;

/**
 * WALLETS HUB — Manage / Wallets, laid out like Investments: the wallet with the largest balance on
 * a big card (FeaturedCard) as tall as the row; the other wallets in a card holder (PortfolioHolder)
 * that pulls each one out on hover, with at its front the (not yet available) way to add one; and
 * all wallets together in a holder of their own, in the virtual blue, like "All portfolios". Every
 * card opens its wallet's Insights. Under them, Transactions, Budgets, Reports and Alerts, opening
 * on all wallets.
 */
export function WalletsHub({ trail, onOpen }: { trail: Crumb[]; onOpen: (id: string, page: WalletPage) => void }) {
  const wallets = useMemo(() => WALLETS.map((w) => {
    const summary = monthlySummary(w.id);
    const year = summary.reduce((acc, m) => ({ income: acc.income + m.income, expenses: acc.expenses + m.expenses }), { income: 0, expenses: 0 });
    return { wallet: w, summary, month: summary.at(-1)!, year };
  }), []);
  const all = useMemo(() => monthlySummary(null), []);
  const featured = wallets.reduce((best, w) => (w.month.balance > best.month.balance ? w : best));

  const items: HolderItem[] = [
    ...wallets.filter((w) => w !== featured).map(({ wallet, summary, month }) => ({
      key: wallet.id,
      name: wallet.name,
      color: wallet.color,
      value: eur(month.balance),
      headline: signed(month.net),
      caption: "this month",
      points: summary.map((m) => ({ value: m.balance })),
      empty: "",
      onOpen: () => onOpen(wallet.id, "insights"),
    })),
    {
      key: "add-wallet",
      name: "Add a wallet",
      color: "",
      add: true,
      value: null,
      headline: null,
      points: [],
      empty: "Connect a bank, or add an account, card or cash by hand — coming soon.",
      cta: "Soon",
      onOpen: () => {},
    },
  ];
  const combined: HolderItem[] = [{
    key: ALL,
    name: "All wallets",
    color: VIRTUAL_COLOR,
    badge: <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/15 text-[9px] font-black uppercase tracking-wider">Combined</span>,
    value: eur(all.at(-1)!.balance),
    headline: signed(all.at(-1)!.net),
    caption: "this month",
    points: all.map((m) => ({ value: m.balance })),
    empty: "",
    onOpen: () => onOpen(ALL, "insights"),
  }];

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Wallets" />
      <PreviewBanner feature="Wallets">
        Wallets will hold your everyday money — accounts, cards, savings and cash — with income, spending, budgets and
        alerts, next to your investments. The wallets and transactions below are sample data; nothing is connected or saved.
      </PreviewBanner>
      {/* The same row as Investments': the largest as tall as the row, the holders' sleeves on one line. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 items-end">
        <FeaturedCard
          eyebrow="Largest wallet"
          name={featured.wallet.name}
          badge={<PreviewBadge label="Sample" />}
          color={featured.wallet.color}
          value={eur(featured.month.balance)}
          line={
            <>
              <span className={featured.month.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{signed(featured.month.net)}</span>
              <span className="text-slate-400 font-semibold"> this month · {featured.wallet.kind}</span>
            </>
          }
          figures={[
            { label: "In, 12 months", value: eur(featured.year.income), tone: "gain" },
            { label: "Out, 12 months", value: eur(featured.year.expenses), tone: "loss" },
          ]}
          points={featured.summary.map((m) => ({ value: m.balance }))}
          empty=""
          onOpen={() => onOpen(featured.wallet.id, "insights")}
        />
        <PortfolioHolder items={items} label={`${items.length - 1} more`} />
        <PortfolioHolder items={combined} label="Combined" tone="virtual" />
      </div>

      {/* The ways on from here, under the wallets: the same grid and cards as Investments'. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <ActionCard icon={<Receipt className="h-5 w-5" />} title="Transactions" text="Every payment and deposit, searchable and filterable by category." onClick={() => onOpen(ALL, "transactions")} />
        <ActionCard icon={<Target className="h-5 w-5" />} title="Budgets" text="A monthly limit per category, and how this month is tracking." onClick={() => onOpen(ALL, "budgets")} />
        <ActionCard icon={<FileText className="h-5 w-5" />} title="Reports" text="Monthly statements and a yearly summary, as PDF." onClick={() => onOpen(ALL, "reports")} />
        <ActionCard icon={<BellRing className="h-5 w-5" />} title="Alerts" text="Low balance, budgets running out, large or unexpected payments." onClick={() => onOpen(ALL, "alerts")} />
      </div>
    </div>
  );
}

// ── Transactions ───────────────────────────────────────────────────────────────────────────

function CategoryChip({ category }: { category: Category }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: `${color}14`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{category}
    </span>
  );
}

// Every wallet's transactions, filtered by wallet in the list itself.
function WalletTransactions() {
  const [wallet, setWallet] = useState<string>(ALL);
  const scope = scopeOf(wallet);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"all" | "in" | "out">("all");
  const [category, setCategory] = useState<"all" | Category>("all");
  const all = transactionsOf(scope);
  const categories = useMemo(() => [...new Set(all.map((t) => t.category))].sort(), [all]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (t) =>
        (type === "all" || (type === "in" ? t.amount > 0 : t.amount < 0)) &&
        (category === "all" || t.category === category) &&
        (!q || t.description.toLowerCase().includes(q)),
    );
  }, [all, query, type, category]);
  const total = rows.reduce((s, t) => s + t.amount, 0);

  const columns: DataColumn<WalletTransaction>[] = [
    { key: "date", label: "Date", sortValue: (t) => t.date, render: (t) => <span className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span> },
    { key: "desc", label: "Description", sortValue: (t) => t.description, render: (t) => <span className="font-semibold text-slate-800">{t.description}</span> },
    { key: "cat", label: "Category", sortValue: (t) => t.category, render: (t) => <CategoryChip category={t.category} /> },
    ...(scope ? [] : [{ key: "wallet", label: "Wallet", sortValue: (t: WalletTransaction) => t.walletId, render: (t: WalletTransaction) => <span className="text-slate-500 whitespace-nowrap">{nameOf(t.walletId)}</span> }]),
    {
      key: "amount", label: "Amount", align: "right", sortValue: (t) => t.amount,
      render: (t) => <span className={`font-bold ${t.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>{t.amount > 0 ? "+" : ""}{eur(t.amount, 2)}</span>,
    },
  ];

  return (
    <>
      <PreviewBanner feature="Wallet transactions">
        Sample transactions. Adding them by hand, importing bank statements and connecting accounts (open banking) are on the
        way; categories will be suggested automatically.
      </PreviewBanner>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5 flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search description"
            className="w-full h-10 pl-10 pr-3.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-[#C49A3C]/60"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            aria-label="Wallet"
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none"
          >
            <option value={ALL}>Every wallet</option>
            {WALLETS.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <Pills<"all" | "in" | "out"> options={[{ value: "all", label: "All" }, { value: "in", label: "Money in" }, { value: "out", label: "Money out" }]} value={type} onChange={setType} />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | Category)}
            aria-label="Category"
            className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 outline-none"
          >
            <option value="all">Every category</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <Panel
        title={`${rows.length.toLocaleString("en-US")} transactions`}
        right={<span className="text-sm font-black tabular-nums"><span className={total >= 0 ? "text-emerald-600" : "text-rose-600"}>{total >= 0 ? "+" : ""}{eur(total, 2)}</span> <span className="text-xs text-slate-400 font-semibold">net</span></span>}
      >
        {rows.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-slate-500">No transactions match.</p>
        ) : (
          <div className="max-h-[36rem] overflow-y-auto custom-scrollbar">
            <DataTable columns={columns} rows={rows} rowKey={(t) => t.id} initialSort={{ key: "date", desc: true }} />
          </div>
        )}
      </Panel>
    </>
  );
}

// ── Insights ───────────────────────────────────────────────────────────────────────────────

function WalletInsights({ scope }: { scope: string | null }) {
  const summary = useMemo(() => monthlySummary(scope), [scope]);
  const byCategory = useMemo(() => spendingByCategory(scope), [scope]);
  const merchants = useMemo(() => topMerchants(scope), [scope]);
  const total = byCategory.reduce((s, c) => s + c.amount, 0);
  const top = useMemo(() => byCategory.slice(0, 6).map((c) => c.category), [byCategory]);

  const stacked = useMemo(
    () => MONTHS.map(({ key, label }) => {
      const row: Record<string, string | number> = { label };
      const cats = spendingByCategory(scope, [key]);
      for (const c of top) row[c] = cats.find((x) => x.category === c)?.amount ?? 0;
      row.Other = cats.filter((x) => !top.includes(x.category)).reduce((s, x) => s + x.amount, 0);
      return row;
    }),
    [scope, top],
  );
  const savings = summary.map((m) => ({ label: m.label, rate: m.income > 0 ? Math.round(((m.income - m.expenses) / m.income) * 100) : 0 }));

  const thisMonth = spendingByCategory(scope, [CURRENT_MONTH]);
  const prevMonth = spendingByCategory(scope, [MONTHS.at(-2)!.key]);
  const restaurantsNow = thisMonth.find((c) => c.category === "Restaurants")?.amount ?? 0;
  const restaurantsAvg = (byCategory.find((c) => c.category === "Restaurants")?.amount ?? 0) / 12;
  const subscriptions = RECURRING.filter((r) => ["Netflix", "Spotify", "iCloud+"].includes(r.name)).reduce((s, r) => s + r.amount, 0);
  const spendNow = thisMonth.reduce((s, c) => s + c.amount, 0);
  const spendPrev = prevMonth.reduce((s, c) => s + c.amount, 0);

  return (
    <>
      <PreviewBanner feature="Wallet insights" />

      <div className="bg-[#1c1917] rounded-3xl p-5 md:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[#C49A3C]" />
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">What PortfoliAI noticed</p>
          <PreviewBadge dark label="Sample" />
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            `Spending this month is ${eur(spendNow)}, ${formatPct(spendPrev > 0 ? (spendNow / spendPrev - 1) * 100 : 0, 0)} on last month.`,
            restaurantsNow > restaurantsAvg
              ? `Eating out is at ${eur(restaurantsNow)}, above your ${eur(restaurantsAvg)} monthly average.`
              : `Eating out is at ${eur(restaurantsNow)}, under your ${eur(restaurantsAvg)} monthly average.`,
            `Streaming and cloud subscriptions cost ${eur(subscriptions * 12)} a year. Investing it monthly instead would be a ${eur(subscriptions, 2)} PAC.`,
          ].map((text) => (
            <li key={text} className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-[13px] text-stone-300 leading-relaxed">{text}</li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-6">
        <Panel title="Spending by category" subtitle={`${eur(total)} over the last 12 months, transfers excluded.`}>
          <div className="p-6 md:p-7 flex flex-col sm:flex-row items-center gap-6">
            <PieChart width={150} height={150}>
              <Pie data={byCategory} dataKey="amount" nameKey="category" innerRadius={46} outerRadius={72} paddingAngle={1.5} stroke="none" isAnimationActive={false}>
                {byCategory.map((c) => <Cell key={c.category} fill={CATEGORY_COLORS[c.category]} />)}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [eur(Number(v)), n]} />
            </PieChart>
            <ul className="flex-1 w-full space-y-1.5">
              {byCategory.map((c) => (
                <li key={c.category} className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[c.category] }} />{c.category}
                  </span>
                  <span className="tabular-nums font-bold text-slate-900">
                    {eur(c.amount)} <span className="text-slate-400 font-semibold">{((c.amount / total) * 100).toFixed(0)}%</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Month by month" subtitle="Spending in the six largest categories.">
          <div className="p-4 md:p-6 h-80">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 300 }}>
              <BarChart data={stacked} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
                <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Number(v)), n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {top.map((c) => <Bar key={c} dataKey={c} stackId="s" fill={CATEGORY_COLORS[c]} maxBarSize={26} isAnimationActive={false} />)}
                <Bar dataKey="Other" stackId="s" fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Panel title="Savings rate" subtitle="Share of each month's income not spent." className="lg:col-span-1">
          <div className="p-4 md:p-6 h-56">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 200 }}>
              <LineChart data={savings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                <ReferenceLine y={20} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "20% goal", position: "insideTopRight", fontSize: 10, fill: "#94a3b8" }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Saved"]} />
                <Line type="monotone" dataKey="rate" stroke="#C49A3C" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Top merchants" subtitle="Last 12 months.">
          <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
            {merchants.map((m) => (
              <li key={m.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{m.name}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{m.count} {m.count === 1 ? "payment" : "payments"} · {m.category}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums text-slate-900">{eur(m.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recurring payments" subtitle="Detected from repeating charges.">
          <ul className="px-6 md:px-7 py-4 divide-y divide-slate-100">
            {RECURRING.map((r) => (
              <li key={r.name} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{r.name}</p>
                  <p className="text-[11px] font-semibold text-slate-400">{r.every}</p>
                </div>
                <span className="text-[13px] font-black tabular-nums text-slate-900">{eur(r.amount, 2)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Income sources" subtitle="Last 12 months, transfers between your wallets excluded.">
        <IncomeSources scope={scope} />
      </Panel>
    </>
  );
}

function IncomeSources({ scope }: { scope: string | null }) {
  const rows = INCOME_CATEGORIES.filter((c) => c !== "Transfers in").map((c) => ({
    category: c,
    amount: transactionsOf(scope).filter((t) => t.category === c).reduce((s, t) => s + t.amount, 0),
  })).filter((r) => r.amount > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total === 0) return <p className="p-6 text-sm font-semibold text-slate-500">No income in this wallet.</p>;
  return (
    <div className="p-6 md:p-7 space-y-3">
      <div className="flex h-3 rounded-full overflow-hidden">
        {rows.map((r) => <span key={r.category} style={{ width: `${(r.amount / total) * 100}%`, background: CATEGORY_COLORS[r.category] }} />)}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {rows.map((r) => (
          <span key={r.category} className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLORS[r.category] }} />
            {r.category} <span className="font-black text-slate-900 tabular-nums">{eur(r.amount)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Budgets ────────────────────────────────────────────────────────────────────────────────

function budgetStatus(scope: string | null) {
  const spent = spendingByCategory(scope, [CURRENT_MONTH]);
  return BUDGETS.map((b) => ({ ...b, spent: spent.find((s) => s.category === b.category)?.amount ?? 0 }));
}

function WalletBudgets({ scope }: { scope: string | null }) {
  const rows = useMemo(() => budgetStatus(scope), [scope]);
  const totalLimit = rows.reduce((s, b) => s + b.limit, 0);
  const totalSpent = rows.reduce((s, b) => s + b.spent, 0);
  const chart = rows.map((b) => ({ name: b.category, spent: Math.round(b.spent), limit: b.limit }));

  return (
    <>
      <PreviewBanner feature="Budgets" />
      <section className="bg-white rounded-4xl border border-slate-200 shadow-sm p-6 md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">September 2026 · day 28 of 30</p>
            <p className="text-3xl font-black text-slate-900 tabular-nums" style={serif}>
              {eur(totalSpent)} <span className="text-lg text-slate-400">of {eur(totalLimit)}</span>
            </p>
          </div>
          <p className="text-[13px] font-bold text-slate-500">
            {totalSpent <= totalLimit ? `${eur(totalLimit - totalSpent)} left for the month` : `${eur(totalSpent - totalLimit)} over budget`}
          </p>
        </div>
        <BudgetBar spent={totalSpent} limit={totalLimit} big />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rows.map((b) => {
          const pct = (b.spent / b.limit) * 100;
          const status = pct > 100 ? "Over budget" : pct > MONTH_ELAPSED * 100 + 5 ? "Ahead of pace" : pct >= 90 ? "Almost used" : "On track";
          const tone = pct > 100 ? "text-rose-600 bg-rose-50" : status === "On track" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50";
          return (
            <div key={b.category} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between gap-3">
                <CategoryChip category={b.category} />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${tone}`}>{status}</span>
              </div>
              <p className="text-lg font-black tabular-nums text-slate-900 mt-3">
                {eur(b.spent)} <span className="text-sm text-slate-400 font-bold">/ {eur(b.limit)}</span>
              </p>
              <BudgetBar spent={b.spent} limit={b.limit} />
            </div>
          );
        })}
      </div>

      <Panel title="Spent vs budget, this month">
        <div className="p-4 md:p-6 h-72">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 280 }}>
            <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [eur(Number(v)), n === "spent" ? "Spent" : "Budget"]} />
              <Bar dataKey="limit" fill="#e2e8f0" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Bar dataKey="spent" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false}>
                {chart.map((c) => <Cell key={c.name} fill={c.spent > c.limit ? "#f43f5e" : "#C49A3C"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}

// The pace marker shows where spending "should" be this far into the month.
function BudgetBar({ spent, limit, big }: { spent: number; limit: number; big?: boolean }) {
  const pct = Math.min(100, (spent / limit) * 100);
  const over = spent > limit;
  return (
    <div className={`relative ${big ? "h-3 mt-5" : "h-2 mt-3"} rounded-full bg-slate-100`}>
      <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct > MONTH_ELAPSED * 100 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
      <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-400 rounded" style={{ left: `${MONTH_ELAPSED * 100}%` }} title="Where spending should be by today" />
    </div>
  );
}

// ── Reports ────────────────────────────────────────────────────────────────────────────────

const WALLET_REPORT_KINDS = {
  monthly: { cover: "periodic" as const, label: "Monthly statement", description: "One wallet's month: what came in, what went out, and the closing balance." },
  yearly: { cover: "full" as const, label: "Yearly summary", description: "One wallet's year: income, spending by category, savings rate." },
};

/**
 * Every wallet's reports as files, as on Investments (ReportFileTile): each with its kind's cover,
 * its wallet and its tags (changed on this page only), one search by file, wallet, kind or tag,
 * and "Generate report" opening the same dialog (GenerateReportDialog), which can't send yet.
 */
function WalletReports() {
  const [files, setFiles] = useState(WALLET_REPORTS);
  const [query, setQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const walletOf = (id: string) => WALLETS.find((w) => w.id === id)!;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter((f) => !q || [f.name, walletOf(f.walletId).name, WALLET_REPORT_KINDS[f.kind].label, ...f.tags].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [files, query]);
  const setTags = (id: string, change: (tags: string[]) => string[]) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags: change(f.tags) } : f)));

  return (
    <>
      <PreviewBanner feature="Wallet reports">Sample statements. Tags change on this page only and aren&apos;t saved; opening, downloading and generating are on the way.</PreviewBanner>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#C49A3C] transition-colors" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by file, wallet or tag…"
            aria-label="Search reports"
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-medium outline-none focus:ring-4 focus:ring-[#C49A3C]/10 focus:border-[#C49A3C]/50 transition-all shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setGenerating(true)}
          className="h-12 flex items-center justify-center gap-2 px-5 rounded-xl bg-[#1c1917] text-white text-sm font-bold hover:bg-[#C49A3C] transition-colors shrink-0"
        >
          <FileText className="h-4 w-4" />
          Generate report
        </button>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
        {shown.length} {shown.length === 1 ? "file" : "files"}{query.trim() && ` matching "${query.trim()}"`}
      </p>
      {shown.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500 px-1">Nothing matches your search.</p>
      ) : (
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-5">
          {shown.map((f) => {
            const wallet = walletOf(f.walletId);
            return (
              <ReportFileTile
                key={f.id}
                name={f.name}
                cover={WALLET_REPORT_KINDS[f.kind].cover}
                kindLabel={WALLET_REPORT_KINDS[f.kind].label}
                ownerName={wallet.name}
                color={wallet.color}
                createdAt={f.createdAt}
                tags={f.tags}
                readOnly={false}
                onAddTag={(tag) => setTags(f.id, (tags) => [...tags, tag])}
                onRemoveTag={(tag) => setTags(f.id, (tags) => tags.filter((t) => t !== tag))}
              />
            );
          })}
        </div>
      )}
      {generating && (
        <GenerateReportDialog
          kinds={(Object.keys(WALLET_REPORT_KINDS) as (keyof typeof WALLET_REPORT_KINDS)[]).map((id) => ({ id, available: true, ...WALLET_REPORT_KINDS[id] }))}
          targets={WALLETS.map((w) => ({ id: w.id, name: w.name, color: w.color }))}
          targetLabel="Wallet"
          readOnly
          readOnlyTitle="Coming soon: wallets are a preview"
          onGenerate={() => setGenerating(false)}
          onClose={() => setGenerating(false)}
        />
      )}
    </>
  );
}

// ── Alerts ─────────────────────────────────────────────────────────────────────────────────

const ALERT_BAR: Record<"danger" | "warn" | "ok" | "muted", string> = {
  danger: "bg-rose-500", warn: "bg-amber-500", ok: "bg-emerald-500", muted: "bg-slate-300",
};

// A sample rule's state, worded as the investments' are (see lib/alerts).
function walletAlertState(a: WalletAlert): { label: string; tone: keyof typeof ALERT_BAR } {
  if (!a.enabled) return { label: "Off", tone: "muted" };
  if (a.triggered) return { label: "Triggered", tone: "danger" };
  if (a.progressPct === undefined) return { label: "Watching", tone: "ok" };
  return a.progressPct >= 60 ? { label: "Approaching", tone: "warn" } : { label: "Within range", tone: "ok" };
}

/**
 * The sample rules, as on Investments' Alerts: a card per wallet (PortfolioGroupCard) with its
 * count, its rules by state and its (not yet available) "New alert", then one row per rule across
 * the card — what it watches; where it stands (now against the limit, how far along the way);
 * its switch, which works on this page only.
 */
function WalletAlerts() {
  const [alerts, setAlerts] = useState(WALLET_ALERTS);
  return (
    <>
      <PreviewBanner feature="Wallet alerts">Sample rules. Switching them on or off works on this page only and isn&apos;t saved.</PreviewBanner>
      {WALLETS.map((w) => {
        const own = alerts.filter((a) => a.walletId === w.id);
        const counts = (["danger", "warn", "ok", "muted"] as const)
          .map((tone) => ({ tone, count: own.filter((a) => walletAlertState(a).tone === tone).length }))
          .filter((t) => t.count > 0);
        return (
          <PortfolioGroupCard
            key={w.id}
            name={w.name}
            eyebrow="Wallet"
            color={w.color}
            subtitle={<>{own.length === 0 ? "No alerts yet" : `${own.length} ${own.length === 1 ? "alert" : "alerts"}`}<span className="text-[#a8a29e]"> · {w.kind}</span></>}
            right={<>
              {counts.map((t) => (
                <span key={t.tone} className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${TONE_STYLES[t.tone].chip}`}>
                  {t.count} {TONE_WORD[t.tone]}
                </span>
              ))}
              <ComingSoonButton icon={<Plus className="h-4 w-4" />}>New alert</ComingSoonButton>
            </>}
          >
            {own.length === 0 ? (
              <p className="px-6 md:px-8 py-5 border-t border-[rgba(196,154,60,0.12)] text-sm text-[#a8a29e]">
                Nothing watched on this wallet. Alerts will tell you about a low balance, a large payment or a budget running out.
              </p>
            ) : (
              <ul className="px-6 md:px-8 border-t border-[rgba(196,154,60,0.12)] divide-y divide-[rgba(196,154,60,0.1)]">
                {own.map((a) => {
                  const state = walletAlertState(a);
                  const progress = a.enabled ? a.progressPct : undefined;
                  return (
                    <li key={a.id} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-x-8 gap-y-4 py-5">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[15px] font-black text-[#1c1917]">{a.title}<PreviewBadge label="Sample" /></p>
                        <p className="text-[13px] text-[#78716c] mt-1">{a.detail}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${TONE_STYLES[state.tone].chip}`}>{state.label}</span>
                          {a.enabled && a.now && (
                            <span className="text-[13px] font-bold tabular-nums text-[#1c1917]">
                              {a.now} <span className="text-[#a8a29e] font-semibold">of {a.limit}</span>
                            </span>
                          )}
                        </div>
                        <div className="mt-2.5 h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                          {progress !== undefined && <div className={`h-full rounded-full ${ALERT_BAR[state.tone]}`} style={{ width: `${Math.max(3, progress)}%` }} />}
                        </div>
                        <p className="text-[11px] font-semibold text-[#a8a29e] mt-1.5">
                          {progress !== undefined ? `${progress}% of the way to the limit` : a.enabled ? "Fires on the event itself" : "Not being checked"}
                        </p>
                      </div>
                      <div className="md:justify-self-end">
                        <Toggle
                          checked={a.enabled}
                          label={a.title}
                          onChange={(v) => setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PortfolioGroupCard>
        );
      })}
    </>
  );
}

const TONE_WORD: Record<keyof typeof ALERT_BAR, string> = {
  danger: "triggered", warn: "approaching", ok: "within range", muted: "off",
};
