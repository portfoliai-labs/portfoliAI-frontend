// components/dashboard/PortfolioSections.tsx
"use client";

import { useMemo } from "react";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfolioColorMap } from "../../lib/chartColors";
import { Breadcrumb, type Crumb } from "./Breadcrumb";
import { FileUploader } from "./FileUploader";
import { ReportsBrowser } from "./ReportsBrowser";
import { AlertsSettings } from "./AlertsSettings";

/**
 * TRANSACTIONS (Manage / Investments / Transactions) — every portfolio's buys, sells and dividends
 * in one list, filtered by portfolio in the list itself (a backtest's read only); a new row picks
 * the portfolio it goes into where it's added (see FileUploader).
 */
export function PortfolioTransactionsSection({ trail }: { trail: Crumb[] }) {
  return (
    <div className="space-y-6">
      <Breadcrumb trail={trail} current="Transactions" />
      <FileUploader />
    </div>
  );
}

/** REPORTS (Manage / Investments / Reports) — every real portfolio's reports, as files (ReportsBrowser). */
export function PortfolioReportsSection({ trail }: { trail: Crumb[] }) {
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current="Reports" />
      <ReportsBrowser />
    </div>
  );
}

/**
 * ALERTS (Manage / Investments / Alerts) — every real portfolio's alert rules, a card each with its
 * own "New alert" (see AlertsSettings). The virtual ones ("All portfolios", the backtests) take no
 * alerts for now.
 */
// `portfolioUuid`: only that portfolio's alerts (from its row in Manage portfolios); every real
// portfolio's without it, or when it's gone.
export function PortfolioAlertsSection({ trail, portfolioUuid }: { trail: Crumb[]; portfolioUuid?: string }) {
  const { portfolios } = usePortfolio();
  // Each card in its portfolio's colour.
  const real = useMemo(() => {
    const colorOf = portfolioColorMap(portfolios);
    return portfolios.filter((p) => !p.isVirtual).map((p) => ({ uuid: p.uuid, name: p.name, color: colorOf(p.uuid) }));
  }, [portfolios]);
  const focused = portfolioUuid ? real.find((p) => p.uuid === portfolioUuid) : undefined;
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={trail} current={focused ? `${focused.name} alerts` : "Alerts"} />
      <AlertsSettings portfolios={focused ? [focused] : real} grouped={focused ? true : undefined} />
    </div>
  );
}
