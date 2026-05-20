from pydantic_settings import BaseSettings
from typing import Optional
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vectora API"
    DEBUG: bool = True
    
    # Supabase Credentials
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    DATABASE_URL: str = ""

    
    # Qdrant Credentials
    QDRANT_URL: str = ":memory:"
    QDRANT_API_KEY: Optional[str] = None
    
    # Gemini API Key
    GEMINI_API_KEY: str = ""

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        case_sensitive = True
        extra = "ignore"

settings = Settings()
