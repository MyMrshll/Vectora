from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Document Schemas
class DocumentBase(BaseModel):
    filename: str
    source: Optional[str] = None
    size: int
    status: str = "pending"

class DocumentCreate(DocumentBase):
    pass

class DocumentUpdate(BaseModel):
    status: Optional[str] = None

class DocumentResponse(DocumentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Chunk Schemas
class ChunkBase(BaseModel):
    document_id: str
    content: str
    token_count: int
    chunk_index: int
    embedding_id: Optional[str] = None

class ChunkResponse(ChunkBase):
    id: str
    created_at: datetime

    class Config:
        from_attributes = True

# Embedding Model Schemas
class EmbeddingModelResponse(BaseModel):
    id: str
    model_name: str
    dimension: int
    created_at: datetime

    class Config:
        from_attributes = True

# Query Schemas
class QueryRequest(BaseModel):
    question: str
    top_k: int = Field(default=4, ge=1, le=20)
    temperature: float = Field(default=0.7, ge=0.0, le=1.0)
    prompt_template: Optional[str] = None

class RetrievedChunk(BaseModel):
    content: str
    score: float
    source_document: str
    chunk_index: int

class QueryResponse(BaseModel):
    answer: str
    retrieved_chunks: List[RetrievedChunk]
    latency: float
    created_at: datetime

# Graph Schemas
class GraphNode(BaseModel):
    id: str
    label: str
    type: str = "Concept"
    val: float = 1.0

class GraphEdge(BaseModel):
    source: str
    target: str
    label: str

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

class GraphQueryResponse(BaseModel):
    answer: str
    retrieved_chunks: List[RetrievedChunk]
    latency: float
    created_at: datetime
    graph: GraphData


# LLM Model Config Schemas
class AIModelResponse(BaseModel):
    id: str
    provider: str
    model_name: str
    type: str  # "llm" or "embedding"
    status: str
    dimension: Optional[int] = None
    api_endpoint: Optional[str] = None

class AIModelCreate(BaseModel):
    provider: str
    model_name: str
    type: str
    api_endpoint: Optional[str] = None

# Vector Database Schemas
class VectorDBCreate(BaseModel):
    name: str
    provider: str
    url: Optional[str] = None
    api_key: Optional[str] = None

class VectorDBResponse(BaseModel):
    id: str
    name: str
    provider: str
    url: Optional[str] = None
    api_key: Optional[str] = None
    status: str
    active_collection: str = "vectora_documents"
    created_at: Optional[datetime] = None  # Wait, database sometimes gives None or missing created_at, let's make Optional[datetime] just in case

    class Config:
        from_attributes = True

class CollectionCreate(BaseModel):
    name: str
