"use client";

import { useState, useEffect } from "react";

interface RetrievedChunk {
  content: string;
  score: number;
  source_document: string;
  chunk_index: number;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  val: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  latency?: number;
  retrievedChunks?: RetrievedChunk[];
  graph?: GraphData;
}

// Color map for node types
const getNodeColor = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes("threat") || t.includes("vulnerability") || t.includes("attack")) {
    return {
      fill: "rgba(244, 63, 94, 0.15)",
      stroke: "#f43f5e",
      glow: "rgba(244, 63, 94, 0.45)"
    };
  }
  if (t.includes("software") || t.includes("hardware") || t.includes("system")) {
    return {
      fill: "rgba(59, 130, 246, 0.15)",
      stroke: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.45)"
    };
  }
  if (t.includes("concept") || t.includes("protocol") || t.includes("category")) {
    return {
      fill: "rgba(245, 158, 11, 0.15)",
      stroke: "#f59e0b",
      glow: "rgba(245, 158, 11, 0.45)"
    };
  }
  if (t.includes("company") || t.includes("org") || t.includes("actor") || t.includes("person")) {
    return {
      fill: "rgba(168, 85, 247, 0.15)",
      stroke: "#a855f7",
      glow: "rgba(168, 85, 247, 0.45)"
    };
  }
  if (t.includes("document") || t.includes("file") || t.includes("log") || t.includes("source")) {
    return {
      fill: "rgba(16, 185, 129, 0.15)",
      stroke: "#10b981",
      glow: "rgba(16, 185, 129, 0.45)"
    };
  }
  return {
    fill: "rgba(6, 182, 212, 0.15)",
    stroke: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.45)"
  };
};

// Force-Directed SVG Visualizer Component
interface GraphVisualizerProps {
  graph: GraphData;
}

