"use client";

import { useState } from "react";

interface RetrievedChunk {
  content: string;
  score: float;
  source_document: string;
  chunk_index: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  latency?: number;
  retrievedChunks?: RetrievedChunk[];
}

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "SYSTEM ONLINE. Ready to execute semantic search and prompt engineering. Ask any question grounded by your vector database index.",
    }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // RAG Parameters
  const [topK, setTopK] = useState(4);
  const [temperature, setTemperature] = useState(0.7);
  const [promptTemplate, setPromptTemplate] = useState(
    "Use the following pieces of retrieved context to answer the user's question. If you don't know the answer or if the context doesn't contain the answer, say you don't know, don't make up an answer.\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"
  );

  // Keep track of the currently selected message's retrieved chunks to show in the right panel
  const [activeRetrievedChunks, setActiveRetrievedChunks] = useState<RetrievedChunk[]>([]);
  const [activeLatency, setActiveLatency] = useState<number | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMessage: Message = {
      role: "user",
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("http://localhost:8000/api/query/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: userMessage.content,
          top_k: topK,
          temperature: temperature,
          prompt_template: promptTemplate || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        const assistantMessage: Message = {
          role: "assistant",
          content: data.answer,
          latency: data.latency,
          retrievedChunks: data.retrieved_chunks,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setActiveRetrievedChunks(data.retrieved_chunks || []);
        setActiveLatency(data.latency);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Query failed");
      }
    } catch (err: any) {
      console.error("Query playground error:", err);
      const errorMessage: Message = {
        role: "assistant",
        content: `Error executing search query: ${err.message || "Unknown error"}`,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const selectMessageChunks = (msg: Message) => {
    if (msg.retrievedChunks) {
      setActiveRetrievedChunks(msg.retrievedChunks);
      setActiveLatency(msg.latency || null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">Knowledge Graph Playground</h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Perform real-time grounded reasoning queries. Tweak hyperparameters and inspect retrieve mechanics.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Chat Console & Hyperparameters */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-gutter">
          {/* Active Settings HUD */}
          <div className="glass-card p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4 border border-outline-variant/30">
            {/* Top K */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-data-mono text-on-surface-variant uppercase">
                <span>Top K Neighbors</span>
                <span className="text-secondary font-bold font-data-mono">{topK}</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="20" 
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="w-full accent-secondary bg-surface-container-high h-1 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-data-mono text-on-surface-variant uppercase">
                <span>Temperature</span>
                <span className="text-secondary font-bold font-data-mono">{temperature.toFixed(1)}</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-secondary bg-surface-container-high h-1 rounded-full appearance-none cursor-pointer"
              />
            </div>

            {/* Ingestion Engine Status */}
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-data-mono text-on-surface-variant uppercase">Retrieval Strategy</span>
              <div className="flex items-center gap-1.5 mt-1 text-green-400 font-data-mono font-bold text-label-sm uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping"></span>
                Qdrant Similarity Search
              </div>
            </div>
          </div>

          {/* Prompt Template Text Box */}
          <details className="glass-card rounded-xl border border-outline-variant/30 group">
            <summary className="p-4 cursor-pointer font-data-mono text-[11px] text-on-surface-variant uppercase flex justify-between items-center select-none">
              <span>View / Edit Prompt System Template</span>
              <span className="material-symbols-outlined text-sm transition-transform group-open:rotate-180">expand_more</span>
            </summary>
            <div className="p-4 border-t border-outline-variant/20 space-y-2 bg-surface-container-lowest/50">
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                rows={5}
                className="w-full bg-surface-dim border border-outline-variant/50 rounded p-3 text-[12px] font-data-mono text-white focus:outline-none focus:border-secondary leading-relaxed"
                placeholder="System prompt template..."
              />
              <p className="text-[10px] font-data-mono text-on-surface-variant">
                * Variable <code className="text-secondary">{`{context}`}</code> and <code className="text-secondary">{`{question}`}</code> will be injected automatically during LLM execution.
              </p>
            </div>
          </details>

          {/* Chat Terminal Area */}
          <div className="glass-card rounded-xl border border-outline-variant/30 min-h-[400px] flex flex-col justify-between overflow-hidden">
            {/* Terminal Top HUD */}
            <div className="px-5 py-3 border-b border-outline-variant/20 bg-surface-container-low flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/50"></span>
                <span className="w-3 h-3 rounded-full bg-yellow-500/50"></span>
                <span className="w-3 h-3 rounded-full bg-green-500/50"></span>
                <span className="text-[10px] font-data-mono text-on-surface-variant ml-2 uppercase">Grounded QA Terminal</span>
              </div>
              {activeLatency !== null && (
                <div className="text-[10px] font-data-mono text-secondary uppercase bg-secondary/10 px-2 py-0.5 rounded border border-secondary/20">
                  LATENCY: {activeLatency.toFixed(2)}s
                </div>
              )}
            </div>

            {/* Message Stream */}
            <div className="p-5 flex-1 overflow-y-auto max-h-[450px] space-y-4 font-mono text-[13px] leading-relaxed">
              {messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div 
                    key={index}
                    onClick={() => selectMessageChunks(msg)}
                    className={`flex flex-col gap-1 p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isUser 
                        ? "bg-surface-container-high/40 border-outline-variant/20 ml-12 text-white"
                        : "bg-surface-container-lowest/80 border-secondary/10 mr-12 text-on-surface/90 hover:border-secondary/30"
                    }`}
                  >
                    <div className="flex justify-between items-center text-[10px] font-bold text-on-surface-variant/70 font-data-mono border-b border-outline-variant/10 pb-1 mb-1.5 uppercase">
                      <span>{isUser ? "USER_PROMPT" : "VECTORA_ENGINE"}</span>
                      {!isUser && msg.latency && (
                        <span>Speed: {msg.latency.toFixed(2)}s</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap font-sans text-white text-body-md leading-relaxed">{msg.content}</p>
                    
                    {!isUser && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/10 flex justify-between items-center">
                        <span className="text-[9px] text-secondary font-bold font-data-mono uppercase">
                          ⚡ Grounded on {msg.retrievedChunks.length} source coordinates
                        </span>
                        <span className="text-[9px] text-on-surface-variant hover:text-white underline font-data-mono uppercase">
                          Inspect retrieval
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {sending && (
                <div className="p-4 bg-surface-container-lowest/40 border border-secondary/20 mr-12 rounded-lg text-on-surface-variant animate-pulse flex items-center gap-2 font-data-mono text-[12px]">
                  <span className="material-symbols-outlined text-md animate-spin text-secondary">sync</span>
                  EXECUTING SEMANTIC SIMILARITY & HYPERPARAMETER SEARCH...
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={sending ? "Processing..." : "Ask Vectora grounded by your indexed database..."}
                disabled={sending}
                className="flex-1 bg-surface-dim border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white placeholder-on-surface-variant/50 focus:outline-none focus:border-secondary transition-colors"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-6 py-2.5 bg-secondary text-on-secondary font-bold text-label-sm uppercase rounded hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">send</span>
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Grounded Source Transparency */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
          <div className="glass-card rounded-xl p-5 border border-outline-variant/30 h-full flex flex-col min-h-[450px]">
            <div className="border-b border-outline-variant/30 pb-3 mb-4">
              <div className="flex items-center gap-2 text-white">
                <span className="material-symbols-outlined text-secondary">explore</span>
                <h3 className="font-data-mono font-bold uppercase text-[12px]">Source Coordinates</h3>
              </div>
              <p className="text-[10px] text-on-surface-variant font-data-mono mt-1 uppercase">
                Transformed Qdrant Retrieval Metrics
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[500px]">
              {activeRetrievedChunks.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant font-data-mono text-[11px] uppercase">
                  <span className="material-symbols-outlined text-3xl mb-2 text-outline">radar</span>
                  <p>Awaiting query execution.</p>
                  <p className="mt-1 text-[9px] text-on-surface-variant/60">
                    Click any assistant chat box with a ⚡ symbol to review historic context matches.
                  </p>
                </div>
              ) : (
                activeRetrievedChunks.map((chunk, index) => {
                  const similarityPercent = (chunk.score * 100).toFixed(1);
                  return (
                    <div 
                      key={index}
                      className="p-3 bg-surface-container-low border border-outline-variant/40 rounded-lg space-y-2 hover:border-secondary/35 transition-colors"
                    >
                      <div className="flex justify-between items-center text-[10px] font-data-mono">
                        <span className="text-secondary font-bold">MATCH_{String(index + 1).padStart(2, "0")}</span>
                        <span className="text-green-400 bg-green-400/10 px-2 py-0.5 rounded font-bold border border-green-400/20">
                          {similarityPercent}% SIMILARITY
                        </span>
                      </div>
                      
                      <div className="bg-surface-container-lowest/80 p-2.5 rounded text-[11px] font-sans text-on-surface leading-normal max-h-24 overflow-y-auto whitespace-pre-wrap border border-outline-variant/10">
                        {chunk.content}
                      </div>

                      <div className="flex justify-between text-[9px] font-data-mono text-on-surface-variant/80 border-t border-outline-variant/10 pt-1.5">
                        <span className="truncate max-w-[130px] uppercase font-bold text-white">{chunk.source_document}</span>
                        <span>SEGMENT: {chunk.chunk_index}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
