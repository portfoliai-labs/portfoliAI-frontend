// components/preview/RealEstatePortfolio.tsx
"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot, Legend, CartesianGrid, ComposedChart,
} from "recharts";
import { BellRing, Building2, Calculator, Download, FileSearch, FileText, Home, Landmark, MapPin, Plus, Receipt, Sparkles, TrendingUp } from "lucide-react";
import { Breadcrumb, type Crumb } from "../dashboard/Breadcrumb";
import { DataTable, type DataColumn } from "../dashboard/ExploreView";
import { ActionCard } from "../dashboard/ActionCard";
import { Toggle } from "../dashboard/Toggle";
import { formatCompact, formatCurrency } from "../../lib/format";
import { CATEGORICAL_PALETTE } from "../../lib/chartColors";
import {
  PROPERTIES, ZONES, QUARTERS, REAL_ESTATE_TRANSACTIONS, REAL_ESTATE_REPORTS, REAL_ESTATE_ALERTS, zoneById, zoneMarketTrend, zoneNow, zoneYoY, zoneGrossYield,
  propertyValue, propertyGrossYield, mortgageBalance, monthlyIncome, shortTermAnalysis, portfolioValueSeries, monthlyCashFlow,
  type Property, type RealEstateTransaction, type RealEstateReport,
} from "../../lib/mock/realEstate";
import { AXIS_TICK, ComingSoonButton, Panel, Pills, PreviewBadge, PreviewBanner, Stat, TOOLTIP_STYLE, formatPct, serif } from "./PreviewKit";

const eur = (v: number) => formatCurrency(v, "EUR", 0);
const GOLD = "#C49A3C";

export type RealEstatePage = "home" | "insights" | "transactions" | "reports" | "alerts";

const PAGE_LABELS: Record<Exclude<RealEstatePage, "home">, string> = {
  insights: "Insights", transactions: "Transactions", reports: "Reports", alerts: "Alerts",
};

/**
 * REAL ESTATE PORTFOLIO (preview) — a sample portfolio of properties, opened from its card on
 * the Portfolios hub and built as a portfolio's own page once was: its figures and
 * value curve, then the way into its Insights, Transactions, Reports and Alerts. Insights holds
 * the property analyses: a table of the properties, then for the one picked the market of its
 * neighbourhood (price trend against the city, rents in the nearby zones) and how it would do as
 * a short-term rental (a 0–100 score, its seasonality, the income against a long-term lease).
 * `trail` leads up to the hub; the sub-pages add "Real estate" to it. Everything comes from
 * lib/mock/realEstate.
 */
export function RealEstatePortfolio({
  trail, page, onOpenPage,
}: { trail: Crumb[]; page: RealEstatePage; onOpenPage: (page: RealEstatePage) => void }) {
  if (page === "home") return <RealEstateHome trail={trail} onOpenPage={onOpenPage} />;

  const pageTrail = [...trail, { label: "Real estate", onClick: () => onOpenPage("home") }];
  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb trail={pageTrail} current={PAGE_LABELS[page]} right={pageAction(page)} />
      {page === "insights" && <RealEstateInsights />}
      {page === "transactions" && <RealEstateTransactions />}
      {page === "reports" && <RealEstateReports />}
      {page === "alerts" && <RealEstateAlerts />}
    </div>
  );
}

function pageAction(page: RealEstatePage) {
  switch (page) {
    case "transactions":
      return <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>Add transaction</ComingSoonButton>;
    case "reports":
      return <ComingSoonButton icon={<FileText className="h-3.5 w-3.5" />}>Generate report</ComingSoonButton>;
    case "alerts":
      return <ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>New alert</ComingSoonButton>;
    default:
      return undefined;
  }
}

