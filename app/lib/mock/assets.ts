// lib/mock/assets.ts
//
// SAMPLE DATA for the Strategy preview's asset picker (components/dashboard/StrategyBuilder, demo
// accounts only): a small catalogue of well-known listed assets, each filed under the macro
// category a strategy allocates to. The backtest itself still trades one proxy per category (see
// models/Strategy): picking assets only decides how much goes into each category.

import type { StrategyCategory } from "../../models/Strategy";

export interface CatalogAsset {
  ticker: string;
  name: string;
  kind: "ETF" | "Stock" | "Bond ETF" | "REIT" | "Commodity ETF" | "Money market" | "Crypto";
  category: StrategyCategory;
}

export const ASSET_CATALOG: CatalogAsset[] = [
  { ticker: "VWCE", name: "Vanguard FTSE All-World", kind: "ETF", category: "equity" },
  { ticker: "SWDA", name: "iShares Core MSCI World", kind: "ETF", category: "equity" },
  { ticker: "CSPX", name: "iShares Core S&P 500", kind: "ETF", category: "equity" },
  { ticker: "EQQQ", name: "Invesco NASDAQ-100", kind: "ETF", category: "equity" },
  { ticker: "EIMI", name: "iShares Core MSCI Emerging Markets", kind: "ETF", category: "equity" },
  { ticker: "MEUD", name: "Amundi STOXX Europe 600", kind: "ETF", category: "equity" },
  { ticker: "AAPL", name: "Apple", kind: "Stock", category: "equity" },
  { ticker: "MSFT", name: "Microsoft", kind: "Stock", category: "equity" },
  { ticker: "NVDA", name: "NVIDIA", kind: "Stock", category: "equity" },
  { ticker: "ASML", name: "ASML Holding", kind: "Stock", category: "equity" },
  { ticker: "ENEL", name: "Enel", kind: "Stock", category: "equity" },
  { ticker: "AGGH", name: "iShares Core Global Aggregate Bond", kind: "Bond ETF", category: "bonds" },
  { ticker: "XGLE", name: "Xtrackers Eurozone Government Bond", kind: "Bond ETF", category: "bonds" },
  { ticker: "IBCI", name: "iShares Euro Inflation Linked Govt Bond", kind: "Bond ETF", category: "bonds" },
  { ticker: "IEAC", name: "iShares Core Euro Corporate Bond", kind: "Bond ETF", category: "bonds" },
  { ticker: "BTP", name: "BTP Italia (Italian government bond)", kind: "Bond ETF", category: "bonds" },
  { ticker: "IWDP", name: "iShares Developed Markets Property Yield", kind: "REIT", category: "real_estate" },
  { ticker: "EPRA", name: "Amundi FTSE EPRA Europe Real Estate", kind: "REIT", category: "real_estate" },
  { ticker: "O", name: "Realty Income", kind: "REIT", category: "real_estate" },
  { ticker: "SGLD", name: "Invesco Physical Gold", kind: "Commodity ETF", category: "commodities" },
  { ticker: "EXXY", name: "iShares Diversified Commodity Swap", kind: "Commodity ETF", category: "commodities" },
  { ticker: "XEON", name: "Xtrackers EUR Overnight Rate Swap", kind: "Money market", category: "cash" },
  { ticker: "CSH2", name: "Amundi Smart Overnight Return", kind: "Money market", category: "cash" },
  { ticker: "BTC", name: "Bitcoin", kind: "Crypto", category: "crypto" },
  { ticker: "ETH", name: "Ethereum", kind: "Crypto", category: "crypto" },
];

/** The catalogue's matches for a search, by ticker or name, leaving out what's already picked. */
export function searchAssets(query: string, exclude: Set<string>, limit = 6): CatalogAsset[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return ASSET_CATALOG
    .filter((a) => !exclude.has(a.ticker) && (a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)))
    .sort((a, b) => Number(!a.ticker.toLowerCase().startsWith(q)) - Number(!b.ticker.toLowerCase().startsWith(q)))
    .slice(0, limit);
}
