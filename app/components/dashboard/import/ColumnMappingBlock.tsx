"use client";

import { AlertCircle } from "lucide-react";
import { ColumnFieldMapping, ConfidenceLevel, MAPPING_TARGETS, MappingTarget, REQUIRED_MAPPING_TARGETS } from "../../../models/Import";
import { RawRow } from "../../../lib/import";
import { FIELD_LABELS } from "./types";

const CONFIDENCE_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
};

const CONSTANT_OPTION = "__constant__";

interface ColumnMappingBlockProps {
  headers: string[];
  fields: Partial<Record<MappingTarget, ColumnFieldMapping>>;
  exampleRow: RawRow | undefined;
  onChangeColumn: (target: MappingTarget, column: string | null) => void;
  onChangeConstant: (target: MappingTarget, value: string) => void;
}

export function ColumnMappingBlock({ headers, fields, exampleRow, onChangeColumn, onChangeConstant }: ColumnMappingBlockProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Which source column feeds each field — or a fixed value shared by every row. Low-confidence or missing required fields are highlighted.
      </p>
      <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-175">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Field</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Source</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Example</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {MAPPING_TARGETS.map((target) => {
                const isRequired = REQUIRED_MAPPING_TARGETS.includes(target);
                const field = fields[target];
                const isConstant = !field?.source_column && field?.constant_value != null;
                const confidence = field?.confidence;
                const missingRequired = isRequired && !field?.source_column && field?.constant_value == null;
                const needsAttention = missingRequired || confidence === "low";
                const example = isConstant ? field.constant_value : field?.source_column && exampleRow ? exampleRow[field.source_column] : undefined;

                return (
                  <tr key={target} className={needsAttention ? "bg-rose-50/50" : "hover:bg-slate-50/50"}>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                      {FIELD_LABELS[target]} {isRequired && <span className="text-rose-500">*</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          value={isConstant ? CONSTANT_OPTION : field?.source_column ?? ""}
                          onChange={(e) => {
                            if (e.target.value === CONSTANT_OPTION) onChangeConstant(target, field?.constant_value ?? "");
                            else onChangeColumn(target, e.target.value || null);
                          }}
                          className={`text-xs bg-white border rounded-xl px-2.5 py-2 font-semibold outline-none transition-all focus:ring-4 min-w-40 ${
                            missingRequired ? "border-rose-300 focus:ring-rose-50" : "border-slate-200 focus:ring-slate-50 focus:border-slate-300"
                          }`}
                        >
                          <option value="">-- not present --</option>
                          {headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                          <option value={CONSTANT_OPTION}>-- fixed value --</option>
                        </select>
                        {isConstant && (
                          <input
                            value={field?.constant_value ?? ""}
                            onChange={(e) => onChangeConstant(target, e.target.value)}
                            placeholder="e.g. EUR"
                            className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-2 font-semibold outline-none transition-all focus:ring-4 focus:ring-slate-50 focus:border-slate-300 w-24"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-500 max-w-50 truncate">
                      {example || <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {confidence ? (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${CONFIDENCE_STYLES[confidence]}`}>
                          {confidence}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {REQUIRED_MAPPING_TARGETS.some((t) => !fields[t]?.source_column && fields[t]?.constant_value == null) && (
        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 font-medium leading-relaxed">
            Map every required field (<span className="font-bold">*</span>) before confirming.
          </p>
        </div>
      )}
    </div>
  );
}
