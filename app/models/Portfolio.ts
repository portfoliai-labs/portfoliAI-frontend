// models/Portfolio.ts
// Matches TransactionsSummaryResponse DTO (GET /v1/transactions/summary)

// A single asset currently held, aggregated across all of the user's processed transactions.
// Every field here is derived purely from transaction input data (quantity, price paid, fees,
// broker, currency, asset class) — never from current market prices/values.
interface Holding {
  ticker: string | null;
  isin: string | null;
  name: string;
  assetClass: string;
  quantity: number;
  investedValue: number;
  currency: string;
  fees: number;
  broker: string | null;
}

interface BrokerTotal {
  broker: string;
  totalInvested: number;
}

interface AssetClassTotal {
  assetClass: string;
  totalInvested: number;
}

interface BrokerFeesTotal {
  broker: string;
  totalFees: number;
}

// A closed round-trip (a sell matched against its buy price). Profit/loss is derived
// entirely from the buy/sell prices recorded in the transactions — never from a current quote.
interface RealizedTrade {
  ticker: string | null;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  currency: string;
  broker: string | null;
}

// All monetary figures in here share one currency. A ticker's underlying currency isn't
// something the app can convert (no live FX rate), so every aggregate — total invested,
// fees, broker/asset-class breakdowns, realized P&L — is scoped to a single currency rather
// than summed across them. One of these exists per currency actually present in the portfolio.
interface CurrencyBreakdown {
  currency: string;
  totalInvested: number;
  totalFeesPaid: number;
  holdingsCount: number;
  purchasesByBroker: BrokerTotal[];
  purchasesByAssetClass: AssetClassTotal[];
  feesByBroker: BrokerFeesTotal[];
  realizedTrades: RealizedTrade[];
  totalRealizedPl: number;
  sellCount: number;
  winRate: number;
}

// Matches TransactionsSummaryResponse (GET /v1/transactions/summary)
interface PortfolioSummary {
  // Every holding across every currency — safe to list or filter, never summed as one figure.
  holdings: Holding[];
  // One entry per currency present in the portfolio.
  byCurrency: CurrencyBreakdown[];
}

export type {
  Holding, PortfolioSummary, CurrencyBreakdown, BrokerTotal, AssetClassTotal, BrokerFeesTotal, RealizedTrade,
};
