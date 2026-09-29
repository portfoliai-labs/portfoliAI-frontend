// lib/mock/wallets.ts
//
// SAMPLE DATA for the Wallets preview (components/preview/WalletPages, under Manage): three made-up
// accounts with a year of everyday money in and out (salary, rent, groceries, bills…), the
// budgets set on them, their alerts and monthly statements. Generated from fixed seeds so the
// pages look the same on every visit.

import { hashSeed, round, seeded } from "./random";

export type WalletKind = "Current account" | "Credit card" | "Savings" | "Cash";

export interface Wallet {
  id: string;
  name: string;
  kind: WalletKind;
  institution: string;
  color: string;
  openingBalance: number;
}

export type Category =
  | "Salary" | "Freelance" | "Refunds" | "Interest" | "Transfers in"
  | "Housing" | "Groceries" | "Restaurants" | "Transport" | "Utilities" | "Subscriptions"
  | "Shopping" | "Health" | "Travel" | "Leisure" | "Transfers out";

export const INCOME_CATEGORIES: Category[] = ["Salary", "Freelance", "Refunds", "Interest", "Transfers in"];

export const CATEGORY_COLORS: Record<Category, string> = {
  Salary: "#1baf7a", Freelance: "#008300", Refunds: "#2a78d6", Interest: "#4a3aa7", "Transfers in": "#94a3b8",
  Housing: "#2a78d6", Groceries: "#1baf7a", Restaurants: "#eb6834", Transport: "#eda100", Utilities: "#4a3aa7",
  Subscriptions: "#e87ba4", Shopping: "#e34948", Health: "#008300", Travel: "#0ea5e9", Leisure: "#a16207", "Transfers out": "#94a3b8",
};

export interface WalletTransaction {
  id: string;
  walletId: string;
  date: string; // YYYY-MM-DD
  description: string;
  category: Category;
  amount: number; // signed: money in positive
}

export const WALLETS: Wallet[] = [
  { id: "everyday", name: "Everyday account", kind: "Current account", institution: "Banca Esempio", color: "#2a78d6", openingBalance: 3200 },
  { id: "card", name: "Credit card", kind: "Credit card", institution: "Carta Demo", color: "#e34948", openingBalance: -460 },
  { id: "savings", name: "Savings pot", kind: "Savings", institution: "Conto Deposito Demo", color: "#1baf7a", openingBalance: 12500 },
];

// Twelve months, October 2025 to September 2026 (the current one, running to the 28th).
export const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2025, 9 + i, 1);
  return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) };
});

const MERCHANTS: Partial<Record<Category, string[]>> = {
  Groceries: ["Esselunga", "Coop", "Carrefour Express", "Lidl", "Local market"],
  Restaurants: ["Pizzeria Da Gino", "Sushi Zen", "Bar Centrale", "Trattoria Rossi", "Deliveroo"],
  Transport: ["ATM Milano", "Trenitalia", "Q8 fuel", "Italo", "Parking"],
  Shopping: ["Amazon", "Zara", "Decathlon", "IKEA", "MediaWorld"],
  Health: ["Farmacia Centrale", "Dentist", "Gym membership"],
  Leisure: ["Cinema", "Concert tickets", "Bookshop", "Padel court"],
  Travel: ["Ryanair", "Booking.com", "Airbnb"],
};

