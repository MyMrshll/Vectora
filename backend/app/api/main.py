from fastapi import APIRouter
from app.api.routers import documents, chunks, query, models, vector_dbs

api_router = APIRouter()

api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(chunks.router, prefix="/chunks", tags=["Chunks"])
api_router.include_router(query.router, prefix="/query", tags=["Query"])
api_router.include_router(models.router, prefix="/models", tags=["Models"])
api_router.include_router(vector_dbs.router, prefix="/vector-dbs", tags=["Vector Databases"])
