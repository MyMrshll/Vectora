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

interface Chunk {
  id: string;
  document_id: string;
  content: string;
  token_count: number;
  chunk_index: number;
  embedding_id: string;
  created_at: string;
}

interface QueryLog {
  id: string;
  question: string;
  response: string;
  latency: number;
  created_at: string;
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all dashboard data
  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // Fetch documents
      const docsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents`);
      const docsData = await docsRes.json();
      setDocuments(docsData);

      // Fetch chunks
      const chunksRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chunks`);
      const chunksData = await chunksRes.json();
      setChunks(chunksData);

      // Fetch query logs
      const logsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/query/logs`);
      const logsData = await logsRes.json();
      setLogs(logsData);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Poll for changes when files are processing
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    setUploadError(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      // Success
      await fetchDashboardData(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err.message || "An unexpected error occurred");
      alert(`Upload failed: ${err.message || "Unknown error"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Helper to format bytes
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Helper to format date relative
  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);

      if (diffSec < 60) return "Just now";
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHr < 24) return `${diffHr}h ago`;
      return date.toLocaleDateString();
    } catch (e) {
      return "Recently";
    }
  };

  // Calculate Metrics
  const docCount = documents.length;
  const chunkCount = chunks.length;
  const vectorCount = chunks.length; // 1-to-1 ratio for chunk to embedding vectors
  const avgLatency = logs.length > 0 
    ? Math.round((logs.reduce((sum, log) => sum + log.latency, 0) / logs.length) * 1000) 
    : 0;

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".txt,.pdf,.docx,.md,.markdown"
      />

      {/* Metric Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {/* Total Documents */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Total Documents</span>
            <span className="material-symbols-outlined text-secondary/50">description</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-white">
              {loading ? "..." : docCount}
            </span>
            <div className="flex items-center gap-1 mt-1">
              <span className="material-symbols-outlined text-secondary text-sm">trending_up</span>
              <span className="text-secondary font-label-sm">Active Ingestion Sources</span>
            </div>
          </div>
        </div>

        {/* Total Chunks */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Total Chunks</span>
            <span className="material-symbols-outlined text-secondary/50">layers</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-white">
              {loading ? "..." : chunkCount}
            </span>
            <p className="text-on-surface-variant font-label-sm mt-1">Fragmented Clusters</p>
          </div>
        </div>

        {/* Vector Embeddings */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between border-secondary/30">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Vector Embeddings</span>
            <span className="material-symbols-outlined text-secondary/50">scatter_plot</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-secondary cyan-glow">
              {loading ? "..." : vectorCount}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-surface-container rounded-full overflow-hidden">
                <div className="w-[100%] h-full bg-secondary"></div>
              </div>
              <span className="text-on-surface-variant font-label-sm">100% health</span>
            </div>
          </div>
        </div>

        {/* Query Latency */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Query Latency</span>
            <span className="material-symbols-outlined text-secondary/50">speed</span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <span className="text-headline-lg font-data-mono text-white">
                {loading ? "..." : avgLatency}
              </span>
              <span className="text-on-surface-variant font-label-sm">ms</span>
            </div>
            <p className="text-on-surface-variant font-label-sm mt-1">Global Average</p>
          </div>
        </div>
      </div>

      {/* Dashboard Body */}
      <div className="grid grid-cols-12 gap-gutter mt-4">
        {/* Query Volume Chart */}
        <section className="col-span-12 lg:col-span-8 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="font-headline-md text-white">Query History</h2>
              <p className="text-on-surface-variant text-body-md">Activity log visualization</p>
            </div>
            <div className="flex gap-2">
              <button className="bg-surface-container-highest text-white px-3 py-1 rounded text-label-sm border border-outline-variant">LIVE</button>
            </div>
          </div>
          {/* Simulated Line Chart / Logs Preview */}
          <div className="h-64 w-full flex items-end gap-[2%] pb-4 border-b border-outline-variant/30 relative">
            <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
              <div className="w-full h-full bg-gradient-to-t from-secondary/5 to-transparent"></div>
            </div>
            
            {logs.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant font-data-mono text-sm">
                NO QUERY LOGS RECORDED
              </div>
            ) : (
              logs.slice(0, 12).reverse().map((log, idx) => {
                // Latency height ratio up to 2000ms
                const percent = Math.min(Math.max((log.latency / 2) * 100, 15), 95);
                return (
                  <div 
                    key={log.id} 
                    className="flex-1 bg-secondary/15 border-t-2 border-secondary/40 rounded-t-sm relative group hover:bg-secondary/30 transition-all cursor-pointer"
                    style={{ height: `${percent}%` }}
                  >
                    <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-surface-container-highest px-3 py-1.5 rounded text-[10px] font-data-mono hidden group-hover:block whitespace-nowrap border border-secondary shadow-xl z-10 max-w-[200px] overflow-hidden text-ellipsis">
                      <div className="text-secondary font-bold mb-0.5">{log.latency.toFixed(2)}s Latency</div>
                      <div className="text-white truncate">"{log.question}"</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-between mt-2 text-on-surface-variant font-data-mono text-[10px] px-1">
            <span>Earliest</span>
            <span>Query Stream Sequence (Newest ➡️)</span>
            <span>Latest</span>
          </div>
        </section>

        {/* Recent Ingestion Activity */}
        <section className="col-span-12 lg:col-span-4 glass-card rounded-xl flex flex-col">
          <div className="p-6 border-b border-outline-variant/30 flex justify-between items-center">
            <h2 className="font-headline-md text-white">Ingestion Activity</h2>
            <button 
              onClick={() => fetchDashboardData(true)} 
              className="p-1 rounded-full hover:bg-surface-container-highest transition-colors text-on-surface-variant hover:text-white"
            >
              <span className="material-symbols-outlined text-md">sync</span>
            </button>
          </div>
          <div className="p-2 flex-1 overflow-y-auto max-h-[350px]">
            <div className="space-y-1">
              {loading && documents.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant font-data-mono text-sm">
                  Loading source registry...
                </div>
              ) : documents.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant font-data-mono text-sm">
                  No source documents ingested yet. Upload a document to build your knowledge store.
                </div>
              ) : (
                documents.slice(0, 4).map((doc) => {
                  const isCompleted = doc.status === "completed";
                  const isFailed = doc.status === "failed";
                  const isProcessing = doc.status === "processing";

                  return (
                    <div 
                      key={doc.id} 
                      className="p-4 hover:bg-surface-container/50 rounded-lg flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isCompleted ? "bg-green-500/10 text-green-500" :
                          isFailed ? "bg-red-500/10 text-red-500" :
                          "bg-secondary/10 text-secondary"
                        }`}>
                          <span className={`material-symbols-outlined text-sm ${isProcessing ? "animate-spin" : ""}`}>
                            {isCompleted ? "check_circle" : isFailed ? "error" : "refresh"}
                          </span>
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-data-mono text-body-md text-white truncate max-w-[180px] md:max-w-[220px]">
                            {doc.filename}
                          </p>
                          <span className="text-[10px] text-on-surface-variant uppercase block">
                            {formatBytes(doc.size)} • {formatRelativeTime(doc.created_at)}
                          </span>
                        </div>
                      </div>
                      <span className={`text-label-sm px-2 py-0.5 rounded-full flex-shrink-0 ${
                        isCompleted ? "text-green-400 bg-green-400/10" :
                        isFailed ? "text-red-400 bg-red-400/10" :
                        "text-secondary bg-secondary/10"
                      }`}>
                        {isCompleted ? "Success" : isFailed ? "Failed" : "Running"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="p-4 bg-surface-container-low border-t border-outline-variant/30">
            <button 
              onClick={handleUploadClick}
              disabled={uploading}
              className={`w-full py-2 bg-secondary text-on-secondary font-bold font-label-sm rounded uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${
                uploading ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {uploading ? "sync" : "upload_file"}
              </span>
              {uploading ? "Ingesting Source..." : "Upload New Source"}
            </button>
          </div>
        </section>

        {/* Additional Context / Status */}
        <section className="col-span-12 glass-card rounded-xl p-6 flex flex-col md:flex-row gap-8 items-center bg-gradient-to-r from-surface-container-low to-surface-container">
          <div className="flex-shrink-0">
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle className="text-surface-variant" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                <circle className="text-secondary" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeDasharray="364.4" strokeDashoffset="364.4" strokeWidth="8" style={{ strokeDashoffset: docCount > 0 ? 0 : 364.4 }}></circle>
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-headline-md font-data-mono text-white">{docCount > 0 ? "100%" : "0%"}</span>
                <span className="text-[10px] text-on-surface-variant font-bold">READY</span>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-2 text-center md:text-left">
            <h3 className="font-headline-md text-white">Knowledge Base Health</h3>
            <p className="text-on-surface-variant max-w-xl">
              System semantic coverage is optimal. Vector space density is balanced. Active search indexes are synced with {docCount} source files chunked into {chunkCount} embedding coordinates.
            </p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start pt-2">
              <span className="bg-secondary/5 border border-secondary/20 text-secondary text-[10px] px-2 py-1 rounded font-data-mono">COSINE_SIMILARITY_STABLE</span>
              <span className="bg-secondary/5 border border-secondary/20 text-secondary text-[10px] px-2 py-1 rounded font-data-mono">TOP_K_OPTIMIZED</span>
              <span className="bg-secondary/5 border border-secondary/20 text-secondary text-[10px] px-2 py-1 rounded font-data-mono">MODEL_GEMINI_ACTIVE</span>
            </div>
          </div>
          <div className="flex-shrink-0 w-full md:w-auto">
            <button 
              onClick={() => fetchDashboardData(true)} 
              className="w-full md:w-auto px-6 py-3 border border-secondary text-secondary rounded font-bold uppercase text-label-sm hover:bg-secondary/10 transition-colors"
            >
              Run Audit Sync
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
