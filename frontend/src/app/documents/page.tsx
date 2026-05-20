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

interface VectorDB {
  id: string;
  name: string;
  provider: string;
  url: string | null;
  api_key: string | null;
  status: string;
  active_collection: string;
  created_at: string;
}

export default function DocumentsPage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"documents" | "databases">("documents");

  // Document states
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragActive, setDragActive] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vector DB states
  const [dbs, setDbs] = useState<VectorDB[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [dbName, setDbName] = useState("");
  const [dbProvider, setDbProvider] = useState<"qdrant" | "chromadb">("qdrant");
  const [dbUrl, setDbUrl] = useState("");
  const [dbApiKey, setDbApiKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [registering, setRegistering] = useState(false);

  // Collections states
  const [collections, setCollections] = useState<string[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const fetchCollections = async (dbId: string) => {
    setLoadingCollections(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/${dbId}/collections`);
      if (res.ok) {
        const data = await res.json();
        setCollections(data);
      }
    } catch (err) {
      console.error("Failed to fetch collections:", err);
    } finally {
      setLoadingCollections(false);
    }
  };

  const handleActivateCollection = async (collectionName: string) => {
    const activeDbId = activeDB?.id || "active";
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/${activeDbId}/collections/${collectionName}/activate`, {
        method: "POST"
      });

      if (res.ok) {
        await fetchDatabases(false);
      } else {
        const data = await res.json();
        alert(`Failed to activate collection: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to activate collection:", err);
      alert("An error occurred during collection activation.");
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;

    const activeDbId = activeDB?.id || "active";
    setCreatingCollection(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/${activeDbId}/collections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() })
      });

      if (res.ok) {
        setNewCollectionName("");
        await fetchCollections(activeDbId);
        await fetchDatabases(false);
      } else {
        const data = await res.json();
        alert(`Failed to create collection: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Failed to create collection:", err);
      alert("An error occurred during collection creation.");
    } finally {
      setCreatingCollection(false);
    }
  };

  // Fetch Documents
  const fetchDocuments = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents`);
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

  // Fetch Vector Databases
  const fetchDatabases = async (showLoading = true) => {
    if (showLoading) setLoadingDbs(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs`);
      if (res.ok) {
        const data = await res.json();
        setDbs(data);
        const active = data.find((db: any) => db.status === "active");
        if (active) {
          fetchCollections(active.id);
        } else {
          fetchCollections("active");
        }
      }
    } catch (err) {
      console.error("Failed to fetch vector databases:", err);
    } finally {
      if (showLoading) setLoadingDbs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchDatabases();

    // Poll for document status updates
    const interval = setInterval(() => {
      fetchDocuments(false);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Document Upload functions
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/`, {
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
      const allowedExts = [".json", ".xml", ".csv"];
      const file = files[0];
      const hasAllowedExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasAllowedExt) {
        alert("Unsupported file format. Please upload JSON, XML, or CSV scraped datasets.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      uploadFile(file);
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
      const allowedExts = [".json", ".xml", ".csv"];
      const file = files[0];
      const hasAllowedExt = allowedExts.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!hasAllowedExt) {
        alert("Unsupported file format. Please upload JSON, XML, or CSV scraped datasets.");
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/documents/${docId}`, {
        method: "DELETE",
      });

      if (res.ok) {
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

  // Vector DB functions
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestStatus(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/test-connection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: dbProvider,
          url: dbUrl || null,
          api_key: dbApiKey || null
        })
      });
      const data = await res.json();
      setTestStatus({
        success: data.success,
        message: data.message
      });
    } catch (err) {
      setTestStatus({
        success: false,
        message: "Failed to communicate with connection test service."
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRegisterDb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName.trim()) {
      alert("Please provide a name for the database connection.");
      return;
    }

    setRegistering(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: dbName,
          provider: dbProvider,
          url: dbUrl || null,
          api_key: dbApiKey || null
        })
      });

      if (res.ok) {
        setDbName("");
        setDbUrl("");
        setDbApiKey("");
        setTestStatus(null);
        await fetchDatabases(false);
      } else {
        const data = await res.json();
        alert(`Failed to register cluster: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Registration error:", err);
      alert("Failed to register the database integration.");
    } finally {
      setRegistering(false);
    }
  };

  const handleActivateDb = async (dbId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/${dbId}/activate`, {
        method: "POST"
      });

      if (res.ok) {
        await fetchDatabases(false);
      } else {
        const data = await res.json();
        alert(`Failed to activate engine: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Activation error:", err);
      alert("An error occurred during database activation.");
    }
  };

  const handleDeleteDb = async (dbId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove connection integration "${name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/vector-dbs/${dbId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        await fetchDatabases(false);
      } else {
        const data = await res.json();
        alert(`Failed to delete integration: ${data.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error("Deletion error:", err);
      alert("An error occurred during connection deletion.");
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

  const activeDB = dbs.find(db => db.status === "active");

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".json,.xml,.csv"
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">Vector Knowledge Engine</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Configure clusters, ingest document resources, and manage vectorized index tables.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Glassmorphic Tab switcher */}
          <div className="flex bg-surface-container-high/60 border border-outline-variant/40 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("documents")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-data-mono text-xs font-bold uppercase transition-all duration-200 ${
                activeTab === "documents"
                  ? "bg-secondary text-inverse-on-surface shadow-md"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">folder</span>
              Documents Registry
            </button>
            <button
              onClick={() => setActiveTab("databases")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-data-mono text-xs font-bold uppercase transition-all duration-200 ${
                activeTab === "databases"
                  ? "bg-secondary text-inverse-on-surface shadow-md"
                  : "text-on-surface-variant hover:text-white"
              }`}
            >
              <span className="material-symbols-outlined text-sm">hub</span>
              Engine Settings
            </button>
          </div>

          <button 
            onClick={() => {
              fetchDocuments(true);
              fetchDatabases(true);
            }}
            className="p-2.5 bg-surface-container-high rounded-xl border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all flex items-center justify-center"
            title="Refresh All"
          >
            <span className="material-symbols-outlined text-md">sync</span>
          </button>
        </div>
      </div>

      {activeTab === "documents" ? (
        <>
          {/* Active Engine Briefing Panel */}
          <div className="glass-card p-4 rounded-xl border border-outline-variant/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gradient-to-r from-secondary/5 to-transparent">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <div className="font-data-mono text-xs">
                <span className="text-on-surface-variant">ACTIVE INGESTION TARGET:</span>{" "}
                <span className="text-secondary font-bold uppercase">
                  {activeDB ? `${activeDB.name} (${activeDB.provider})` : "Default Embedded Qdrant (In-Memory)"}
                </span>
              </div>
            </div>
            <div className="text-[10px] font-data-mono text-on-surface-variant/70 uppercase">
              {activeDB?.url ? `ENDPOINT: ${activeDB.url}` : "ENDPOINT: LOCAL-EMBEDDED"}
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
              {uploading ? "Indexing and Stream Processing..." : "Drag & Drop or Browse"}
            </h3>
            <p className="text-on-surface-variant text-label-sm mt-2 max-w-md">
              {uploading 
                ? "Parsing document text, computing 768-dim embeddings, and streaming to vector store..." 
                : "Supports JSON, XML, and CSV scraped datasets. Background threads index vector points automatically."}
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
                className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
              />
              <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant/70 text-md">search</span>
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
                        {isProcessing ? "BUILDING VECTOR PATHS..." : isCompleted ? "SYNCED" : "UNSYNCD"}
                      </span>
                      <button
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        className="p-1.5 text-on-surface-variant hover:text-red-400 rounded-lg hover:bg-surface-container-highest transition-all flex items-center justify-center"
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
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Databases List & Active Dashboard */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Core Dashboard Card */}
            <div className="glass-card rounded-xl border border-outline-variant/40 bg-gradient-to-br from-surface-container-low to-surface-container-lowest overflow-hidden">
              <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/30 bg-secondary/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center border border-secondary/30">
                    <span className="material-symbols-outlined text-secondary text-2xl animate-pulse">hub</span>
                  </div>
                  <div>
                    <h3 className="font-data-mono font-bold text-white text-body-md uppercase tracking-wide">ACTIVE VECTOR CORE</h3>
                    <p className="text-[11px] text-on-surface-variant/80 uppercase font-data-mono mt-0.5">
                      {activeDB ? `Cluster: ${activeDB.name}` : "System Fallback Engine"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold font-data-mono px-3 py-1 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 flex items-center gap-1.5 uppercase">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-ping"></span>
                    Operational
                  </span>
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 font-data-mono text-[12px] text-on-surface-variant">
                <div className="space-y-1">
                  <span className="text-[10px] text-outline uppercase">PROVIDER TYPE</span>
                  <p className="text-white text-body-md font-bold uppercase">{activeDB ? activeDB.provider : "qdrant (embedded)"}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-outline uppercase">CONNECTION ENDPOINT</span>
                  <p className="text-white text-body-md font-bold truncate max-w-[200px]" title={activeDB?.url || "LOCAL IN-MEMORY"}>
                    {activeDB?.url || "Local Memory Loop"}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-outline uppercase">REGISTERED INTEGRATIONS</span>
                  <p className="text-white text-body-md font-bold">{dbs.length} CONFIGURED</p>
                </div>
              </div>
            </div>

            {/* Collections & Index Tables Manager */}
            <div className="glass-card rounded-xl border border-outline-variant/40 bg-gradient-to-br from-surface-container-low to-surface-container-lowest overflow-hidden">
              <div className="p-6 border-b border-outline-variant/30 bg-secondary/5 flex justify-between items-center">
                <div>
                  <h3 className="font-data-mono font-bold text-white text-body-md uppercase tracking-wide">Collections & Index Tables</h3>
                  <p className="text-[11px] text-on-surface-variant/80 uppercase font-data-mono mt-0.5">
                    Manage table partitions within the active {activeDB?.provider || "qdrant"} engine
                  </p>
                </div>
                <button
                  onClick={() => fetchCollections(activeDB?.id || "active")}
                  disabled={loadingCollections}
                  className="p-1.5 bg-surface-container-high rounded-lg border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-all flex items-center justify-center disabled:opacity-50"
                  title="Reload Collections"
                >
                  <span className={`material-symbols-outlined text-sm ${loadingCollections ? "animate-spin" : ""}`}>sync</span>
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Create Collection Form */}
                <form onSubmit={handleCreateCollection} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. customer_feedback"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    className="flex-1 bg-surface-container-low border border-outline-variant/50 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-secondary transition-colors font-data-mono"
                    required
                    disabled={creatingCollection}
                  />
                  <button
                    type="submit"
                    disabled={creatingCollection || !newCollectionName.trim()}
                    className="px-4 py-2 bg-secondary text-inverse-on-surface font-bold text-center uppercase tracking-wide hover:opacity-90 transition-all rounded-xl disabled:opacity-50 text-[11px] flex items-center gap-1.5 font-data-mono"
                  >
                    {creatingCollection ? (
                      <>
                        <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                        CREATING...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xs font-bold">add</span>
                        CREATE TABLE
                      </>
                    )}
                  </button>
                </form>

                {/* Collections Grid */}
                {loadingCollections ? (
                  <div className="py-8 text-center text-on-surface-variant font-data-mono text-xs">
                    <span className="material-symbols-outlined text-2xl animate-spin text-secondary mb-2">sync</span>
                    <p>RETRIEVING SCHEMAS...</p>
                  </div>
                ) : collections.length === 0 ? (
                  <div className="py-6 border border-dashed border-outline-variant/60 rounded-xl bg-surface-container-low/30 text-center font-data-mono text-on-surface-variant">
                    <span className="material-symbols-outlined text-2xl text-outline mb-1">table_chart</span>
                    <p className="text-[10px] uppercase">No collections detected in active cluster.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {collections.map((name) => {
                      const isActiveCollection = name === (activeDB?.active_collection || "vectora_documents");
                      return (
                        <div
                          key={name}
                          className={`glass-card rounded-xl p-4 border flex items-center justify-between transition-all duration-300 ${
                            isActiveCollection
                              ? "border-green-500/50 bg-green-500/5 ring-1 ring-green-500/20"
                              : "border-outline-variant/30 hover:border-outline-variant/60 hover:bg-surface-container-low/20"
                          }`}
                        >
                          <div className="flex items-center gap-3 overflow-hidden font-data-mono text-xs">
                            <span className={`material-symbols-outlined text-xl ${isActiveCollection ? "text-green-400" : "text-outline"}`}>
                              table_rows
                            </span>
                            <span className="font-bold text-white truncate max-w-[150px]" title={name}>
                              {name}
                            </span>
                          </div>

                          {isActiveCollection ? (
                            <span className="text-[9px] font-bold text-green-400 font-data-mono flex items-center gap-1 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded">
                              <span className="h-1 w-1 rounded-full bg-green-400 animate-ping"></span>
                              ACTIVE
                            </span>
                          ) : (
                            <button
                              onClick={() => handleActivateCollection(name)}
                              className="px-2.5 py-1 rounded bg-secondary/10 border border-secondary/20 hover:bg-secondary hover:text-inverse-on-surface text-[10px] font-bold font-data-mono text-secondary transition-all"
                            >
                              ACTIVATE
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Configured Clusters Grid */}
            <div className="space-y-4">
              <h2 className="text-headline-md font-bold text-white font-data-mono uppercase tracking-tight text-[18px]">
                Configured Engine Connections
              </h2>

              {loadingDbs && dbs.length === 0 ? (
                <div className="glass-card p-12 rounded-xl text-center text-on-surface-variant font-data-mono">
                  <span className="material-symbols-outlined text-3xl animate-spin text-secondary mb-2">sync</span>
                  <p>LOADING DATABASE CONFIGURATIONS...</p>
                </div>
              ) : dbs.length === 0 ? (
                <div className="glass-card p-8 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low/30 text-center font-data-mono text-on-surface-variant space-y-3">
                  <span className="material-symbols-outlined text-3xl text-outline">dns</span>
                  <p className="text-xs uppercase">No custom external vector clusters registered.</p>
                  <p className="text-[11px] text-outline max-w-md mx-auto normal-case">
                    The platform is operating using the default in-memory database context. Use the side panel to add a custom Qdrant or ChromaDB connection.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dbs.map((db) => {
                    const isActive = db.status === "active";
                    return (
                      <div 
                        key={db.id} 
                        className={`glass-card rounded-xl p-5 border flex flex-col justify-between transition-all duration-300 ${
                          isActive 
                            ? "border-secondary bg-secondary/5 ring-1 ring-secondary/30 scale-[1.01]" 
                            : "border-outline-variant/40 hover:border-outline-variant/80"
                        }`}
                      >
                        <div className="space-y-4">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-2xl ${isActive ? "text-secondary" : "text-outline"}`}>
                                {db.provider === "qdrant" ? "dataset" : "layers"}
                              </span>
                              <div>
                                <h3 className="font-bold text-white font-data-mono text-body-md uppercase truncate max-w-[140px]" title={db.name}>
                                  {db.name}
                                </h3>
                                <span className="text-[10px] text-outline font-data-mono uppercase">{db.provider}</span>
                              </div>
                            </div>
                            <span className={`text-[9px] font-bold font-data-mono px-2 py-0.5 rounded-full uppercase ${
                              isActive 
                                ? "text-secondary bg-secondary/15 border border-secondary/30" 
                                : "text-on-surface-variant bg-surface-container-high/60 border border-outline-variant/30"
                            }`}>
                              {db.status}
                            </span>
                          </div>

                          <div className="space-y-1.5 font-data-mono text-[11px] text-on-surface-variant/80">
                            <div className="flex justify-between">
                              <span>URL:</span>
                              <span className="text-white truncate max-w-[160px]" title={db.url || "Local Memory"}>
                                {db.url || "Memory Location"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>API KEY:</span>
                              <span className="text-white">{db.api_key ? "••••••••" : "NOT SET"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-outline-variant/20 flex gap-2 justify-end">
                          {!isActive && (
                            <>
                              <button
                                onClick={() => handleDeleteDb(db.id, db.name)}
                                className="px-3 py-1.5 rounded-lg border border-outline-variant text-[11px] font-bold font-data-mono hover:bg-red-500/10 hover:border-red-500/30 text-outline hover:text-red-400 transition-all flex items-center gap-1"
                                title="Remove connection"
                              >
                                <span className="material-symbols-outlined text-xs">delete</span>
                                REMOVE
                              </button>
                              <button
                                onClick={() => handleActivateDb(db.id)}
                                className="px-3 py-1.5 rounded-lg bg-secondary text-inverse-on-surface text-[11px] font-bold font-data-mono hover:opacity-90 transition-all flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-xs font-bold">bolt</span>
                                ACTIVATE
                              </button>
                            </>
                          )}
                          {isActive && (
                            <span className="text-[10px] font-bold text-secondary font-data-mono flex items-center gap-1 py-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              ACTIVE ENGINE
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Connection Registration Form */}
          <div className="glass-card rounded-xl border border-outline-variant/40 bg-surface-container-low/40 p-6 space-y-6 h-fit">
            <div>
              <h2 className="text-headline-md font-bold text-white font-data-mono uppercase tracking-tight text-[18px]">
                Register Integration
              </h2>
              <p className="text-on-surface-variant text-[12px] mt-1">
                Link custom Vector DB clusters into your Vectora environment cache.
              </p>
            </div>

            <form onSubmit={handleRegisterDb} className="space-y-4 font-data-mono text-xs">
              <div className="space-y-2">
                <label className="text-outline uppercase text-[10px]">1. Database Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDbProvider("qdrant");
                      setTestStatus(null);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      dbProvider === "qdrant"
                        ? "border-secondary bg-secondary/10 text-secondary"
                        : "border-outline-variant/40 hover:border-outline-variant/80 text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">dataset</span>
                    <span className="font-bold text-[11px]">QDRANT</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDbProvider("chromadb");
                      setTestStatus(null);
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                      dbProvider === "chromadb"
                        ? "border-secondary bg-secondary/10 text-secondary"
                        : "border-outline-variant/40 hover:border-outline-variant/80 text-on-surface-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">layers</span>
                    <span className="font-bold text-[11px]">CHROMADB</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="db-name" className="text-outline uppercase text-[10px]">2. Connection Alias</label>
                <input
                  id="db-name"
                  type="text"
                  placeholder="e.g. Production Cluster"
                  value={dbName}
                  onChange={(e) => setDbName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-secondary transition-colors"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="db-url" className="text-outline uppercase text-[10px]">3. Connection URL</label>
                <input
                  id="db-url"
                  type="text"
                  placeholder={dbProvider === "qdrant" ? "e.g. http://localhost:6333 or :memory:" : "e.g. http://localhost:8000"}
                  value={dbUrl}
                  onChange={(e) => setDbUrl(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-secondary transition-colors"
                />
                <p className="text-[10px] text-on-surface-variant/70 leading-normal">
                  Leave empty to initialize in memory (Qdrant client local mock environment).
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="db-apikey" className="text-outline uppercase text-[10px]">4. API Access Key / Token (Optional)</label>
                <input
                  id="db-apikey"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={dbApiKey}
                  onChange={(e) => setDbApiKey(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>

              {testStatus && (
                <div className={`p-3.5 rounded-xl border font-data-mono text-[11px] flex gap-2.5 items-start ${
                  testStatus.success 
                    ? "bg-green-500/10 border-green-500/30 text-green-400" 
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  <span className="material-symbols-outlined text-md mt-0.5">
                    {testStatus.success ? "check_circle" : "error"}
                  </span>
                  <div>
                    <span className="font-bold uppercase block">{testStatus.success ? "CONNECTION SUCCESS" : "CONNECTION ERROR"}</span>
                    <span className="text-[10px] leading-relaxed block mt-0.5">{testStatus.message}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || registering}
                  className="flex-1 py-2 px-3 rounded-xl border border-outline-variant font-bold text-center uppercase tracking-wide hover:bg-surface-container-highest transition-colors disabled:opacity-50 text-[11px] flex items-center justify-center gap-1.5"
                >
                  {testingConnection ? (
                    <>
                      <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                      TESTING...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs">network_check</span>
                      TEST LINK
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  disabled={registering || testingConnection}
                  className="flex-1 py-2 px-3 rounded-xl bg-secondary text-inverse-on-surface font-bold text-center uppercase tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 text-[11px] flex items-center justify-center gap-1.5"
                >
                  {registering ? (
                    <>
                      <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                      SAVING...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs font-bold">save</span>
                      REGISTER
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
