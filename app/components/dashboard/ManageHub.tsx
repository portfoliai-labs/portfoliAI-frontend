// components/dashboard/ManageHub.tsx
"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Briefcase, Goal, Hourglass, Wallet } from "lucide-react";
import { usePortfolio } from "../../context/PortfolioContext";
import { useUser } from "../../context/UserContext";
import { portfoliosService } from "../../services/portfoliosService";
import { formatCurrency } from "../../lib/format";
import { WALLETS } from "../../lib/mock/wallets";
import { walletsSummary } from "../preview/WalletsOverview";
import { PreviewBadge } from "../preview/PreviewKit";
import { ActionCard } from "./InsightsHub";
import type { ComparisonValue } from "../../models/PortfolioData";

/**
 * MANAGE HUB — where Manage (everything the user owns) opens: one card per kind of asset, each
 * leading to its own hub.
 * Investments (the portfolios, with their value today: the aggregate's, or the only real
 * portfolio's) and Wallets (everyday money: a preview on sample data for a demo account, coming
 * soon for everyone else), on white cards. A demo account also sees, in a row of its own on a
 * dark cards, Retirement simulation and Goal planning (coming soon): not assets, but tools on all
 * of them.
 */
export function ManageHub({ onInvestments, onWallets }: { onInvestments: () => void; onWallets: () => void }) {
  const { portfolios } = usePortfolio();
  const { isDemo } = useUser();
  const real = portfolios.filter((p) => !p.isVirtual);
  const backtests = portfolios.filter((p) => p.isVirtual && !p.isAggregate).length;
  // Every real portfolio together: the aggregate when there is one, otherwise the only one.
  const headline = portfolios.find((p) => p.isAggregate) ?? real[0];
  const [value, setValue] = useState<{ uuid: string; value: ComparisonValue | null } | null>(null);

  useEffect(() => {
    if (!headline) return;
    let cancelled = false;
    portfoliosService.compare([headline.uuid])
      .then((list) => { if (!cancelled) setValue({ uuid: headline.uuid, value: list[0]?.value ?? null }); })
      .catch(() => { if (!cancelled) setValue({ uuid: headline.uuid, value: null }); });
    return () => { cancelled = true; };
  }, [headline?.uuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const investments = value?.uuid === headline?.uuid ? value?.value : undefined;
  const wallets = isDemo ? walletsSummary() : null;

  return (
    <div className="space-y-6 pb-12">
      {/* What the user owns, on white cards like the portfolios' and wallets' own. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <AssetCard
          icon={<Briefcase className="h-5 w-5" />}
          title="Investments"
          text="Your portfolios: holdings, returns and risk, plus Compare and strategy backtests."
          onClick={onInvestments}
        >
          <Figure
            value={investments === undefined ? null : investments ? formatCurrency(investments.marketValue, investments.currency, 0) : "—"}
            note={`${real.length} ${real.length === 1 ? "portfolio" : "portfolios"}${backtests > 0 ? ` · ${backtests} virtual` : ""}`}
          />
        </AssetCard>
        <AssetCard
          icon={<Wallet className="h-5 w-5" />}
          title="Wallets"
          badge={<PreviewBadge label={wallets ? "Preview" : "Soon"} />}
          text="Accounts, cards, savings and cash: what comes in and goes out, budgets and alerts."
          onClick={wallets ? onWallets : undefined}
        >
          {wallets && (
            <Figure value={formatCurrency(wallets.balance, wallets.currency, 0)} note={`${WALLETS.length} wallets · sample data`} />
          )}
        </AssetCard>
      </div>

      {/* What works across all of it, on a dark card in a row of its own, as the hubs' ways on are. */}
      {isDemo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <ActionCard
            icon={<Hourglass className="h-5 w-5" />}
            title="Retirement simulation"
            badge={<PreviewBadge dark label="Soon" />}
            text="Uses your investments and your wallets together: how long your savings would last, and how much you'd need, across thousands of simulated markets."
          />
          <ActionCard
            icon={<Goal className="h-5 w-5" />}
            title="Goal planning"
            badge={<PreviewBadge dark label="Soon" />}
            text="A house, a sabbatical, your kids' studies: set a target and a date, and see how much to put aside each month from your investments and wallets to get there."
          />
        </div>
      )}
    </div>
  );
}

/**
 * ASSET CARD — a kind of asset on Manage's hub (Investments, Wallets): white, like the portfolio
 * and wallet cards under it, so it reads apart from the dark cards of the tools (ActionCard).
 */
function AssetCard({ icon, title, text, badge, onClick, children }: {
  icon: React.ReactNode;
  title: string;
  text: string;
  badge?: React.ReactNode;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group min-h-52 h-full text-left bg-white rounded-3xl border border-slate-200 p-6 md:p-7 flex flex-col justify-between gap-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-slate-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60"
    >
      <div className="flex items-center justify-between">
        <span className="w-11 h-11 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center">{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-[#C49A3C] transition-colors" />
      </div>
      <div>
        <p className="flex items-center gap-2 text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}{badge}</p>
        <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">{text}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </button>
  );
}

/** A card's figure, with a line under it; "…" while it loads. */
function Figure({ value, note }: { value: string | null; note: string }) {
  return (
    <div>
      <p className="text-3xl font-black text-slate-900 tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{value ?? "…"}</p>
      <p className="text-xs font-bold text-[#C49A3C] mt-0.5">{note}</p>
    </div>
  );
}
