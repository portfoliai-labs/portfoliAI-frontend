"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  FileText, Download, Search, Tag as TagIcon, 
  Loader2, AlertCircle, X, Eye, Plus, Check, Rows, LayoutGrid 
} from "lucide-react";
import { reportService } from "../../services/reportService";
import type { Document } from "../../models/Report";

// --- INTERFACES ---

/**
 * Props for the individual Document Card component
 */
interface DocumentCardProps {
  report: Document;
  onDownload: (docId: string, fileName: string) => void;
  onView: (docId: string) => void;
  onRemoveTag: (docId: string, tagName: string) => void;
  onAddTag: (docId: string) => void;
  taggingDocId: string | null;
  setTaggingDocId: (docId: string | null) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
}

export function ReportsList({ forUserUuid }: { forUserUuid?: string | null } = {}) {
  const [reports, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI & Filtering States
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  
  // Tagging Logic States
  const [taggingDocId, setTaggingDocId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState<string>("");

  /**
   * Fetches all documents from the backend on component mount
   */
  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getAllDocuments(forUserUuid);
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync with server";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadDocuments(); 
  }, []);

  // --- ACTIONS ---

  const handleView = async (docId: string) => {
    try {
      const { url } = await reportService.downloadReport(docId);
      if (!url) throw new Error("Invalid URL received from server");

      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not fetch file data from storage");

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(blobUrl, "_blank");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not open file";
      alert(`Error: ${msg}`);
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      // Step 1: Request the short-lived signed URL from the backend
      const { url } = await reportService.downloadReport(docId);

      if (!url) throw new Error("Invalid URL received from server");

      // Step 2: Fetch the file data
      const response = await fetch(url);
      if (!response.ok) throw new Error("Could not fetch file data from storage");
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Step 3: Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      link.download = cleanFileName;
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup DOM and Memory
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Download failed";
      alert(`Error: ${msg}`);
    }
  };

  const handleAddTag = async (docId: string) => {
    if (!newTagName.trim()) return;
    try {
      await reportService.addTag(docId, newTagName.trim());
      setDocuments(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: [...(r.tags || []), newTagName.trim()] } : r
      ));
      setNewTagName("");
      setTaggingDocId(null);
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : "Error adding tag";
      alert(errorMessage); 
    }
  };

  const handleRemoveTag = async (docId: string, tagName: string) => {
    try {
      await reportService.removeTag(docId, tagName);
      setDocuments(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: (r.tags ?? []).filter((t: string) => t !== tagName) } : r
      ));
    } catch (err: unknown) { 
      const errorMessage = err instanceof Error ? err.message : "Error removing tag";
      alert(errorMessage); 
    }
  };

  // --- FILTERING & GROUPING LOGIC ---

  /**
   * Filters the reports based on the search input and selected tag
   */
  const filteredList = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = selectedTag ? r.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [reports, searchTerm, selectedTag]);

  /**
   * Groups filtered reports by their tags for the "Grouped View"
   */
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    filteredList.forEach(report => {
      if (!report.tags || report.tags.length === 0) {
        groups["Untagged"] = [...(groups["Untagged"] || []), report];
      } else {
        report.tags.forEach((tag: string) => {
          groups[tag] = [...(groups[tag] || []), report];
        });
      }
    });
    return groups;
  }, [filteredList]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-32">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* Error Feedback */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row justify-between gap-6 xl:items-end">
        <div className="w-full xl:w-auto">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Documents Archive</h2>
          <p className="text-sm md:text-base text-slate-500 font-medium mt-1">Manage, download, and organize your generated analyses.</p>
          
          <div className="flex items-center gap-4 mt-4">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search by name..."
                className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl font-medium outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all shadow-sm text-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex bg-slate-100/80 p-1.5 rounded-xl border border-slate-200 shrink-0 w-full md:w-auto">
          <button 
            onClick={() => setViewMode("list")}
            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Rows className="h-4 w-4" /> List View
          </button>
          <button 
            onClick={() => setViewMode("grouped")}
            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
              viewMode === "grouped" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutGrid className="h-4 w-4" /> Grouped
          </button>
        </div>
      </div>

      {/* Main List Rendering */}
      <div className="space-y-8">
        {reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white border border-slate-200 border-dashed rounded-[2rem]">
            <FileText className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No reports found</h3>
            <p className="text-slate-500 mt-1">Upload files and generate a report to see it here.</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="grid gap-4">
            {filteredList.map(report => (
              <DocumentCard
                key={report.document_id}
                report={report}
                onDownload={handleDownload}
                onView={handleView}
                onRemoveTag={handleRemoveTag}
                onAddTag={handleAddTag}
                taggingDocId={taggingDocId}
                setTaggingDocId={setTaggingDocId}
                newTagName={newTagName}
                setNewTagName={setNewTagName}
              />
            ))}
          </div>
        ) : (
          Object.entries(groupedDocuments).map(([tag, docs]) => (
            <div key={`group-${tag}`} className="space-y-4 bg-slate-50/50 p-4 md:p-6 rounded-[2.5rem] border border-slate-100">
              <div className="flex items-center gap-3 px-2">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                  <TagIcon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">{tag}</h3>
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                  {docs.length} items
                </span>
              </div>
              <div className="grid gap-4">
                {docs.map(report => (
                  <DocumentCard
                    key={`grouped-${tag}-${report.document_id}`}
                    report={report}
                    onDownload={handleDownload}
                    onView={handleView}
                    onRemoveTag={handleRemoveTag}
                    onAddTag={handleAddTag}
                    taggingDocId={taggingDocId}
                    setTaggingDocId={setTaggingDocId}
                    newTagName={newTagName}
                    setNewTagName={setNewTagName}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * DocumentCard: UI component for each document item
 */
function DocumentCard({
  report,
  onDownload,
  onView,
  onRemoveTag,
  onAddTag,
  taggingDocId,
  setTaggingDocId,
  newTagName,
  setNewTagName
}: DocumentCardProps) {
  return (
    <div className="group flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 bg-white border border-slate-200/80 rounded-[2rem] hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all duration-300 gap-5 md:gap-0">
      
      {/* Visual Identity & Name */}
      <div className="flex items-start md:items-center gap-4 md:gap-6 w-full md:w-auto">
        <div className="bg-slate-50/80 text-slate-400 group-hover:bg-blue-600 group-hover:text-white p-4 md:p-5 rounded-2xl md:rounded-3xl transition-colors duration-300 shrink-0">
          <FileText className="h-6 w-6 md:h-8 md:w-8" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-lg md:text-xl text-slate-900 group-hover:text-blue-600 transition-colors truncate">
            {report.name || "Untitled Document"}
          </h3>
          
          {/* Tags List */}
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {report.tags?.map((tag: string, index: number) => (
              <span key={`${report.document_id}-${tag}-${index}`} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100">
                {tag}
                <X 
                  className="h-3 w-3 cursor-pointer text-blue-400 hover:text-rose-500 transition-colors" 
                  onClick={() => onRemoveTag(report.document_id, tag)} 
                />
              </span>
            ))}
            
            {/* Inline Add Tag Input */}
            {taggingDocId === report.document_id ? (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                <input 
                  autoFocus 
                  placeholder="Tag name..."
                  className="text-[10px] font-bold border border-blue-200 bg-blue-50/50 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-500/20 w-24" 
                  value={newTagName} 
                  onChange={(e) => setNewTagName(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && onAddTag(report.document_id)} 
                />
                <button 
                  onClick={() => onAddTag(report.document_id)} 
                  className="p-1.5 bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors"
                >
                  <Check className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setTaggingDocId(report.document_id)} 
                className="text-[10px] font-black text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-200 transition-all flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> ADD TAG
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="flex gap-2 md:gap-3 w-full md:w-auto mt-2 md:mt-0">
        <button
          onClick={() => onView(report.document_id)}
          className="flex-1 md:flex-none flex justify-center items-center px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-50 text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all"
        >
          <Eye className="h-4 w-4" />
        </button>
        <button 
          // Trigger the secure download workflow
          onClick={() => onDownload(report.document_id, report.name)} 
          className="flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-3.5 text-sm font-bold uppercase tracking-wide bg-slate-900 text-white rounded-xl hover:bg-blue-600 shadow-md shadow-slate-200 hover:shadow-blue-200 transition-all"
        >
          <Download className="h-4 w-4" /> 
          <span className="md:hidden lg:inline">Download</span>
        </button>
      </div>
      
    </div>
  );
}