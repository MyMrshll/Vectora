from fastapi import APIRouter, HTTPException, Query
from app.services.rag_service import rag_service
from app.models.schemas import ChunkResponse
from typing import List, Optional

router = APIRouter()

@router.get("/", response_model=List[ChunkResponse])
async def get_chunks(document_id: Optional[str] = Query(None, description="Filter chunks by document ID")):
    try:
        if document_id:
            chunks = await rag_service.get_chunks_by_document(document_id)
        else:
            chunks = await rag_service.get_chunks()
        return chunks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{chunk_id}", response_model=ChunkResponse)
async def get_chunk(chunk_id: str):
    chunks = await rag_service.get_chunks()
    chunk = next((c for c in chunks if c["id"] == chunk_id), None)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return chunk