function RealEstateHome({ trail, onOpenPage }: { trail: Crumb[]; onOpenPage: (page: RealEstatePage) => void }) {
  const totals = useMemo(() => {
    const value = PROPERTIES.reduce((s, p) => s + propertyValue(p), 0);
    const invested = PROPERTIES.reduce((s, p) => s + p.purchasePrice + p.purchaseCosts, 0);
    const debt = PROPERTIES.reduce((s, p) => s + mortgageBalance(p), 0);
    const income = PROPERTIES.reduce((s, p) => s + monthlyIncome(p), 0);
    return { value, invested, debt, income, equity: value - debt, gain: value - invested };
  }, []);
  const valueSeries = useMemo(() => portfolioValueSeries(), []);
  const lastReport = REAL_ESTATE_REPORTS[0];
  const activeAlerts = REAL_ESTATE_ALERTS.filter((a) => a.enabled);
  const triggered = activeAlerts.filter((a) => a.triggered).length;

  return (
    <div className="space-y-6 pb-12">
      <Breadcrumb
        trail={trail}
        current="Real estate"
        right={<ComingSoonButton icon={<Plus className="h-3.5 w-3.5" />}>Add property</ComingSoonButton>}
      />
      <PreviewBanner feature="Real estate">
        A sample portfolio of four properties, to show where PortfoliAI is heading: property values tracked against their
        neighbourhood&apos;s market, rent and mortgage cash flows, and a short-term rental check. Market and rental figures
        are invented; nothing here is saved.
      </PreviewBanner>

      <section className="bg-white rounded-4xl border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="p-6 md:p-7 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Estimated value</p>
                <PreviewBadge label="Sample" />
              </div>
              <p className="text-3xl md:text-4xl font-black text-slate-900 tabular-nums" style={serif}>{eur(totals.value)}</p>
              <p className="text-[13px] font-bold tabular-nums mt-2">
                <span className={totals.gain >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct((totals.gain / totals.invested) * 100)}</span>
                <span className="text-slate-400 font-semibold"> on what was paid, costs included</span>
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Stat label="Invested" value={eur(totals.invested)} />
              <Stat label="Equity" value={eur(totals.equity)} note={`LTV ${((totals.debt / totals.value) * 100).toFixed(0)}%`} />
              <Stat label="Mortgage debt" value={eur(totals.debt)} />
              <Stat label="Rent / month" value={eur(totals.income)} note={`${((totals.income * 12 / totals.value) * 100).toFixed(1)}% gross yield`} />
            </dl>
          </div>
          <div className="h-60 lg:h-auto lg:min-h-64 border-t lg:border-t-0 lg:border-l border-slate-100 p-4">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 240 }}>
              <AreaChart data={valueSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [eur(Number(v)), name === "value" ? "Estimated value" : "Invested"]} />
                <Area type="stepAfter" dataKey="invested" stroke="#94a3b8" strokeDasharray="4 4" fill="none" strokeWidth={1.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="value" stroke={GOLD} fill={GOLD} fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ActionCard
          className="md:col-span-3 min-h-0"
          icon={<TrendingUp className="h-5 w-5" />}
          title="Insights"
          text="Each property against its neighbourhood's market, its short-term rental potential, cash flow and where the value sits."
          onClick={() => onOpenPage("insights")}
        >
          <div className="flex flex-wrap gap-1.5">
            {["Properties", "Market trend", "Rents by zone", "Short-term rental", "Cash flow"].map((label) => (
              <span key={label} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-stone-300">{label}</span>
            ))}
          </div>
        </ActionCard>
        <ActionCard
          icon={<Receipt className="h-5 w-5" />}
          title="Transactions"
          text="Purchases, works, rents, mortgage payments and running costs."
          onClick={() => onOpenPage("transactions")}
        >
          <p className="text-xs font-bold text-[#C49A3C]">{REAL_ESTATE_TRANSACTIONS.length} transactions</p>
        </ActionCard>
        <ActionCard icon={<FileText className="h-5 w-5" />} title="Reports" text="Quarterly reports, valuations and the figures for your tax return." onClick={() => onOpenPage("reports")}>
          <p className="text-xs font-bold text-[#C49A3C]">
            {REAL_ESTATE_REPORTS.length} reports · last {new Date(lastReport.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </ActionCard>
        <ActionCard icon={<BellRing className="h-5 w-5" />} title="Alerts" text="Missed rents, falling zone prices, taxes due and short-stay occupancy." onClick={() => onOpenPage("alerts")}>
          <p className="text-xs font-bold text-[#C49A3C]">{activeAlerts.length} active{triggered > 0 ? ` · ${triggered} triggered` : ""}</p>
        </ActionCard>
      </div>
    </div>
  );
}

function RealEstateInsights() {
  const [selectedId, setSelectedId] = useState(PROPERTIES[0].id);
  const selected = PROPERTIES.find((p) => p.id === selectedId)!;

  return (
    <>
      <PreviewBanner feature="Real estate insights" />
      <PropertiesTable selectedId={selectedId} onSelect={setSelectedId} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#C49A3C]">Property analysis</p>
            <h2 className="text-2xl font-black text-slate-900" style={serif}>{selected.name}</h2>
            <p className="text-xs font-semibold text-slate-500 mt-0.5 flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {selected.address}, {zoneById(selected.zoneId).name} · {selected.city}
            </p>
          </div>
          <Pills options={PROPERTIES.map((p) => ({ value: p.id, label: p.name }))} value={selectedId} onChange={setSelectedId} />
        </div>
        <MarketTrend property={selected} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ZoneSnapshot property={selected} />
          <RentByZone property={selected} />
        </div>
        <ShortTermRental property={selected} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6">
        <CashFlow />
        <Allocation />
      </div>

      <Roadmap />
    </>
  );
}

function PropertiesTable({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const columns: DataColumn<Property>[] = [
    {
      key: "name", label: "Property", sortValue: (p) => p.name,
      render: (p) => (
        <button type="button" onClick={() => onSelect(p.id)} className="text-left group min-w-44">
          <span className="font-bold text-slate-900 group-hover:text-[#C49A3C] transition-colors">{p.name}</span>
          <span className="block text-[11px] text-slate-400 font-semibold">{p.type} · {zoneById(p.zoneId).name}, {p.city}</span>
        </button>
      ),
    },
    { key: "sqm", label: "m²", align: "right", sortValue: (p) => p.sqm, render: (p) => p.sqm },
    { key: "bought", label: "Bought", align: "right", sortValue: (p) => p.purchaseDate, render: (p) => new Date(p.purchaseDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) },
    { key: "price", label: "Paid", align: "right", sortValue: (p) => p.purchasePrice, render: (p) => eur(p.purchasePrice) },
    { key: "value", label: "Value", align: "right", sortValue: (p) => propertyValue(p), render: (p) => <span className="font-bold text-slate-900">{eur(propertyValue(p))}</span> },
    {
      key: "gain", label: "Gain", align: "right", sortValue: (p) => propertyValue(p) / p.purchasePrice,
      render: (p) => {
        const pct = (propertyValue(p) / p.purchasePrice - 1) * 100;
        return <span className={`font-bold ${pct >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{formatPct(pct)}</span>;
      },
    },
    { key: "rent", label: "Income / mo", align: "right", sortValue: (p) => monthlyIncome(p), render: (p) => eur(monthlyIncome(p)) },
    { key: "yield", label: "Gross yield", align: "right", sortValue: (p) => propertyGrossYield(p), render: (p) => `${propertyGrossYield(p).toFixed(1)}%` },
    { key: "debt", label: "Mortgage", align: "right", sortValue: (p) => mortgageBalance(p), render: (p) => (p.mortgage ? eur(mortgageBalance(p)) : "—") },
    {
      key: "usage", label: "Use", sortValue: (p) => p.usage,
      render: (p) => (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${
          p.usage === "Short-term rental" ? "bg-violet-50 text-violet-700" : p.usage === "Long-term rental" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}>{p.usage}</span>
      ),
    },
  ];
  return (
    <Panel title="Properties" subtitle="Click a property to analyse it below.">
      <DataTable columns={columns} rows={PROPERTIES} rowKey={(p) => p.id} initialSort={{ key: "value", desc: true }} highlight={selectedId} />
    </Panel>
  );
}

function MarketTrend({ property }: { property: Property }) {
  const zone = zoneById(property.zoneId);
  const data = useMemo(() => zoneMarketTrend(zone), [zone]);
  const [y, m] = property.purchaseDate.split("-").map(Number);
  const purchaseQuarter = QUARTERS[(y - 2019) * 4 + Math.floor((m - 1) / 3)];
  const paidPerSqm = Math.round(property.purchasePrice / property.sqm);

  return (
    <Panel
      title={`Market trend · ${zone.name} vs ${zone.city}`}
      subtitle="Asking price per m², quarterly. The dot is what was paid per m²."
      right={<span className="text-sm font-black tabular-nums"><span className={zoneYoY(zone) >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatPct(zoneYoY(zone))}</span> <span className="text-slate-400 text-xs font-semibold">last 12 months</span></span>}
    >
      <div className="p-4 md:p-6 h-72">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 280 }}>
          <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="quarter" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={40} />
            <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} domain={["auto", "auto"]} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, name) => [`${eur(Number(v))}/m²`, name === "zone" ? zone.name : `${zone.city} average`]} />
            <Legend formatter={(v) => (v === "zone" ? zone.name : `${zone.city} average`)} wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={purchaseQuarter} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: "Bought", position: "insideTopLeft", fontSize: 11, fill: "#64748b" }} />
            <Line type="monotone" dataKey="city" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="zone" stroke={CATEGORICAL_PALETTE[0]} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <ReferenceDot x={purchaseQuarter} y={paidPerSqm} r={5} fill={GOLD} stroke="#fff" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function ZoneSnapshot({ property }: { property: Property }) {
  const zone = zoneById(property.zoneId);
  const now = zoneNow(zone);
  const value = propertyValue(property);
  const marketRent = zone.rentPerSqm * property.sqm;
  return (
    <Panel title={`${zone.name} at a glance`} subtitle="Neighbourhood figures, this quarter.">
      <div className="p-6 md:p-7 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat label="Price / m²" value={eur(now)} note={`${formatPct(zoneYoY(zone))} YoY`} />
        <Stat label="Your value / m²" value={eur(value / property.sqm)} note={`${formatPct((value / property.sqm / now - 1) * 100)} vs zone`} />
        <Stat label="Rent / m² / mo" value={formatCurrency(zone.rentPerSqm, "EUR", 1)} />
        <Stat label="Gross yield (zone)" value={`${zoneGrossYield(zone).toFixed(1)}%`} />
        <Stat label="Vacancy" value={`${zone.vacancyPct.toFixed(1)}%`} />
        <Stat label="Days on market" value={`${zone.daysOnMarket}`} />
        {property.monthlyRent > 0 && (
          <div className="col-span-2 rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-600">
              Rent collected <span className="font-black text-slate-900">{eur(property.monthlyRent)}</span> vs market{" "}
              <span className="font-black text-slate-900">{eur(marketRent)}</span>{" "}
              <span className={property.monthlyRent >= marketRent ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>
                ({formatPct((property.monthlyRent / marketRent - 1) * 100)})
              </span>
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function RentByZone({ property }: { property: Property }) {
  const data = ZONES.filter((z) => z.city === property.city).map((z) => ({ name: z.name, rent: z.rentPerSqm, yield: zoneGrossYield(z), id: z.id }));
  return (
    <Panel title={`Rents across ${property.city}`} subtitle="Long-term rent per m² per month, by neighbourhood.">
      <div className="p-4 md:p-6 h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 240 }}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
            <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
            <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, _n, item) => [`€${Number(v).toFixed(1)}/m² · ${(item.payload as { yield: number }).yield.toFixed(1)}% yield`, "Rent"]} />
            <Bar dataKey="rent" radius={[0, 6, 6, 0]} maxBarSize={22} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.id} fill={d.id === property.zoneId ? GOLD : "#cbd5e1"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 70 ? "#10b981" : score >= 55 ? GOLD : score >= 40 ? "#f59e0b" : "#f43f5e";
  return (
    <svg viewBox="0 0 128 128" className="w-36 h-36" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
      <circle
        cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 64 64)"
      />
      <text x="64" y="62" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 30, fontWeight: 900, ...serif }}>{score}</text>
      <text x="64" y="82" textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}>/ 100</text>
    </svg>
  );
}

function ShortTermRental({ property }: { property: Property }) {
  const st = useMemo(() => shortTermAnalysis(property), [property]);
  const zone = zoneById(property.zoneId);

  return (
    <Panel
      title="Short-term rental potential"
      subtitle="Would it earn more on Airbnb-style short stays than on a long-term lease?"
      right={<PreviewBadge label="Sample model" />}
    >
      {!st.eligible ? (
        <div className="p-6 md:p-7 flex items-center gap-6">
          <ScoreRing score={st.score} />
          <p className="text-sm text-slate-600 max-w-md">
            A {property.type.toLowerCase()} can&apos;t host guests, so short stays aren&apos;t an option here. Its long-term rent
            of <span className="font-bold text-slate-900">{eur(property.monthlyRent)}</span> a month is the income to track.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          <div className="p-6 md:p-7 grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-8 items-center">
            <div className="flex flex-col items-center gap-2">
              <ScoreRing score={st.score} />
              <span className="text-sm font-black text-slate-900">{st.verdict}</span>
            </div>
            <div className="space-y-3">
              {st.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-bold text-slate-700">{f.label}</span>
                    <span className="text-xs font-black tabular-nums text-slate-900">{f.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${f.score}%`, background: f.score >= 70 ? "#10b981" : f.score >= 45 ? GOLD : "#f43f5e" }} />
                  </div>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{f.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-7 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
            <Stat label="Nightly rate" value={eur(st.adr)} note={`${zone.name} average, sized to ${property.rooms} rooms`} />
            <Stat label="Occupancy" value={`${st.occupancyPct}%`} note={`Break-even ${st.breakEvenOccupancyPct.toFixed(0)}%`} />
            <Stat label="Short stays, net / yr" value={eur(st.netYearly)} tone={st.netYearly >= st.longTermNetYearly ? "gain" : "loss"} note="After fees, cleaning, 26% tax" />
            <Stat label="Long lease, net / yr" value={eur(st.longTermNetYearly)} note="After 5% vacancy, 21% flat tax" />
          </div>

          <div className="p-4 md:p-6 h-64">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 700, height: 240 }}>
              <ComposedChart data={st.monthly} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis yAxisId="rev" tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                <YAxis yAxisId="occ" orientation="right" tickFormatter={(v) => `${v}%`} tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} domain={[0, 100]} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, name) => (name === "revenue" ? [eur(Number(v)), "Gross revenue"] : [`${v}%`, "Occupancy"])} />
                <Legend formatter={(v) => (v === "revenue" ? "Gross revenue" : "Occupancy")} wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine yAxisId="rev" y={(st.longTermNetYearly / 12)} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Long lease, net", position: "insideTopRight", fontSize: 11, fill: "#64748b" }} />
                <Bar yAxisId="rev" dataKey="revenue" fill={CATEGORICAL_PALETTE[4]} radius={[6, 6, 0, 0]} maxBarSize={32} isAnimationActive={false} />
                <Line yAxisId="occ" dataKey="occupancyPct" stroke={GOLD} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}

