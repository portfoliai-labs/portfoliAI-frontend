// components/preview/WalletsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, LineChart, BarChart, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid, ReferenceLine,
} from "recharts";
import {
  ArrowUpRight, BellRing, CreditCard, Download, FileText, Landmark, Layers, Lightbulb, PiggyBank, Plus, Receipt, Search, Target, TrendingUp, Upload, Wallet as WalletIcon,
} from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { ActionCard } from "../dashboard/InsightsHub";
import { DataTable, type DataColumn } from "../dashboard/ExploreView";
import { Toggle } from "../dashboard/Toggle";
import { formatCompact, formatCurrency } from "../../lib/format";
import {
  BUDGETS, CATEGORY_COLORS, INCOME_CATEGORIES, MONTHS, RECURRING, WALLETS, WALLET_ALERTS,
  monthlySummary, spendingByCategory, topMerchants, transactionsOf,
  type Category, type Wallet, type WalletTransaction,
} from "../../lib/mock/wallets";
import { AXIS_TICK, ComingSoonButton, Panel, Pills, PreviewBadge, PreviewBanner, Stat, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

type WalletPage = "home" | "transactions" | "insights" | "reports" | "budgets" | "alerts";
type View = { kind: "hub" } | { kind: "wallet"; id: string; page: WalletPage };

const ALL = "all";
const eur = (v: number, d = 0) => formatCurrency(v, "EUR", d);
const scopeOf = (id: string) => (id === ALL ? null : id);
const nameOf = (id: string) => (id === ALL ? "All wallets" : WALLETS.find((w) => w.id === id)!.name);
const CURRENT_MONTH = MONTHS.at(-1)!.key;
// Day 28 of September's 30: how far into the month budgets should be.
const MONTH_ELAPSED = 28 / 30;

const PAGE_LABELS: Record<Exclude<WalletPage, "home">, string> = {
  transactions: "Transactions", insights: "Insights", reports: "Reports", budgets: "Budgets", alerts: "Alerts",
};

/**
 * Opens Wallets on one wallet's page (`"all"` for All wallets) rather than on the hub, from
 * elsewhere in the dashboard (the Dashboard's wallet tiles): like openPortfoliosPage, the page
 * rides in the URL hash (#wallet=<id>), which WalletsSection reads when it mounts and clears.
 */
export function openWalletsPage(onNavigate: (section: string) => void, walletId: string) {
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#wallet=${encodeURIComponent(walletId)}`);
  onNavigate("wallets");
}

const viewFromHash = (): View => {
  if (typeof window === "undefined") return { kind: "hub" };
  const match = window.location.hash.match(/^#wallet=([\w-]+)$/);
  if (!match || (match[1] !== ALL && !WALLETS.some((w) => w.id === match[1]))) return { kind: "hub" };
  return { kind: "wallet", id: match[1], page: "home" };
};

/**
 * WALLETS SECTION (preview) — everyday money, next to the investments: current accounts, cards,
 * savings and cash, with what comes in and goes out. Built like Portfolios: a hub of wallets
 * ("All wallets" first), each opening its own page (balance, the year's income, spending and
 * balance), and from there its Transactions, Insights, Budgets, Reports and Alerts, with the
 * trail shown in the Sidebar through Breadcrumb. All figures come from lib/mock/wallets.
 */
export function WalletsSection() {
  const [view, setView] = useState<View>(viewFromHash);
  // The hash only carries the request to open a wallet (openWalletsPage): clear it.
  useEffect(() => {
    if (window.location.hash.startsWith("#wallet=")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);
  const go = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  if (view.kind === "hub") return <WalletsHub onOpen={(id) => go({ kind: "wallet", id, page: "home" })} />;

  const hubCrumb: Crumb = { label: "Wallets", onClick: () => go({ kind: "hub" }) };
  const homeCrumb: Crumb = { label: nameOf(view.id), onClick: () => go({ kind: "wallet", id: view.id, page: "home" }) };
  const openPage = (page: WalletPage) => go({ kind: "wallet", id: view.id, page });
  const scope = scopeOf(view.id);

  if (view.page === "home") {
    return <WalletHome id={view.id} trail={[hubCrumb]} onOpenPage={openPage} />;
  }

  const trail = [hubCrumb, homeCrumb];
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current={PAGE_LABELS[view.page]} right={pageAction(view.page)} />
      {view.page === "transactions" && <WalletTransactions scope={scope} />}
      {view.page === "insights" && <WalletInsights scope={scope} />}
      {view.page === "budgets" && <WalletBudgets scope={scope} />}
      {view.page === "reports" && <WalletReports scope={scope} name={nameOf(view.id)} />}
      {view.page === "alerts" && <WalletAlerts />}
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
    case "reports":
      return <ComingSoonButton icon={<FileText className="h-3.5 w-3.5" />}>Generate report</ComingSoonButton>;
    case "alerts":
      return <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>New alert</ComingSoonButton>;
    default:
      return undefined;
  }
}

// ── Hub ────────────────────────────────────────────────────────────────────────────────────

const KIND_ICON: Record<Wallet["kind"], React.ReactNode> = {
  "Current account": <Landmark className="h-4 w-4" />,
  "Credit card": <CreditCard className="h-4 w-4" />,
  Savings: <PiggyBank className="h-4 w-4" />,
  Cash: <WalletIcon className="h-4 w-4" />,
};

function WalletsHub({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <div className="space-y-6 pb-12">
      <PreviewBanner feature="Wallets">
        Wallets will hold your everyday money — accounts, cards, savings and cash — with income, spending, budgets and
        alerts, next to your investments. The wallets and transactions below are sample data; nothing is connected or saved.
      </PreviewBanner>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <WalletCard
          id={ALL}
          title="All wallets"
          subtitle={`${WALLETS.length} wallets`}
          icon={<Layers className="h-4 w-4" />}
          color="#C49A3C"
          onOpen={() => onOpen(ALL)}
        />
        {WALLETS.map((w) => (
          <WalletCard key={w.id} id={w.id} title={w.name} subtitle={`${w.kind} · ${w.institution}`} icon={KIND_ICON[w.kind]} color={w.color} onOpen={() => onOpen(w.id)} />
        ))}
        <button
          type="button"
          disabled
          title="Coming soon"
          className="min-h-44 h-full w-full rounded-3xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-slate-400 cursor-not-allowed"
        >
          <Plus className="h-6 w-6" />
          <span className="text-[13px] font-bold">Connect a bank or add a wallet</span>
          <PreviewBadge label="Soon" />
        </button>
      </div>
    </div>
  );
}

function WalletCard({ id, title, subtitle, icon, color, onOpen }: { id: string; title: string; subtitle: string; icon: React.ReactNode; color: string; onOpen: () => void }) {
  const summary = useMemo(() => monthlySummary(scopeOf(id)), [id]);
  const balance = summary.at(-1)!.balance;
  const month = summary.at(-1)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-h-44 h-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col gap-4 hover:border-[#C49A3C]/50 hover:shadow-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>{icon}</span>
          <div className="min-w-0">
            <p className="text-lg font-black text-slate-900 truncate leading-tight" style={serif}>{title}</p>
            <p className="text-[11px] font-semibold text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>
        <span className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-100 text-slate-400 group-hover:bg-[#C49A3C] group-hover:text-white transition-colors shrink-0">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="flex-1 flex items-end justify-between gap-4 w-full">
        <div className="min-w-0">
          <p className={`text-2xl font-black tabular-nums truncate ${balance < 0 ? "text-rose-600" : "text-slate-900"}`} style={serif}>{eur(balance)}</p>
          <p className="text-[12px] font-bold tabular-nums mt-1">
            <span className="text-emerald-600">+{eur(month.income)}</span>
            <span className="text-slate-300"> · </span>
            <span className="text-rose-600">−{eur(month.expenses)}</span>
            <span className="text-slate-400 font-semibold"> this month</span>
          </p>
        </div>
        <div className="w-24 h-12 shrink-0">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 96, height: 48 }}>
            <LineChart data={summary} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="balance" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  );
}

// ── Wallet home ────────────────────────────────────────────────────────────────────────────

function WalletHome({ id, trail, onOpenPage }: { id: string; trail: Crumb[]; onOpenPage: (page: WalletPage) => void }) {
  const scope = scopeOf(id);
  const summary = useMemo(() => monthlySummary(scope), [scope]);
  const month = summary.at(-1)!;
  const year = summary.reduce((acc, m) => ({ income: acc.income + m.income, expenses: acc.expenses + m.expenses }), { income: 0, expenses: 0 });
  const savingsRate = year.income > 0 ? ((year.income - year.expenses) / year.income) * 100 : 0;
  const txCount = transactionsOf(scope).length;
  const budgetsOver = budgetStatus(scope).filter((b) => b.spent > b.limit).length;
  const alertsTriggered = WALLET_ALERTS.filter((a) => a.enabled && a.triggered).length;

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current={nameOf(id)} />
      <PreviewBanner feature="Wallets" />

      <section className="bg-white rounded-4xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <div className="p-6 md:p-7 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Balance today</p>
                <PreviewBadge label="Sample" />
              </div>
              <p className="text-3xl md:text-4xl font-black text-slate-900 tabular-nums" style={serif}>{eur(month.balance)}</p>
              <p className="text-[13px] font-bold tabular-nums mt-2">
                <span className={month.net >= 0 ? "text-emerald-600" : "text-rose-600"}>{month.net >= 0 ? "+" : ""}{eur(month.net)}</span>
                <span className="text-slate-400 font-semibold"> this month</span>
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Stat label="In, 12 months" value={eur(year.income)} tone="gain" />
              <Stat label="Out, 12 months" value={eur(year.expenses)} tone="loss" />
              <Stat label="Savings rate" value={`${savingsRate.toFixed(0)}%`} note="Of what came in, kept" />
              <Stat label="Avg spend / month" value={eur(year.expenses / 12)} />
            </dl>
          </div>
          <div className="h-72 lg:h-auto lg:min-h-72 border-t lg:border-t-0 lg:border-l border-slate-100 p-4">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 560, height: 280 }}>
              <ComposedChart data={summary} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
                <YAxis yAxisId="flow" tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                <YAxis yAxisId="bal" orientation="right" tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, name) => [eur(Number(v)), FLOW_LABELS[name as keyof typeof FLOW_LABELS] ?? name]} />
                <Legend formatter={(v) => FLOW_LABELS[v as keyof typeof FLOW_LABELS] ?? v} wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="flow" dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                <Bar yAxisId="flow" dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                <Line yAxisId="bal" type="monotone" dataKey="balance" stroke="#C49A3C" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionCard
          className="md:col-span-2 min-h-0"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Insights"
          text="Where the money goes: spending by category, top merchants, recurring payments and how much you save."
          onClick={() => onOpenPage("insights")}
        >
          <div className="flex flex-wrap gap-1.5">
            {["Categories", "Merchants", "Recurring", "Savings rate"].map((label) => (
              <span key={label} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-stone-300">{label}</span>
            ))}
          </div>
        </ActionCard>
        <ActionCard icon={<Receipt className="h-5 w-5" />} title="Transactions" text="Every payment and deposit, searchable and filterable by category." onClick={() => onOpenPage("transactions")}>
          <p className="text-xs font-bold text-[#C49A3C]">{txCount.toLocaleString("en-US")} transactions</p>
        </ActionCard>
        <ActionCard icon={<Target className="h-5 w-5" />} title="Budgets" text="A monthly limit per category, and how this month is tracking." onClick={() => onOpenPage("budgets")}>
          <p className="text-xs font-bold text-[#C49A3C]">{BUDGETS.length} budgets{budgetsOver > 0 ? ` · ${budgetsOver} over` : ""}</p>
        </ActionCard>
        <ActionCard icon={<FileText className="h-5 w-5" />} title="Reports" text="Monthly statements and a yearly summary, as PDF." onClick={() => onOpenPage("reports")}>
          <p className="text-xs font-bold text-[#C49A3C]">{MONTHS.length} monthly statements</p>
        </ActionCard>
        <ActionCard icon={<BellRing className="h-5 w-5" />} title="Alerts" text="Low balance, budgets running out, large or unexpected payments." onClick={() => onOpenPage("alerts")}>
          <p className="text-xs font-bold text-[#C49A3C]">{WALLET_ALERTS.filter((a) => a.enabled).length} active · {alertsTriggered} triggered</p>
        </ActionCard>
      </div>
    </div>
  );
}

