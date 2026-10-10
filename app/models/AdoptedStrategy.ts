// models/AdoptedStrategy.ts
// Matches AdoptedStrategyResponse (POST/GET/PUT /v1/portfolios/{p}/adopted-strategy): a backtest's
// strategy adopted on an existing portfolio — standard or the aggregate, never a backtest — and
// kept there as alert rules, one per target with a weight, each firing when the target's weight
// leaves its band. The rules aren't in the response: they're the portfolio's alert rules whose
// `source` is the adoption's (GET .../alert-rules?source=…), each matched to its target by its
// selector. A portfolio has at most one adoption per user: adopting again replaces it (same
// adoptionId). An advisor adopting on a client's portfolio adopts for themselves (advisorUuid set):
// the client doesn't see it.
//
// What it shows says where the portfolio stands against the ranges the user chose, never what to
// buy or sell.

import type { AlertRuleResponse } from "./Alert";
import type { StrategyRebalancing, StrategyTarget } from "./Strategy";

// A strategy without the conditions a backtest runs it in: what a portfolio adopts, and the body
// of PUT (refining it: unchanged rules stay as they are, changed ones start again with no
// reading, those of removed targets go).
interface StrategyAllocation {
  targets: StrategyTarget[];
  rebalancing: StrategyRebalancing;
}

// Body of POST. `inCategories` watches each security target as its asset category instead, its
// weight added to the category's (models/AssetCategory): only when the user asks for it. Channels
// left null: in-app only.
interface AdoptStrategyPayload {
  originPortfolioUuid: string;
  inCategories: boolean;
  notifyEmail: boolean | null;
  notifyInApp: boolean | null;
}

interface AdoptedStrategy {
  adoptionId: string;
  // The portfolio that adopted it.
  portfolioUuid: string;
  ownerUuid: string;
  advisorUuid: string | null;
  // The backtest it came from; null once that's deleted.
  originPortfolioUuid: string | null;
  strategy: StrategyAllocation;
  notifyEmail: boolean;
  notifyInApp: boolean;
  // "adoption:<id>": the `source` of its rules.
  source: string;
  ruleIds: string[];
  createdAt: string;
  updatedAt: string;
}

// The band when the rebalancing sets none, in points.
const DEFAULT_BAND_PCT = 5;

/**
 * The range the backend keeps a target in, for previews and wording: a band around its weight,
 * the narrower of the absolute one (thresholdPct points) and the relative one (relativeThresholdPct
 * percent of the weight), DEFAULT_BAND_PCT without either. No minimum when it would be 0 or less,
 * no maximum at 100 or more; a target at 0 has no rule (null).
 */
function targetRange(weightPct: number, rebalancing: Pick<StrategyRebalancing, "thresholdPct" | "relativeThresholdPct">): { minPct: number | null; maxPct: number | null } | null {
  if (!(weightPct > 0)) return null;
  const bands = [
    rebalancing.thresholdPct,
    rebalancing.relativeThresholdPct != null ? (weightPct * rebalancing.relativeThresholdPct) / 100 : null,
  ].filter((b): b is number => b != null && b > 0);
  const band = bands.length > 0 ? Math.min(...bands) : DEFAULT_BAND_PCT;
  const round = (v: number) => Math.round(v * 100) / 100;
  return {
    minPct: weightPct - band > 0 ? round(weightPct - band) : null,
    maxPct: weightPct + band < 100 ? round(weightPct + band) : null,
  };
}

/** The adoption's rule for a target: the weight rule whose selector is that security or category. */
function ruleForTarget<R extends AlertRuleResponse>(target: StrategyTarget, rules: R[]): R | undefined {
  return rules.find(({ params }) => {
    if (params.type !== "weight") return false;
    const { selector } = params;
    return target.kind === "asset"
      ? selector.kind === "asset" && selector.assetId === target.asset.assetId
      : selector.kind === "category" && selector.category === target.category;
  });
}

export type { StrategyAllocation, AdoptStrategyPayload, AdoptedStrategy };
export { DEFAULT_BAND_PCT, targetRange, ruleForTarget };
