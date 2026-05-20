from typing import List, Optional
import uuid
import logging
from app.core.database import prisma_client, _is_db_ready
from app.models.schemas import VectorDBCreate, VectorDBResponse
from qdrant_client import QdrantClient
import chromadb
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# In-memory storage fallback
in_memory_dbs = []

class VectorDBService:
    @staticmethod
    def _is_db_ready() -> bool:
        return _is_db_ready()

    @classmethod
    async def list_dbs(cls) -> List[dict]:
        if cls._is_db_ready():
            try:
                res = await prisma_client.vectordb.find_many(
                    order={"created_at": "desc"}
                )
                return [d.model_dump() if hasattr(d, 'model_dump') else d.dict() for d in res]
            except Exception as e:
                logger.error(f"Failed to fetch vector DBs from Prisma: {e}")
        
        return in_memory_dbs

    @classmethod
    async def get_db(cls, db_id: str) -> Optional[dict]:
        if cls._is_db_ready():
            try:
                d = await prisma_client.vectordb.find_unique(where={"id": db_id})
                if d:
                    return d.model_dump() if hasattr(d, 'model_dump') else d.dict()
            except Exception as e:
                logger.error(f"Failed to get vector DB {db_id} from Prisma: {e}")
        
        for d in in_memory_dbs:
            if d["id"] == db_id:
                return d
        return None

    @classmethod
    async def create_db(cls, db_data: VectorDBCreate) -> dict:
        db_id = str(uuid.uuid4())
        new_db = {
            "id": db_id,
            "name": db_data.name,
            "provider": db_data.provider.lower(),
            "url": db_data.url,
            "api_key": db_data.api_key,
            "status": "inactive",
            "created_at": None
        }
        
        from datetime import datetime
        new_db["created_at"] = datetime.utcnow()

        if cls._is_db_ready():
            try:
                res = await prisma_client.vectordb.create(
                    data={
                        "id": db_id,
                        "name": db_data.name,
                        "provider": db_data.provider.lower(),
                        "url": db_data.url,
                        "api_key": db_data.api_key,
                        "status": "inactive"
                    }
                )
                return res.model_dump() if hasattr(res, 'model_dump') else res.dict()
            except Exception as e:
                logger.error(f"Failed to create vector DB in Prisma: {e}")

        in_memory_dbs.append(new_db)
        return new_db

    @classmethod
    async def delete_db(cls, db_id: str) -> bool:
        if cls._is_db_ready():
            try:
                await prisma_client.vectordb.delete(where={"id": db_id})
                return True
            except Exception as e:
                logger.error(f"Failed to delete vector DB {db_id} from Prisma: {e}")
                return False

        initial_len = len(in_memory_dbs)
        in_memory_dbs[:] = [d for d in in_memory_dbs if d["id"] != db_id]
        return len(in_memory_dbs) < initial_len

    @classmethod
    async def activate_db(cls, db_id: str) -> Optional[dict]:
        db_config = await cls.get_db(db_id)
        if not db_config:
            raise ValueError("Vector database registry not found.")

        is_connected = await cls.test_connection(
            provider=db_config["provider"],
            url=db_config["url"],
            api_key=db_config["api_key"]
        )

        if not is_connected:
            raise RuntimeError(f"Connection test failed for {db_config['provider']} database. Cannot activate.")

        if cls._is_db_ready():
            try:
                await prisma_client.vectordb.update_many(
                    where={"status": "active"},
                    data={"status": "inactive"}
                )
                res = await prisma_client.vectordb.update(
                    where={"id": db_id},
                    data={"status": "active"}
                )
                
                from app.core.vector_store import _clients_cache
                _clients_cache.clear()
                
                return res.model_dump() if hasattr(res, 'model_dump') else res.dict()
            except Exception as e:
                logger.error(f"Failed to activate vector DB in Prisma: {e}")

        for d in in_memory_dbs:
            if d["id"] == db_id:
                d["status"] = "active"
            else:
                d["status"] = "inactive"
                
        from app.core.vector_store import _clients_cache
        _clients_cache.clear()
        
        return await cls.get_db(db_id)

    @classmethod
    async def test_connection(cls, provider: str, url: Optional[str], api_key: Optional[str]) -> bool:
        provider = provider.lower()
        try:
            if provider == "qdrant":
                if not url or url == ":memory:":
                    client = QdrantClient(location=":memory:")
                else:
                    client = QdrantClient(url=url, api_key=api_key if api_key else None)
                client.get_collections()
                return True
            elif provider == "chromadb":
                if not url:
                    return True
                elif url.startswith("http://") or url.startswith("https://"):
                    parsed = urlparse(url)
                    host = parsed.hostname or "localhost"
                    port = parsed.port or (443 if parsed.scheme == "https" else 80)
                    client = chromadb.HttpClient(
                        host=host,
                        port=port,
                        ssl=(parsed.scheme == "https"),
                        headers={"Authorization": f"Bearer {api_key}"} if api_key else None
                    )
                    client.heartbeat()
                else:
                    client = chromadb.PersistentClient(path=url)
                    client.heartbeat()
                return True
            else:
                logger.error(f"Unsupported provider: {provider}")
                return False
        except Exception as e:
            logger.error(f"Connection test failed for provider {provider} at {url}: {e}")
            return False

    @classmethod
    def get_client_for_db(cls, db_config: dict):
        from app.core.vector_store import QdrantVectorStore, ChromaVectorStore
        provider = db_config.get("provider", "").lower()
        url = db_config.get("url")
        api_key = db_config.get("api_key")
        if provider == "qdrant":
            return QdrantVectorStore(url=url, api_key=api_key)
        elif provider == "chromadb":
            return ChromaVectorStore(url=url, api_key=api_key)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

    @classmethod
    async def resolve_db_config(cls, db_id: str) -> dict:
        if db_id == "active":
            active_db = None
            if cls._is_db_ready():
                try:
                    active_db = await prisma_client.vectordb.find_first(where={"status": "active"})
                except Exception as e:
                    logger.error(f"Error querying active vector DB: {e}")
            if active_db:
                return active_db.model_dump() if hasattr(active_db, 'model_dump') else active_db.dict()
            else:
                # Return env fallback
                from app.core.config import settings
                from app.core.vector_store import fallback_collection
                return {
                    "id": "active",
                    "name": "Fallback In-Memory Store",
                    "provider": "qdrant",
                    "url": settings.QDRANT_URL if settings.QDRANT_URL else ":memory:",
                    "api_key": settings.QDRANT_API_KEY,
                    "status": "active",
                    "active_collection": fallback_collection
                }
        
        db_config = await cls.get_db(db_id)
        if not db_config:
            raise ValueError(f"Vector DB with ID {db_id} not found.")
        return db_config

    @classmethod
    async def list_collections(cls, db_id: str) -> List[str]:
        db_config = await cls.resolve_db_config(db_id)
        client = cls.get_client_for_db(db_config)
        return client.list_collections()

    @classmethod
    async def create_collection(cls, db_id: str, collection_name: str) -> bool:
        db_config = await cls.resolve_db_config(db_id)
        client = cls.get_client_for_db(db_config)
        client.init_collection(collection_name, size=768)
        return True

    @classmethod
    async def activate_collection(cls, db_id: str, collection_name: str) -> dict:
        # Update in database if ready
        db_config = await cls.resolve_db_config(db_id)
        
        # Verify collection exists first
        client = cls.get_client_for_db(db_config)
        collections = client.list_collections()
        if collection_name not in collections:
            # Auto-initialize the collection to be safe
            client.init_collection(collection_name, size=768)
        
        actual_id = db_config.get("id")
        
        if cls._is_db_ready() and actual_id != "active" and actual_id != "fallback":
            try:
                res = await prisma_client.vectordb.update(
                    where={"id": actual_id},
                    data={"active_collection": collection_name}
                )
                
                from app.core.vector_store import _clients_cache
                _clients_cache.clear()
                
                return res.model_dump() if hasattr(res, 'model_dump') else res.dict()
            except Exception as e:
                logger.error(f"Failed to update active collection in Prisma: {e}")
        
        # Fallback to local memory / fallback configuration
        from app.core.vector_store import _clients_cache
        import app.core.vector_store as vs
        vs.fallback_collection = collection_name
        _clients_cache.clear()
        
        # Update the fallback/in_memory storage list if applicable
        for d in in_memory_dbs:
            if d["id"] == actual_id:
                d["active_collection"] = collection_name
                
        db_config["active_collection"] = collection_name
        return db_config
