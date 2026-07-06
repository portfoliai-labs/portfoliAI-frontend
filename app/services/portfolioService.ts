// services/portfolioService.ts
import type { PortfolioSummary } from "../models/Portfolio";

// MOCK — no backend endpoint exists yet for aggregated portfolio holdings.
// Swap getPortfolioSummary's body for a real GET call once that endpoint exists.
// Every figure here is derived from transaction input data only (quantity, price paid, fees,
// broker, currency, asset class) — never from current market prices/values.
// Note: totalInvested naively sums each holding's invested value across its own currency,
// with no FX conversion — a real backend would convert every position into the reporting
// currency first. The per-currency breakdown below is unaffected by this, since each bucket
// only sums holdings that already share the same currency.
const MOCK_HOLDINGS = [
  { ticker: "AAPL", isin: "US0378331005", name: "Apple Inc.", assetClass: "Stock", quantity: 42, investedValue: 6120.50, currency: "USD", fees: 12.40, broker: "Fineco" },
  { ticker: "VWCE.MI", isin: "IE00BK5BQT80", name: "Vanguard FTSE All-World", assetClass: "ETF", quantity: 130, investedValue: 11875.00, currency: "EUR", fees: 0, broker: "Fineco" },
  { ticker: "MSFT", isin: "US5949181045", name: "Microsoft Corp.", assetClass: "Stock", quantity: 18, investedValue: 5760.30, currency: "USD", fees: 8.75, broker: "Degiro" },
  { ticker: "TSLA", isin: "US88160R1014", name: "Tesla Inc.", assetClass: "Stock", quantity: 9, investedValue: 1980.75, currency: "USD", fees: 4.20, broker: "Degiro" },
  { ticker: "ENI.MI", isin: "IT0003132476", name: "Eni S.p.A.", assetClass: "Stock", quantity: 300, investedValue: 4230.00, currency: "EUR", fees: 6.00 },
  { ticker: "BTPS30", isin: "IT0005425233", name: "BTP 15/06/2030", assetClass: "Bond", quantity: 20, investedValue: 2100.00, currency: "EUR", fees: 3.50, broker: "Fineco" },
];

// Closed positions (already sold) — profit/loss uses only the buy/sell prices recorded on
// the two matched transactions, never a current quote.
const MOCK_REALIZED_TRADES = [
  { ticker: "NFLX", quantity: 5, buyPrice: 380.00, sellPrice: 455.20, currency: "USD", broker: "Fineco" },
  { ticker: "BABA", quantity: 20, buyPrice: 95.00, sellPrice: 78.50, currency: "USD", broker: "Degiro" },
  { ticker: "SPY", quantity: 10, buyPrice: 410.00, sellPrice: 430.75, currency: "USD", broker: "Fineco" },
  { ticker: "PYPL", quantity: 15, buyPrice: 68.00, sellPrice: 60.10, currency: "USD" },
];

export const portfolioService = {
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const holdings = MOCK_HOLDINGS.map(h => ({ ...h }));
    const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
    const totalFeesPaid = holdings.reduce((sum, h) => sum + h.fees, 0);

    const realizedTrades = MOCK_REALIZED_TRADES.map(t => ({ ...t }));
    const tradeProfit = (t: typeof realizedTrades[number]) => (t.sellPrice - t.buyPrice) * t.quantity;
    const totalRealizedPL = realizedTrades.reduce((sum, t) => sum + tradeProfit(t), 0);
    const sellCount = realizedTrades.length;
    const winRate = sellCount > 0 ? (realizedTrades.filter(t => tradeProfit(t) > 0).length / sellCount) * 100 : 0;

    const sumBy = <K extends string>(getKey: (h: typeof holdings[number]) => K, getValue: (h: typeof holdings[number]) => number) => {
      const totals = new Map<K, number>();
      for (const h of holdings) {
        const key = getKey(h);
        totals.set(key, (totals.get(key) ?? 0) + getValue(h));
      }
      return [...totals.entries()].sort((a, b) => b[1] - a[1]);
    };

    return {
      totalInvested,
      currency: "EUR",
      totalFeesPaid,
      holdings,
      purchasesByBroker: sumBy(h => h.broker || "Unknown", h => h.investedValue)
        .map(([broker, total]) => ({ broker, totalInvested: total })),
      purchasesByCurrency: sumBy(h => h.currency, h => h.investedValue)
        .map(([currency, total]) => ({ currency, totalInvested: total })),
      purchasesByAssetClass: sumBy(h => h.assetClass, h => h.investedValue)
        .map(([assetClass, total]) => ({ assetClass, totalInvested: total })),
      feesByBroker: sumBy(h => h.broker || "Unknown", h => h.fees)
        .map(([broker, total]) => ({ broker, totalFees: total })),
      realizedTrades,
      totalRealizedPL,
      sellCount,
      winRate,
    };
  },
};
