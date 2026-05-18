from supabase import create_client, Client
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

supabase_client: Client = None

try:
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    else:
        logger.warning("Supabase credentials not fully configured. Database operations will fail.")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")

def get_db():
    if not supabase_client:
        raise RuntimeError("Supabase client is not initialized. Please configure SUPABASE_URL and SUPABASE_KEY.")
    return supabase_client
