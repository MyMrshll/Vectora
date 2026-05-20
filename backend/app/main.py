from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api.main import api_router
from app.core.config import settings
from app.core.database import prisma_client
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Connecting to Prisma database...")
    try:
        await prisma_client.connect()
        logger.info("Successfully connected to Prisma database.")
    except Exception as e:
        logger.error(f"Failed to connect to Prisma database: {e}")
    
    yield
    
    logger.info("Disconnecting from Prisma database...")
    if prisma_client.is_connected():
        await prisma_client.disconnect()
        logger.info("Successfully disconnected from Prisma.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API backend for Vectora (RAG Admin Platform)",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware for Next.js frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the centralized API router
app.include_router(api_router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
