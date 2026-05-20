from app.core.database import prisma_client, _is_db_ready
from app.core.vector_store import get_vector_store
from app.models.schemas import DocumentResponse, DocumentCreate
from app.services.rag_service import rag_service
from fastapi import UploadFile, BackgroundTasks
import uuid
import time
from datetime import datetime
import logging
import json
import csv
import io
import xml.etree.ElementTree as ET

logger = logging.getLogger(__name__)

# Fallback in-memory database for testing when DB is not configured
in_memory_docs = {}
in_memory_chunks = {}

def parse_json_scraped(content_bytes: bytes) -> str:
    """
    Parses JSON scraped datasets.
    Extracts text, content, body, description for 'content'.
    Extracts title, name, headline for 'title'.
    Extracts url, link, source for 'url'.
    """
    try:
        data = json.loads(content_bytes.decode("utf-8-sig", errors="ignore"))
    except Exception as e:
        raise ValueError(f"Invalid JSON format: {e}")
        
    records = []
    
    # helper to clean dict and extract keys
    def extract_from_dict(d: dict) -> dict:
        content = ""
        title = ""
        url = ""
        
        # look for content/text/body
        content_keys = ["content", "text", "body", "scraped_data", "description", "article", "payload"]
        for k in content_keys:
            val = next((d[x] for x in d if x.lower() == k), None)
            if val is not None:
                content = str(val).strip()
                break
        
        # look for title
        title_keys = ["title", "name", "headline", "subject"]
        for k in title_keys:
            val = next((d[x] for x in d if x.lower() == k), None)
            if val is not None:
                title = str(val).strip()
                break
                
        # look for url
        url_keys = ["url", "link", "source", "uri", "origin"]
        for k in url_keys:
            val = next((d[x] for x in d if x.lower() == k), None)
            if val is not None:
                url = str(val).strip()
                break
                
        # Fallback: if keys are completely different, look for largest text string
        if not content:
            # Sort keys by string length of values
            candidates = []
            for k, val in d.items():
                if isinstance(val, str):
                    candidates.append((k, val))
            if candidates:
                # take the longest string as content
                candidates.sort(key=lambda x: len(x[1]), reverse=True)
                content = candidates[0][1].strip()
                # take first other key as title if empty
                if not title and len(candidates) > 1:
                    title = f"{candidates[1][0]}: {candidates[1][1][:50]}"
        
        return {"title": title, "url": url, "content": content}

    # case 1: It is a list of records
    if isinstance(data, list):
        for idx, item in enumerate(data):
            if isinstance(item, dict):
                rec = extract_from_dict(item)
                if rec["content"]:
                    records.append(rec)
            elif isinstance(item, str):
                records.append({"title": f"Item {idx+1}", "url": "", "content": item.strip()})
    # case 2: It is a single record
    elif isinstance(data, dict):
        # check if there's a list nested under a 'records' / 'items' / 'data' / 'scraped' key
        nested_list = None
        for k in ["records", "items", "data", "scraped", "results", "pages"]:
            if k in data and isinstance(data[k], list):
                nested_list = data[k]
                break
        
        if nested_list:
            for idx, item in enumerate(nested_list):
                if isinstance(item, dict):
                    rec = extract_from_dict(item)
                    if rec["content"]:
                        records.append(rec)
                elif isinstance(item, str):
                    records.append({"title": f"Item {idx+1}", "url": "", "content": item.strip()})
        else:
            rec = extract_from_dict(data)
            if rec["content"]:
                records.append(rec)
                
    if not records:
        raise ValueError("Invalid scraped JSON format. No valid scraped records (missing keys like content, text, body, or description) were found.")
        
    # Format all records
    formatted_parts = []
    for idx, rec in enumerate(records):
        title_str = rec["title"] or f"Scraped Record {idx+1}"
        url_str = rec["url"] or "N/A"
        formatted_parts.append(
            f"Title: {title_str}\n"
            f"Source: {url_str}\n"
            f"Content: {rec['content']}"
        )
        
    return "\n\n---\n\n".join(formatted_parts)

