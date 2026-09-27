// components/dashboard/InsightsHub.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Columns3, FileText, Layers, Loader2, Settings2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis } from "recharts";
import { usePortfolio } from "../../context/PortfolioContext";
import { portfoliosService } from "../../services/portfoliosService";
import { formatCurrency } from "../../lib/format";
import { toChartPoints } from "../../lib/series";
import { portfolioColorMap } from "../../lib/chartColors";
import { NewPortfolioCard } from "./PortfolioBar";
import { Breadcrumb } from "./Breadcrumb";
import { ReportsList } from "./ReportsList";
import { useGenerateReport } from "./GenerateReport";
import type { Portfolio } from "../../models/Portfolio";
import type { PortfolioComparisonEntry } from "../../models/PortfolioData";

const AGGREGATE_COLOR = "#C49A3C";

const formatPct = (pct: number) => `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

/**
 * INSIGHTS HUB — where Insights opens: a card per portfolio ("All portfolios" first), each
 * with its value, its return since inception and the curve behind it, opening that
 * portfolio's Insights; then the ways out to Compare, Reports and managing portfolios. The
 * figures for every card come from one call (GET /v1/portfolios/comparison with no portfolio
 * listed returns all of them), refetched when a portfolio is added or removed.
 */
export function InsightsHub({
  onOpenPortfolio, onCompare, onReports, onManage,
}: {
  onOpenPortfolio: (uuid: string) => void;
  onCompare: () => void;
  onReports: () => void;
  onManage: () => void;
}) {
  const { portfolios } = usePortfolio();
  const colorOf = useMemo(() => portfolioColorMap(portfolios), [portfolios]);
  const uuidsKey = portfolios.map((p) => p.uuid).join(",");
  const [entries, setEntries] = useState<{ key: string; byUuid: Map<string, PortfolioComparisonEntry> | null }>({ key: "", byUuid: null });

  useEffect(() => {
    let cancelled = false;
    portfoliosService.compare()
      .then((list) => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map(list.map((e) => [e.portfolio.uuid, e])) }); })
      .catch(() => { if (!cancelled) setEntries({ key: uuidsKey, byUuid: new Map() }); });
    return () => { cancelled = true; };
  }, [uuidsKey]);

  // Still loading until the answer for the current list of portfolios is in.
  const loaded = entries.key === uuidsKey;
  const canCompare = portfolios.filter((p) => !p.isAggregate).length >= 2;

  return (
    <div className="space-y-6 pb-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {portfolios.map((p) => (
          <PortfolioCard
            key={p.uuid}
            portfolio={p}
            color={p.isAggregate ? AGGREGATE_COLOR : colorOf(p.uuid)}
            entry={loaded ? entries.byUuid?.get(p.uuid) ?? null : undefined}
            onOpen={() => onOpenPortfolio(p.uuid)}
          />
        ))}
        <NewPortfolioCard />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard
          icon={<Columns3 className="h-5 w-5" />}
          title="Compare"
          text={canCompare ? "Your portfolios side by side, up to four at once." : "Needs at least two portfolios."}
          onClick={canCompare ? onCompare : undefined}
        />
        <ActionCard
          icon={<FileText className="h-5 w-5" />}
          title="Reports"
          text="Full-history PDF reports of your portfolios, generated on demand."
          onClick={onReports}
        />
        <ActionCard
          icon={<Settings2 className="h-5 w-5" />}
          title="Manage portfolios"
          text="Create, rename or delete your portfolios."
          onClick={onManage}
        />
      </div>
    </div>
  );
}

/**
 * PORTFOLIO CARD — one portfolio on the hub. `entry` undefined while loading, null when the
 * backend has nothing for it (no figures computed yet, or the request failed): the card still
 * opens the portfolio, whose own page explains what's missing.
 */
function PortfolioCard({
  portfolio, color, entry, onOpen,
}: { portfolio: Portfolio; color: string; entry: PortfolioComparisonEntry | null | undefined; onOpen: () => void }) {
  const value = entry?.value ?? null;
  const performance = entry?.performance ?? null;
  const totalReturn = performance?.totalReturnPct ?? null;
  const points = useMemo(() => (performance?.cumulativeReturnPct ? toChartPoints(performance.cumulativeReturnPct) : []), [performance]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group min-h-44 h-full text-left bg-white rounded-3xl border border-slate-200 shadow-sm p-5 md:p-6 flex flex-col gap-4 hover:border-[#C49A3C]/50 hover:shadow-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/40"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {portfolio.isAggregate ? (
            <Layers className="h-4 w-4 shrink-0" style={{ color }} />
          ) : (
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: color }} />
          )}
          <span className="text-lg font-black text-slate-900 truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {portfolio.name}
          </span>
        </div>
        <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-slate-100 text-slate-400 group-hover:bg-[#C49A3C] group-hover:text-white transition-colors">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      {entry === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#C49A3C]" />
        </div>
      ) : value === null ? (
        <p className="flex-1 flex items-end text-[13px] font-semibold text-slate-400">No figures yet — add transactions to get started.</p>
      ) : (
        <div className="flex-1 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-2xl font-black text-slate-900 tabular-nums truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {formatCurrency(value.marketValue, value.currency, 0)}
            </p>
            {totalReturn !== null && (
              <p className="text-[13px] font-bold tabular-nums mt-1">
                <span className={totalReturn >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(totalReturn)}</span>
                <span className="text-slate-400 font-semibold"> since inception</span>
              </p>
            )}
          </div>
          {points.length >= 2 && (
            <div className="w-28 h-12 shrink-0">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 112, height: 48 }}>
                <LineChart data={points} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/** ACTION CARD — a way out of the hub: dark, so it reads apart from the portfolio cards above. */
function ActionCard({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group text-left bg-[#1c1917] rounded-3xl p-5 md:p-6 flex flex-col gap-4 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 outline-none focus-visible:ring-2 focus-visible:ring-[#C49A3C]/60"
    >
      <div className="flex items-center justify-between">
        <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/15 text-[#C49A3C] flex items-center justify-center">{icon}</span>
        <ArrowUpRight className="h-4 w-4 text-stone-500 group-hover:text-[#C49A3C] transition-colors" />
      </div>
      <div>
        <p className="text-lg font-black text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>{title}</p>
        <p className="text-[13px] text-stone-400 mt-1 leading-relaxed">{text}</p>
      </div>
    </button>
  );
}

/**
 * INSIGHTS REPORTS — "Insights / Reports": the PDF reports of one portfolio at a time
 * (ReportsList), picked with the pills when there's more than one, and "Generate report" for
 * it. Only standard portfolios: the backend neither generates nor stores reports for the
 * aggregate. Starts on the portfolio last opened, if it's a standard one.
 */
export function InsightsReports({ onHub }: { onHub: () => void }) {
  const { portfolios, current } = usePortfolio();
  const standard = portfolios.filter((p) => !p.isAggregate);
  const [selectedUuid, setSelectedUuid] = useState(() => (current && !current.isAggregate ? current.uuid : standard[0]?.uuid ?? null));
  const selected = standard.find((p) => p.uuid === selectedUuid) ?? standard[0] ?? null;
  const { generate, sending, toast } = useGenerateReport();

  return (
    <div className="space-y-6">
      <Breadcrumb
        trail={[{ label: "Insights", onClick: onHub }]}
        current="Reports"
        right={selected && (
          <button
            type="button"
            onClick={() => generate(selected)}
            disabled={sending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1c1917] text-white text-xs font-bold hover:bg-[#C49A3C] transition-colors disabled:opacity-60 shrink-0"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            Generate report
          </button>
        )}
      />
      {toast}
      {standard.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {standard.map((p) => {
            const on = p.uuid === selected?.uuid;
            return (
              <button
                key={p.uuid}
                type="button"
                onClick={() => setSelectedUuid(p.uuid)}
                aria-pressed={on}
                className={`shrink-0 px-3.5 py-2 rounded-full border text-[13px] font-bold transition-colors ${
                  on ? "bg-[#1c1917] border-[#1c1917] text-white" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      )}
      {selected ? (
        <ReportsList key={selected.uuid} portfolioUuid={selected.uuid} />
      ) : (
        <p className="text-sm text-slate-500">Create a portfolio to generate its reports.</p>
      )}
    </div>
  );
}
