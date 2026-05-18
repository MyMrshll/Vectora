"use client";

import { useEffect, useState } from "react";

interface QueryLog {
  id: string;
  question: string;
  response: string;
  latency: number;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<QueryLog | null>(null);

  const fetchLogs = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/api/query/logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch query logs:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.response.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Helper to format date
  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  // Stats calculations
  const totalQueries = logs.length;
  const avgLatency =
    totalQueries > 0
      ? (logs.reduce((sum, log) => sum + log.latency, 0) / totalQueries).toFixed(2)
      : "0.00";
  const maxLatency =
    totalQueries > 0
      ? Math.max(...logs.map((log) => log.latency)).toFixed(2)
      : "0.00";
  const minLatency =
    totalQueries > 0
      ? Math.min(...logs.map((log) => log.latency)).toFixed(2)
      : "0.00";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">System Telemetry Audit</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Analyze RAG pipeline performance, prompt latencies, and transaction logs.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          className="p-2 bg-surface-container-high rounded border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-colors flex items-center gap-2 font-data-mono text-[12px] uppercase"
        >
          <span className="material-symbols-outlined text-md">sync</span>
          Sync Audit Stream
        </button>
      </div>

      {/* KPI Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {/* Total Audit Logs */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Total Transactions</span>
            <span className="material-symbols-outlined text-secondary/50">history</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-white">
              {loading ? "..." : totalQueries}
            </span>
            <p className="text-on-surface-variant font-label-sm mt-1">Recorded Executions</p>
          </div>
        </div>

        {/* Avg Latency */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Avg Latency</span>
            <span className="material-symbols-outlined text-secondary/50">speed</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-secondary cyan-glow">
              {loading ? "..." : `${avgLatency}s`}
            </span>
            <p className="text-on-surface-variant font-label-sm mt-1">Response Speed</p>
          </div>
        </div>

        {/* Max Latency */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Peak Delay</span>
            <span className="material-symbols-outlined text-secondary/50">trending_up</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-white">
              {loading ? "..." : `${maxLatency}s`}
            </span>
            <p className="text-on-surface-variant font-label-sm mt-1">Maximum Latency</p>
          </div>
        </div>

        {/* Min Latency */}
        <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-on-surface-variant font-label-sm uppercase tracking-wider">Minimum Latency</span>
            <span className="material-symbols-outlined text-secondary/50">bolt</span>
          </div>
          <div className="mt-4">
            <span className="text-headline-lg font-data-mono text-white">
              {loading ? "..." : `${minLatency}s`}
            </span>
            <p className="text-on-surface-variant font-label-sm mt-1">Best Performance</p>
          </div>
        </div>
      </div>

      {/* Filter and Table View */}
      <div className="glass-card p-6 rounded-xl space-y-4">
        {/* Search */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <input
              type="text"
              placeholder="Search query payload, answer text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
            />
            <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant/70 text-md">search</span>
          </div>
          <div className="font-data-mono text-label-sm text-on-surface-variant">
            <span>FILTERED: {filteredLogs.length} OF {totalQueries}</span>
          </div>
        </div>

        {/* Table logs */}
        {loading ? (
          <div className="py-20 text-center text-on-surface-variant font-data-mono">
            <span className="material-symbols-outlined text-3xl animate-spin text-secondary mb-2">sync</span>
            <p>LOADING TRANSACTIONS STREAM...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 text-center text-on-surface-variant font-data-mono">
            <span className="material-symbols-outlined text-3xl mb-2 text-outline">history</span>
            <p>NO TELEMETRY TRANSACTIONS RECORDED.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse text-left font-data-mono text-body-md">
              <thead>
                <tr className="border-b border-outline-variant text-[11px] text-on-surface-variant uppercase tracking-wider bg-surface-container-low/30">
                  <th className="py-3 px-4 font-bold">Timestamp</th>
                  <th className="py-3 px-4 font-bold">Query</th>
                  <th className="py-3 px-4 font-bold">Response Segment Preview</th>
                  <th className="py-3 px-4 font-bold text-right">Latency</th>
                  <th className="py-3 px-4 font-bold text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {filteredLogs.map((log) => {
                  const isFast = log.latency < 0.5;
                  const isSlow = log.latency > 1.5;

                  return (
                    <tr key={log.id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3.5 px-4 text-white text-[12px] whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-white text-[13px] max-w-[200px] truncate">
                        {log.question}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-on-surface-variant text-[13px] max-w-[300px] truncate">
                        {log.response}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`text-[12px] font-bold px-2 py-0.5 rounded ${
                          isFast ? "text-green-400 bg-green-400/10" :
                          isSlow ? "text-red-400 bg-red-400/10" :
                          "text-secondary bg-secondary/10"
                        }`}>
                          {log.latency.toFixed(2)}s
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-secondary hover:underline uppercase text-[11px] font-bold inline-flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-3xl rounded-xl border border-secondary/30 shadow-2xl flex flex-col max-h-[85vh] animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-outline-variant/40 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">monitor_heart</span>
                  <h3 className="font-data-mono font-bold text-white uppercase text-body-md">
                    Transaction Audit Segment
                  </h3>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1 font-data-mono">
                  TRANSACTION ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg hover:bg-surface-container-highest text-on-surface-variant hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Question */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-data-mono text-secondary uppercase tracking-widest font-bold">Query Payload</span>
                <div className="bg-surface-container-lowest/80 border border-outline-variant/30 rounded-lg p-4 font-sans text-white text-[14px]">
                  {selectedLog.question}
                </div>
              </div>

              {/* Answer */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-data-mono text-secondary uppercase tracking-widest font-bold">Generative AI Response</span>
                <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 font-sans text-white leading-relaxed text-[13px] whitespace-pre-wrap select-text max-h-[250px] overflow-y-auto">
                  {selectedLog.response}
                </div>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-lg font-data-mono text-[11px] text-on-surface-variant">
                  <div className="text-on-surface-variant uppercase">EXECUTION SPEED:</div>
                  <div className="text-white font-bold text-body-lg mt-1">{selectedLog.latency.toFixed(4)} SECONDS</div>
                </div>
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/30 rounded-lg font-data-mono text-[11px] text-on-surface-variant">
                  <div className="text-on-surface-variant uppercase">RECORDED TIMESTAMP:</div>
                  <div className="text-white font-bold text-body-lg mt-1">{formatDateTime(selectedLog.created_at)}</div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-surface-container border-t border-outline-variant/40 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-secondary text-on-secondary font-bold text-label-sm uppercase rounded hover:opacity-90 transition-opacity"
              >
                Close Transaction Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