def parse_csv_scraped(content_bytes: bytes) -> str:
    """
    Parses CSV scraped datasets.
    Maps columns case-insensitively.
    """
    try:
        csv_text = content_bytes.decode("utf-8-sig", errors="ignore")
    except Exception as e:
        raise ValueError(f"Invalid text encoding in CSV: {e}")
        
    # Use StringIO and DictReader
    f = io.StringIO(csv_text)
    reader = csv.DictReader(f)
    
    if not reader.fieldnames:
        raise ValueError("CSV file has no columns/headers.")
        
    fieldnames = reader.fieldnames
    
    # Identify key columns case-insensitively
    content_col = None
    title_col = None
    url_col = None
    
    content_keys = ["content", "text", "body", "scraped_data", "description", "article", "payload", "scraped_text"]
    title_keys = ["title", "name", "headline", "subject"]
    url_keys = ["url", "link", "source", "uri", "origin"]
    
    for f_name in fieldnames:
        f_lower = f_name.lower().strip()
        if not content_col and f_lower in content_keys:
            content_col = f_name
        if not title_col and f_lower in title_keys:
            title_col = f_name
        if not url_col and f_lower in url_keys:
            url_col = f_name
            
    # Fallback if no matching columns found
    if not content_col:
        # Fallback to the column with the longest name or values, or just take the last column
        content_col = fieldnames[-1]
    if not title_col:
        # take the first column that isn't the content or url
        for f_name in fieldnames:
            if f_name != content_col and f_name != url_col:
                title_col = f_name
                break
        if not title_col:
            title_col = fieldnames[0]
            
    records = []
    for idx, row in enumerate(reader):
        content_val = row.get(content_col, "").strip() if content_col else ""
        title_val = row.get(title_col, "").strip() if title_col else ""
        url_val = row.get(url_col, "").strip() if url_col else ""
        
        # If both title and content are empty, just serialize the entire row
        if not content_val and not title_val:
            row_vals = [f"{k}: {v}" for k, v in row.items() if v]
            content_val = ", ".join(row_vals)
            title_val = f"Row {idx+1}"
            
        records.append({
            "title": title_val or f"Row {idx+1}",
            "url": url_val or "N/A",
            "content": content_val
        })
        
    if not records:
        raise ValueError("Invalid scraped CSV format. No records found in the CSV file.")
        
    formatted_parts = []
    for rec in records:
        formatted_parts.append(
            f"Title: {rec['title']}\n"
            f"Source: {rec['url']}\n"
            f"Content: {rec['content']}"
        )
        
    return "\n\n---\n\n".join(formatted_parts)

def parse_xml_scraped(content_bytes: bytes) -> str:
    """
    Parses XML scraped datasets.
    Searches for container elements (like <item>, <entry>, <page>) or just extracts tags.
    """
    try:
        # Handle namespaces or invalid characters gracefully
        xml_text = content_bytes.decode("utf-8-sig", errors="ignore")
        root = ET.fromstring(xml_text)
    except Exception as e:
        raise ValueError(f"Invalid XML format: {e}")
        
    records = []
    
    # Helper to strip namespace from tags
    def strip_ns(tag):
        if tag.startswith("{"):
            return tag.split("}", 1)[1]
        return tag

    def extract_from_element(elem) -> dict:
        content = ""
        title = ""
        url = ""
        
        content_keys = ["content", "text", "body", "description", "summary"]
        title_keys = ["title", "name", "headline", "subject"]
        url_keys = ["url", "link", "source", "uri", "loc"]
        
        # Check direct child elements
        for child in elem:
            tag_name = strip_ns(child.tag).lower()
            child_text = (child.text or "").strip()
            
            if tag_name in content_keys:
                content = child_text
            elif tag_name in title_keys:
                title = child_text
            elif tag_name in url_keys:
                url = child_text
                
        # Also check attributes
        for attr_k, attr_v in elem.attrib.items():
            attr_lower = strip_ns(attr_k).lower()
            if attr_lower in content_keys and not content:
                content = attr_v.strip()
            elif attr_lower in title_keys and not title:
                title = attr_v.strip()
            elif attr_lower in url_keys and not url:
                url = attr_v.strip()
                
        # Fallback if content is empty: accumulate all child element texts
        if not content:
            child_texts = []
            for child in elem:
                c_text = (child.text or "").strip()
                if c_text:
                    child_texts.append(f"{strip_ns(child.tag)}: {c_text}")
            if child_texts:
                content = "\n".join(child_texts)
                
        return {"title": title, "url": url, "content": content}

    # Find elements that look like record containers recursively
    container_tags = ["item", "entry", "page", "row", "doc", "document", "record", "article"]
    
    containers = []
    for elem in root.iter():
        tag_name = strip_ns(elem.tag).lower()
        if tag_name in container_tags:
            containers.append(elem)
            
    if containers:
        for idx, elem in enumerate(containers):
            rec = extract_from_element(elem)
            if rec["content"]:
                records.append(rec)
    else:
        # If no containers, check if the root itself is a document or page
        rec = extract_from_element(root)
        if rec["content"]:
            records.append(rec)
        else:
            # Fallback to extracting all tag-value text recursively
            text_parts = []
            for elem in root.iter():
                elem_text = (elem.text or "").strip()
                if elem_text:
                    text_parts.append(f"{strip_ns(elem.tag)}: {elem_text}")
            if text_parts:
                records.append({
                    "title": strip_ns(root.tag),
                    "url": "N/A",
                    "content": "\n".join(text_parts)
                })
                
    if not records:
        raise ValueError("Invalid scraped XML format. No valid records or elements found in the XML file.")
        
    formatted_parts = []
    for idx, rec in enumerate(records):
        title_str = rec["title"] or f"Scraped Entry {idx+1}"
        url_str = rec["url"] or "N/A"
        formatted_parts.append(
            f"Title: {title_str}\n"
            f"Source: {url_str}\n"
            f"Content: {rec['content']}"
        )
        
    return "\n\n---\n\n".join(formatted_parts)

