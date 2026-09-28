// components/preview/RealEstateTransactionFields.tsx
"use client";

import { useState } from "react";
import { Building2, Hammer, HandCoins, Home, KeyRound, Landmark, Receipt, type LucideIcon } from "lucide-react";
import type { PropertyType, PropertyUsage } from "../../lib/mock/realEstate";
import { PreviewBanner } from "./PreviewKit";

type Kind = "purchase" | "sale" | "rent" | "expense" | "renovation" | "mortgage";

const KINDS: { value: Kind; label: string; icon: LucideIcon }[] = [
  { value: "purchase", label: "Purchase", icon: Home },
  { value: "sale", label: "Sale", icon: KeyRound },
  { value: "rent", label: "Rent in", icon: HandCoins },
  { value: "expense", label: "Expense", icon: Receipt },
  { value: "renovation", label: "Works", icon: Hammer },
  { value: "mortgage", label: "Mortgage", icon: Landmark },
];

const PROPERTY_TYPES: PropertyType[] = ["Apartment", "House", "Commercial", "Garage", "Land"];
const USAGES: PropertyUsage[] = ["Primary residence", "Long-term rental", "Short-term rental", "Vacant"];
const EXPENSES = ["Property tax (IMU)", "Condo fees", "Insurance", "Maintenance", "Utilities", "Agency / management", "Other"];
const ENERGY = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"];

/**
 * REAL ESTATE TRANSACTION FIELDS (preview) — the transaction modal's Property tab: the basics a
 * property transaction needs (which property, its type, address, size and energy class; for a
 * purchase the price, the costs on top and the mortgage; otherwise the amount and what it was
 * for). It shows the form as it's planned but can't be saved yet: TransactionModal disables
 * its Save while this tab is open.
 */
