"use client";

import { useEffect, useState } from "react";

interface AIModel {
  id: string;
  provider: string;
  model_name: string;
  type: string;
  status: string;
  dimension?: number;
  api_endpoint?: string;
}

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [provider, setProvider] = useState("google");
  const [modelName, setModelName] = useState("");
  const [modelType, setModelType] = useState("llm");
  const [apiEndpoint, setApiEndpoint] = useState("");

  const fetchModels = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/models/`);
      if (res.ok) {
        const data = await res.json();
        setModels(data);
      }
    } catch (err) {
      console.error("Failed to fetch model registry:", err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelName.trim()) {
      alert("Model Name is required");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        provider,
        model_name: modelName.trim(),
        type: modelType,
        api_endpoint: apiEndpoint.trim() || null,
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/models/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to register model");
      }

      // Clear form
      setModelName("");
      setApiEndpoint("");
      
      // Refresh models
      await fetchModels(false);
      alert("Model successfully registered!");
    } catch (err: any) {
      console.error("Error registering model:", err);
      alert(`Registration failed: ${err.message || "Unknown error"}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-headline-lg font-bold text-white tracking-tight uppercase">Models Registry</h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Configure LLMs and text embedding model clusters powering the cognitive vector engine.
          </p>
        </div>
        <button
          onClick={() => fetchModels(true)}
          className="p-2 bg-surface-container-high rounded border border-outline-variant hover:bg-surface-container-highest text-on-surface transition-colors flex items-center gap-2 font-data-mono text-[12px] uppercase"
        >
          <span className="material-symbols-outlined text-md">sync</span>
          Sync Registry
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Registered Models List */}
        <section className="lg:col-span-7 space-y-4">
          <div className="glass-card p-6 rounded-xl">
            <h2 className="text-headline-md text-white font-bold mb-1 uppercase">Active Deployments</h2>
            <p className="text-on-surface-variant text-body-md mb-6">Cognitive models loaded into the workspace environment.</p>

            {loading ? (
              <div className="py-16 text-center text-on-surface-variant font-data-mono">
                <span className="material-symbols-outlined text-3xl animate-spin text-secondary mb-2">sync</span>
                <p>SYNCING ACTIVE REGISTRY...</p>
              </div>
            ) : models.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant font-data-mono">
                <span className="material-symbols-outlined text-3xl mb-2 text-outline">settings_input_component</span>
                <p>NO MODELS REGISTERED.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {models.map((model) => {
                  const isEmbedding = model.type === "embedding";
                  const providerName = model.provider.toLowerCase();

                  return (
                    <div
                      key={model.id}
                      className="bg-surface-container-low/50 border border-outline-variant/30 rounded-xl p-5 hover:border-secondary/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group"
                    >
                      {/* Ambient background glow for active status */}
                      <div className="absolute right-0 top-0 h-full w-1 bg-secondary shadow-lg"></div>

                      <div className="flex items-start gap-4">
                        {/* Icon Badge */}
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          isEmbedding ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "bg-secondary/10 text-secondary border border-secondary/20"
                        }`}>
                          <span className="material-symbols-outlined text-lg">
                            {isEmbedding ? "scatter_plot" : "smart_toy"}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-data-mono font-bold text-white text-body-lg">
                              {model.model_name}
                            </h3>
                            <span className={`text-[10px] font-data-mono font-bold px-2 py-0.5 rounded uppercase ${
                              isEmbedding 
                                ? "text-cyan-400 bg-cyan-400/10 border border-cyan-400/20" 
                                : "text-secondary bg-secondary/10 border border-secondary/20"
                            }`}>
                              {model.type}
                            </span>
                            <span className="text-[10px] font-data-mono text-green-400 bg-green-400/10 px-2 py-0.5 rounded border border-green-400/20 uppercase">
                              {model.status}
                            </span>
                          </div>
                          <div className="font-data-mono text-[11px] text-on-surface-variant flex flex-col gap-0.5">
                            <div>PROVIDER: <span className="text-white capitalize">{model.provider}</span></div>
                            {model.dimension && <div>DIMENSION: <span className="text-white">{model.dimension} vD</span></div>}
                            {model.api_endpoint && (
                              <div className="truncate max-w-[280px] sm:max-w-[340px]" title={model.api_endpoint}>
                                ENDPOINT: <span className="text-white">{model.api_endpoint}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Register Model Form */}
        <section className="lg:col-span-5">
          <div className="glass-card p-6 rounded-xl border border-secondary/20 sticky top-24">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-secondary">add_circle</span>
              <h2 className="text-headline-md text-white font-bold uppercase">Register Model</h2>
            </div>
            <p className="text-on-surface-variant text-body-md mb-6">
              Connect external AI model providers to extend your search capabilities.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Provider Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider font-bold">Model Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors cursor-pointer"
                >
                  <option value="google">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="cohere">Cohere AI</option>
                  <option value="huggingface">Hugging Face</option>
                  <option value="custom">Custom Provider</option>
                </select>
              </div>

              {/* Model Name Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider font-bold">Model Name</label>
                <input
                  type="text"
                  placeholder="e.g. gemini-1.5-pro or gpt-4o"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
                  required
                />
              </div>

              {/* Model Type Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider font-bold">Model Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModelType("llm")}
                    className={`py-2 px-4 rounded border font-data-mono text-[12px] uppercase font-bold transition-all ${
                      modelType === "llm"
                        ? "bg-secondary text-on-secondary border-secondary"
                        : "bg-surface-container-low text-on-surface border-outline-variant/50 hover:bg-surface-container-high"
                    }`}
                  >
                    Large Language (LLM)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelType("embedding")}
                    className={`py-2 px-4 rounded border font-data-mono text-[12px] uppercase font-bold transition-all ${
                      modelType === "embedding"
                        ? "bg-cyan-500 text-black border-cyan-500"
                        : "bg-surface-container-low text-on-surface border-outline-variant/50 hover:bg-surface-container-high"
                    }`}
                  >
                    Embedding Vector
                  </button>
                </div>
              </div>

              {/* API Endpoint Field */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-data-mono text-on-surface-variant uppercase tracking-wider font-bold">
                  API Endpoint <span className="text-on-surface-variant/50 font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  placeholder="e.g. https://api.openai.com/v1"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/50 rounded px-4 py-2.5 text-body-md text-white focus:outline-none focus:border-secondary transition-colors"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className={`w-full mt-2 py-3 bg-secondary text-on-secondary font-bold font-label-sm rounded uppercase hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${
                  submitting ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {submitting ? "sync" : "cloud_sync"}
                </span>
                {submitting ? "Deploying Configuration..." : "Register Model"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
