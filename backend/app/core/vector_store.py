from qdrant_client import QdrantClient
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

qdrant_client: QdrantClient = None

try:
    if settings.QDRANT_URL == ":memory:":
        qdrant_client = QdrantClient(location=":memory:")
        logger.info("Qdrant client initialized in-memory.")
    elif settings.QDRANT_URL:
        qdrant_client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY if settings.QDRANT_API_KEY else None
        )
        logger.info(f"Qdrant client initialized at {settings.QDRANT_URL}")
    else:
        logger.warning("Qdrant URL not configured. Vector operations will fail.")
except Exception as e:
    logger.error(f"Failed to initialize Qdrant client: {e}")

def get_vector_store():
    if not qdrant_client:
        raise RuntimeError("Qdrant client is not initialized. Please configure QDRANT_URL.")
    return qdrant_client
