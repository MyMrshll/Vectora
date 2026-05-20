from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import logging
from urllib.parse import urlparse
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
import chromadb
from chromadb.config import Settings as ChromaSettings
from app.core.config import settings
from app.core.database import prisma_client, _is_db_ready

logger = logging.getLogger(__name__)

fallback_collection = "vectora_documents"

class VectorStoreResult:
    def __init__(self, id: str, payload: dict, score: float):
        self.id = id
        self.payload = payload
        self.score = score

class BaseVectorStore(ABC):
    @abstractmethod
    def init_collection(self, collection_name: str, size: int = 768):
        pass

    @abstractmethod
    def list_collections(self) -> List[str]:
        pass

    @abstractmethod
    def upsert(self, collection_name: str, points: list):
        pass

    @abstractmethod
    def search(self, collection_name: str, query_vector: list, limit: int = 4) -> List[Any]:
        pass

    @abstractmethod
    def delete(self, collection_name: str, document_id: str):
        pass

    @abstractmethod
    def get_collection_dimension(self, collection_name: str) -> int:
        pass

class QdrantVectorStore(BaseVectorStore):
    def __init__(self, url: str = None, api_key: str = None):
        if not url or url == ":memory:":
            self.client = QdrantClient(location=":memory:")
            logger.info("Qdrant client initialized in-memory.")
        else:
            self.client = QdrantClient(
                url=url,
                api_key=api_key if api_key else None
            )
            logger.info(f"Qdrant client initialized at {url}")

    def list_collections(self) -> List[str]:
        try:
            collections = self.client.get_collections().collections
            return [c.name for c in collections]
        except Exception as e:
            logger.error(f"Failed to list Qdrant collections: {e}")
            return []

    def get_collection_dimension(self, collection_name: str) -> int:
        try:
            info = self.client.get_collection(collection_name)
            return info.config.params.vectors.size
        except Exception as e:
            logger.error(f"Failed to get collection dimension for Qdrant '{collection_name}': {e}")
            return 768  # Fallback default

    def init_collection(self, collection_name: str, size: int = 768):
        try:
            collections = self.client.get_collections().collections
            exists = any(c.name == collection_name for c in collections)
            if not exists:
                self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=VectorParams(size=size, distance=Distance.COSINE)
                )
                logger.info(f"Qdrant collection '{collection_name}' created.")
        except Exception as e:
            logger.error(f"Failed to check/create Qdrant collection: {e}")
            raise e

    def upsert(self, collection_name: str, points: list):
        self.client.upsert(
            collection_name=collection_name,
            points=points
        )

    def search(self, collection_name: str, query_vector: list, limit: int = 4) -> List[Any]:
        try:
            response = self.client.query_points(
                collection_name=collection_name,
                query=query_vector,
                limit=limit
            )
            results = []
            for point in response.points:
                results.append(VectorStoreResult(
                    id=str(point.id),
                    payload=point.payload or {},
                    score=point.score or 0.0
                ))
            return results
        except Exception as e:
            logger.error(f"Error querying Qdrant points: {e}")
            raise e

    def delete(self, collection_name: str, document_id: str):
        self.client.delete(
            collection_name=collection_name,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id)
                    )
                ]
            )
        )

