"use client";

import { useState } from "react";
import { X, AlertCircle, PlusCircle, Pencil, ChevronDown, Trash2 } from "lucide-react";
import { StandardTransaction } from "../../models/Report";
import { validateTransactions } from "../../lib/parser";

interface TransactionModalProps {
  mode: "add" | "edit";
  initial?: StandardTransaction;
  onClose: () => void;
  onSave: (transaction: StandardTransaction) => void;
  onDelete?: () => void;
}

const OPERATIONS: StandardTransaction["operation"][] = ["buy", "sell", "dividend", "other"];

interface FormState {
  date: string;
  time: string;
  operation: StandardTransaction["operation"];
  quantity: string;
  price: string;
  currency: string;
  fees: string;
  ticker: string;
  isin: string;
  broker: string;
}

const emptyForm: FormState = {
  date: "",
  time: "",
  operation: "buy",
  quantity: "",
  price: "",
  currency: "EUR",
  fees: "",
  ticker: "",
  isin: "",
  broker: "Manual",
};

// Pulls the "YYYY-MM-DD" and, if present, "HH:mm" straight out of the ISO string as text —
// deliberately not routed through `Date`, which would reinterpret a bare date (no time,
// no offset) as UTC midnight and could shift it by a day once displayed in local time.
function splitIsoDate(iso: string): { date: string; time: string } {
  const match = iso?.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) return { date: iso ?? "", time: "" };
  return { date: match[1], time: match[2] ?? "" };
}

function toFormState(tx?: StandardTransaction): FormState {
  if (!tx) return emptyForm;
  const { date, time } = splitIsoDate(tx.date);
  return {
    date,
    time,
    operation: tx.operation,
    quantity: Number.isNaN(tx.quantity) ? "" : String(tx.quantity),
    price: Number.isNaN(tx.price) ? "" : String(tx.price),
    currency: tx.currency,
    fees: String(tx.fees ?? 0),
    ticker: tx.ticker ?? "",
    isin: tx.isin ?? "",
    broker: tx.broker,
  };
}

function InputField({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-300 placeholder:font-normal outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-11 pl-3.5 pr-9 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:ring-4 focus:ring-slate-50 focus:border-slate-300 transition-all appearance-none"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>
    </div>
  );
}

export function TransactionModal({ mode, initial, onClose, onSave, onDelete }: TransactionModalProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<string[]>([]);
  const isEdit = mode === "edit";

  const set = <K extends keyof FormState>(key: K) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    const foundErrors: string[] = [];

    if (!form.ticker.trim() && !form.isin.trim())
      foundErrors.push("Provide at least a Ticker or an ISIN.");

    const quantity = Number(form.quantity);
    const price = Number(form.price);

    const isin = form.isin.trim().toUpperCase();
    const ticker = form.ticker.trim().toUpperCase();

    const transaction: StandardTransaction = {
      // Locally-generated key, not shown to the user — prefers isin, falls back to ticker.
      id: initial?.id || isin || ticker,
      date: form.time ? `${form.date}T${form.time}` : form.date,
      operation: form.operation,
      quantity,
      price,
      currency: form.currency.trim().toUpperCase(),
      fees: form.fees.trim() === "" ? 0 : Number(form.fees),
      broker: form.broker.trim() || "Manual",
      ...(isin ? { isin } : {}),
      ...(ticker ? { ticker } : {}),
    } as StandardTransaction;

    const { errors: validationErrors } = validateTransactions([transaction]);
    foundErrors.push(...validationErrors.map(e => e.message));

    if (foundErrors.length > 0) {
      setErrors(foundErrors);
      return;
    }

    onSave(transaction);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-4xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 md:p-8 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              {isEdit ? <Pencil className="h-5 w-5 text-blue-600" /> : <PlusCircle className="h-5 w-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">{isEdit ? "Edit transaction" : "Add transaction"}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isEdit ? "Update the fields for this transaction" : "Fill in the fields for a single transaction"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 space-y-1.5">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-xs font-semibold text-rose-700">{err}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField label="Date" type="date" value={form.date} onChange={set("date")} required />
          <InputField label="Time" type="time" value={form.time} onChange={set("time")} placeholder="Optional" />
          <SelectField label="Operation" value={form.operation} onChange={(v) => set("operation")(v as StandardTransaction["operation"])} options={OPERATIONS} />
          <InputField label="Ticker" value={form.ticker} onChange={set("ticker")} placeholder="AAPL" />
          <InputField label="ISIN" value={form.isin} onChange={set("isin")} placeholder="US0378331005" />
          <InputField label="Quantity" type="number" value={form.quantity} onChange={set("quantity")} placeholder="10" required />
          <InputField label="Price" type="number" value={form.price} onChange={set("price")} placeholder="185.20" required />
          <InputField label="Currency" value={form.currency} onChange={set("currency")} placeholder="EUR" required />
          <InputField label="Fees" type="number" value={form.fees} onChange={set("fees")} placeholder="0" />
          <InputField label="Broker" value={form.broker} onChange={set("broker")} placeholder="Manual" />
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          {isEdit && onDelete ? (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-3 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-blue-600 transition-colors shadow-md shadow-slate-200"
            >
              {isEdit ? "Save changes" : "Add transaction"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