class DocumentService:
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
        }

        # Save to database
        if _is_db_ready():
            try:
                res = await prisma_client.document.create(data=doc_data)
                doc_data = res.model_dump() if hasattr(res, 'model_dump') else res.dict()
                # Ensure datetime objects are converted to ISO format strings to match previous behavior
                if isinstance(doc_data.get("created_at"), datetime):
                    doc_data["created_at"] = doc_data["created_at"].isoformat()
                if isinstance(doc_data.get("updated_at"), datetime):
                    doc_data["updated_at"] = doc_data["updated_at"].isoformat()
            except Exception as e:
                logger.error(f"Prisma insert failed, using fallback in-memory: {e}")
                doc_data["created_at"] = created_at.isoformat()
                doc_data["updated_at"] = created_at.isoformat()
                in_memory_docs[doc_id] = doc_data
        else:
            doc_data["created_at"] = created_at.isoformat()
            doc_data["updated_at"] = created_at.isoformat()
            in_memory_docs[doc_id] = doc_data

        # Trigger async pipeline processing
        background_tasks.add_task(self._process_document, doc_id, filename, content)
        
        return doc_data

    async def _process_document(self, doc_id: str, filename: str, content: bytes):
        try:
            file_ext = filename.split(".")[-1].lower()
            text = ""
            
            if file_ext == "json":
                text = parse_json_scraped(content)
            elif file_ext == "csv":
                text = parse_csv_scraped(content)
            elif file_ext == "xml":
                text = parse_xml_scraped(content)
            else:
                raise ValueError(f"Unsupported file format '{file_ext}'. Only scraped datasets in JSON, XML, and CSV formats are supported.")
            
            if not text.strip():
                raise ValueError("Parsed document content is empty.")
                
            # Process with RAG Service
            chunks_data = await rag_service.process_and_embed(doc_id, filename, text)
            
            # Update doc status
            await self._update_doc_status(doc_id, "completed")
            logger.info(f"Successfully processed document {doc_id}")
            
        except Exception as e:
            logger.error(f"Failed to process document {doc_id}: {e}")
            await self._update_doc_status(doc_id, "failed")

    async def _update_doc_status(self, doc_id: str, status: str):
        updated_at = datetime.utcnow()
        if _is_db_ready():
            try:
                await prisma_client.document.update(
                    where={"id": doc_id},
                    data={"status": status, "updated_at": updated_at}
                )
                return
            except Exception as e:
                logger.error(f"Failed to update document status in Prisma: {e}")
        
        if doc_id in in_memory_docs:
            in_memory_docs[doc_id]["status"] = status
            in_memory_docs[doc_id]["updated_at"] = updated_at.isoformat()

    async def get_documents(self) -> list:
        if _is_db_ready():
            try:
                res = await prisma_client.document.find_many(order={"created_at": "desc"})
                return [doc.model_dump() if hasattr(doc, 'model_dump') else doc.dict() for doc in res]
            except Exception as e:
                logger.error(f"Failed to fetch documents from Prisma, returning in-memory: {e}")
        
        return list(in_memory_docs.values())

    async def get_document(self, doc_id: str) -> dict:
        if _is_db_ready():
            try:
                res = await prisma_client.document.find_unique(where={"id": doc_id})
                if res:
                    return res.model_dump() if hasattr(res, 'model_dump') else res.dict()
            except Exception as e:
                logger.error(f"Failed to fetch document {doc_id} from Prisma: {e}")
        
        return in_memory_docs.get(doc_id)

    async def delete_document(self, doc_id: str) -> bool:
        # Delete from Qdrant vector store
        try:
            await rag_service.delete_from_vector_store(doc_id)
        except Exception as e:
            logger.error(f"Failed to delete vectors for doc {doc_id}: {e}")

        # Delete from database
        db_success = False
        if _is_db_ready():
            try:
                # Chunks are deleted automatically due to Cascade delete in Prisma schema
                res = await prisma_client.document.delete(where={"id": doc_id})
                db_success = res is not None
            except Exception as e:
                logger.error(f"Failed to delete document from Prisma: {e}")
        
        in_memory_success = False
        if doc_id in in_memory_docs:
            del in_memory_docs[doc_id]
            # remove from in-memory chunks
            keys_to_remove = [k for k, v in in_memory_chunks.items() if v["document_id"] == doc_id]
            for k in keys_to_remove:
                del in_memory_chunks[k]
            in_memory_success = True

        return db_success or in_memory_success

document_service = DocumentService()
