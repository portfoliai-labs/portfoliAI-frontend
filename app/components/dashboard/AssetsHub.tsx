// components/dashboard/AssetsHub.tsx
"use client";

import { useEffect, useState } from "react";
import { Briefcase, Hourglass, Wallet } from "lucide-react";
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
 * ASSETS HUB — where Assets opens: one card per kind of asset, each leading to its own hub.
 * Investments (the portfolios, with their value today: the aggregate's, or the only real
 * portfolio's) and Wallets (everyday money: a preview on sample data for a demo account, coming
 * soon for everyone else). A demo account also sees Retirement simulation, coming soon.
 */
export function AssetsHub({ onInvestments, onWallets }: { onInvestments: () => void; onWallets: () => void }) {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        <ActionCard
          icon={<Briefcase className="h-5 w-5" />}
          title="Investments"
          text="Your portfolios: holdings, returns and risk, plus Compare and strategy backtests."
          onClick={onInvestments}
        >
          <Figure
            value={investments === undefined ? null : investments ? formatCurrency(investments.marketValue, investments.currency, 0) : "—"}
            note={`${real.length} ${real.length === 1 ? "portfolio" : "portfolios"}${backtests > 0 ? ` · ${backtests} virtual` : ""}`}
          />
        </ActionCard>
        <ActionCard
          icon={<Wallet className="h-5 w-5" />}
          title="Wallets"
          badge={<PreviewBadge dark label={wallets ? "Preview" : "Soon"} />}
          text="Accounts, cards, savings and cash: what comes in and goes out, budgets and alerts."
          onClick={wallets ? onWallets : undefined}
        >
          {wallets && (
            <Figure value={formatCurrency(wallets.balance, wallets.currency, 0)} note={`${WALLETS.length} wallets · sample data`} />
          )}
        </ActionCard>
        {isDemo && (
          <ActionCard
            icon={<Hourglass className="h-5 w-5" />}
            title="Retirement simulation"
            badge={<PreviewBadge dark label="Soon" />}
            text="How long your savings would last, and how much you'd need, across thousands of simulated markets."
          />
        )}
      </div>
    </div>
  );
}

/** A card's figure, with a line under it; "…" while it loads. */
function Figure({ value, note }: { value: string | null; note: string }) {
  return (
    <div>
      <p className="text-2xl font-black text-white tabular-nums" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{value ?? "…"}</p>
      <p className="text-xs font-bold text-[#C49A3C] mt-0.5">{note}</p>
    </div>
  );
}