export function RealEstateTransactionFields() {
  const [kind, setKind] = useState<Kind>("purchase");
  const [form, setForm] = useState<Record<string, string>>({ currency: "EUR", type: "Apartment", usage: "Long-term rental", energy: "D", expense: EXPENSES[0] });
  const set = (key: string) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const isPurchase = kind === "purchase";
  const isSale = kind === "sale";

  const price = Number(form.price) || 0;
  const costs = (Number(form.notary) || 0) + (Number(form.agency) || 0) + (Number(form.taxes) || 0);
  const perSqm = price && Number(form.sqm) ? price / Number(form.sqm) : null;

  return (
    <div className="space-y-5">
      <PreviewBanner feature="Real estate transactions">
        This is how adding a property transaction will work. The form can be filled in to try it out, but it can&apos;t be
        saved yet.
      </PreviewBanner>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => setKind(k.value)}
            className={`flex flex-col items-center justify-center gap-1.5 w-[4.5rem] sm:w-20 py-2.5 rounded-2xl border-2 transition-all shrink-0 ${
              kind === k.value ? "border-violet-400 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
            }`}
          >
            <k.icon className="h-4 w-4" />
            <span className="text-[11px] font-bold">{k.label}</span>
          </button>
        ))}
      </div>

      <Group title="Property" icon={<Building2 className="h-3.5 w-3.5" />}>
        <Field label="Name" value={form.name} onChange={set("name")} placeholder="Navigli loft" required />
        <Select label="Type" value={form.type} options={PROPERTY_TYPES} onChange={set("type")} />
        {(isPurchase || isSale) && (
          <>
            <Field label="Address" value={form.address} onChange={set("address")} placeholder="Via Vigevano 18" required={isPurchase} />
            <Field label="City" value={form.city} onChange={set("city")} placeholder="Milan" required={isPurchase} />
            <Field label="Neighbourhood / zone" value={form.zone} onChange={set("zone")} placeholder="Navigli" />
            <Field label="Cadastral reference" value={form.cadastral} onChange={set("cadastral")} placeholder="Fg. 12, Part. 345, Sub. 6" />
            <Field label="Surface" type="number" value={form.sqm} onChange={set("sqm")} placeholder="68" suffix="m²" required={isPurchase} />
            <Field label="Rooms" type="number" value={form.rooms} onChange={set("rooms")} placeholder="3" />
            <Field label="Year built" type="number" value={form.yearBuilt} onChange={set("yearBuilt")} placeholder="1962" />
            <Select label="Energy class" value={form.energy} options={ENERGY} onChange={set("energy")} />
          </>
        )}
        {isPurchase && <Select label="Use" value={form.usage} options={USAGES} onChange={set("usage")} />}
      </Group>

      <Group title={isPurchase ? "Purchase" : isSale ? "Sale" : "Transaction"} icon={<Receipt className="h-3.5 w-3.5" />}>
        <Field label="Date" type="date" value={form.date} onChange={set("date")} required />
        <Field label="Currency" value={form.currency} onChange={set("currency")} placeholder="EUR" required />
        {(isPurchase || isSale) ? (
          <>
            <Field label={isPurchase ? "Price" : "Sale price"} type="number" value={form.price} onChange={set("price")} placeholder="305000" required />
            <Field label="Agency fee" type="number" value={form.agency} onChange={set("agency")} placeholder="9150" />
            {isPurchase && (
              <>
                <Field label="Notary" type="number" value={form.notary} onChange={set("notary")} placeholder="3500" />
                <Field label="Registration & taxes" type="number" value={form.taxes} onChange={set("taxes")} placeholder="11750" />
              </>
            )}
          </>
        ) : (
          <>
            <Field label="Amount" type="number" value={form.amount} onChange={set("amount")} placeholder={kind === "rent" ? "1480" : "250"} required />
            {kind === "expense" && <Select label="Expense type" value={form.expense} options={EXPENSES} onChange={set("expense")} />}
            {kind === "rent" && <Field label="Period" type="month" value={form.period} onChange={set("period")} />}
            {kind === "rent" && <Field label="Tenant / platform" value={form.tenant} onChange={set("tenant")} placeholder="Airbnb, tenant name…" />}
            {kind === "renovation" && <Field label="Tax incentive" value={form.incentive} onChange={set("incentive")} placeholder="Bonus ristrutturazione 50%" />}
            {kind === "mortgage" && (
              <>
                <Field label="Of which interest" type="number" value={form.interest} onChange={set("interest")} placeholder="290" />
                <Field label="Remaining balance" type="number" value={form.balance} onChange={set("balance")} placeholder="171400" />
              </>
            )}
          </>
        )}
      </Group>

      {isPurchase && (
        <Group title="Mortgage (optional)" icon={<Landmark className="h-3.5 w-3.5" />}>
          <Field label="Loan amount" type="number" value={form.loan} onChange={set("loan")} placeholder="220000" />
          <Field label="Interest rate" type="number" value={form.rate} onChange={set("rate")} placeholder="1.6" suffix="%" />
          <Field label="Term" type="number" value={form.term} onChange={set("term")} placeholder="25" suffix="years" />
          <Field label="Lender" value={form.lender} onChange={set("lender")} placeholder="Bank name" />
        </Group>
      )}

      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notes</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes")(e.target.value)}
          rows={2}
          placeholder="Anything worth remembering about this transaction"
          className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:border-slate-300"
        />
      </div>

      {isPurchase && price > 0 && (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
          <span>All-in cost <span className="font-black text-slate-900">{(price + costs).toLocaleString("en-US")} {form.currency}</span></span>
          <span>Costs on top <span className="font-black text-slate-900">{((costs / price) * 100).toFixed(1)}%</span></span>
          {perSqm && <span>Per m² <span className="font-black text-slate-900">{Math.round(perSqm).toLocaleString("en-US")} {form.currency}</span></span>}
          {Number(form.loan) > 0 && <span>LTV <span className="font-black text-slate-900">{((Number(form.loan) / price) * 100).toFixed(0)}%</span></span>}
        </div>
      )}
    </div>
  );
}

function Group({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-slate-700 mb-3">
        <span className="text-violet-600">{icon}</span>{title}
      </legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  );
}

const inputClass =
  "w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all";

function Field({ label, value, onChange, type = "text", placeholder, required, suffix }: {
  label: string; value?: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; suffix?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="relative">
        <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputClass} ${suffix ? "pr-14" : ""}`} />
        {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
