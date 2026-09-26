// components/dashboard/CompareSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Star, Check } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { portfoliosService } from "../../services/portfoliosService";
import { usePortfolio } from "../../context/PortfolioContext";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { portfolioColorMap } from "../../lib/chartColors";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

// More columns than this stop fitting a table a person can read across.
const MAX_SELECTED = 4;
const SELECTION_KEY = "compare_selected_portfolio_uuids";
// Same isStale contract as the rest of the dashboard (see useAnalytics in PerformanceSection).
const STALE_POLL_INTERVAL_MS = 15_000;
const STALE_TIMEOUT_MS = 5 * 60_000;

const AXIS_TICK_COLOR = "#64748b";
const TOOLTIP_STYLE: React.CSSProperties = { borderRadius: 8, borderColor: "#e2e8f0", fontSize: 12, color: "#334155" };

const HORIZONS = ["1 Month", "6 Months", "1 Year", "3 Years"];

const ASSET_CLASS_LABELS: Record<string, string> = {
  EQUITY: "Stocks", ETF: "ETFs", MUTUALFUND: "Funds", CRYPTOCURRENCY: "Crypto", BOND: "Bonds", UNKNOWN: "Other",
};
const assetClassLabel = (c: string) => ASSET_CLASS_LABELS[c] ?? c.charAt(0) + c.slice(1).toLowerCase();

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
const monthShortYearLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
const fullDateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const readSelection = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SELECTION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : null;
  } catch {
    return null;
  }
};

const writeSelection = (uuids: string[]) => {
  try {
    localStorage.setItem(SELECTION_KEY, JSON.stringify(uuids));
  } catch {
    // Private mode or blocked storage: the selection just isn't remembered.
  }
};

/**
 * COMPARE SECTION — the user's portfolios side by side (GET /v1/portfolios/comparison). The
 * user picks up to MAX_SELECTED of them, the aggregate "All portfolios" included if they want
 * it (off by default: it's the whole, not a peer); the pick is remembered in this browser.
 * One table of figures with the best of each row starred, then the cumulative returns and the
 * allocation. Each portfolio keeps one colour (see portfolioColorMap), so changing the
 * selection never repaints the others. Only reachable with 2+
 * portfolios (see Sidebar).
 */
export function CompareSection() {
  const { portfolios } = usePortfolio();
  const peers = useMemo(() => portfolios.filter((p) => !p.isAggregate), [portfolios]);

  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);

  const [selected, setSelected] = useState<string[]>(() => {
    const known = new Set(portfolios.map((p) => p.uuid));
    const saved = readSelection()?.filter((u) => known.has(u));
    return saved && saved.length >= 2 ? saved.slice(0, MAX_SELECTED) : peers.slice(0, MAX_SELECTED).map((p) => p.uuid);
  });

  // Requested in portfolio-list order, not click order, so the columns don't shuffle.
  const ordered = useMemo(() => portfolios.filter((p) => selected.includes(p.uuid)).map((p) => p.uuid), [portfolios, selected]);
  const orderedKey = ordered.join(",");

  const toggle = (uuid: string) => {
    setSelected((prev) => {
      const next = prev.includes(uuid) ? prev.filter((u) => u !== uuid) : prev.length >= MAX_SELECTED ? prev : [...prev, uuid];
      writeSelection(next);
      return next;
    });
  };

  const { entries, loading, failed, timedOut } = useComparison(orderedKey);

  if (peers.length < 2) {
    return (
      <Page>
        <Notice>Create a second portfolio to compare them here.</Notice>
      </Page>
    );
  }

  return (
    <Page>
      <PortfolioPicker portfolios={portfolios} selected={selected} colorOf={colorOf} onToggle={toggle} />
      {ordered.length < 2 ? (
        <Notice>Pick at least two portfolios to compare.</Notice>
      ) : loading && entries === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin h-8 w-8 text-[#C49A3C]" />
        </div>
      ) : failed || entries === null ? (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">Failed to load the comparison. Try again in a moment.</p>
        </div>
      ) : (
        // Dimmed while a new selection loads over the previous one.
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <ComparisonBody entries={entries} colorOf={colorOf} timedOut={timedOut} />
        </div>
      )}
    </Page>
  );
}

