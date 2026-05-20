from fastapi import APIRouter, HTTPException
from app.models.schemas import AIModelResponse, AIModelCreate
from app.core.database import prisma_client
from typing import List
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Default models
default_models = [
    {
        "id": "gemini-2.5-flash",
        "provider": "google",
        "model_name": "gemini-2.5-flash",
        "type": "llm",
        "status": "active",
        "dimension": None,
        "api_endpoint": "https://generativelanguage.googleapis.com"
    },
    {
        "id": "gemini-embedding-001",
        "provider": "google",
        "model_name": "gemini-embedding-001",
        "type": "embedding",
        "status": "active",
        "dimension": 1536,
        "api_endpoint": "https://generativelanguage.googleapis.com"
    }
]

@router.get("/", response_model=List[AIModelResponse])
async def get_models():
    try:
        if prisma_client.is_connected():
            try:
                db_models = await prisma_client.aimodel.find_many()
                # merge defaults with table records
                db_model_dicts = [m.model_dump() for m in db_models]
                model_ids = {m["id"] for m in db_model_dicts}
                merged = db_model_dicts + [m for m in default_models if m["id"] not in model_ids]
                return merged
            except Exception as e:
                logger.error(f"Failed to fetch models from Prisma: {e}")
        
        return default_models
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
            "dimension": 1536 if model.type == "embedding" else None,
            "api_endpoint": model.api_endpoint
        }
        
        if prisma_client.is_connected():
            try:
                saved_model = await prisma_client.aimodel.create(data=model_data)
                return saved_model.model_dump()
            except Exception as e:
                logger.error(f"Failed to save model to Prisma: {e}")
                
        return model_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
