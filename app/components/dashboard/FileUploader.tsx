"use client";

import { useState, useRef, useMemo } from "react";
import { 
  UploadCloud, Loader2, AlertCircle, Send, 
  CheckCircle2, FileText, Trash2, ChevronRight 
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
  standardizeRow,
  StandardTransaction,
  RawRow,
} from "../../lib/parser/brokerParser";


interface UploadedFileState {
  id: string;
  fileName: string;
  rawData: Record<string, unknown>[];
  previewData: StandardTransaction[];
  manualMap: Partial<Record<keyof StandardTransaction, string>>;
  detectedBroker: string;
  isValid: boolean;
  missingFields: string[];
}


export function FileUploader() {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFileState[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "preview" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get the currently selected file object
  const activeFile = useMemo(() => 
    files.find(f => f.id === activeFileId) || null, 
  [files, activeFileId]);

  // Global validation: all files must be valid to proceed
  const allFilesValid = useMemo(() => 
    files.length > 0 && files.every(f => f.isValid), 
  [files]);

  /**
   * Core logic: Standardizes raw data using specific mapping and broker formatters
   */
  const processFileData = (
    rawData: RawRow[], 
    mapping: Partial<Record<keyof StandardTransaction, string>>, 
    brokerId: string
  ) => {
    const previewData = rawData.map(row => standardizeRow(row, mapping, brokerId));
    const { isValid, missingFields } = validateMapping(previewData);
    return { previewData, isValid, missingFields };
  };

  const onParseComplete = (data: RawRow[], fileName: string) => {
    const id = Math.random().toString(36).substring(7);
    const broker = identifyBroker(data[0]);
    const initialMapping = BROKER_CONFIGS[broker]?.columns || {};
    
    const { previewData, isValid, missingFields } = processFileData(data, initialMapping, broker);

    const newFile: UploadedFileState = {
      id,
      fileName,
      rawData: data,
      previewData,
      manualMap: initialMapping,
      detectedBroker: broker,
      isValid,
      missingFields: missingFields.map(String)
    };

    setFiles(prev => [...prev, newFile]);
    setActiveFileId(id);
    setStatus("preview");
  };

  const handleMappingChange = (stdField: keyof StandardTransaction, csvHeader: string) => {
    if (!activeFile) return;

    const newMapping = { ...activeFile.manualMap, [stdField]: csvHeader };
    const { previewData, isValid, missingFields } = processFileData(
      activeFile.rawData, 
      newMapping, 
      activeFile.detectedBroker
    );

    setFiles(prev => prev.map(f => f.id === activeFile.id ? {
      ...f,
      manualMap: newMapping,
      previewData,
      isValid,
      missingFields: missingFields.map(String)
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
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => onParseComplete(results.data as RawRow[], file.name),
        });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const workbook = XLSX.read(e.target?.result, { type: "array" });
          const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as RawRow[];
          onParseComplete(json, file.name);
        };
        reader.readAsArrayBuffer(file);
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!allFilesValid) return;
    try {
      setLoading(true);
      // Combine all preview data from all files into a single array for the backend
      const allTransactions = files.flatMap(f => f.previewData);
      await reportService.processReport(allTransactions, "Multiple_Files_Upload");
      setStatus("processing");
      setFiles([]);
    } catch (error: unknown) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      {/* LEFT COLUMN: File List & Upload */}
      <div className="lg:col-span-1 space-y-4">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="p-6 border-2 border-dashed border-slate-200 rounded-3xl bg-white hover:bg-slate-50 cursor-pointer transition-all text-center"
        >
          <UploadCloud className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <span className="text-sm font-bold text-slate-600">Add Files</span>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
        </div>

        <div className="space-y-2">
          {files.map(file => (
            <div 
              key={file.id}
              onClick={() => setActiveFileId(file.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                activeFileId === file.id ? "border-blue-500 bg-blue-50/50" : "border-slate-100 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <FileText className={`h-5 w-5 shrink-0 ${file.isValid ? "text-emerald-500" : "text-amber-500"}`} />
                <span className="text-xs font-bold text-slate-700 truncate">{file.fileName}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeFile(file.id); }} className="text-slate-400 hover:text-rose-500">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {files.length > 0 && (
          <button 
            disabled={!allFilesValid || loading}
            onClick={handleConfirmUpload}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
              allFilesValid ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
            Analyze {files.length} Files
          </button>
        )}
      </div>

      {/* RIGHT COLUMN: Mapping & Preview for Active File */}
      <div className="lg:col-span-3">
        {activeFile ? (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">{activeFile.fileName}</h3>
                <p className="text-sm text-slate-500">Broker: <span className="text-blue-600 font-bold">{activeFile.detectedBroker}</span></p>
              </div>
              {!activeFile.isValid && (
                <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs font-bold">Fix mapping to continue</span>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      {ALL_FIELDS.map((field) => {
                        const isRequired = REQUIRED_FIELDS.includes(field);
                        const hasValue = !!activeFile.previewData[0]?.[field];
                        return (
                          <th key={field} className="px-6 py-6 min-w-[200px]">
                            <div className="flex flex-col gap-2">
                              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                                {field} {isRequired && <span className="text-rose-500">*</span>}
                              </span>
                              <select 
                                value={activeFile.manualMap[field] || ""}
                                onChange={(e) => handleMappingChange(field, e.target.value)}
                                className={`text-xs bg-white border rounded-lg p-2 font-bold outline-none focus:ring-2 focus:ring-blue-500 ${
                                  !hasValue && isRequired ? 'border-amber-400 text-amber-700' : 'border-slate-200 text-slate-700'
                                }`}
                              >
                                <option value="">-- Ignore --</option>
                                {Object.keys(activeFile.rawData[0] || {}).map(header => (
                                  <option key={header} value={header}>{header}</option>
                                ))}
                              </select>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {activeFile.previewData.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                        {ALL_FIELDS.map((field) => (
                          <td key={field} className="px-6 py-4 text-xs font-medium text-slate-600">
                            {row[field] ? String(row[field]) : "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/50 p-20 text-center">
            <div className="p-6 bg-white rounded-3xl shadow-sm mb-4">
               <UploadCloud className="h-12 w-12 text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold">Select a file from the list or upload new ones</p>
          </div>
        )}
      </div>
    </div>
  );
}