class ChromaVectorStore(BaseVectorStore):
    def __init__(self, url: str = None, api_key: str = None):
        if not url:
            self.client = chromadb.Client(ChromaSettings(anonymized_telemetry=False))
            logger.info("ChromaDB initialized in-memory.")
        elif url.startswith("http://") or url.startswith("https://"):
            parsed = urlparse(url)
            host = parsed.hostname or "localhost"
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            self.client = chromadb.HttpClient(
                host=host,
                port=port,
                ssl=(parsed.scheme == "https"),
                headers={"Authorization": f"Bearer {api_key}"} if api_key else None
            )
            logger.info(f"ChromaDB HttpClient initialized at {url}")
        else:
            self.client = chromadb.PersistentClient(path=url)
            logger.info(f"ChromaDB PersistentClient initialized at path: {url}")

    def list_collections(self) -> List[str]:
        try:
            collections = self.client.get_collections().collections if hasattr(self.client, "get_collections") else self.client.list_collections()
            return [c.name for c in collections]
        except Exception as e:
            logger.error(f"Failed to list ChromaDB collections: {e}")
            return []

    def get_collection_dimension(self, collection_name: str) -> int:
        # ChromaDB collections are dimension-agnostic prior to writing data.
        # We return a standard default of 768.
        return 768

    def init_collection(self, collection_name: str, size: int = 768):
        self.client.get_or_create_collection(name=collection_name, metadata={"hnsw:space": "cosine"})

    def upsert(self, collection_name: str, points: list):
        collection = self.client.get_or_create_collection(name=collection_name)
        ids = [p.id for p in points]
        embeddings = [p.vector for p in points]
        metadatas = [p.payload for p in points]
        documents = [p.payload.get("content", "") for p in points]
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            metadatas=metadatas,
            documents=documents
        )

    def search(self, collection_name: str, query_vector: list, limit: int = 4) -> List[Any]:
        collection = self.client.get_or_create_collection(name=collection_name)
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=limit
        )
        scored_points = []
        if results and "ids" in results and len(results["ids"]) > 0:
            ids = results["ids"][0]
            metadatas = results["metadatas"][0] if "metadatas" in results else []
            distances = results["distances"][0] if "distances" in results else []
            for i in range(len(ids)):
                payload = metadatas[i] if i < len(metadatas) else {}
                dist = distances[i] if i < len(distances) else 0.0
                score = 1.0 - dist if dist is not None else 1.0
                scored_points.append(VectorStoreResult(id=ids[i], payload=payload, score=score))
        return scored_points

    def delete(self, collection_name: str, document_id: str):
        collection = self.client.get_or_create_collection(name=collection_name)
        collection.delete(where={"document_id": document_id})

# Local cache for initialized client instances
_clients_cache: Dict[str, BaseVectorStore] = {}

async def get_active_vector_store() -> BaseVectorStore:
    active_db = None
    if _is_db_ready():
        try:
            active_db = await prisma_client.vectordb.find_first(
                where={"status": "active"}
            )
        except Exception as e:
            logger.error(f"Error querying active vector DB: {e}")

    if active_db:
        provider = active_db.provider.lower()
        url = active_db.url
        api_key = active_db.api_key
        cache_key = f"{provider}:{url}:{api_key}"
    else:
        # Fallback to .env Qdrant configuration
        provider = "qdrant"
        url = settings.QDRANT_URL if settings.QDRANT_URL else ":memory:"
        api_key = settings.QDRANT_API_KEY
        cache_key = f"env:{provider}:{url}:{api_key}"

    if cache_key in _clients_cache:
        return _clients_cache[cache_key]

    try:
        if provider == "qdrant":
            store = QdrantVectorStore(url=url, api_key=api_key)
        elif provider == "chromadb":
            store = ChromaVectorStore(url=url, api_key=api_key)
        else:
            raise ValueError(f"Unsupported vector DB provider: {provider}")
        
        _clients_cache[cache_key] = store
        return store
    except Exception as e:
        logger.error(f"Failed to initialize active vector store {provider} ({url}): {e}")
        # Absolute fallback to in-memory Qdrant store to prevent crash
        fallback_key = "fallback:qdrant:in-memory"
        if fallback_key not in _clients_cache:
            _clients_cache[fallback_key] = QdrantVectorStore(url=":memory:")
        return _clients_cache[fallback_key]

# Deprecated but kept for backwards compatibility
def get_vector_store():
    # Synchronously attempts to get or create an in-memory client
    fallback_key = "fallback:qdrant:in-memory"
    if fallback_key not in _clients_cache:
        _clients_cache[fallback_key] = QdrantVectorStore(url=":memory:")
    return _clients_cache[fallback_key]
