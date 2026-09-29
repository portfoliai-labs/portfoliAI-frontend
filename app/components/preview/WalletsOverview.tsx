// components/preview/WalletsOverview.tsx

import { monthlySummary } from "../../lib/mock/wallets";

export interface WalletsSummary {
  currency: string;
  balance: number;
  // This month's money in and out, moves between one's own wallets left out.
  income: number;
  expenses: number;
}

/**
 * WALLETS SUMMARY (preview) — all wallets together, for the Dashboard's net worth: the balance
 * and this month's money in and out. Demo accounts only, from the sample data of
 * lib/mock/wallets (every wallet there is in EUR).
 */
export function walletsSummary(): WalletsSummary {
  const month = monthlySummary(null).at(-1)!;
  return { currency: "EUR", balance: month.balance, income: month.income, expenses: month.expenses };
}