/**
 * Fetches the comparison for the given (comma-joined) uuids, refetching every
 * STALE_POLL_INTERVAL_MS while any column is stale, for up to STALE_TIMEOUT_MS. `timedOut`
 * means stale columns should now be drawn anyway, with a hint.
 */
function useComparison(uuidsKey: string) {
  const [state, setState] = useState<{ entries: PortfolioComparisonEntry[] | null; loading: boolean; failed: boolean; timedOut: boolean }>({
    entries: null, loading: true, failed: false, timedOut: false,
  });

  useEffect(() => {
    const uuids = uuidsKey ? uuidsKey.split(",") : [];
    if (uuids.length < 2) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    const tick = async (isFirst: boolean) => {
      // Keep the previous columns up while a new selection loads, so the page doesn't flash.
      if (isFirst) setState((prev) => ({ ...prev, loading: true, failed: false, timedOut: false }));
      try {
        const entries = await portfoliosService.compare(uuids);
        if (cancelled) return;
        const anyStale = entries.some((e) => e.isStale);
        const timedOut = anyStale && Date.now() - startedAt >= STALE_TIMEOUT_MS;
        setState({ entries, loading: false, failed: false, timedOut });
        if (anyStale && !timedOut) timer = setTimeout(() => tick(false), STALE_POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setState({ entries: null, loading: false, failed: true, timedOut: false });
      }
    };
    tick(true);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [uuidsKey]);

  return state;
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0 py-6 space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#C49A3C] mb-1.5">Your portfolios</p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Compare
        </h1>
        <p className="text-slate-500 font-medium mt-1">Your portfolios side by side, over the same periods.</p>
      </div>
      {children}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center text-center py-16 px-6 bg-white border border-slate-200 border-dashed rounded-4xl">
      <p className="text-slate-500 text-sm max-w-sm">{children}</p>
    </div>
  );
}

function Module({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-4xl border border-slate-200 shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function ModuleHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="p-6 md:p-7 pb-5 border-b border-slate-100">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C] mb-1.5">{eyebrow}</p>
      <h2 className="text-lg md:text-xl font-black text-slate-900" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {title}
      </h2>
      {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-xl leading-relaxed">{desc}</p>}
    </div>
  );
}

function Swatch({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return <span className="w-4 shrink-0 border-t-2" style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} />;
}

/**
 * PORTFOLIO PICKER — one toggle per portfolio, in its colour. Unselected ones are disabled
 * once MAX_SELECTED are picked, with the reason spelled out underneath.
 */
function PortfolioPicker({
  portfolios, selected, colorOf, onToggle,
}: { portfolios: Portfolio[]; selected: string[]; colorOf: (uuid: string) => string; onToggle: (uuid: string) => void }) {
  const full = selected.length >= MAX_SELECTED;
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {portfolios.map((p) => {
          const isOn = selected.includes(p.uuid);
          const disabled = !isOn && full;
          return (
            <button
              key={p.uuid}
              onClick={() => onToggle(p.uuid)}
              disabled={disabled}
              aria-pressed={isOn}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[13px] font-bold transition-colors ${
                isOn
                  ? "bg-white border-slate-300 text-slate-900 shadow-sm"
                  : "bg-transparent border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300"
              } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0 flex items-center justify-center"
                style={{ background: isOn ? colorOf(p.uuid) : "transparent", border: `2px solid ${colorOf(p.uuid)}` }}
              >
                {isOn && <Check className="h-2 w-2 text-white" strokeWidth={4} />}
              </span>
              {p.name}
            </button>
          );
        })}
      </div>
      {full && <p className="text-xs text-slate-400 mt-2">Up to {MAX_SELECTED} at a time — deselect one to pick another.</p>}
    </div>
  );
}

type Better = "higher" | "lower";

interface MetricRow {
  label: string;
  info?: string;
  get: (e: PortfolioComparisonEntry) => number | null | undefined;
  format: (v: number, currency: string) => string;
  // Omitted for amounts, where "more" isn't better or worse on its own (a bigger portfolio
  // isn't a better one).
  better?: Better;
  // Colour the figure green/red by its sign.
  signed?: boolean;
}