export const WALLET_TRANSACTIONS: WalletTransaction[] = (() => {
  const out: WalletTransaction[] = [];
  let n = 0;
  const push = (walletId: string, date: string, description: string, category: Category, amount: number) =>
    out.push({ id: `w${n++}`, walletId, date, description, category, amount: round(amount, 2) });

  // The card is settled from the Everyday account on the 6th, for what it spent the month before.
  let cardDue = 460;
  MONTHS.forEach(({ key }, mi) => {
    const rand = seeded(hashSeed(key));
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
    const day = (d: number) => `${key}-${String(Math.min(d, 28)).padStart(2, "0")}`;

    // Everyday account: salary in, fixed bills out, the card settled, savings put aside.
    push("everyday", day(27), "Salary — Acme S.r.l.", "Salary", mi === 2 ? 2480 * 2 : 2480); // December: 13th month
    if (rand() > 0.6) push("everyday", day(15), "Invoice — freelance project", "Freelance", 400 + round(rand() * 900));
    push("everyday", day(1), "Rent — Via Tortona 5", "Housing", -950);
    push("everyday", day(5), "Electricity & gas", "Utilities", -(70 + rand() * 60 + (mi >= 2 && mi <= 5 ? 45 : 0)));
    push("everyday", day(8), "Fibre internet", "Utilities", -29.9);
    push("everyday", day(9), "Mobile plan", "Utilities", -9.99);
    push("everyday", day(3), "Transfer to Savings pot", "Transfers out", -400);
    push("everyday", day(6), "Credit card settlement", "Transfers out", -cardDue);
    for (let w = 0; w < 4; w++) push("everyday", day(2 + w * 7), pick(MERCHANTS.Groceries!), "Groceries", -(38 + rand() * 55));
    for (let t = 0; t < 3; t++) push("everyday", day(4 + t * 9), pick(MERCHANTS.Transport!), "Transport", -(4 + rand() * 38));
    if (rand() > 0.7) push("everyday", day(19), pick(MERCHANTS.Health!), "Health", -(25 + rand() * 90));
    if (rand() > 0.85) push("everyday", day(21), "Tax refund", "Refunds", 120 + rand() * 300);

    // Credit card: eating out, shopping, subscriptions, trips.
    for (let r = 0; r < 4 + Math.floor(rand() * 4); r++) push("card", day(1 + Math.floor(rand() * 27)), pick(MERCHANTS.Restaurants!), "Restaurants", -(12 + rand() * 55));
    for (let s = 0; s < 1 + Math.floor(rand() * 3); s++) push("card", day(1 + Math.floor(rand() * 27)), pick(MERCHANTS.Shopping!), "Shopping", -(20 + rand() * (mi === 2 ? 260 : 120)));
    push("card", day(12), "Netflix", "Subscriptions", -13.99);
    push("card", day(14), "Spotify", "Subscriptions", -11.99);
    push("card", day(20), "iCloud+", "Subscriptions", -2.99);
    if (rand() > 0.5) push("card", day(10 + Math.floor(rand() * 15)), pick(MERCHANTS.Leisure!), "Leisure", -(15 + rand() * 60));
    if (mi === 9 || mi === 10 || mi === 5) push("card", day(11), pick(MERCHANTS.Travel!), "Travel", -(180 + rand() * 420));
    push("card", day(6), "Payment from Everyday account", "Transfers in", cardDue);
    cardDue = -out.filter((t) => t.walletId === "card" && t.date.startsWith(key) && t.amount < 0).reduce((s, t) => s + t.amount, 0);

    // Savings pot: the monthly transfer in, quarterly interest.
    push("savings", day(3), "From Everyday account", "Transfers in", 400);
    if (mi % 3 === 2) push("savings", day(28), "Interest", "Interest", 12500 * 0.025 / 4 * (1 + mi / 30));
    if (mi === 9) push("savings", day(10), "Summer holiday — Sardinia", "Travel", -1500);
  });
  return out.sort((a, b) => b.date.localeCompare(a.date));
})();

export const transactionsOf = (walletId: string | null) =>
  walletId ? WALLET_TRANSACTIONS.filter((t) => t.walletId === walletId) : WALLET_TRANSACTIONS;

const isTransfer = (c: Category) => c === "Transfers in" || c === "Transfers out";

/** Income, spending and month-end balance for each of the twelve months. */
export function monthlySummary(walletId: string | null) {
  const wallets = walletId ? WALLETS.filter((w) => w.id === walletId) : WALLETS;
  let balance = wallets.reduce((s, w) => s + w.openingBalance, 0);
  const txs = transactionsOf(walletId);
  return MONTHS.map(({ key, label }) => {
    const inMonth = txs.filter((t) => t.date.startsWith(key));
    // Moves between one's own wallets aren't income or spending when looking at all of them.
    const counted = walletId ? inMonth : inMonth.filter((t) => !isTransfer(t.category));
    const income = counted.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const expenses = -counted.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    balance += inMonth.reduce((s, t) => s + t.amount, 0);
    return { month: key, label, income: round(income), expenses: round(expenses), net: round(income - expenses), balance: round(balance) };
  });
}

export const walletBalance = (walletId: string | null) => monthlySummary(walletId).at(-1)!.balance;

/** Spending by category over the given months (default: all twelve), largest first. */
export function spendingByCategory(walletId: string | null, monthKeys?: string[]) {
  const map = new Map<Category, number>();
  for (const t of transactionsOf(walletId)) {
    if (t.amount >= 0 || isTransfer(t.category)) continue;
    if (monthKeys && !monthKeys.some((k) => t.date.startsWith(k))) continue;
    map.set(t.category, (map.get(t.category) ?? 0) - t.amount);
  }
  return [...map].map(([category, amount]) => ({ category, amount: round(amount) })).sort((a, b) => b.amount - a.amount);
}

