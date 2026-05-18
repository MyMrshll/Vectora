from app.core.database import supabase_client
from app.core.vector_store import get_vector_store
from app.models.schemas import DocumentResponse, DocumentCreate
from app.services.rag_service import rag_service
from fastapi import UploadFile, BackgroundTasks
import uuid
import time
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Fallback in-memory database for testing when Supabase is not configured
in_memory_docs = {}
in_memory_chunks = {}

class DocumentService:
    def _is_supabase_ready(self) -> bool:
        return supabase_client is not None

    async def upload_document(self, file: UploadFile, background_tasks: BackgroundTasks) -> dict:
        filename = file.filename
        content = await file.read()
        size = len(content)
        
        doc_id = str(uuid.uuid4())
        created_at = datetime.utcnow()
        
        doc_data = {
            "id": doc_id,
            "filename": filename,
            "source": "upload",
            "size": size,
            "status": "processing",
            "created_at": created_at.isoformat(),
            "updated_at": created_at.isoformat()
        }

        # Save to database
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("documents").insert(doc_data).execute()
                if len(res.data) > 0:
                    doc_data = res.data[0]
            except Exception as e:
                logger.error(f"Supabase insert failed, using fallback in-memory: {e}")
                in_memory_docs[doc_id] = doc_data
        else:
            in_memory_docs[doc_id] = doc_data

        # Trigger async pipeline processing
        background_tasks.add_task(self._process_document, doc_id, filename, content)
        
        return doc_data

    async def _process_document(self, doc_id: str, filename: str, content: bytes):
        try:
            # Decode file content (assuming text for MVP)
            # In a real app we might use pdf plumper or python-docx
            text = ""
            try:
                text = content.decode("utf-8")
            except UnicodeDecodeError:
                # If binary, placeholder or fallback
                text = f"[Binary File: {filename}] Size: {len(content)} bytes. Support for PDF/DOCX parsing is mock."
            
            # Process with RAG Service
            chunks_data = await rag_service.process_and_embed(doc_id, filename, text)
            
            # Update doc status
            self._update_doc_status(doc_id, "completed")
            logger.info(f"Successfully processed document {doc_id}")
            
        except Exception as e:
            logger.error(f"Failed to process document {doc_id}: {e}")
            self._update_doc_status(doc_id, "failed")

    def _update_doc_status(self, doc_id: str, status: str):
        updated_at = datetime.utcnow().isoformat()
        if self._is_supabase_ready():
            try:
                supabase_client.table("documents").update({
                    "status": status,
                    "updated_at": updated_at
                }).eq("id", doc_id).execute()
                return
            except Exception as e:
                logger.error(f"Failed to update document status in Supabase: {e}")
        
        if doc_id in in_memory_docs:
            in_memory_docs[doc_id]["status"] = status
            in_memory_docs[doc_id]["updated_at"] = updated_at

    async def get_documents(self) -> list:
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("documents").select("*").order("created_at", desc=True).execute()
                return res.data
            except Exception as e:
                logger.error(f"Failed to fetch documents from Supabase, returning in-memory: {e}")
        
        return list(in_memory_docs.values())

    async def get_document(self, doc_id: str) -> dict:
        if self._is_supabase_ready():
            try:
                res = supabase_client.table("documents").select("*").eq("id", doc_id).execute()
                if len(res.data) > 0:
                    return res.data[0]
            except Exception as e:
                logger.error(f"Failed to fetch document {doc_id} from Supabase: {e}")
        
        return in_memory_docs.get(doc_id)

    async def delete_document(self, doc_id: str) -> bool:
        # Delete from Qdrant vector store
        try:
            await rag_service.delete_from_vector_store(doc_id)
        except Exception as e:
            logger.error(f"Failed to delete vectors for doc {doc_id}: {e}")

        # Delete from database
        supabase_success = False
        if self._is_supabase_ready():
            try:
                # Delete chunks metadata
                supabase_client.table("chunks").delete().eq("document_id", doc_id).execute()
                # Delete document
                res = supabase_client.table("documents").delete().eq("id", doc_id).execute()
                supabase_success = len(res.data) > 0
            except Exception as e:
                logger.error(f"Failed to delete document from Supabase: {e}")
        
        in_memory_success = False
        if doc_id in in_memory_docs:
            del in_memory_docs[doc_id]
            # remove from in-memory chunks
            keys_to_remove = [k for k, v in in_memory_chunks.items() if v["document_id"] == doc_id]
            for k in keys_to_remove:
                del in_memory_chunks[k]
            in_memory_success = True

        return supabase_success or in_memory_success

document_service = DocumentService()
