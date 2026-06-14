"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  UploadCloud, Loader2, AlertCircle, Send,
  FileText, Trash2, CheckCircle2, X, AlertTriangle
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { reportService } from "../../services/reportService";
import {
  identifyBroker,
  BROKER_CONFIGS,
  ALL_FIELDS,
  REQUIRED_FIELDS,
  validateMapping,
  validateTransactions,
  standardizeRow,
  RawRow,
  TransactionValidationResult,
} from "../../lib/parser";
import { StandardTransaction } from "../../models/Report";


interface UploadedFileState {
  id: string;
  fileName: string;
  rawData: Record<string, unknown>[];
  previewData: StandardTransaction[];
  manualMap: Partial<Record<keyof StandardTransaction, string>>;
  detectedBroker: string;
  isValid: boolean;
  missingFields: string[];
  hasOrdersWithoutTime: boolean;
  hasMissingExchangeMic: boolean;
  validationErrors: TransactionValidationResult;
}

export function FileUploader({ forUserUuid }: { forUserUuid?: string | null } = {}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "preview" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effetto per nascondere automaticamente il toast dopo 5 secondi
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const activeFile = useMemo(() => 
    files.find(f => f.id === activeFileId) || null, 
  [files, activeFileId]);

  const allFilesValid = useMemo(() =>
    files.length > 0 && files.every(f => f.isValid),
  [files]);

  // Set of "rowIndex_field" strings for O(1) cell-level error lookup in the preview table
  const errorSet = useMemo(
    () => new Set((activeFile?.validationErrors.errors ?? []).map(e => `${e.row}_${e.field}`)),
    [activeFile],
  );

  const processFileData = (rawData: RawRow[], mapping: Partial<Record<keyof StandardTransaction, string>>, brokerId: string) => {
    const previewData = rawData.map(row => standardizeRow(row, mapping, brokerId));
    const { isValid: mappingValid, missingFields, hasOrdersWithoutTime, hasMissingExchangeMic } = validateMapping(previewData);
    const validationErrors = validateTransactions(previewData);
    return {
      previewData,
      isValid: mappingValid && validationErrors.isValid,
      missingFields,
      hasOrdersWithoutTime,
      hasMissingExchangeMic,
      validationErrors,
    };
  };

  const onParseComplete = (data: RawRow[], fileName: string) => {
    const id = Math.random().toString(36).substring(7);
    const broker = identifyBroker(data);
    const initialMapping = BROKER_CONFIGS[broker]?.columns || {};

    const { previewData, isValid, missingFields, hasOrdersWithoutTime, hasMissingExchangeMic, validationErrors } = processFileData(data, initialMapping, broker);

    const newFile: UploadedFileState = {
      id, fileName, rawData: data, previewData, manualMap: initialMapping,
      detectedBroker: broker, isValid, missingFields: missingFields.map(String),
      hasOrdersWithoutTime, hasMissingExchangeMic, validationErrors,
    };

    setFiles(prev => [...prev, newFile]);
    setActiveFileId(id);
    setStatus("preview");
  };

  const handleMappingChange = (stdField: keyof StandardTransaction, csvHeader: string) => {
    if (!activeFile) return;
    const newMapping = { ...activeFile.manualMap, [stdField]: csvHeader };
    const { previewData, isValid, missingFields, hasOrdersWithoutTime, hasMissingExchangeMic, validationErrors } = processFileData(activeFile.rawData, newMapping, activeFile.detectedBroker);

    setFiles(prev => prev.map(f => f.id === activeFile.id ? {
      ...f, manualMap: newMapping, previewData, isValid,
      missingFields: missingFields.map(String), hasOrdersWithoutTime, hasMissingExchangeMic, validationErrors,
    } : f));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    if (activeFileId === id) setActiveFileId(null);
    if (files.length <= 1) setStatus("idle");
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    for (const file of Array.from(uploadedFiles)) {
      if (file.name.toLowerCase().endsWith(".csv")) {
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: (results) => onParseComplete(results.data as RawRow[], file.name) });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const workbook = XLSX.read(e.target?.result, { type: "array" });
          // defval: "" ensures every row includes ALL column keys even when cells are empty
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }) as RawRow[];
          onParseComplete(json, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    }

    if (fileInputRef.current) 
      fileInputRef.current.value = "";
  };

  const handleConfirmUpload = async () => {
    if (!allFilesValid) return;
    try {
      setLoading(true);
      const allTransactions = files.flatMap(f => f.previewData);
      await reportService.processReport(allTransactions, "Multiple_Files_Upload", forUserUuid);
      setStatus("processing");
      setShowToast(true);
      setFiles([]);
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-in fade-in duration-500 pb-12 relative">
      
      {/* NOTIFICA TOAST (Visualizzata in base allo stato) */}
      {showToast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${
          status === "error" ? "bg-rose-500 text-white" : "bg-slate-900 text-white"
        }`}>
          {status === "error" ? (
            <AlertCircle className="h-5 w-5 text-rose-200" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-bold">
              {status === "error" ? "Analysis Failed" : "Analysis Started Successfully"}
            </span>
            <span className="text-xs opacity-80">
              {status === "error" ? errorMessage : "Your files are being processed. Check the archive shortly."}
            </span>
          </div>
          <button onClick={() => setShowToast(false)} className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* LEFT COLUMN: File List & Upload */}
      <div className="xl:col-span-1 space-y-4">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="p-8 border-2 border-dashed border-slate-200/80 rounded-3xl bg-white/50 hover:bg-slate-50 cursor-pointer transition-all text-center group"
        >
          <div className="bg-slate-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-100 transition-colors">
            <UploadCloud className="h-6 w-6 text-slate-500 group-hover:text-blue-600 transition-colors" />
          </div>
          <span className="text-sm font-bold text-slate-700">Browse Files</span>
          <p className="text-xs text-slate-400 mt-1">CSV or Excel formats</p>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
        </div>

        <div className="space-y-2">
          {files.map(file => (
            <div 
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between shadow-sm ${
                activeFileId === file.id ? "border-blue-500 bg-blue-50/30 ring-4 ring-blue-500/10" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className={`h-5 w-5 shrink-0 ${file.isValid ? "text-slate-700" : "text-amber-500"}`} />
                <span className="text-sm font-semibold text-slate-700 truncate">{file.fileName}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {files.length > 0 && (
          <button 
            disabled={!allFilesValid || loading}
            onClick={handleConfirmUpload}
            className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
              allFilesValid ? "bg-slate-900 text-white hover:bg-blue-600 shadow-slate-200" : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            Analyze {files.length} {files.length === 1 ? 'File' : 'Files'}
          </button>
        )}
      </div>

      {/* RIGHT COLUMN: Mapping & Preview for Active File */}
      <div className="xl:col-span-3">
        {activeFile ? (
          <div className="space-y-4 md:space-y-6">
            <div className="bg-white p-5 md:p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-900 truncate max-w-[200px] sm:max-w-md">{activeFile.fileName}</h3>
                <p className="text-sm text-slate-500 mt-1">Detected Broker: <span className="px-2 py-1 bg-slate-100 rounded-md text-slate-700 font-bold ml-1">{activeFile.detectedBroker}</span></p>
              </div>
              {!activeFile.isValid && (
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200/50 shrink-0">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-bold">Fix mapping required</span>
                </div>
              )}
            </div>

            {activeFile.hasOrdersWithoutTime && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Some orders are missing execution times. For these transactions, the spread will be calculated as a daily approximation.
                </p>
              </div>
            )}

            {activeFile.hasMissingExchangeMic && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  Some transactions are missing the <span className="font-bold">exchange MIC</span> code. The ticker from the first available exchange will be used, which may cause unexpected spread.
                </p>
              </div>
            )}

            {!activeFile.validationErrors.isValid && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-rose-800">
                    {activeFile.validationErrors.invalidRowCount} row{activeFile.validationErrors.invalidRowCount !== 1 ? 's' : ''} have validation errors — upload is blocked until resolved
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {Object.entries(activeFile.validationErrors.errorsByField).map(([field, count]) => (
                    <span key={field} className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-1 rounded-lg">
                      {field}: {count} error{count !== 1 ? 's' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {ALL_FIELDS.map((field) => {
                        const isRequired = REQUIRED_FIELDS.includes(field);
                        const hasValue = !!activeFile.previewData[0]?.[field];
                        const hasMissingDates = field === "date" && activeFile.hasOrdersWithoutTime;
                        return (
                          <th key={field} className="px-5 py-5 min-w-[180px]">
                            <div className="flex flex-col gap-2.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                {field} {isRequired && <span className="text-rose-500 text-xs">*</span>}
                                {hasMissingDates && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                                {activeFile.validationErrors.errorsByField[field] && (
                                  <span className="bg-rose-100 text-rose-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                    {activeFile.validationErrors.errorsByField[field]}
                                  </span>
                                )}
                              </span>
                              <select 
                                value={activeFile.manualMap[field] || ""}
                                onChange={(e) => handleMappingChange(field, e.target.value)}
                                className={`text-xs bg-white border rounded-xl p-2.5 font-semibold outline-none transition-all focus:ring-4 ${
                                  !hasValue && isRequired ? 'border-amber-300 focus:ring-amber-50 bg-amber-50/30' : 'border-slate-200 focus:ring-slate-50 focus:border-slate-300'
                                }`}
                              >
                                <option value="" className="text-slate-400">-- Ignore --</option>
                                {Array.from(
                                  new Set(activeFile.rawData.flatMap(r => Object.keys(r)))
                                ).map(header => (
                                  <option key={header} value={header}>{header}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeFile.previewData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        {ALL_FIELDS.map((field) => {
                          const hasError = errorSet.has(`${i}_${field}`);
                          return (
                            <td key={field} className={`px-5 py-4 text-sm font-medium truncate max-w-[180px] ${hasError ? 'bg-rose-50 text-rose-700' : 'text-slate-600'}`}>
                              {row[field] ? String(row[field]) : <span className={hasError ? 'text-rose-300' : 'text-slate-300'}>-</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200/80 rounded-[2.5rem] bg-slate-50/50 p-10 text-center">
            <div className="p-5 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4">
               <FileText className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-slate-600 font-semibold text-lg">No file selected</p>
            <p className="text-slate-400 text-sm mt-1">Upload a file or select one from the sidebar to map its data.</p>
          </div>
        )}
      </div>
    </div>
  );
}