export function topMerchants(walletId: string | null, limit = 6) {
  const map = new Map<string, { amount: number; count: number; category: Category }>();
  for (const t of transactionsOf(walletId)) {
    if (t.amount >= 0 || isTransfer(t.category) || t.category === "Housing" || t.category === "Utilities") continue;
    const cur = map.get(t.description) ?? { amount: 0, count: 0, category: t.category };
    cur.amount -= t.amount;
    cur.count += 1;
    map.set(t.description, cur);
  }
  return [...map].map(([name, v]) => ({ name, ...v, amount: round(v.amount) })).sort((a, b) => b.amount - a.amount).slice(0, limit);
}

export interface Budget {
  category: Category;
  limit: number; // per month
}

export const BUDGETS: Budget[] = [
  { category: "Groceries", limit: 320 },
  { category: "Restaurants", limit: 220 },
  { category: "Transport", limit: 90 },
  { category: "Shopping", limit: 200 },
  { category: "Subscriptions", limit: 35 },
  { category: "Leisure", limit: 80 },
  { category: "Utilities", limit: 170 },
  { category: "Health", limit: 60 },
];

export interface WalletAlert {
  id: string;
  // The wallet it watches.
  walletId: string;
  title: string;
  detail: string;
  enabled: boolean;
  triggered: boolean;
  // Where it stands, when it measures something: now against the limit, and how far along the
  // way it is (0–100).
  now?: string;
  limit?: string;
  progressPct?: number;
}

export const WALLET_ALERTS: WalletAlert[] = [
  { id: "a1", walletId: "everyday", title: "Low balance", detail: "Balance drops under €500", enabled: true, triggered: false, now: "€1,840", limit: "€500", progressPct: 27 },
  { id: "a2", walletId: "everyday", title: "Budget at 90%", detail: "Any category reaches 90% of its monthly budget", enabled: true, triggered: true, now: "Restaurants 96%", limit: "90%", progressPct: 100 },
  { id: "a4", walletId: "everyday", title: "Salary received", detail: "When the monthly salary lands", enabled: false, triggered: false },
  { id: "a3", walletId: "card", title: "Large expense", detail: "A single payment over €250", enabled: true, triggered: true, now: "€312", limit: "€250", progressPct: 100 },
  { id: "a5", walletId: "card", title: "New subscription", detail: "A recurring charge from a merchant not seen before", enabled: true, triggered: false },
  { id: "a6", walletId: "card", title: "Card statement due", detail: "Three days before the card is settled", enabled: true, triggered: false, now: "5 days left", limit: "3 days", progressPct: 72 },
];

/** A report in the Wallets preview's archive: a month's statement or a year's summary. */
export interface WalletReport {
  id: string;
  walletId: string;
  kind: "monthly" | "yearly";
  name: string;
  createdAt: string;
  tags: string[];
}

// Each wallet's last three monthly statements (made on the 1st of the month after) and its 2025
// summary.
export const WALLET_REPORTS: WalletReport[] = WALLETS.flatMap((w) => [
  ...MONTHS.slice(-4, -1).reverse().map((m, i) => {
    const [y, mo] = m.key.split("-").map(Number);
    const month = new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    return {
      id: `${w.id}-${m.key}`,
      walletId: w.id,
      kind: "monthly" as const,
      name: `${w.name} — ${month} statement`,
      createdAt: new Date(y, mo, 1, 7).toISOString(),
      tags: i === 0 && w.id === "everyday" ? ["Taxes"] : [],
    };
  }),
  {
    id: `${w.id}-2025`,
    walletId: w.id,
    kind: "yearly" as const,
    name: `${w.name} — 2025 summary`,
    createdAt: new Date(2026, 0, 2, 7).toISOString(),
    tags: w.id === "savings" ? ["Year end", "Taxes"] : ["Year end"],
  },
]);

export const RECURRING = [
  { name: "Rent — Via Tortona 5", amount: 950, every: "Monthly, 1st" },
  { name: "Transfer to Savings pot", amount: 400, every: "Monthly, 3rd" },
  { name: "Electricity & gas", amount: 110, every: "Monthly, ~5th" },
  { name: "Fibre internet", amount: 29.9, every: "Monthly, 8th" },
  { name: "Netflix", amount: 13.99, every: "Monthly, 12th" },
  { name: "Spotify", amount: 11.99, every: "Monthly, 14th" },
  { name: "Mobile plan", amount: 9.99, every: "Monthly, 9th" },
  { name: "iCloud+", amount: 2.99, every: "Monthly, 20th" },
];
