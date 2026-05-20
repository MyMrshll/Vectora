from prisma import Prisma
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

prisma_client = Prisma()

# To use prisma in your code, you can just import `prisma_client` from this module.
# The `connect` and `disconnect` should be handled in FastAPI lifespan events in main.py.

def _is_db_ready() -> bool:
    # Prisma is connected when `prisma_client.is_connected()` returns True
    return prisma_client.is_connected()
