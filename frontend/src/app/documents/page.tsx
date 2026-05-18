"use client";

import { useEffect, useState, useRef } from "react";

interface Document {
  id: string;
  filename: string;
  source: string;
  size: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();

    // Poll for status updates (e.g. processing -> completed)
    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);

    try {
      const res = await fetch("http://localhost:8000/api/documents/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Ingestion failed");
      }

      await fetchDocuments(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`Ingestion failed: ${err.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const allowedExts = [".txt", ".pdf", ".docx", ".md", ".markdown"];
      const file = files[0];
      const hasAllowedExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasAllowedExt) {
        alert("Unsupported file format. Please upload PDF, TXT, DOCX, or MD files.");
        return;
      }
      uploadFile(file);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Are you sure you want to permanently purge "${filename}" and all its derived vector chunks?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:8000/api/documents/${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Sync layout state
        setDocuments(prev => prev.filter(d => d.id !== docId));
      } else {
        const data = await res.json();
        alert(`Delete failed: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
      alert("An error occurred during document deletion.");
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredDocuments = documents.filter(doc => 
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".txt,.pdf,.docx,.md,.markdown"
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">Vector Registry</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Ingest knowledge resources and manage active index records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => fetchDocuments(true)}
            className="p-2 bg-surface-container-high rounded border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-md">sync</span>
          </button>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={handleUploadClick}
        className={`glass-card p-8 rounded-xl border-dashed border-2 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[180px] text-center ${
          dragActive ? "border-secondary bg-secondary/5 scale-[0.99]" : "border-outline-variant/60 hover:border-secondary/50"
        } ${uploading ? "opacity-60 pointer-events-none" : ""}`}
      >
        <span className={`material-symbols-outlined text-4xl mb-3 text-secondary/70 ${uploading ? "animate-spin" : ""}`}>
          {uploading ? "autorenew" : "cloud_upload"}
        </span>
        <h3 className="font-data-mono text-white text-body-md font-bold uppercase">
          {uploading ? "Index Pipeline Processing..." : "Drag & Drop or Browse"}
        </h3>
        <p className="text-on-surface-variant text-label-sm mt-2 max-w-md">
          {uploading 
            ? "Converting, embedding, and streaming index points to Qdrant." 
            : "Supports PDF, TXT, DOCX, and Markdown. Background tasks index vectors automatically."}
        </p>
      </div>

      {/* Registry Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Filter files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
          />
          <span className="material-symbols-outlined absolute right-3 top-2.5 text-on-surface-variant/70 text-md">search</span>
        </div>
        <div className="text-on-surface-variant font-data-mono text-label-sm">
          DISPLAYING {filteredDocuments.length} OF {documents.length} ENTRIES
        </div>
      </div>

      {/* Documents Registry Cards */}
      {loading && documents.length === 0 ? (
        <div className="glass-card p-12 rounded-xl text-center text-on-surface-variant font-data-mono">
          <span className="material-symbols-outlined text-3xl animate-spin text-secondary mb-2">sync</span>
          <p>RETRIEVING VECTOR REGISTRY...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="glass-card p-12 rounded-xl text-center text-on-surface-variant font-data-mono">
          <span className="material-symbols-outlined text-3xl mb-2 text-outline">database_off</span>
          <p>{searchQuery ? "NO SEARCH RESULTS FOUND." : "KNOWLEDGE BASE IS EMPTY. INDEX YOUR FIRST SOURCE."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {filteredDocuments.map((doc) => {
            const isCompleted = doc.status === "completed";
            const isFailed = doc.status === "failed";
            const isProcessing = doc.status === "processing";

            return (
              <div 
                key={doc.id}
                className="glass-card rounded-xl overflow-hidden flex flex-col justify-between border border-outline-variant/30 hover:border-secondary/20 transition-all"
              >
                <div className="p-5 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span className={`material-symbols-outlined text-2xl flex-shrink-0 ${
                        isCompleted ? "text-green-400" : isFailed ? "text-red-400" : "text-secondary animate-pulse"
                      }`}>
                        {isCompleted ? "draft" : isFailed ? "broken_image" : "progress_activity"}
                      </span>
                      <h3 className="font-data-mono font-bold text-white text-body-md truncate uppercase max-w-[180px]" title={doc.filename}>
                        {doc.filename}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold font-data-mono px-2 py-0.5 rounded uppercase flex-shrink-0 ${
                      isCompleted ? "text-green-400 bg-green-400/10 border border-green-400/20" :
                      isFailed ? "text-red-400 bg-red-400/10 border border-red-400/20" :
                      "text-secondary bg-secondary/10 border border-secondary/20 animate-pulse"
                    }`}>
                      {doc.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 font-data-mono text-[11px] text-on-surface-variant/80">
                    <div className="flex justify-between">
                      <span>SIZE:</span>
                      <span className="text-white">{formatBytes(doc.size)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>INDEXED:</span>
                      <span className="text-white">{new Date(doc.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ID:</span>
                      <span className="text-white truncate max-w-[120px]" title={doc.id}>{doc.id}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low border-t border-outline-variant/30 flex justify-between items-center">
                  <span className="text-[10px] font-data-mono text-on-surface-variant">
                    {isProcessing ? "BUILDING SEGMENTS..." : isCompleted ? "SYNCED" : "UNSYNCD"}
                  </span>
                  <button
                    onClick={() => handleDelete(doc.id, doc.filename)}
                    className="p-1 text-on-surface-variant hover:text-red-400 rounded hover:bg-surface-container-highest transition-all flex items-center justify-center"
                    title="Purge Document"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
