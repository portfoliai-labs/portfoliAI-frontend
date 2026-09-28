// components/preview/WalletsOverview.tsx
"use client";

import { useMemo } from "react";
import { ArrowRight, CreditCard, Landmark, PiggyBank, TrendingDown, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { formatCurrency } from "../../lib/format";
import { WALLETS, monthlySummary, type Wallet } from "../../lib/mock/wallets";
import { openWalletsPage } from "./WalletsSection";
import { PreviewBadge, serif } from "./PreviewKit";

const eur = (v: number) => formatCurrency(v, "EUR", 0);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${eur(Math.abs(v))}`;

const KIND_ICON: Record<Wallet["kind"], React.ReactNode> = {
  "Current account": <Landmark className="h-3.5 w-3.5" />,
  "Credit card": <CreditCard className="h-3.5 w-3.5" />,
  Savings: <PiggyBank className="h-3.5 w-3.5" />,
  Cash: <WalletIcon className="h-3.5 w-3.5" />,
};

/**
 * WALLETS OVERVIEW (preview) — the Dashboard's wallets module, built like its investments one:
 * all wallets together on top (balance, this month's money in and out), then a tile per wallet
 * with its balance only, attached along the bottom. Shown to demo accounts only, on the sample
 * data of lib/mock/wallets; a tile opens that wallet's page under Wallets.
 */
export function WalletsOverviewModule({ onNavigate }: { onNavigate?: (section: string) => void }) {
  const month = useMemo(() => monthlySummary(null).at(-1)!, []);
  const balances = useMemo(() => WALLETS.map((w) => ({ wallet: w, balance: monthlySummary(w.id).at(-1)!.balance })), []);
  const open = (id: string) => onNavigate && openWalletsPage(onNavigate, id);

  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 md:p-7 pb-5 border-b border-slate-100 flex flex-wrap items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">EUR</p>
            <PreviewBadge label="Sample data" />
          </div>
          <h2 className="text-lg md:text-xl font-black text-slate-900" style={serif}>All wallets</h2>
          <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">Your everyday money: accounts, cards and savings.</p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate("wallets")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 hover:border-[#C49A3C] hover:text-[#C49A3C] transition-colors"
          >
            Open wallets <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 divide-y divide-slate-100 md:divide-y-0 md:divide-x">
        <Figure title="Balance" value={eur(month.balance)} icon={<WalletIcon className="h-4 w-4" />} tone="gold" />
        <Figure title="In this month" value={signed(month.income)} icon={<TrendingUp className="h-4 w-4" />} tone="emerald" />
        <Figure title="Out this month" value={signed(-month.expenses)} icon={<TrendingDown className="h-4 w-4" />} tone="red" />
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 p-4 md:p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 px-1">Wallets</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map(({ wallet, balance }) => (
            <button
              key={wallet.id}
              onClick={() => open(wallet.id)}
              className="group text-left bg-white rounded-2xl border border-slate-200 hover:border-[#C49A3C]/50 transition-colors px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-bold text-slate-700 truncate">
                  <span style={{ color: wallet.color }} className="shrink-0">{KIND_ICON[wallet.kind]}</span>
                  <span className="truncate">{wallet.name}</span>
                </p>
                <p className={`mt-1 pl-5.5 text-lg font-black tabular-nums ${balance < 0 ? "text-rose-600" : "text-slate-900"}`} style={serif}>
                  {eur(balance)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const TONES = {
  gold: "bg-[#C49A3C]/10 text-[#C49A3C] border-[#C49A3C]/20",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  red: "bg-red-50 text-red-600 border-red-100",
};

// Same look as the Dashboard's Stat, without its info tooltip.
function Figure({ title, value, icon, tone }: { title: string; value: string; icon: React.ReactNode; tone: keyof typeof TONES }) {
  return (
    <div className="p-6 md:p-7 flex flex-col gap-2.5">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${TONES[tone]}`}>{icon}</div>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <p className="font-black text-slate-900 text-xl md:text-2xl tabular-nums" style={serif}>{value}</p>
    </div>
  );
}
