// lib/mock/community.ts
//
// SAMPLE DATA for the Explore preview (components/preview/ExploreCommunity): portfolios other
// users have made public. The people, portfolios and figures are all invented.

import { hashSeed, normal, round, seeded } from "./random";

export type MacroCategory = "Equity" | "Bonds" | "Real estate" | "Commodities" | "Cash" | "Crypto";

export const MACRO_CATEGORIES: MacroCategory[] = ["Equity", "Bonds", "Real estate", "Commodities", "Cash", "Crypto"];

export interface SharedPortfolio {
  id: string;
  name: string;
  author: string;
  handle: string;
  description: string;
  tags: string[];
  risk: "Low" | "Medium" | "High";
  since: string;
  allocation: Partial<Record<MacroCategory, number>>;
  topHoldings: string[];
  holdings: number;
  likes: number;
  copies: number;
  return1y: number;
  returnTotal: number;
  volatility: number;
  sharedDaysAgo: number;
  series: { i: number; value: number }[];
}

type Seed = Omit<SharedPortfolio, "series" | "return1y" | "returnTotal" | "volatility"> & { drift: number; vol: number };

const SEEDS: Seed[] = [
  {
    id: "c1", name: "Lazy three-fund", author: "Giulia R.", handle: "@giulia.invests", risk: "Medium", since: "2019",
    description: "Global stocks, global bonds, a pinch of gold. Rebalanced once a year, never touched otherwise.",
    tags: ["Passive", "ETF", "Annual rebalance"], allocation: { Equity: 60, Bonds: 30, Commodities: 10 },
    topHoldings: ["VWCE", "AGGH", "SGLD"], holdings: 3, likes: 1284, copies: 342, sharedDaysAgo: 3, drift: 0.075, vol: 0.11,
  },
  {
    id: "c2", name: "Dividend growers EU", author: "Marco B.", handle: "@marcob", risk: "Medium", since: "2020",
    description: "European companies with 10+ years of rising dividends. Income reinvested monthly via PAC.",
    tags: ["Dividends", "Stocks", "PAC"], allocation: { Equity: 92, Cash: 8 },
    topHoldings: ["ASML", "SAN.PA", "ENEL", "NESN"], holdings: 24, likes: 876, copies: 190, sharedDaysAgo: 8, drift: 0.09, vol: 0.14,
  },
  {
    id: "c3", name: "All-weather Italia", author: "Luca P.", handle: "@lucap", risk: "Low", since: "2018",
    description: "Ray Dalio-style risk parity built with UCITS ETFs, BTPs for the bond leg.",
    tags: ["Risk parity", "BTP", "Low volatility"], allocation: { Equity: 30, Bonds: 55, Commodities: 15 },
    topHoldings: ["SWDA", "BTP 2033", "IBGL", "SGLD"], holdings: 7, likes: 2210, copies: 611, sharedDaysAgo: 1, drift: 0.045, vol: 0.07,
  },
  {
    id: "c4", name: "Tech conviction", author: "Sara T.", handle: "@sara.t", risk: "High", since: "2021",
    description: "Concentrated bets on AI infrastructure and semiconductors. Not for the faint-hearted.",
    tags: ["Growth", "Tech", "Concentrated"], allocation: { Equity: 95, Cash: 5 },
    topHoldings: ["NVDA", "MSFT", "TSM", "AMD"], holdings: 9, likes: 3150, copies: 402, sharedDaysAgo: 12, drift: 0.19, vol: 0.32,
  },
  {
    id: "c5", name: "Bricks & bonds", author: "Andrea F.", handle: "@andreaf", risk: "Low", since: "2017",
    description: "REITs and property funds next to short-term government bonds, for steady income.",
    tags: ["Income", "REIT", "Bonds"], allocation: { "Real estate": 45, Bonds: 45, Cash: 10 },
    topHoldings: ["IPRP", "EPRA", "BOT 12M"], holdings: 6, likes: 540, copies: 88, sharedDaysAgo: 20, drift: 0.035, vol: 0.09,
  },
  {
    id: "c6", name: "Satellite crypto 10%", author: "Davide M.", handle: "@dav.crypto", risk: "High", since: "2020",
    description: "A plain world-equity core with a 10% crypto satellite, rebalanced when it drifts past 5 points.",
    tags: ["Core-satellite", "Crypto", "Threshold rebalance"], allocation: { Equity: 80, Crypto: 10, Cash: 10 },
    topHoldings: ["SWDA", "BTC", "ETH"], holdings: 4, likes: 1675, copies: 298, sharedDaysAgo: 5, drift: 0.13, vol: 0.2,
  },
  {
    id: "c7", name: "Retirement glide path", author: "Paola G.", handle: "@paolag", risk: "Low", since: "2016",
    description: "Ten years to go: equity share falls 3 points a year, withdrawals planned from 2036.",
    tags: ["Retirement", "Glide path", "Withdrawals"], allocation: { Equity: 40, Bonds: 50, Cash: 10 },
    topHoldings: ["VWCE", "XGLE", "BTP Italia"], holdings: 5, likes: 730, copies: 256, sharedDaysAgo: 30, drift: 0.05, vol: 0.08,
  },
  {
    id: "c8", name: "Emerging markets tilt", author: "Kenji O.", handle: "@kenji", risk: "High", since: "2022",
    description: "World equity with a heavy EM tilt: India, Brazil, Southeast Asia.",
    tags: ["Emerging", "Value", "ETF"], allocation: { Equity: 90, Commodities: 5, Cash: 5 },
    topHoldings: ["EIMI", "NDIA", "IBZL"], holdings: 8, likes: 412, copies: 61, sharedDaysAgo: 2, drift: 0.08, vol: 0.19,
  },
  {
    id: "c9", name: "Permanent portfolio", author: "Elena V.", handle: "@elena.v", risk: "Low", since: "2015",
    description: "Harry Browne's four quarters: stocks, long bonds, gold, cash. Boring on purpose.",
    tags: ["Permanent", "Gold", "Classic"], allocation: { Equity: 25, Bonds: 25, Commodities: 25, Cash: 25 },
    topHoldings: ["SWDA", "IBTL", "SGLD", "XEON"], holdings: 4, likes: 1890, copies: 520, sharedDaysAgo: 15, drift: 0.055, vol: 0.075,
  },
];

export const SHARED_PORTFOLIOS: SharedPortfolio[] = SEEDS.map(({ drift, vol, ...seed }) => {
  const rand = seeded(hashSeed(seed.id));
  let v = 100;
  const series = Array.from({ length: 36 }, (_, i) => {
    if (i > 0) v *= 1 + drift / 12 + (normal(rand) * vol) / Math.sqrt(12);
    return { i, value: round(v, 2) };
  });
  return {
    ...seed,
    series,
    return1y: round((series[35].value / series[23].value - 1) * 100, 1),
    returnTotal: round((series[35].value / 100 - 1) * 100, 1),
    volatility: round(vol * 100, 1),
  };
});

export const MACRO_COLORS: Record<MacroCategory, string> = {
  Equity: "#2a78d6",
  Bonds: "#1baf7a",
  "Real estate": "#eb6834",
  Commodities: "#eda100",
  Cash: "#94a3b8",
  Crypto: "#4a3aa7",
};