interface MetricGroup {
  title: string;
  rows: MetricRow[];
}

const money = (v: number, currency: string) => formatCurrency(v, currency, 0);
const signedMoney = (v: number, currency: string) => `${v >= 0 ? "+" : ""}${formatCurrency(v, currency, 0)}`;
const plainPct = (v: number) => `${v.toFixed(2)}%`;

const horizonOf = (e: PortfolioComparisonEntry, period: string) =>
  e.performance?.horizons.find((h) => h.period === period)?.totalReturnPct;

function buildGroups(entries: PortfolioComparisonEntry[]): MetricGroup[] {
  // A horizon row only when at least one column reaches that far back.
  const horizonRows: MetricRow[] = HORIZONS
    .filter((period) => entries.some((e) => horizonOf(e, period) != null))
    .map((period) => ({
      label: `Last ${period.toLowerCase()}`,
      get: (e) => horizonOf(e, period),
      format: formatPct,
      better: "higher",
      signed: true,
    }));

  return [
    {
      title: "Value",
      rows: [
        { label: "Market value", get: (e) => e.value?.marketValue, format: money },
        { label: "Invested", info: "What you paid for the positions you hold.", get: (e) => e.value?.investedCapital, format: money },
        { label: "Unrealized P&L", get: (e) => e.value?.unrealizedPnl, format: signedMoney, signed: true },
      ],
    },
    {
      title: "Returns",
      rows: [
        ...horizonRows,
        {
          label: "Since inception",
          info: "Each portfolio since its own first transaction, so the periods can differ in length.",
          get: (e) => e.performance?.totalReturnPct,
          format: formatPct,
          better: "higher",
          signed: true,
        },
        { label: "Per year", info: "Annualized, available after a year of history.", get: (e) => e.performance?.annualizedReturnPct, format: formatPct, better: "higher", signed: true },
      ],
    },
    {
      title: "Risk",
      rows: [
        { label: "Volatility", info: "How much daily returns swing, annualized. Lower is steadier.", get: (e) => e.volatility?.annualizedVolatilityPct, format: plainPct, better: "lower" },
        { label: "Deepest fall", info: "The largest drop from a previous high.", get: (e) => e.performance?.maxDrawdownPct, format: plainPct, better: "higher" },
      ],
    },
    {
      title: "Income & costs",
      rows: [
        { label: "Dividends, last 12 months", get: (e) => e.dividends?.totalTrailing12MIncome, format: money },
        { label: "Dividend yield", info: "Last 12 months' dividends over the portfolio's value today.", get: (e) => e.dividends?.wholePortfolioYieldPct, format: plainPct, better: "higher" },
        { label: "Trading costs", info: "Commissions plus spread, since inception.", get: (e) => e.value?.tradingCosts, format: money },
        { label: "Yearly cost drag", info: "How much costs take off the return each year. Lower is better.", get: (e) => e.tradingCosts?.annualizedCostDragPct, format: plainPct, better: "lower" },
      ],
    },
    {
      title: "Benchmark",
      rows: [
        {
          label: "vs benchmark",
          info: "Annualized return above (or below) a benchmark of matching ETFs fed the same deposits and withdrawals.",
          get: (e) => e.benchmark?.excessReturnPct,
          format: formatPct,
          better: "higher",
          signed: true,
        },
      ],
    },
  ];
}

/**
 * The columns holding the best value of a row: among the real portfolios (the aggregate is the
 * whole, not a competitor) with a figure to compare, and only when there are two or more and
 * they aren't all equal.
 */
function bestColumns(row: MetricRow, entries: PortfolioComparisonEntry[], hidden: (e: PortfolioComparisonEntry) => boolean): Set<string> {
  if (!row.better) return new Set();
  const values = entries
    .filter((e) => !e.portfolio.isAggregate && !hidden(e))
    .map((e) => ({ uuid: e.portfolio.uuid, v: row.get(e) }))
    .filter((x): x is { uuid: string; v: number } => x.v != null);
  if (values.length < 2) return new Set();
  const best = row.better === "higher" ? Math.max(...values.map((x) => x.v)) : Math.min(...values.map((x) => x.v));
  const winners = values.filter((x) => x.v === best);
  return winners.length === values.length ? new Set() : new Set(winners.map((x) => x.uuid));
}

