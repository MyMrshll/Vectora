from app.core.config import settings
from app.core.database import prisma_client, _is_db_ready
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
in_memory_entities = {}
in_memory_relations = {}

class RAGService:
    def __init__(self):
        self.collection_name = "vectora_documents"

    async def _get_store(self):
        from app.core.vector_store import get_active_vector_store, fallback_collection
        store = await get_active_vector_store()
        
        # Dynamically resolve active collection
        self.collection_name = fallback_collection
        if self._is_db_ready():
            try:
                active_db = await prisma_client.vectordb.find_first(where={"status": "active"})
                if active_db and getattr(active_db, "active_collection", None):
                    self.collection_name = active_db.active_collection
            except Exception as e:
                logger.error(f"Error resolving active collection from db: {e}")
        
        try:
            store.init_collection(self.collection_name, size=1536)
        except Exception as e:
            logger.error(f"Failed to auto-initialize collection '{self.collection_name}': {e}")
        return store

    def _is_db_ready(self) -> bool:
        return _is_db_ready()

    async def _get_gemini_embedding(self, text: str, dimensionality: int = 1536) -> list:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
            # Mock embedding generation (dimensionality dimensions)
            logger.warning(f"GEMINI_API_KEY not set. Using mock embeddings with dimension {dimensionality}.")
            random.seed(text)
            return [random.uniform(-0.1, 0.1) for _ in range(dimensionality)]
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "model": "models/gemini-embedding-001",
            "content": {
                "parts": [{"text": text}]
            },
            "outputDimensionality": dimensionality
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
                return [random.uniform(-0.1, 0.1) for _ in range(dimensionality)]

    async def _generate_gemini_answer(self, prompt: str) -> str:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
            logger.warning("GEMINI_API_KEY not set. Using mock LLM response.")
            return f"[MOCK ANSWER - GEMINI KEY NOT SET]\n\nBased on your RAG source documents, here is the answer: This is a synthetic response simulating Gemini's output. To get actual responses, please configure GEMINI_API_KEY in your .env file."
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
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
        
        store = await self._get_store()
        dimension = store.get_collection_dimension(self.collection_name)
        logger.info(f"Using dimension {dimension} for collection '{self.collection_name}'")
        points = []
        chunks_metadata = []
        
        for idx, chunk in enumerate(chunks):
            chunk_id = str(uuid.uuid4())
            
            # 1. Generate embedding
            vector = await self._get_gemini_embedding(chunk, dimensionality=dimension)
            
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
                "embedding_id": "gemini-embedding-001",
                "created_at": datetime.utcnow()
            }
            chunks_metadata.append(chunk_data)

        # Upsert vectors to store
        try:
            store.upsert(
                collection_name=self.collection_name,
                points=points
            )
            logger.info(f"Successfully upserted {len(points)} vectors into vector store.")
        except Exception as e:
            logger.error(f"Failed to upsert points into vector store: {e}")

        # Insert metadata to Database / In-Memory
        if self._is_db_ready():
            try:
                await prisma_client.chunk.create_many(data=chunks_metadata)
            except Exception as e:
                logger.error(f"Prisma chunks insert failed: {e}")
                self._save_chunks_in_memory(doc_id, chunks_metadata)
        else:
            self._save_chunks_in_memory(doc_id, chunks_metadata)

        # Extract and save knowledge graph dynamically
        try:
            await self.extract_and_save_graph(doc_id, text)
        except Exception as e:
            logger.error(f"Failed to extract and save knowledge graph during ingestion: {e}")
            
        return chunks_metadata

    def _save_chunks_in_memory(self, doc_id: str, chunks: list):
        for chunk in chunks:
            in_memory_chunks[chunk["id"]] = chunk

    async def get_chunks(self) -> list:
        if self._is_db_ready():
            try:
                res = await prisma_client.chunk.find_many()
                return [c.model_dump() if hasattr(c, 'model_dump') else c.dict() for c in res]
            except Exception as e:
                logger.error(f"Failed to fetch chunks from Prisma: {e}")
        
        return list(in_memory_chunks.values())

    async def get_chunks_by_document(self, doc_id: str) -> list:
        if self._is_db_ready():
            try:
                res = await prisma_client.chunk.find_many(where={"document_id": doc_id})
                return [c.model_dump() if hasattr(c, 'model_dump') else c.dict() for c in res]
            except Exception as e:
                logger.error(f"Failed to fetch chunks for doc {doc_id}: {e}")
        
        return [c for c in in_memory_chunks.values() if c["document_id"] == doc_id]

    async def delete_from_vector_store(self, doc_id: str):
        try:
            store = await self._get_store()
            store.delete(
                collection_name=self.collection_name,
                document_id=doc_id
            )
            logger.info(f"Deleted points for document {doc_id} from vector store.")
        except Exception as e:
            logger.error(f"Failed to delete points from vector store: {e}")

        # 1. Get store & dynamic dimension
        try:
            store = await self._get_store()
            dimension = store.get_collection_dimension(self.collection_name)
        except Exception as e:
            logger.error(f"Failed to get store or dimension: {e}")
            store = None
            dimension = 768

        # 2. Embed query
        query_vector = await self._get_gemini_embedding(question, dimensionality=dimension)
        
        # 3. Search Store
        retrieved_chunks = []
        try:
            if store is None:
                raise ValueError("Store not initialized")
            search_results = store.search(
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
                    "content": "Ini adalah konten tiruan (mock) karena vector store Anda kosong atau koneksi vector store gagal.",
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
            "created_at": datetime.utcnow()
        }

        # Save to logs
        if self._is_db_ready():
            try:
                await prisma_client.querylog.create(data=query_log)
            except Exception as e:
                logger.error(f"Failed to save query log to Prisma: {e}")
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
        if self._is_db_ready():
            try:
                res = await prisma_client.querylog.find_many(order={"created_at": "desc"})
                return [q.model_dump() if hasattr(q, 'model_dump') else q.dict() for q in res]
            except Exception as e:
                logger.error(f"Failed to fetch query logs from Prisma: {e}")
        
        return sorted(in_memory_query_logs, key=lambda x: x["created_at"], reverse=True)

    def _get_mock_graph(self) -> dict:
        return {
            "nodes": [
                {"id": "doc1", "label": "Vectora System", "type": "Software", "val": 4.5},
                {"id": "c1", "label": "Graph RAG", "type": "Concept", "val": 5.0},
                {"id": "v1", "label": "Relational Entity", "type": "Concept", "val": 3.0},
                {"id": "m1", "label": "Qdrant Store", "type": "Software", "val": 4.0},
                {"id": "t1", "label": "Gemini 3.1 Flash", "type": "Software", "val": 4.2}
            ],
            "edges": [
                {"source": "doc1", "target": "c1", "label": "implements"},
                {"source": "c1", "target": "v1", "label": "extracts"},
                {"source": "doc1", "target": "m1", "label": "integrates"},
                {"source": "doc1", "target": "t1", "label": "utilizes"},
                {"source": "t1", "target": "c1", "label": "powers"}
            ]
        }

    async def _extract_knowledge_graph(self, context: str) -> dict:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
            logger.warning("GEMINI_API_KEY not set. Using mock graph.")
            return self._get_mock_graph()
            
        prompt = (
            "Extract a high-quality Knowledge Graph representing key concepts, software systems, actors, documents, threats, "
            "vulnerabilities, and relations discussed in the following textual context.\n\n"
            "Format your response as a valid, parsable JSON object EXACTLY matching this schema:\n"
            "{\n"
            "  \"nodes\": [\n"
            "    {\"id\": \"node_unique_short_id\", \"label\": \"Entity Name (e.g., Metasploit, CVE-2023-1234, Ransomware, Windows)\", \"type\": \"Category (e.g. Software, Vulnerability, Threat, Concept, Protocol, Document, Organization, Location, Person, Other)\", \"val\": 3.5}\n"
            "  ],\n"
            "  \"edges\": [\n"
            "    {\"source\": \"source_node_id\", \"target\": \"target_node_id\", \"label\": \"relationship description (e.g. targets, exploits, contains, developed_by, associated_with)\"}\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "1. Extract maximum 12-15 most important nodes to keep the graph uncluttered.\n"
            "2. 'val' must be a float between 1.0 and 5.0 representing the prominence or centrality of the node in the context.\n"
            "3. Ensure all source and target IDs in the edges list EXACTLY match the id of a node in the nodes list.\n"
            "4. Do NOT include markdown code blocks formatting (like ```json ... ```) or any trailing characters outside the JSON in your response.\n\n"
            f"Context:\n{context}\n\n"
            "JSON Output:"
        )
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "responseMimeType": "application/json"
            }
        }
        
        import json
        async with httpx.AsyncClient() as client:
            try:
                res = await client.post(url, json=payload, timeout=20.0)
                res.raise_for_status()
                data = res.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                
                # Strip out any potential markdown wrap
                if raw_text.startswith("```"):
                    raw_text = raw_text.split("```")[1]
                    if raw_text.startswith("json"):
                        raw_text = raw_text[4:]
                
                graph_dict = json.loads(raw_text.strip())
                if "nodes" not in graph_dict:
                    graph_dict["nodes"] = []
                if "edges" not in graph_dict:
                    graph_dict["edges"] = []
                    
                # Clean invalid edges to prevent rendering crashes
                node_ids = {node["id"] for node in graph_dict["nodes"]}
                valid_edges = []
                for edge in graph_dict["edges"]:
                    if edge.get("source") in node_ids and edge.get("target") in node_ids:
                        valid_edges.append(edge)
                graph_dict["edges"] = valid_edges
                
                return graph_dict
            except Exception as e:
                logger.error(f"Failed to dynamically extract knowledge graph from Gemini API: {e}")
                return self._get_mock_graph()

    async def extract_and_save_graph(self, doc_id: str, text: str):
        logger.info(f"Extracting knowledge graph for document {doc_id}...")
        
        # Limit token usage to reasonable length (approx 8000 characters)
        extraction_text = text[:8000]
        
        extracted = await self._extract_knowledge_graph(extraction_text)
        nodes = extracted.get("nodes", [])
        edges = extracted.get("edges", [])
        
        logger.info(f"Extracted {len(nodes)} nodes and {len(edges)} edges for document {doc_id}")
        
        if self._is_db_ready():
            try:
                # Clear existing graph data for this document to avoid duplicates on re-upload
                await prisma_client.relation.delete_many(where={"document_id": doc_id})
                await prisma_client.entity.delete_many(where={"document_id": doc_id})
                
                # 1. Save entities to DB
                # Mapping from LLM local node id (e.g. "doc1") to DB UUID
                node_id_map = {}
                
                for node in nodes:
                    created_entity = await prisma_client.entity.create(
                        data={
                            "entity_id": node["id"],
                            "name": node["label"],
                            "type": node.get("type", "Concept"),
                            "val": float(node.get("val", 1.0)),
                            "document_id": doc_id
                        }
                    )
                    node_id_map[node["id"]] = created_entity.id
                
                # 2. Save relations to DB
                for edge in edges:
                    src_uuid = node_id_map.get(edge["source"])
                    tgt_uuid = node_id_map.get(edge["target"])
                    
                    if src_uuid and tgt_uuid:
                        await prisma_client.relation.create(
                            data={
                                "source_id": src_uuid,
                                "target_id": tgt_uuid,
                                "label": edge["label"],
                                "document_id": doc_id
                            }
                        )
                logger.info(f"Successfully saved knowledge graph to database for document {doc_id}")
            except Exception as e:
                logger.error(f"Failed to save knowledge graph to database: {e}. Falling back to in-memory.")
                self._save_graph_in_memory(doc_id, nodes, edges)
        else:
            self._save_graph_in_memory(doc_id, nodes, edges)

    def _save_graph_in_memory(self, doc_id: str, nodes: list, edges: list):
        in_memory_entities[doc_id] = nodes
        in_memory_relations[doc_id] = edges
        logger.info(f"Successfully saved knowledge graph to in-memory storage for document {doc_id}")

    def _get_in_memory_graph_data(self, doc_ids: list) -> tuple:
        entities = []
        relations = []
        for doc_id in doc_ids:
            if doc_id in in_memory_entities:
                doc_nodes = in_memory_entities[doc_id]
                doc_edges = in_memory_relations[doc_id]
                
                # Create virtual UUID mappings for compatibility
                virtual_map = {}
                for node in doc_nodes:
                    v_id = f"v-{doc_id}-{node['id']}"
                    virtual_map[node["id"]] = v_id
                    entities.append({
                        "id": v_id,
                        "entity_id": node["id"],
                        "name": node["label"],
                        "type": node.get("type", "Concept"),
                        "val": float(node.get("val", 1.0)),
                        "document_id": doc_id
                    })
                
                for edge in doc_edges:
                    src_v = virtual_map.get(edge["source"])
                    tgt_v = virtual_map.get(edge["target"])
                    if src_v and tgt_v:
                        relations.append({
                            "id": f"r-{doc_id}-{uuid.uuid4()}",
                            "source_id": src_v,
                            "target_id": tgt_v,
                            "label": edge["label"],
                            "source_name": next((x["name"] for x in entities if x["id"] == src_v), ""),
                            "target_name": next((x["name"] for x in entities if x["id"] == tgt_v), ""),
                            "document_id": doc_id
                        })
        return entities, relations

    def _merge_and_normalize_graphs(self, entities: list, relations: list) -> dict:
        # Case-insensitive Entity Merging
        merged_nodes = {}
        entity_id_to_normalized_name = {}

        for ent in entities:
            norm_key = ent["name"].strip().lower()
            if norm_key not in merged_nodes:
                merged_nodes[norm_key] = {
                    "id": ent["id"],
                    "label": ent["name"],
                    "type": ent["type"],
                    "val": ent["val"],
                    "count": 1
                }
            else:
                merged_nodes[norm_key]["val"] = max(merged_nodes[norm_key]["val"], ent["val"])
                merged_nodes[norm_key]["val"] = min(5.0, merged_nodes[norm_key]["val"] + 0.2)
                merged_nodes[norm_key]["count"] += 1
            
            entity_id_to_normalized_name[ent["id"]] = merged_nodes[norm_key]["label"]

        final_nodes = []
        node_name_to_final_id = {}
        for idx, (norm_key, node_data) in enumerate(merged_nodes.items()):
            final_id = f"node_{idx}"
            node_name_to_final_id[node_data["label"]] = final_id
            final_nodes.append({
                "id": final_id,
                "label": node_data["label"],
                "type": node_data["type"],
                "val": node_data["val"]
            })

        seen_edges = set()
        final_edges = []

        for rel in relations:
            src_name = rel.get("source_name")
            tgt_name = rel.get("target_name")
            
            if not src_name:
                src_name = entity_id_to_normalized_name.get(rel["source_id"])
            if not tgt_name:
                tgt_name = entity_id_to_normalized_name.get(rel["target_id"])

            if src_name and tgt_name:
                src_final_id = node_name_to_final_id.get(src_name)
                tgt_final_id = node_name_to_final_id.get(tgt_name)
                
                if src_final_id and tgt_final_id and src_final_id != tgt_final_id:
                    edge_key = (src_final_id, tgt_final_id, rel["label"].lower())
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)
                        final_edges.append({
                            "source": src_final_id,
                            "target": tgt_final_id,
                            "label": rel["label"]
                        })

        return {
            "nodes": final_nodes,
            "edges": final_edges
        }

    async def query_rag_graph(self, question: str, top_k: int = 4, temperature: float = 0.7, prompt_template: str = None) -> dict:
        start_time = time.time()
        
        # 1. Get store & dynamic dimension
        try:
            store = await self._get_store()
            dimension = store.get_collection_dimension(self.collection_name)
        except Exception as e:
            logger.error(f"Failed to get store or dimension in graph mode: {e}")
            store = None
            dimension = 768

        # 2. Embed query
        query_vector = await self._get_gemini_embedding(question, dimensionality=dimension)
        
        # 3. Search Store
        retrieved_chunks = []
        try:
            if store is None:
                raise ValueError("Store not initialized")
            search_results = store.search(
                collection_name=self.collection_name,
                query_vector=query_vector,
                limit=top_k
            )
            
            for res in search_results:
                retrieved_chunks.append({
                    "content": res.payload.get("content", ""),
                    "score": res.score,
                    "source_document": res.payload.get("filename", "unknown"),
                    "document_id": res.payload.get("document_id", ""),
                    "chunk_index": res.payload.get("chunk_index", 0)
                })
        except Exception as e:
            logger.error(f"Failed to search vector store in graph mode: {e}")
            retrieved_chunks = [
                {
                    "content": "Ini adalah konten tiruan (mock) karena vector store Anda kosong atau koneksi vector store gagal.",
                    "score": 0.95,
                    "source_document": "panduan_sistem.txt",
                    "document_id": "mock-doc-id",
                    "chunk_index": 0
                }
            ]

        # 3. Build context
        context = "\n\n".join([f"--- Source: {c['source_document']} (Chunk {c['chunk_index']}) ---\n{c['content']}" for c in retrieved_chunks])
        
        # 4. Fetch entities & relations from database or in-memory based on unique document_ids
        doc_ids = list(set([c.get("document_id", "") for c in retrieved_chunks if c.get("document_id")]))
        
        entities_list = []
        relations_list = []

        if self._is_db_ready() and doc_ids:
            try:
                # Fetch entities
                db_entities = await prisma_client.entity.find_many(
                    where={"document_id": {"in": doc_ids}}
                )
                # Fetch relations with source & target
                db_relations = await prisma_client.relation.find_many(
                    where={"document_id": {"in": doc_ids}},
                    include={"source": True, "target": True}
                )
                
                # Standardize to dictionaries
                for ent in db_entities:
                    entities_list.append({
                        "id": ent.id,
                        "entity_id": ent.entity_id,
                        "name": ent.name,
                        "type": ent.type,
                        "val": ent.val,
                        "document_id": ent.document_id
                    })
                
                for rel in db_relations:
                    relations_list.append({
                        "id": rel.id,
                        "source_id": rel.source_id,
                        "target_id": rel.target_id,
                        "label": rel.label,
                        "source_name": rel.source.name if rel.source else "",
                        "target_name": rel.target.name if rel.target else "",
                        "document_id": rel.document_id
                    })
            except Exception as e:
                logger.error(f"Failed to fetch graph from database: {e}. Falling back to in-memory.")
                entities_list, relations_list = self._get_in_memory_graph_data(doc_ids)
        elif doc_ids:
            entities_list, relations_list = self._get_in_memory_graph_data(doc_ids)

        # Fallback to dynamic on-the-fly extraction if no entities were found in DB/memory
        if not entities_list:
            logger.info("No persisted entities found. Falling back to on-the-fly dynamic extraction.")
            extracted_graph = await self._extract_knowledge_graph(context)
        else:
            logger.info(f"Loaded {len(entities_list)} entities and {len(relations_list)} relations from persistence. Merging...")
            extracted_graph = self._merge_and_normalize_graphs(entities_list, relations_list)

        # 5. Build Graph prompt augmentation
        graph_triples = []
        node_map = {node["id"]: node["label"] for node in extracted_graph["nodes"]}
        for edge in extracted_graph["edges"]:
            src_lbl = node_map.get(edge["source"], edge["source"])
            tgt_lbl = node_map.get(edge["target"], edge["target"])
            graph_triples.append(f"({src_lbl}) --[{edge['label']}]--> ({tgt_lbl})")
            
        graph_str = "\n".join(graph_triples) if graph_triples else "No explicit relations extracted."
        
        default_template = (
            "You are a helpful AI Assistant with access to a custom Graph RAG (Knowledge Graph & Vector) security knowledge base.\n"
            "Use BOTH the textual context and the extracted conceptual relationships (Knowledge Graph) below to answer the user's question.\n"
            "Provide a comprehensive, highly coherent answer grounded in the entity connections.\n\n"
            "Extracted Semantic Graph Relations:\n"
            f"{graph_str}\n\n"
            "Retrieved Textual Context:\n"
            f"{context}\n\n"
            f"Question: {question}\n\n"
            "Answer:"
        )
        
        prompt = prompt_template.format(context=context, question=question) if prompt_template else default_template
        
        # 6. Generate answer
        answer = await self._generate_gemini_answer(prompt)
        
        latency = time.time() - start_time
        
        query_log = {
            "id": str(uuid.uuid4()),
            "question": question,
            "response": answer,
            "latency": round(latency, 2),
            "created_at": datetime.utcnow()
        }

        # Save query log
        if self._is_db_ready():
            try:
                await prisma_client.querylog.create(data=query_log)
            except Exception as e:
                logger.error(f"Failed to save query log to Prisma: {e}")
                in_memory_query_logs.append(query_log)
        else:
            in_memory_query_logs.append(query_log)

        return {
            "answer": answer,
            "retrieved_chunks": retrieved_chunks,
            "latency": round(latency, 2),
            "created_at": datetime.utcnow(),
            "graph": extracted_graph
        }

rag_service = RAGService()

