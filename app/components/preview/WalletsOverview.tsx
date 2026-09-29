// components/preview/WalletsOverview.tsx

import { WALLETS, monthlySummary, type WalletKind } from "../../lib/mock/wallets";

export interface WalletLine {
  id: string;
  name: string;
  kind: WalletKind;
  color: string;
  balance: number;
  // This month's money in minus money out, moves to and from the user's other wallets included.
  net: number;
}

export interface WalletsSummary {
  currency: string;
  balance: number;
  // This month's money in and out, moves between one's own wallets left out.
  income: number;
  expenses: number;
  // Each wallet on its own, in the hub's order.
  wallets: WalletLine[];
}

/**
 * WALLETS SUMMARY (preview) — all wallets together, and each on its own, for the Dashboard's net
 * worth: the balance and this month's money in and out. Demo accounts only, from the sample data
 * of lib/mock/wallets (every wallet there is in EUR).
 */
export function walletsSummary(): WalletsSummary {
  const month = monthlySummary(null).at(-1)!;
  const wallets = WALLETS.map((w) => {
    const own = monthlySummary(w.id).at(-1)!;
    return { id: w.id, name: w.name, kind: w.kind, color: w.color, balance: own.balance, net: own.net };
  });
  return { currency: "EUR", balance: month.balance, income: month.income, expenses: month.expenses, wallets };
}
