from fastapi import APIRouter, HTTPException
from app.models.schemas import AIModelResponse, AIModelCreate
from app.core.database import supabase_client
from typing import List
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Default models
default_models = [
    {
        "id": "gemini-1.5-flash",
        "provider": "google",
        "model_name": "gemini-1.5-flash",
        "type": "llm",
        "status": "active",
        "dimension": None,
        "api_endpoint": "https://generativelanguage.googleapis.com"
    },
    {
        "id": "text-embedding-004",
        "provider": "google",
        "model_name": "text-embedding-004",
        "type": "embedding",
        "status": "active",
        "dimension": 768,
        "api_endpoint": "https://generativelanguage.googleapis.com"
    }
]

configured_models = []

def _is_supabase_ready() -> bool:
    return supabase_client is not None

@router.get("/", response_model=List[AIModelResponse])
async def get_models():
    try:
        if _is_supabase_ready():
            try:
                res = supabase_client.table("models").select("*").execute()
                # merge defaults with table records
                db_models = res.data
                model_ids = {m["id"] for m in db_models}
                merged = db_models + [m for m in default_models if m["id"] not in model_ids]
                return merged
            except Exception as e:
                logger.error(f"Failed to fetch models from Supabase: {e}")
        
        return default_models + configured_models
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=AIModelResponse)
async def create_model(model: AIModelCreate):
    try:
        model_id = str(uuid.uuid4())
        model_data = {
            "id": model_id,
            "provider": model.provider,
            "model_name": model.model_name,
            "type": model.type,
            "status": "active",
            "dimension": 768 if model.type == "embedding" else None,
            "api_endpoint": model.api_endpoint
        }
        
        if _is_supabase_ready():
            try:
                res = supabase_client.table("models").insert(model_data).execute()
                if len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Failed to save model to Supabase: {e}")
                
        configured_models.append(model_data)
        return model_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
