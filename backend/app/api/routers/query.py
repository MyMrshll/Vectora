from fastapi import APIRouter, HTTPException
from app.services.rag_service import rag_service
from app.models.schemas import QueryRequest, QueryResponse
from typing import List, Dict, Any

router = APIRouter()

@router.post("/", response_model=QueryResponse)
async def query_rag(request: QueryRequest):
    try:
        res = await rag_service.query_rag(
            question=request.question,
            top_k=request.top_k,
            temperature=request.temperature,
            prompt_template=request.prompt_template
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_query_logs():
    try:
        logs = await rag_service.get_query_logs()
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
