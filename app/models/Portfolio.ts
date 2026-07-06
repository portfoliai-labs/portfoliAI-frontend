// models/Portfolio.ts

// A single asset currently held, aggregated across all of the user's processed transactions.
// Every field here is derived purely from transaction input data (quantity, price paid, fees,
// broker, currency, asset class) — never from current market prices/values.
interface Holding {
  ticker: string;
  isin?: string;
  name: string;
  assetClass: string;
  quantity: number;
  investedValue: number;
  currency: string;
  fees: number;
  broker?: string;
}

interface BrokerTotal {
  broker: string;
  totalInvested: number;
}

interface CurrencyTotal {
  currency: string;
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
  ticker: string;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  currency: string;
  broker?: string;
}

// Matches the (future) GET /v1/portfolio/summary response shape.
interface PortfolioSummary {
  totalInvested: number;
  currency: string;
  totalFeesPaid: number;
  holdings: Holding[];
  purchasesByBroker: BrokerTotal[];
  purchasesByCurrency: CurrencyTotal[];
  purchasesByAssetClass: AssetClassTotal[];
  feesByBroker: BrokerFeesTotal[];
  realizedTrades: RealizedTrade[];
  totalRealizedPL: number;
  sellCount: number;
  winRate: number;
}

export type {
  Holding, PortfolioSummary, BrokerTotal, CurrencyTotal, AssetClassTotal, BrokerFeesTotal, RealizedTrade,
};