const FLOW_LABELS = { income: "In", expenses: "Out", balance: "Balance" };

// ── Transactions ───────────────────────────────────────────────────────────────────────────

function CategoryChip({ category }: { category: Category }) {
  const color = CATEGORY_COLORS[category];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ background: `${color}14`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{category}
    </span>
  );
}

function WalletTransactions({ scope }: { scope: string | null }) {
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

function WalletReports({ scope, name }: { scope: string | null; name: string }) {
  const summary = useMemo(() => monthlySummary(scope), [scope]);
  const reports = [
    ...[...summary].reverse().map((m) => ({
      id: m.month,
      title: `${new Date(`${m.month}-01`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} statement`,
      detail: `In ${eur(m.income)} · out ${eur(m.expenses)} · closing ${eur(m.balance)}`,
      partial: m.month === CURRENT_MONTH,
    })),
    { id: "y2025", title: "2025 yearly summary", detail: "Income, spending by category, savings rate and net worth change", partial: false },
  ];
  return (
    <>
      <PreviewBanner feature="Wallet reports" />
      <Panel title={`${name} — reports`} subtitle="Generated at the start of each month for the one before.">
        <ul className="divide-y divide-slate-100">
          {reports.map((r) => (
            <li key={r.id} className="px-6 md:px-7 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-900 truncate">
                    {r.title}
                    {r.partial && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-500 align-middle">In progress</span>}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 truncate">{r.detail}</p>
                </div>
              </div>
              <button type="button" disabled title="Coming soon" className="p-2.5 rounded-xl border border-slate-200 text-slate-300 cursor-not-allowed shrink-0">
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

// ── Alerts ─────────────────────────────────────────────────────────────────────────────────

function WalletAlerts() {
  const [alerts, setAlerts] = useState(WALLET_ALERTS);
  return (
    <>
      <PreviewBanner feature="Wallet alerts">Sample rules. Switching them on or off works on this page only and isn&apos;t saved.</PreviewBanner>
      <Panel title="Alert rules" subtitle="Notifications will arrive by email and in the bell at the top.">
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <li key={a.id} className="px-6 md:px-7 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.enabled && a.triggered ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
                  <BellRing className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-900">
                    {a.title}
                    {a.enabled && a.triggered && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-50 text-[9px] font-black uppercase tracking-wider text-rose-600 align-middle">Triggered</span>}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400">{a.detail}</p>
                </div>
              </div>
              <Toggle
                checked={a.enabled}
                label={a.title}
                onChange={(v) => setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