function CashFlow() {
  const data = useMemo(() => monthlyCashFlow(), []);
  const net = data.reduce((s, d) => s + d.net, 0);
  return (
    <Panel
      title="Cash flow, last 12 months"
      subtitle="Rent and payouts in; mortgage, condo fees, property tax and repairs out."
      right={<span className="text-sm font-black tabular-nums"><span className={net >= 0 ? "text-emerald-600" : "text-rose-600"}>{net >= 0 ? "+" : ""}{eur(net)}</span> <span className="text-xs font-semibold text-slate-400">net</span></span>}
    >
      <div className="p-4 md:p-6 h-64">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 240 }}>
          <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={8} />
            <YAxis tickFormatter={formatCompact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f8fafc" }} formatter={(v, name) => [eur(Number(v)), name === "income" ? "In" : "Out"]} />
            <Bar dataKey="income" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar dataKey="costs" fill="#f43f5e" radius={[5, 5, 0, 0]} maxBarSize={18} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function Allocation() {
  const byCity = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of PROPERTIES) map.set(p.city, (map.get(p.city) ?? 0) + propertyValue(p));
    return [...map].map(([name, value]) => ({ name, value }));
  }, []);
  const total = byCity.reduce((s, d) => s + d.value, 0);
  return (
    <Panel title="Where the value sits" subtitle="Estimated value by city.">
      <div className="p-6 md:p-7 flex items-center gap-6">
        <PieChart width={128} height={128}>
          <Pie data={byCity} dataKey="value" innerRadius={40} outerRadius={62} paddingAngle={2} isAnimationActive={false} stroke="none">
            {byCity.map((d, i) => <Cell key={d.name} fill={CATEGORICAL_PALETTE[i]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => eur(Number(v))} />
        </PieChart>
        <ul className="space-y-2 flex-1 min-w-0">
          {byCity.map((d, i) => (
            <li key={d.name} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2 font-semibold text-slate-700 truncate">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: CATEGORICAL_PALETTE[i] }} />{d.name}
              </span>
              <span className="font-black tabular-nums text-slate-900">{((d.value / total) * 100).toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function RealEstateTransactions() {
  const [propertyId, setPropertyId] = useState("all");
  const nameOf = (id: string) => PROPERTIES.find((p) => p.id === id)!.name;
  const rows = propertyId === "all" ? REAL_ESTATE_TRANSACTIONS : REAL_ESTATE_TRANSACTIONS.filter((t) => t.propertyId === propertyId);
  const net = rows.reduce((s, t) => s + t.amount, 0);
  const columns: DataColumn<RealEstateTransaction>[] = [
    { key: "date", label: "Date", sortValue: (t) => t.date, render: (t) => <span className="whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</span> },
    { key: "property", label: "Property", sortValue: (t) => nameOf(t.propertyId), render: (t) => <span className="font-semibold text-slate-800">{nameOf(t.propertyId)}</span> },
    { key: "kind", label: "Type", sortValue: (t) => t.kind, render: (t) => t.kind },
    {
      key: "amount", label: "Amount", align: "right", sortValue: (t) => t.amount,
      render: (t) => <span className={`font-bold ${t.amount >= 0 ? "text-emerald-600" : "text-slate-900"}`}>{t.amount >= 0 ? "+" : ""}{eur(t.amount)}</span>,
    },
  ];
  return (
    <>
      <PreviewBanner feature="Real estate transactions">
        Sample transactions. New ones will be added from the transaction form&apos;s Real estate tab, which you can already
        try out but not save.
      </PreviewBanner>
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 md:p-5">
        <Pills options={[{ value: "all", label: "Every property" }, ...PROPERTIES.map((p) => ({ value: p.id, label: p.name }))]} value={propertyId} onChange={setPropertyId} />
      </div>
      <Panel
        title={`${rows.length} transactions`}
        right={<span className="text-sm font-black tabular-nums"><span className={net >= 0 ? "text-emerald-600" : "text-slate-900"}>{net >= 0 ? "+" : ""}{eur(net)}</span> <span className="text-xs text-slate-400 font-semibold">net</span></span>}
      >
        <DataTable columns={columns} rows={rows} rowKey={(t) => t.id} initialSort={{ key: "date", desc: true }} />
      </Panel>
    </>
  );
}

const REPORT_STYLE: Record<RealEstateReport["kind"], string> = {
  Quarterly: "bg-blue-50 text-blue-700",
  Tax: "bg-amber-50 text-amber-700",
  Valuation: "bg-emerald-50 text-emerald-700",
  "Short-term": "bg-violet-50 text-violet-700",
};

function RealEstateReports() {
  return (
    <>
      <PreviewBanner feature="Real estate reports" />
      <Panel title="Reports" subtitle="Made every quarter, plus valuations and tax summaries when they fall due.">
        <ul className="divide-y divide-slate-100">
          {REAL_ESTATE_REPORTS.map((r) => (
            <li key={r.id} className="px-6 md:px-7 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-10 h-10 rounded-xl bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center shrink-0"><FileText className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-900 truncate">
                    {r.title}
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider align-middle ${REPORT_STYLE[r.kind]}`}>{r.kind}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400 truncate">
                    {new Date(r.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })} · {r.detail}
                  </p>
                </div>
              </div>
              <button type="button" disabled title="Coming soon" className="p-2.5 rounded-xl border border-slate-200 text-slate-300 cursor-not-allowed shrink-0">
                <Download className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function RealEstateAlerts() {
  const [alerts, setAlerts] = useState(REAL_ESTATE_ALERTS);
  return (
    <>
      <PreviewBanner feature="Real estate alerts">Sample rules. Switching them on or off works on this page only and isn&apos;t saved.</PreviewBanner>
      <Panel title="Alert rules" subtitle="Notifications will arrive by email and in the bell at the top.">
        <ul className="divide-y divide-slate-100">
          {alerts.map((a) => (
            <li key={a.id} className="px-6 md:px-7 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.enabled && a.triggered ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-400"}`}>
                  <BellRing className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-black text-slate-900">
                    {a.title}
                    {a.enabled && a.triggered && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-rose-50 text-[9px] font-black uppercase tracking-wider text-rose-600 align-middle">Triggered</span>}
                  </p>
                  <p className="text-[11px] font-semibold text-slate-400">{a.detail} · {a.scope}</p>
                </div>
              </div>
              <Toggle
                checked={a.enabled}
                label={a.title}
                onChange={(v) => setAlerts((list) => list.map((x) => (x.id === a.id ? { ...x, enabled: v } : x)))}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function Roadmap() {
  const items = [
    { icon: <FileSearch className="h-4 w-4" />, title: "Valuation from comparables", text: "Estimate each property from recent sales of similar homes nearby, not just the zone index." },
    { icon: <Landmark className="h-4 w-4" />, title: "Mortgage & refinancing", text: "Amortisation schedules, early repayment and what switching rate would save." },
    { icon: <Calculator className="h-4 w-4" />, title: "Tax simulator", text: "IMU, flat-tax (cedolare secca) vs ordinary income tax, and capital gains on a sale." },
    { icon: <Home className="h-4 w-4" />, title: "Renovation ROI", text: "What an energy-class upgrade adds to value and rent, net of incentives." },
    { icon: <Building2 className="h-4 w-4" />, title: "Real estate next to securities", text: "Property value and equity counted in the Dashboard's net worth and in Compare." },
    { icon: <Sparkles className="h-4 w-4" />, title: "AI deal check", text: "Paste a listing: fair price, expected yield and short-stay score before you buy." },
  ];
  return (
    <Panel title="On the roadmap" subtitle="Analyses planned for real estate.">
      <div className="p-6 md:p-7 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.title} className="rounded-2xl border border-dashed border-slate-200 p-4">
            <span className="w-8 h-8 rounded-lg bg-[#C49A3C]/10 text-[#C49A3C] flex items-center justify-center">{it.icon}</span>
            <p className="text-sm font-black text-slate-900 mt-3">{it.title}</p>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{it.text}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
