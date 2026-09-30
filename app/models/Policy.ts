// models/Policy.ts
//
// A portfolio's POLICY (schemas PortfolioPolicy / PortfolioPolicyResponse): constraints its owner declares
// on what the portfolio should look like, each checked by an alert rule the policy keeps itself
// (AlertRuleResponse.policyConstraintId). What it shows must say where the portfolio stands
// against the owner's own range, never what to buy or sell. Every percentage is in % (35 = 35%);
// asset ids are provider tickers, the same as holdings' assetId.

import type { AlertRuleResponse } from "./Alert";

// A group of assets the user names (`label`, ≤ 60 chars; a strategy's are its categories, see
// categoryLabel) held at targetPct (0 < x ≤ 100), within bandPct points either side,
// relativeBandPct percent of the target, or the narrower of the two. An end of the band at or past
// 0 or 100 is left open.
interface GroupTargetConstraint {
  type: "group_target";
  id?: string | null;
  label: string;
  assetIds: string[];
  targetPct: number;
  bandPct?: number | null;
  relativeBandPct?: number | null;
}

// A group's weight at least minPct, at most maxPct, or both: a floor or a ceiling with no target.
interface GroupRangeConstraint {
  type: "group_range";
  id?: string | null;
  label: string;
  assetIds: string[];
  minPct?: number | null;
  maxPct?: number | null;
}

// No single asset above maxPct.
interface PositionCapConstraint {
  type: "position_cap";
  id?: string | null;
  maxPct: number;
}

type PolicyConstraint = GroupTargetConstraint | GroupRangeConstraint | PositionCapConstraint;

// PUT /v1/portfolios/{p}/policy's body, and a draft's shape (ids null). A constraint sent back
// with its id is edited, one without is new, one left out is removed with its rule.
interface PortfolioPolicy {
  constraints: PolicyConstraint[];
  notifyEmail?: boolean;
  notifyInApp?: boolean;
}

// One constraint with the rule checking it: rule.reading is where the portfolio stands against it
// as of the last 5-minute check (null right after a change).
interface PolicyConstraintResponse {
  constraint: PolicyConstraint;
  rule: AlertRuleResponse | null;
}

interface PortfolioPolicyResponse {
  constraints: PolicyConstraintResponse[];
  notifyEmail: boolean;
  notifyInApp: boolean;
  // The strategy (backtest) portfolio this one was adopted from (POST .../strategy/adopt), kept
  // when the policy is edited. It may have been deleted since.
  adoptedFrom?: string | null;
}

// A strategy's policy draft names each group after its category.
const CATEGORY_LABELS: Record<string, string> = {
  equity: "Equity",
  bonds: "Bonds",
  real_estate: "Real estate",
  commodities: "Commodities",
  cash: "Cash",
  crypto: "Crypto",
};

/** A constraint's group label as shown: a strategy's category names translated, the user's own as they are. */
const categoryLabel = (label: string) => CATEGORY_LABELS[label] ?? label;

export type {
  GroupTargetConstraint, GroupRangeConstraint, PositionCapConstraint, PolicyConstraint,
  PortfolioPolicy, PolicyConstraintResponse, PortfolioPolicyResponse,
};
export { categoryLabel };
