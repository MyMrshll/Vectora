# Vectora 🚀

Vectora is a unified, high-performance **Retrieval-Augmented Generation (RAG) Admin Platform** designed for developers and system operators to orchestrate, analyze, and optimize RAG lifecycles.

Built with a modern, high-fidelity neural interface and robust vector-native backend utilities, Vectora integrates seamlessly with **FastAPI**, **Qdrant Vector Database**, and **Google Gemini Models**.

## Key Features

- 📂 **Knowledge Ingestion & Vectorization**: Upload unstructured documents, dynamically split texts using Recursive Character Spacing, calculate high-dimensional embeddings via Google Gemini (`text-embedding-004`), and index them seamlessly in Qdrant.
- ⚡ **Neural Semantic Querying**: Formulate natural language questions and synthesize contextualized responses using Gemini LLMs (`gemini-1.5-flash`) grounded in retrieved document shards.
- 📊 **Audit Logs & Ingestion Pipeline Monitoring**: Monitor similarity distance metrics, latency markers, token consumption logs, and index configurations from a consolidated system dashboard.
- 🎨 **Synthetic Intelligence Interface**: A unified design language with rich visual aesthetics, deep-space dark modes, micro-animations, and glassmorphic dashboards.

## Architecture Outline

```
┌──────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│  Next.js client  │ ◄───► │  FastAPI API Server  │ ◄───► │ Qdrant Vector Store │
└──────────────────┘       └──────────┬───────────┘       └──────────────────────┘
                                      │
                                      ▼
                           ┌──────────────────────┐
                           │  Google Gemini APIs  │
                           └──────────────────────┘
```

## Running the Project

### 1. Backend Startup
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
python app/main.py
```

### 2. Frontend Startup
```bash
cd frontend
pnpm dev
```
