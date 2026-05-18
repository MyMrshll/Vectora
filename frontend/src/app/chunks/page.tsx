"use client";

import { useEffect, useState } from "react";

interface Chunk {
  id: string;
  document_id: string;
  content: string;
  token_count: number;
  chunk_index: number;
  embedding_id: string;
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  size: number;
  status: string;
}

export default function ChunksPage() {
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);

  // Fetch documents for the filter selector
  const fetchDocuments = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/documents");
      if (res.ok) {
        const data = await res.ok ? await res.json() : [];
        setDocuments(data.filter((d: Document) => d.status === "completed"));
      }
    } catch (err) {
      console.error("Failed to fetch documents for filters:", err);
    }
  };

  // Fetch chunks
  const fetchChunks = async (docId = "") => {
    setLoading(true);
    try {
      const url = docId 
        ? `http://localhost:8000/api/chunks?document_id=${docId}`
        : "http://localhost:8000/api/chunks";
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setChunks(data);
      }
    } catch (err) {
      console.error("Failed to fetch chunks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await fetchDocuments();
      await fetchChunks();
    };
    init();
  }, []);

  const handleDocumentFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    setSelectedDocId(docId);
    fetchChunks(docId);
  };

  // Find parent filename
  const getParentFilename = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    return doc ? doc.filename : "Unknown Document";
  };

  const filteredChunks = chunks.filter(chunk => 
    chunk.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">Segment Pipeline</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Browse and inspect semantic vector chunks parsed from raw documents.
          </p>
        </div>
        <button 
          onClick={() => fetchChunks(selectedDocId)}
          className="p-2 bg-surface-container-high rounded border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-colors flex items-center gap-2 font-data-mono text-[12px] uppercase"
        >
          <span className="material-symbols-outlined text-md">sync</span>
          Sync Pipeline
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-center">
        {/* Source Document Selector */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-1.5">
          <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider">Source Document Filter</label>
          <select
            value={selectedDocId}
            onChange={handleDocumentFilterChange}
            className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors cursor-pointer"
          >
            <option value="">-- ALL INDEXED SOURCES --</option>
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>

        {/* Client-side Text Search */}
        <div className="col-span-12 md:col-span-5 flex flex-col gap-1.5">
          <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider">Text Keyword Search</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search terms inside fragments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
            />
            <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant/70 text-md">search</span>
          </div>
        </div>

        {/* Counter Summary */}
        <div className="col-span-12 md:col-span-3 text-right font-data-mono text-label-sm text-on-surface-variant flex flex-col justify-end h-full pt-4 md:pt-0">
          <div>PIPELINE SEGMENTS: {chunks.length}</div>
          <div className="text-[10px] mt-1 text-secondary">MATCHING SEARCH: {filteredChunks.length}</div>
        </div>
      </div>

      {/* Grid of Chunks */}
      {loading ? (
        <div className="glass-card p-16 rounded-xl text-center text-on-surface-variant font-data-mono">
          <span className="material-symbols-outlined text-3xl animate-spin text-secondary mb-2">sync</span>
          <p>LOAD SECTOR COORDINATES...</p>
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="glass-card p-16 rounded-xl text-center text-on-surface-variant font-data-mono">
          <span className="material-symbols-outlined text-3xl mb-2 text-outline">description</span>
          <p>{searchQuery ? "NO CHUNK FRAGMENTS MATCH SEARCH." : "NO SEGMENTS FOR SELECTED FILTER. INDEX A SOURCE FILE."}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {filteredChunks.map((chunk) => (
            <div 
              key={chunk.id}
              className="glass-card rounded-xl overflow-hidden border border-outline-variant/30 flex flex-col justify-between hover:border-secondary/20 transition-all group"
            >
              <div className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                    <span className="text-[11px] font-bold font-data-mono text-secondary uppercase">
                      CHUNK_{String(chunk.chunk_index).padStart(3, "0")}
                    </span>
                  </div>
                  <span className="text-[10px] font-data-mono text-on-surface-variant bg-surface-container-high border border-outline-variant/20 px-2 py-0.5 rounded">
                    {chunk.token_count} TOKENS
                  </span>
                </div>

                <div className="bg-surface-container-lowest/80 border border-outline-variant/20 rounded-lg p-3.5 h-36 overflow-y-auto">
                  <p className="text-body-md font-sans text-on-surface/90 leading-relaxed text-[13px] whitespace-pre-wrap">
                    {chunk.content}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3.5 bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-data-mono text-on-surface-variant/80">
                  <span className="uppercase">Source File:</span>
                  <span className="text-white truncate max-w-[180px]">{getParentFilename(chunk.document_id)}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-data-mono text-on-surface-variant/80 pt-1">
                  <span>VECTOR ID:</span>
                  <button 
                    onClick={() => setSelectedChunk(chunk)}
                    className="text-secondary hover:underline uppercase flex items-center gap-1 font-bold"
                  >
                    <span>Inspect</span>
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full Screen Chunk Inspection Modal */}
      {selectedChunk && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-3xl rounded-xl border border-secondary/30 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
            {/* Modal Header */}
            <div className="p-6 border-b border-outline-variant/40 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">explore</span>
                  <h3 className="font-data-mono font-bold text-white uppercase text-body-md">
                    Inspect Segment CHUNK_{String(selectedChunk.chunk_index).padStart(3, "0")}
                  </h3>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1 font-data-mono">
                  PARENT DOC ID: {selectedChunk.document_id}
                </p>
              </div>
              <button 
                onClick={() => setSelectedChunk(null)}
                className="p-1 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="flex justify-between text-label-sm font-data-mono border-b border-outline-variant/20 pb-3">
                <span className="text-secondary">METADATA DETAILS</span>
                <span className="text-on-surface-variant">{selectedChunk.token_count} TOKENS • INDEXED: {new Date(selectedChunk.created_at).toLocaleString()}</span>
              </div>
              
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-5 font-sans text-white leading-relaxed text-body-md whitespace-pre-wrap select-text">
                {selectedChunk.content}
              </div>

              {selectedChunk.embedding_id && (
                <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg font-data-mono text-[11px] text-on-surface-variant flex justify-between items-center">
                  <span>VECTOR REGISTERED ADDRESS:</span>
                  <span className="text-secondary cyan-glow font-bold truncate max-w-[320px]" title={selectedChunk.embedding_id}>
                    {selectedChunk.embedding_id}
                  </span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-surface-container border-t border-outline-variant/40 flex justify-end">
              <button
                onClick={() => setSelectedChunk(null)}
                className="px-5 py-2 bg-secondary text-on-secondary font-bold text-label-sm uppercase rounded hover:opacity-90 transition-opacity"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
