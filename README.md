<div align="center">
  <img src="./assets/vectora_logo.png" alt="Vectora Logo" width="240px" style="border-radius: 24px; margin-bottom: 20px;" />

  # ⚡ Vectora

  ### High-Performance RAG Orchestration & Administration Control Plane

  [![Python](https://img.shields.io/badge/Python-3.10%2B-blueviolet?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org)
  [![FastAPI](https://img.shields.io/badge/FastAPI-v0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
  [![Next.js](https://img.shields.io/badge/Next.js-v16-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
  [![Qdrant](https://img.shields.io/badge/Qdrant-VectorStore-red?style=for-the-badge&logo=qdrant&logoColor=white)](https://qdrant.tech)
  [![Gemini](https://img.shields.io/badge/Google_Gemini-Cognitive_AI-blue?style=for-the-badge&logo=google-gemini&logoColor=white)](https://ai.google.dev)

  <p align="center" style="margin-top: 20px;">
    <a href="#ingestion--search-pipelines">🧠 <b>RAG Pipeline</b></a> &nbsp;•&nbsp;
    <a href="#installation--local-development">🌐 <b>Web Dashboard</b></a> &nbsp;•&nbsp;
    <a href="#automated-verification">📊 <b>System Telemetry</b></a> &nbsp;•&nbsp;
    <a href="#configuration-reference-env">🛠️ <b>Configuration</b></a>
  </p>
</div>

Vectora is an enterprise-grade, high-performance Retrieval-Augmented Generation (RAG) Orchestration and Administration Control Plane. It is engineered for developers, system architects, and AI operators to configure, monitor, and optimize cognitive search lifecycles.

The application features a unified developer-centric glassmorphism dashboard, real-time logging telemetry, vector chunk visualization, and robust pipeline management.

---

## Architectural Topology

```
             ┌──────────────────────────────────────────────┐
             │            Next.js User Interface            │
             │   (Glassmorphic Admin dashboard / console)   │
             └──────────────────────┬───────────────────────┘
                                    │ HTTP / WebSocket REST APIs
                                    ▼
             ┌──────────────────────────────────────────────┐
             │              FastAPI API Core                │
             │  (Asynchronous Document Parsing & Ingestion) │
             └───────┬──────────────┬──────────────┬────────┘
                     │              │              │
    Embeddings &     │              │              │ In-Memory or Supabase
    Grounded prompts │              │              │ Relational Metadata Backup
                     ▼              │              ▼
       ┌────────────────────────┐   │   ┌────────────────────────┐
       │   Google Gemini APIs   │   │   │     PostgreSQL DB      │
       │  (text-embedding-004)  │   │   │   (Chunk Persistence)  │
       │   (gemini-1.5-flash)   │   │   └────────────────────────┘
       └────────────────────────┘   │
                                    ▼
                       ┌────────────────────────┐
                       │  Qdrant Vector Engine  │
                       │   (Cos-Sim Indexing)   │
                       └────────────────────────┘
```

The Vectora topology consists of four decoupled layers:
1. **Presentation Layer (Next.js)**: Styled via a custom visual design system. The user interface features modular panes for document indexing, chunk exploration, telemetry query playgrounds, system logging, and active model registries.
2. **Orchestration Core (FastAPI)**: Coordinates file ingestion, initiates asynchronous background tasks, manages pipeline telemetry, and formats API queries.
3. **Vector Indexing Engine (Qdrant)**: Stores and indexes semantic embeddings. Vectora supports both lightweight in-memory storage (`:memory:`) for development and connection to production Qdrant clusters.
4. **Cognitive Reasoning Layer (Google Gemini)**: Translates text fragments into high-dimensional embeddings via the `text-embedding-004` model (768 dimensions), and synthesizes context-grounded query answers using `gemini-1.5-flash`.

---

## Ingestion & Search Pipelines

### Ingestion Pipeline
1. **Document Ingestion**: Unstructured files (such as `.txt` or `.md`) are uploaded via the FastAPI `/api/documents/` endpoint.
2. **Background Processing**: FastAPI places files on a non-blocking background queue to maintain interface responsiveness.
3. **Recursive Chunking**: Text is extracted and split using LangChain's `RecursiveCharacterTextSplitter` into structured fragments (default size: `1000` characters, overlap: `200` characters).
4. **Vector Generation**: Text chunks are parsed and vectorized using Google Gemini's `text-embedding-004` model. A robust mock fallback activates if no `GEMINI_API_KEY` is present.
5. **Collection Indexing**: 768-dimensional vectors are saved to the Qdrant collection named `vectora_documents` with **Cosine Distance** configuration.
6. **Relational Sync**: Chunks are mirrored to a secondary relational backup (Supabase) if configured; otherwise, they fail over gracefully to standard memory dictionary structures.

### Query and RAG Synthesis Pipeline
1. **Query Vectorization**: The natural language user query is mapped into the 768-dimensional vector space using the `text-embedding-004` model.
2. **K-Nearest Neighbors Search**: The query vector is compared against Qdrant collection vectors using Cosine similarity. The top-k matching points are retrieved.
3. **Context Reconstruction**: Source document chunks are gathered and formatted into a highly relevant context prompt.
4. **Synthesized Generation**: The reconstructed prompt is submitted to Google Gemini's `gemini-1.5-flash` model to construct a grounded reply.
5. **Telemetry Logging**: Every query's statistics—including raw latency, source references, distance scores, and estimated token counts—are persisted in the query logs database for system audit.

---

## Configuration Reference (.env)

The backend service reads configurations from `.env` in the root workspace or in the `/backend` folder.

```ini
# FastAPI Settings
PROJECT_NAME="Vectora API"
DEBUG=true

# Qdrant Configurations
# Use ":memory:" for transient in-memory development (requires qdrant-client package).
# Use "http://localhost:6333" for local Docker or a remote Qdrant Cloud URL.
QDRANT_URL=:memory:
QDRANT_API_KEY=

# Google Gemini Configurations
# Retrieve your developer key from the Google AI Studio console.
GEMINI_API_KEY=your-gemini-api-key

# Relational Backup Configuration (Optional)
# If provided, document chunk metadata will also sync to Supabase.
SUPABASE_URL=your-supabase-project-url
SUPABASE_KEY=your-supabase-anon-key
```

---

## Installation & Local Development

### System Requirements
* Python 3.10+
* Node.js v18+
* Package Managers: `pnpm` (frontend), `pip` (backend)

### Backend Deployment

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Launch the FastAPI server:
   ```bash
   python3 app/main.py
   ```
   The API documentation will be available at `http://localhost:8000/docs`.

### Frontend Deployment

1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```

2. Install frontend dependencies:
   ```bash
   pnpm install
   ```

3. Start the Next.js development server:
   ```bash
   pnpm dev
   ```
   The dashboard application will run on `http://localhost:3000`.

---

## Automated Verification

Vectora comes with a test harness designed to verify ingestion and query pipeline health:

1. Activate your virtual environment and run the test script:
   ```bash
   cd backend
   python3 test_api.py
   ```

2. The automated script will perform the following actions:
   * Establish a connection to the running FastAPI server.
   * Verify the `/health` and `/api/models/` endpoints.
   * Upload a mock knowledge file (`test_knowledge.txt`).
   * Verify recursive splitting and Qdrant vector ingestion.
   * Query the integrated RAG pipeline for retrieval validation.
   * Assert the persistence of telemetry in `/api/query/logs`.
   * Clean up index entries.
