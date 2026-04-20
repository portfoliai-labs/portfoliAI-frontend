"use client";

/**
 * components/dashboard/ReportsList.tsx
 * Advanced view with grouping logic, tagging system, preview, and download.
 */

import { useState, useMemo, useEffect } from "react";
import { 
  FileText, Download, Search, Tag as TagIcon, 
  Loader2, AlertCircle, X, Eye, Plus, Check, Rows, LayoutGrid 
} from "lucide-react";
import { reportService } from "../../services/reportService";
import { Report } from "../../models/Report";

export function ReportsList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [taggingDocId, setTaggingDocId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await reportService.getAllDocuments();
      setReports(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || "Failed to sync with server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, []);

  // --- ACTIONS ---

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) { window.open(url, '_blank'); }
  };

  const handleAddTag = async (docId: string) => {
    if (!newTagName.trim()) return;
    try {
      await reportService.addTag(docId, newTagName.trim());
      setReports(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: [...(r.tags || []), newTagName.trim()] } : r
      ));
      setNewTagName("");
      setTaggingDocId(null);
    } catch (err: any) { alert(err.message); }
  };

  const handleRemoveTag = async (docId: string, tagName: string) => {
    try {
      await reportService.removeTag(docId, tagName);
      setReports(prev => prev.map(r => 
        r.document_id === docId ? { ...r, tags: r.tags.filter(t => t !== tagName) } : r
      ));
    } catch (err: any) { alert(err.message); }
  };

  // --- LOGIC ---

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    reports.forEach(r => r.tags?.forEach(t => tagsSet.add(t)));
    return Array.from(tagsSet);
  }, [reports]);

  const filteredList = useMemo(() => {
    return reports.filter(r => {
      const matchesSearch = r.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTag = selectedTag ? r.tags?.includes(selectedTag) : true;
      return matchesSearch && matchesTag;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, searchTerm, selectedTag]);

  // Raggruppamento per la vista "Grouped"
  const groupedReports = useMemo(() => {
    const groups: Record<string, Report[]> = {};
    filteredList.forEach(report => {
      if (!report.tags || report.tags.length === 0) {
        groups["Untagged"] = [...(groups["Untagged"] || []), report];
      } else {
        report.tags.forEach(tag => {
          groups[tag] = [...(groups[tag] || []), report];
        });
      }
    });
    return groups;
  }, [filteredList]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Top Bar: Search & View Toggle */}
      <div className="flex flex-col md:flex-row justify-between gap-6 items-end">
        <div className="w-full md:w-auto">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Reports</h2>
          <div className="flex items-center gap-4 mt-4">
            <div className="relative w-full md:w-80 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" placeholder="Search reports..."
                className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "list" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            <Rows className="h-4 w-4" /> List
          </button>
          <button 
            onClick={() => setViewMode("grouped")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === "grouped" ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            <LayoutGrid className="h-4 w-4" /> Grouped
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-10">
        {viewMode === "list" ? (
          /* --- LIST VIEW --- */
          <div className="grid gap-4">
            {filteredList.map(report => (
              <ReportCard 
                key={report.document_id} 
                report={report} 
                onDownload={handleDownload} 
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
          /* --- GROUPED VIEW --- */
          Object.entries(groupedReports).map(([tag, docs]) => (
            <div key={`group-${tag}`} className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <TagIcon className="h-4 w-4 text-blue-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">{tag}</h3>
                <div className="h-[1px] flex-1 bg-slate-100" />
                <span className="text-xs font-bold text-slate-300">{docs.length} items</span>
              </div>
              <div className="grid gap-4">
                {docs.map(report => (
                  <ReportCard 
                    key={`grouped-${tag}-${report.document_id}`} 
                    report={report} 
                    onDownload={handleDownload} 
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

// Sub-component to clean up the main loop
function ReportCard({ report, onDownload, onRemoveTag, onAddTag, taggingDocId, setTaggingDocId, newTagName, setNewTagName }: any) {
  return (
    <div className="group flex flex-col md:flex-row items-center justify-between p-6 bg-white border border-slate-200 rounded-[2rem] hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center gap-6">
        <div className="bg-slate-50 group-hover:bg-blue-600 group-hover:text-white p-5 rounded-3xl transition-all duration-500">
          <FileText className="h-8 w-8" />
        </div>
        <div>
          <h3 className="font-black text-xl text-slate-900 group-hover:text-blue-600 transition-colors">{report.name || "Untitled"}</h3>
          <div className="flex flex-wrap gap-2 mt-2 items-center">
            {report.tags?.map((tag: string, index: number) => (
              <span key={`${report.document_id}-${tag}-${index}`} className="flex items-center gap-1.5 text-[10px] font-black uppercase text-blue-600 bg-blue-50/50 px-2.5 py-1 rounded-lg border border-blue-100">
                {tag}
                <X className="h-3 w-3 cursor-pointer hover:text-rose-500" onClick={() => onRemoveTag(report.document_id, tag)} />
              </span>
            ))}
            {taggingDocId === report.document_id ? (
              <div className="flex items-center gap-1">
                <input autoFocus className="text-[10px] font-bold border border-blue-200 rounded px-2 py-0.5" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAddTag(report.document_id)} />
                <button onClick={() => onAddTag(report.document_id)} className="text-emerald-500"><Check className="h-3 w-3"/></button>
              </div>
            ) : (
              <button onClick={() => setTaggingDocId(report.document_id)} className="text-[10px] font-black text-slate-400 hover:text-blue-600 flex items-center gap-1"><Plus className="h-3 w-3"/> ADD TAG</button>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3 mt-6 md:mt-0">
        <button onClick={() => window.open(report.url, '_blank')} className="px-6 py-3 text-sm font-black uppercase bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all"><Eye className="h-4 w-4"/></button>
        <button onClick={() => onDownload(report.url, report.name)} className="flex items-center gap-2 px-6 py-3 text-sm font-black uppercase bg-slate-900 text-white rounded-2xl hover:bg-blue-600 shadow-lg transition-all"><Download className="h-4 w-4"/> Download</button>
      </div>
    </div>
  );
}