function GraphVisualizer({ graph }: GraphVisualizerProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Initialize positions on graph change
  useEffect(() => {
    if (!graph || !graph.nodes) return;
    const width = 350;
    const height = 350;
    
    // Position nodes in a circle initially to distribute them nicely
    const initNodes = graph.nodes.map((node, i) => {
      const angle = (i / graph.nodes.length) * 2 * Math.PI;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * 90 + (Math.random() - 0.5) * 15,
        y: height / 2 + Math.sin(angle) * 90 + (Math.random() - 0.5) * 15,
        vx: 0,
        vy: 0,
      };
    });

    setNodes(initNodes);
    setEdges(graph.edges || []);
    setSelectedNodeId(null);
  }, [graph]);

  // Spring Relaxation Physics Loop
  useEffect(() => {
    if (nodes.length === 0) return;

    let animationFrameId: number;
    const width = 350;
    const height = 350;
    
    // Physics parameters
    const kAttr = 0.04;     // Spring force
    const kRep = 380;       // Repulsion force
    const kGravity = 0.025; // Centering force
    const damping = 0.84;   // Friction

    const updatePhysics = () => {
      setNodes(prevNodes => {
        // Create a copy of nodes with forces initialized to 0
        const nextNodes = prevNodes.map(n => ({ ...n, fx: 0, fy: 0 }));

        // 1. Repulsion between all node pairs (Coulomb's Law)
        for (let i = 0; i < nextNodes.length; i++) {
          const n1 = nextNodes[i];
          for (let j = i + 1; j < nextNodes.length; j++) {
            const n2 = nextNodes[j];
            const dx = n2.x! - n1.x!;
            const dy = n2.y! - n1.y!;
            const distSq = dx * dx + dy * dy + 0.1;
            const dist = Math.sqrt(distSq);
            
            if (dist < 130) {
              const force = kRep / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              
              n1.fx! -= fx;
              n1.fy! -= fy;
              n2.fx! += fx;
              n2.fy! += fy;
            }
          }
        }

        // 2. Attraction along edges (Hooke's Law)
        edges.forEach(edge => {
          const sourceNode = nextNodes.find(n => n.id === edge.source);
          const targetNode = nextNodes.find(n => n.id === edge.target);
          
          if (sourceNode && targetNode) {
            const dx = targetNode.x! - sourceNode.x!;
            const dy = targetNode.y! - sourceNode.y!;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            const desiredDist = 75;
            const diff = dist - desiredDist;
            
            const force = kAttr * diff;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            
            sourceNode.fx! += fx;
            sourceNode.fy! += fy;
            targetNode.fx! -= fx;
            targetNode.fy! -= fy;
          }
        });

        // 3. Gravity pulling to center & Bounding box constraints
        const updated = nextNodes.map(n => {
          if (n.id === draggedNodeId) {
            // Dragged node maintains manual position
            return n;
          }
          
          const gcX = width / 2;
          const gcY = height / 2;
          n.fx! += (gcX - n.x!) * kGravity;
          n.fy! += (gcY - n.y!) * kGravity;

          const vx = (n.vx! + n.fx!) * damping;
          const vy = (n.vy! + n.fy!) * damping;

          let x = n.x! + vx;
          let y = n.y! + vy;
          
          // Constrain within bounds
          x = Math.max(15, Math.min(width - 15, x));
          y = Math.max(15, Math.min(height - 15, y));

          return {
            ...n,
            x,
            y,
            vx,
            vy
          };
        });

        return updated;
      });

      animationFrameId = requestAnimationFrame(updatePhysics);
    };

    animationFrameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animationFrameId);
  }, [nodes.length, edges, draggedNodeId]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNodeId) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    
    // Scale coordinates accurately if container is responsive
    const x = Math.max(15, Math.min(350 - 15, ((e.clientX - rect.left) / rect.width) * 350));
    const y = Math.max(15, Math.min(350 - 15, ((e.clientY - rect.top) / rect.height) * 350));
    
    setNodes(prev => prev.map(n => n.id === draggedNodeId ? { ...n, x, y, vx: 0, vy: 0 } : n));
  };

  const handleMouseUpOrLeave = () => {
    setDraggedNodeId(null);
  };

  // Helper to determine active connectivity for highlight
  const isNodeConnected = (nodeId: string) => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return true;
    if (nodeId === activeId) return true;
    return edges.some(e => 
      (e.source === activeId && e.target === nodeId) || 
      (e.target === activeId && e.source === nodeId)
    );
  };

  const isEdgeConnected = (edge: GraphEdge) => {
    const activeId = hoveredNodeId || selectedNodeId;
    if (!activeId) return true;
    return edge.source === activeId || edge.target === activeId;
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const connectedRelations = edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);

  return (
    <div className="space-y-4">
      {/* 2D Canvas */}
      <div className="relative aspect-square w-full rounded-xl bg-surface-container-lowest border border-outline-variant/20 overflow-hidden flex items-center justify-center select-none shadow-inner">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 350 350"
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
        >
          {/* Defs for gradients & arrows */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="17"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="rgba(255, 255, 255, 0.2)" />
            </marker>
            <marker
              id="arrow-highlight"
              viewBox="0 0 10 10"
              refX="17"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#00e5ff" />
            </marker>
            
            {/* Glow filter */}
            <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Render Connections / Edges */}
          {edges.map((edge, idx) => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const isHigh = isEdgeConnected(edge);
            const activeId = hoveredNodeId || selectedNodeId;

            return (
              <g key={idx} className="transition-all duration-300">
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isHigh ? "#00e5ff" : "rgba(255, 255, 255, 0.07)"}
                  strokeWidth={isHigh ? 1.8 : 0.8}
                  strokeDasharray={isHigh ? "none" : "2,3"}
                  markerEnd={isHigh ? "url(#arrow-highlight)" : "url(#arrow)"}
                  className="transition-all duration-200"
                />
                
                {/* Relationship label in center of connection on hover/focus */}
                {isHigh && activeId && (
                  <g transform={`translate(${(sourceNode.x! + targetNode.x!) / 2}, ${(sourceNode.y! + targetNode.y!) / 2})`}>
                    <rect
                      x={-35}
                      y={-7}
                      width={70}
                      height={14}
                      rx={3}
                      fill="#0d1b2a"
                      stroke="#00e5ff"
                      strokeWidth={0.5}
                      opacity={0.9}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#00e5ff"
                      fontSize="6.5px"
                      fontFamily="monospace"
                      fontWeight="bold"
                      className="uppercase tracking-wider pointer-events-none"
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Render Entities / Nodes */}
          {nodes.map((node) => {
            const { fill, stroke } = getNodeColor(node.type);
            const isHigh = isNodeConnected(node.id);
            const radius = 6 + (node.val || 3) * 1.6;
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isActive = isSelected || isHovered;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${node.y})`}
                className="cursor-pointer group transition-all duration-300"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggedNodeId(node.id);
                  setSelectedNodeId(node.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Node Outer Glow Ring */}
                <circle
                  r={radius + 4}
                  fill="transparent"
                  stroke={isActive ? stroke : "transparent"}
                  strokeWidth={1.2}
                  strokeDasharray="2,2"
                  className="animate-[spin_20s_linear_infinite]"
                />

                {/* Node Body */}
                <circle
                  r={radius}
                  fill={fill}
                  stroke={isSelected ? "#00e5ff" : stroke}
                  strokeWidth={isSelected ? 2 : 1.2}
                  style={isActive ? { filter: "url(#node-glow)" } : undefined}
                  className="transition-all duration-200"
                  opacity={isHigh ? 1 : 0.22}
                />

                {/* Inner Core Accent */}
                <circle
                  r={2}
                  fill={isSelected ? "#00e5ff" : stroke}
                  opacity={isHigh ? 1 : 0.22}
                />

                {/* Node Label Text */}
                <text
                  y={radius + 11}
                  textAnchor="middle"
                  fill={isSelected ? "#00e5ff" : isHigh ? "#ffffff" : "rgba(255, 255, 255, 0.2)"}
                  fontSize={isSelected ? "9px" : "7.5px"}
                  fontFamily="sans-serif"
                  fontWeight={isSelected ? "bold" : "normal"}
                  className="pointer-events-none select-none tracking-tight transition-all duration-200"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Dynamic Legend Overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-x-2 gap-y-0.5 bg-surface-container-high/90 border border-outline-variant/20 rounded p-1.5 text-[7px] font-data-mono uppercase text-on-surface-variant backdrop-blur-sm select-none">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Threat/Vuln
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Software
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Concept
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> Actor/Org
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Doc/Log
          </div>
        </div>
      </div>

      {/* Entity Inspector Panel */}
      <div className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 min-h-[110px] flex flex-col justify-center">
        {!selectedNode ? (
          <div className="text-center py-4 text-on-surface-variant font-data-mono text-[9px] uppercase space-y-1">
            <span className="material-symbols-outlined text-sm block mb-1">info</span>
            <p>Interactive Node Inspector</p>
            <p className="text-[8px] opacity-60">Click any node to explore relational graph dependencies.</p>
          </div>
        ) : (
          <div className="space-y-2 text-left animate-fadeIn">
            <div className="flex justify-between items-center border-b border-outline-variant/20 pb-1.5">
              <div>
                <span className="text-[8px] font-data-mono text-secondary uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-secondary/10 border border-secondary/20 mr-1.5">
                  {selectedNode.type}
                </span>
                <span className="font-bold text-white text-body-sm">{selectedNode.label}</span>
              </div>
              <button 
                onClick={() => setSelectedNodeId(null)}
                className="text-on-surface-variant hover:text-white text-xs font-data-mono uppercase"
              >
                Clear
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[9px] font-data-mono text-on-surface-variant uppercase">
                Direct Semantic Relationships ({connectedRelations.length}):
              </div>
              {connectedRelations.length === 0 ? (
                <p className="text-[10px] text-on-surface-variant italic">No immediate connections found.</p>
              ) : (
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                  {connectedRelations.map((edge, idx) => {
                    const isSource = edge.source === selectedNode.id;
                    const otherId = isSource ? edge.target : edge.source;
                    const otherNode = nodes.find(n => n.id === otherId);
                    const otherLabel = otherNode ? otherNode.label : otherId;
                    
                    return (
                      <div key={idx} className="flex items-center gap-1.5 text-[9.5px] text-on-surface/90 font-data-mono bg-surface-container-lowest/50 px-2 py-1 rounded border border-outline-variant/10">
                        {isSource ? (
                          <>
                            <span className="text-white font-bold">{selectedNode.label}</span>
                            <span className="text-secondary italic">--({edge.label})--&gt;</span>
                            <span className="text-white font-bold">{otherLabel}</span>
                          </>
                        ) : (
                          <>
                            <span className="text-white font-bold">{otherLabel}</span>
                            <span className="text-secondary italic">--({edge.label})--&gt;</span>
                            <span className="text-white font-bold">{selectedNode.label}</span>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Main Playground Component
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
  const [retrievalStrategy, setRetrievalStrategy] = useState<"semantic" | "graph">("semantic");
  const [promptTemplate, setPromptTemplate] = useState(
    "Use the following pieces of retrieved context to answer the user's question. If you don't know the answer or if the context doesn't contain the answer, say you don't know, don't make up an answer.\n\nContext:\n{context}\n\nQuestion: {question}\n\nAnswer:"
  );

  // Active visualization states
  const [activeRetrievedChunks, setActiveRetrievedChunks] = useState<RetrievedChunk[]>([]);
  const [activeLatency, setActiveLatency] = useState<number | null>(null);
  const [activeGraph, setActiveGraph] = useState<GraphData | null>(null);
  const [activeTab, setActiveTab] = useState<"sources" | "graph">("sources");

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
      const endpoint = retrievalStrategy === "graph" ? "query/graph" : "query/";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/${endpoint}`, {
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
          graph: data.graph || undefined,
        };

        setMessages(prev => [...prev, assistantMessage]);
        setActiveRetrievedChunks(data.retrieved_chunks || []);
        setActiveLatency(data.latency);
        
        if (data.graph) {
          setActiveGraph(data.graph);
          setActiveTab("graph");
        } else {
          setActiveGraph(null);
          setActiveTab("sources");
        }
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
    if (msg.graph) {
      setActiveGraph(msg.graph);
      setActiveTab("graph");
    } else {
      setActiveGraph(null);
      setActiveTab("sources");
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

            {/* Strategy Selector Toggle */}
            <div className="space-y-1.5 flex flex-col justify-center">
              <div className="flex justify-between items-center text-[10px] font-data-mono text-on-surface-variant uppercase">
                <span>Retrieval Strategy</span>
                <span className="text-secondary font-bold font-data-mono">
                  {retrievalStrategy === "graph" ? "GRAPH RAG" : "SEMANTIC"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 bg-surface-container-high/60 p-0.5 rounded-lg border border-outline-variant/30">
                <button
                  type="button"
                  onClick={() => setRetrievalStrategy("semantic")}
                  className={`py-1 text-[9px] font-data-mono uppercase font-bold rounded transition-all ${
                    retrievalStrategy === "semantic"
                      ? "bg-secondary text-on-secondary shadow-md shadow-secondary/15"
                      : "text-on-surface-variant hover:text-white hover:bg-surface-container-highest/40"
                  }`}
                >
                  Semantic
                </button>
                <button
                  type="button"
                  onClick={() => setRetrievalStrategy("graph")}
                  className={`py-1 text-[9px] font-data-mono uppercase font-bold rounded transition-all flex items-center justify-center gap-1 ${
                    retrievalStrategy === "graph"
                      ? "bg-secondary text-on-secondary shadow-md shadow-secondary/15"
                      : "text-on-surface-variant hover:text-white hover:bg-surface-container-highest/40"
                  }`}
                >
                  <span className="w-1 h-1 rounded-full bg-current animate-ping"></span>
                  Graph RAG
                </button>
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
                    
                    {!isUser && ((msg.retrievedChunks && msg.retrievedChunks.length > 0) || msg.graph) && (
                      <div className="mt-2 pt-2 border-t border-outline-variant/10 flex justify-between items-center">
                        <span className="text-[9px] text-secondary font-bold font-data-mono uppercase flex items-center gap-1">
                          ⚡ Grounded on {msg.retrievedChunks?.length || 0} chunks {msg.graph && "and semantic graph connections"}
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
                  EXECUTING GRAPH RAG RETRIEVAL & COGNITIVE REASONING...
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

        {/* Right Column: Grounded Source Transparency & Concept Web */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-gutter">
          <div className="glass-card rounded-xl p-5 border border-outline-variant/30 h-full flex flex-col min-h-[480px]">
            
            {/* Custom Tab Selector */}
            <div className="flex border-b border-outline-variant/20 pb-2 mb-4 gap-4">
              <button
                onClick={() => setActiveTab("sources")}
                className={`flex items-center gap-1.5 pb-2 text-[10.5px] font-data-mono uppercase font-bold tracking-wider transition-all relative ${
                  activeTab === "sources" ? "text-white" : "text-on-surface-variant hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary">explore</span>
                <span>Source Coordinates</span>
                {activeTab === "sources" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-secondary rounded-full"></span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab("graph")}
                className={`flex items-center gap-1.5 pb-2 text-[10.5px] font-data-mono uppercase font-bold tracking-wider transition-all relative ${
                  activeTab === "graph" ? "text-white" : "text-on-surface-variant hover:text-white"
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-secondary font-bold">hub</span>
                <span>Concept Web</span>
                {activeTab === "graph" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-secondary rounded-full"></span>
                )}
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 flex flex-col justify-between">
              {activeTab === "sources" ? (
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 max-h-[500px]">
                  {activeRetrievedChunks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant font-data-mono text-[11px] uppercase my-auto min-h-[300px]">
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
              ) : (
                <div className="flex-1 flex flex-col min-h-[350px]">
                  {activeGraph ? (
                    <GraphVisualizer graph={activeGraph} />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-on-surface-variant font-data-mono text-[11px] uppercase my-auto min-h-[300px]">
                      <span className="material-symbols-outlined text-3xl mb-2 text-outline">hub</span>
                      <p>Awaiting Graph RAG Execution.</p>
                      <p className="mt-1 text-[9px] text-on-surface-variant/60">
                        Toggle "Graph RAG" strategy, execute a query, and watch the dynamic Knowledge Graph emerge.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