function ComparisonBody({
  entries, colorOf, timedOut,
}: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string; timedOut: boolean }) {
  const groups = useMemo(() => buildGroups(entries), [entries]);
  const currency = entries.find((e) => e.value)?.value?.currency ?? "EUR";
  // A stale column is hidden while its rebuild is expected any moment, then shown with a hint.
  const isUpdating = (e: PortfolioComparisonEntry) => e.isStale && !timedOut;
  const visible = useMemo(() => entries.filter((e) => !(e.isStale && !timedOut)), [entries, timedOut]);

  return (
    <>
      {timedOut && entries.some((e) => e.isStale) && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          <p className="text-xs font-bold">An update is taking longer than usual — some figures below may be out of date.</p>
        </div>
      )}
      <Module>
        <ModuleHead
          eyebrow={currency}
          title="Side by side"
          desc="Returns are time-weighted, so money added or withdrawn doesn't count. The star marks the best of each row."
        />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm min-w-[520px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white text-left p-4 pl-6 md:pl-7 w-48" />
                {entries.map((e) => (
                  <th key={e.portfolio.uuid} scope="col" className="p-4 text-right align-bottom">
                    <span className="inline-flex items-center gap-2 justify-end">
                      <Swatch color={colorOf(e.portfolio.uuid)} dashed={e.portfolio.isAggregate} />
                      <span className="text-[13px] font-black text-slate-900">{e.portfolio.name}</span>
                    </span>
                    {isUpdating(e) && (
                      <span className="flex items-center gap-1 justify-end text-[11px] font-bold text-amber-600 mt-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Updating
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.title} className="border-t border-slate-100">
                <tr>
                  <th colSpan={entries.length + 1} scope="colgroup" className="sticky left-0 bg-white text-left px-6 md:px-7 pt-4 pb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {g.title}
                  </th>
                </tr>
                {g.rows.map((row) => {
                  const best = bestColumns(row, entries, isUpdating);
                  return (
                    <tr key={row.label} className="hover:bg-slate-50/60">
                      <th scope="row" className="sticky left-0 z-10 bg-white text-left font-semibold text-slate-600 py-2.5 pl-6 md:pl-7 pr-4" title={row.info}>
                        <span className={row.info ? "underline decoration-dotted decoration-slate-300 underline-offset-4 cursor-help" : ""}>{row.label}</span>
                      </th>
                      {entries.map((e) => {
                        const v = isUpdating(e) ? null : row.get(e);
                        const isBest = best.has(e.portfolio.uuid);
                        return (
                          <td key={e.portfolio.uuid} className="py-2.5 px-4 text-right tabular-nums whitespace-nowrap">
                            {v == null ? (
                              <span className="text-slate-300">—</span>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 font-bold ${
                                row.signed ? (v >= 0 ? "text-emerald-600" : "text-rose-600") : "text-slate-900"
                              }`}>
                                {isBest && <Star className="h-3 w-3 fill-[#C49A3C] text-[#C49A3C]" aria-label="Best" />}
                                {row.format(v, currency)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
        <p className="px-6 md:px-7 py-4 border-t border-slate-100 text-xs text-slate-400">
          “—” means not available yet: a period longer than that portfolio&apos;s history, or figures still being prepared.
        </p>
      </Module>
      <CumulativeReturnsModule entries={visible} colorOf={colorOf} />
      <AllocationModule entries={visible} colorOf={colorOf} />
    </>
  );
}

/**
 * CUMULATIVE RETURNS — one line per portfolio, each from its own first day, so the lines start
 * at different dates. Merged on date; a portfolio with no point on a date just has a gap there
 * that connectNulls bridges.
 */
function CumulativeReturnsModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withSeries = useMemo(() => entries.filter((e) => e.performance?.cumulativeReturnPct), [entries]);
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const e of withSeries) {
      for (const p of toChartPoints(e.performance!.cumulativeReturnPct!, 250)) {
        const row = byDate.get(p.date) ?? { date: p.date };
        row[e.portfolio.uuid] = p.value;
        byDate.set(p.date, row);
      }
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [withSeries]);

  return (
    <Module>
      <ModuleHead
        eyebrow="Performance"
        title="Cumulative return"
        desc="Time-weighted growth since each portfolio's first transaction."
      />
      {data.length < 2 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not enough history yet to chart.</p>
      ) : (
        <>
          <div className="p-6 md:p-7 pb-2 h-72">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 288 }}>
              <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={monthShortYearLabel} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: AXIS_TICK_COLOR }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  labelFormatter={(label) => fullDateLabel(label as string)}
                  formatter={(value, name) => [formatPct(Number(value)), entries.find((e) => e.portfolio.uuid === name)?.portfolio.name ?? String(name)]}
                  contentStyle={TOOLTIP_STYLE}
                />
                {withSeries.map((e) => (
                  <Line
                    key={e.portfolio.uuid}
                    type="monotone"
                    dataKey={e.portfolio.uuid}
                    stroke={colorOf(e.portfolio.uuid)}
                    strokeWidth={2}
                    strokeDasharray={e.portfolio.isAggregate ? "5 4" : undefined}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Legend with each line's latest value as its direct label. */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-6 md:px-7 pb-6">
            {withSeries.map((e) => {
              const values = e.performance!.cumulativeReturnPct!.values;
              const last = values[values.length - 1];
              return (
                <span key={e.portfolio.uuid} className="flex items-center gap-2 text-xs">
                  <Swatch color={colorOf(e.portfolio.uuid)} dashed={e.portfolio.isAggregate} />
                  <span className="font-bold text-slate-700">{e.portfolio.name}</span>
                  {last !== undefined && <span className="text-slate-500 tabular-nums">{formatPct(last)}</span>}
                </span>
              );
            })}
          </div>
        </>
      )}
    </Module>
  );
}

/**
 * ALLOCATION — for each asset class, one bar per portfolio showing its weight there. Grouped
 * by asset class rather than one stacked bar per portfolio, so colour keeps meaning "which
 * portfolio" everywhere on the page instead of switching to "which asset class" here.
 */
function AllocationModule({ entries, colorOf }: { entries: PortfolioComparisonEntry[]; colorOf: (uuid: string) => string }) {
  const withAllocation = useMemo(() => entries.filter((e) => e.allocation && e.allocation.length > 0), [entries]);
  const classes = useMemo(() => {
    const maxWeight = new Map<string, number>();
    for (const e of withAllocation) {
      for (const a of e.allocation!) maxWeight.set(a.assetClass, Math.max(maxWeight.get(a.assetClass) ?? 0, a.weightPct));
    }
    return [...maxWeight.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [withAllocation]);

  return (
    <Module>
      <ModuleHead eyebrow="Composition" title="Allocation by asset class" desc="Share of each portfolio's market value today." />
      {classes.length === 0 ? (
        <p className="text-sm text-slate-400 p-6 md:p-7">Not available yet.</p>
      ) : (
        <div className="p-6 md:p-7 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          {classes.map((c) => (
            <div key={c}>
              <h3 className="text-sm font-black text-slate-900 mb-2">{assetClassLabel(c)}</h3>
              <div className="space-y-1.5">
                {withAllocation.map((e) => {
                  const weight = e.allocation!.find((a) => a.assetClass === c)?.weightPct ?? 0;
                  return (
                    <div key={e.portfolio.uuid} className="flex items-center gap-3" title={`${e.portfolio.name}: ${weight.toFixed(1)}%`}>
                      <span className="w-24 shrink-0 truncate text-xs font-semibold text-slate-500">{e.portfolio.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(weight, 100)}%`, background: colorOf(e.portfolio.uuid), opacity: e.portfolio.isAggregate ? 0.6 : 1 }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs font-bold text-slate-600 tabular-nums">{weight.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Module>
  );
}
