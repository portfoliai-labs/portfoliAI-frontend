"use client";

/**
 * components/dashboard/FileUploader.tsx
 * Handles file selection, local CSV/Excel preview, 
 * and explicit confirmation before submission.
 */

import { useState, useRef } from "react";
import { 
  UploadCloud, 
  Loader2, 
  Clock, 
  AlertCircle, 
  FileType, 
  Table as TableIcon,
  Send,
  X 
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { reportService } from "../../services/reportService";

export function FileUploader() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "preview" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [currentFileName, setCurrentFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Final step: Sends the already parsed JSON to the backend.
   */
  const handleConfirmUpload = async () => {
    try {
      setLoading(true);
      // reportService handles the Bearer token internally
      await reportService.processReport(previewData, currentFileName);
      setStatus("processing");
      setPreviewData([]); // Clear preview after submission
    } catch (error: any) {
      console.error("Submission Error:", error);
      setStatus("error");
      setErrorMessage(error.message || "An error occurred during submission");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Resets the uploader to the initial state.
   */
  const handleReset = () => {
    setPreviewData([]);
    setCurrentFileName("");
    setStatus("idle");
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /**
   * Local parsing logic (CSV or Excel).
   */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCurrentFileName(file.name);
    const fileName = file.name.toLowerCase();

    const onParseComplete = (data: any[]) => {
      setPreviewData(data);
      setStatus("preview");
    };

    if (fileName.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => onParseComplete(results.data),
        error: (error) => {
          setStatus("error");
          setErrorMessage(`CSV Error: ${error.message}`);
        }
      });
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet);
          onParseComplete(json);
        } catch (err) {
          setStatus("error");
          setErrorMessage("Excel parsing failed.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setStatus("error");
      setErrorMessage("Unsupported format. Use .csv, .xlsx or .xls");
    }
  };

  return (
    <div className="space-y-6">
      <div className={`group relative p-12 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 ${
        status === "error" ? "border-rose-200 bg-rose-50/30" : 
        status === "processing" ? "border-blue-200 bg-blue-50/30" : 
        status === "preview" ? "border-emerald-200 bg-emerald-50/30" :
        "border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/30"
      }`}>
        
        <input 
          type="file" ref={fileInputRef} onChange={handleFileChange}
          accept=".csv, .xlsx, .xls" className="hidden"
        />

        <div className="flex flex-col items-center text-center">
          <div className={`p-5 rounded-3xl mb-6 transition-all duration-500 shadow-inner ${
            loading ? "bg-blue-100 text-blue-600 animate-pulse" :
            status === "processing" ? "bg-amber-100 text-amber-600" :
            status === "preview" ? "bg-emerald-100 text-emerald-600" :
            status === "error" ? "bg-rose-100 text-rose-600" :
            "bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white"
          }`}>
            {loading ? <Loader2 className="h-10 w-10 animate-spin" /> :
             status === "processing" ? <Clock className="h-10 w-10" /> :
             status === "preview" ? <TableIcon className="h-10 w-10" /> :
             status === "error" ? <AlertCircle className="h-10 w-10" /> :
             <UploadCloud className="h-10 w-10" />}
          </div>

          <h2 className="text-2xl font-black text-slate-900 mb-2">
            {loading ? "Syncing..." : 
             status === "processing" ? "Processing Started" : 
             status === "preview" ? "File Ready" :
             status === "error" ? "Upload Error" : 
             "Import Ledger"}
          </h2>

          <p className="text-slate-500 max-w-sm mb-8 font-medium italic">
            {status === "error" ? errorMessage : 
             status === "processing" ? "Analysis is running in the background. Check your reports list shortly." :
             status === "preview" ? `Successfully parsed ${currentFileName}. Check the preview below.` :
             "Upload your CSV or Excel export to start the AI-powered financial analysis."}
          </p>

          {status === "idle" && (
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-slate-900 text-white hover:bg-blue-600 shadow-xl shadow-slate-200 transition-all active:scale-95"
            >
              Select File
            </button>
          )}

          {status === "preview" && !loading && (
            <div className="flex gap-4">
              <button 
                onClick={handleConfirmUpload}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-blue-600 text-white shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Send className="h-4 w-4" /> Analyze Data
              </button>
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black text-sm uppercase tracking-widest bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all active:scale-95"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- PREVIEW SECTION --- */}
      {status === "preview" && previewData.length > 0 && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between px-4 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <FileType className="h-3 w-3" /> Data Preview ({previewData.length} rows)
            </h3>
          </div>
          <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  {Object.keys(previewData[0]).map((key) => (
                    <th key={key} className="px-6 py-4 text-[10px] font-black uppercase tracking-tighter text-slate-500">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="px-6 py-4 text-xs font-medium text-slate-600 truncate max-w-[200px]">
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {previewData.length > 5 && (
              <div className="p-4 text-center bg-slate-50/30">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Showing first 5 rows only
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}