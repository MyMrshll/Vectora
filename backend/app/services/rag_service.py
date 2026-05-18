from app.core.config import settings
from app.core.vector_store import get_vector_store
from app.core.database import supabase_client
from qdrant_client.models import Distance, VectorParams, PointStruct
from langchain_text_splitters import RecursiveCharacterTextSplitter
import httpx
import uuid
import time
import random
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Fallback in-memory database for chunks & logs
in_memory_chunks = {}
in_memory_query_logs = []

class RAGService:
    def __init__(self):
        self.collection_name = "vectora_documents"
        self._init_qdrant_collection()

    def _init_qdrant_collection(self):
        try:
            client = get_vector_store()
            # text-embedding-004 dimension is 768
            # Recreate or create if not exists
            collections = client.get_collections().collections
            exists = any(c.name == self.collection_name for c in collections)
            
            if not exists:
                client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(size=768, distance=Distance.COSINE)
                )
                logger.info(f"Qdrant collection '{self.collection_name}' created.")
        except Exception as e:
            logger.error(f"Failed to check/create Qdrant collection: {e}")

    def _is_supabase_ready(self) -> bool:
        return supabase_client is not None

    async def _get_gemini_embedding(self, text: str) -> list:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
            # Mock embedding generation (768 dimensions)
            logger.warning("GEMINI_API_KEY not set. Using mock embeddings.")
            random.seed(text)
            return [random.uniform(-0.1, 0.1) for _ in range(768)]
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "model": "models/text-embedding-004",
            "content": {
                "parts": [{"text": text}]
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(url, json=payload, timeout=10.0)
                res.raise_for_status()
                data = res.json()
                return data["embedding"]["values"]
            except Exception as e:
                logger.error(f"Failed to generate embedding from Gemini API: {e}")
                # Fallback to deterministic pseudo-random embedding so system doesn't crash
                random.seed(text)
                return [random.uniform(-0.1, 0.1) for _ in range(768)]

    async def _generate_gemini_answer(self, prompt: str) -> str:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
            logger.warning("GEMINI_API_KEY not set. Using mock LLM response.")
            return f"[MOCK ANSWER - GEMINI KEY NOT SET]\n\nBased on your RAG source documents, here is the answer: This is a synthetic response simulating Gemini's output. To get actual responses, please configure GEMINI_API_KEY in your .env file."
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(url, json=payload, timeout=15.0)
                res.raise_for_status()
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                logger.error(f"Failed to generate content from Gemini API: {e}")
                return f"[Error generating answer from Gemini: {e}]"

    async def process_and_embed(self, doc_id: str, filename: str, text: str) -> list:
        # Split text into chunks using LangChain character splitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        chunks = splitter.split_text(text)
        logger.info(f"Split document {filename} into {len(chunks)} chunks.")
        
        qdrant_client = get_vector_store()
        points = []
        chunks_metadata = []
        
        for idx, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            
            # 1. Generate embedding
            vector = await self._get_gemini_embedding(chunk)
            
            # 2. Add to Qdrant Point List
            points.append(PointStruct(
                id=chunk_id,
                vector=vector,
                payload={
                    "document_id": doc_id,
                    "filename": filename,
                    "content": chunk,
                    "chunk_index": idx
                }
            ))
            
            # 3. Add to Database chunk metadata list
            chunk_data = {
                "id": chunk_id,
                "document_id": doc_id,
                "content": chunk,
                "token_count": len(chunk.split()), # Rough token estimate
                "chunk_index": idx,
                "embedding_id": "text-embedding-004",
                "created_at": datetime.utcnow().isoformat()
            }
            chunks_metadata.append(chunk_data)

        # Upsert vectors to Qdrant
        try:
            qdrant_client.upsert(
                collection_name=self.collection_name,
                points=points
            )
            logger.info(f"Successfully upserted {len(points)} vectors into Qdrant.")
        except Exception as e:
            logger.error(f"Failed to upsert points into Qdrant: {e}")

        # Insert metadata to Supabase / In-Memory
        if self._is_supabase_ready():
            try:
                supabase_client.table("chunks").insert(chunks_metadata).execute()
            except Exception as e:
                logger.error(f"Supabase chunks insert failed: {e}")
                self._save_chunks_in_memory(doc_id, chunks_metadata)
        else:
            self._save_chunks_in_memory(doc_id, chunks_metadata)
            
        return chunks_metadata

    def _save_chunks_in_memory(self, doc_id: str, chunks: list):
        for chunk in chunks:
            in_memory_chunks[chunk["id"]] = chunk

    async def get_chunks(self) -> list:
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("chunks").select("*").execute()
                return res.data
            except Exception as e:
                logger.error(f"Failed to fetch chunks from Supabase: {e}")
        
        return list(in_memory_chunks.values())

    async def get_chunks_by_document(self, doc_id: str) -> list:
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("chunks").select("*").eq("document_id", doc_id).execute()
                return res.data
            except Exception as e:
                logger.error(f"Failed to fetch chunks for doc {doc_id}: {e}")
        
        return [c for c in in_memory_chunks.values() if c["document_id"] == doc_id]

    async def delete_from_vector_store(self, doc_id: str):
        try:
            client = get_vector_store()
            # Import Selector here or use standard qdrant client delete
            from qdrant_client.models import Filter, FieldCondition, MatchValue
            client.delete(
                collection_name=self.collection_name,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=doc_id)
                        )
                    ]
                )
            )
            logger.info(f"Deleted points for document {doc_id} from Qdrant.")
        except Exception as e:
            logger.error(f"Failed to delete points from Qdrant: {e}")

    async def query_rag(self, question: str, top_k: int = 4, temperature: float = 0.7, prompt_template: str = None) -> dict:
        start_time = time.time()
        
        # 1. Embed query
        query_vector = await self._get_gemini_embedding(question)
        
        # 2. Search Qdrant
        retrieved_chunks = []
        try:
            client = get_vector_store()
            search_results = client.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=top_k
            )
            
            for res in search_results:
                retrieved_chunks.append({
                    "content": res.payload.get("content", ""),
                    "score": res.score,
                    "source_document": res.payload.get("filename", "unknown"),
                    "chunk_index": res.payload.get("chunk_index", 0)
                })
        except Exception as e:
            logger.error(f"Failed to search vector store: {e}")
            # Mock retrieved chunks if store empty
            retrieved_chunks = [
                {
                    "content": "Ini adalah konten tiruan (mock) karena vector store Anda kosong atau koneksi Qdrant gagal.",
                    "score": 0.95,
                    "source_document": "panduan_sistem.txt",
                    "chunk_index": 0
                }
            ]

        # 3. Build Prompt
        context = "\n\n".join([f"--- Source: {c['source_document']} (Chunk {c['chunk_index']}) ---\n{c['content']}" for c in retrieved_chunks])
        
        default_template = (
            "You are a helpful AI Assistant with access to a custom RAG (Retrieval-Augmented Generation) knowledge base.\n"
            "Answer the question using the following retrieved context. If the answer cannot be found in the context, say so.\n\n"
            "Retrieved Context:\n"
            f"{context}\n\n"
            f"Question: {question}\n\n"
            "Answer:"
        )
        
        prompt = prompt_template.format(context=context, question=question) if prompt_template else default_template
        
        # 4. Generate LLM response
        answer = await self._generate_gemini_answer(prompt)
        
        latency = time.time() - start_time
        
        query_log = {
            "id": str(uuid.uuid4()),
            "question": question,
            "response": answer,
            "latency": round(latency, 2),
            "created_at": datetime.utcnow().isoformat()
        }

        # Save to logs
        if self._is_supabase_ready():
            try:
                supabase_client.table("query_logs").insert(query_log).execute()
            except Exception as e:
                logger.error(f"Failed to save query log to Supabase: {e}")
                in_memory_query_logs.append(query_log)
        else:
            in_memory_query_logs.append(query_log)

        return {
            "answer": answer,
            "retrieved_chunks": retrieved_chunks,
            "latency": round(latency, 2),
            "created_at": datetime.utcnow()
        }

    async def get_query_logs(self) -> list:
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("query_logs").select("*").order("created_at", desc=True).execute()
                return res.data
            except Exception as e:
                logger.error(f"Failed to fetch query logs from Supabase: {e}")
        
        return sorted(in_memory_query_logs, key=lambda x: x["created_at"], reverse=True)

rag_service = RAGService()
