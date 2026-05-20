import asyncio
import sys
import os
import logging

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.rag_service import rag_service
from app.core.vector_store import get_active_vector_store
from app.core.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TestIntegration")

async def test_integration():
    logger.info("=== STARTING INTEGRATION TEST ===")
    
    # 1. Verify Gemini API Key
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("your-"):
        logger.error("GEMINI_API_KEY is not set correctly in your environment!")
        sys.exit(1)
    logger.info(f"Gemini API key is configured.")

    # 2. Test Embedding Generation (1536 Dim)
    logger.info("Generating embedding for test text...")
    test_text = "Metasploit is a widely used penetration testing framework."
    embedding = await rag_service._get_gemini_embedding(test_text)
    
    logger.info(f"Embedding generated. Dimension: {len(embedding)}")
    if len(embedding) != 1536:
        logger.error(f"FAILED: Embedding dimension is {len(embedding)} but expected 1536!")
        sys.exit(1)
    logger.info("PASSED: Embedding dimension matches 1536.")

    # 3. Test Qdrant Initialization & Collection
    logger.info("Initializing vector store collection...")
    store = await get_active_vector_store()
    logger.info(f"Active vector store provider: {store.__class__.__name__}")
    
    collection_name = "test_vectora_1536"
    try:
        store.init_collection(collection_name, size=1536)
        logger.info(f"PASSED: Collection '{collection_name}' initialized/verified successfully.")
    except Exception as e:
        logger.error(f"FAILED: Initializing collection failed: {e}")
        sys.exit(1)

    # 4. Test Graph RAG Pipeline Extraction
    logger.info("Testing dynamic graph extraction...")
    context = (
        "Active Directory is Microsoft's proprietary directory service. "
        "Domain Controllers authenticates users. Kerberos is the default protocol used for authentication. "
        "A common attack is Kerberoasting, which targets service account passwords."
    )
    graph = await rag_service._extract_knowledge_graph(context)
    logger.info(f"Graph extraction output: {graph}")
    
    if "nodes" not in graph or "edges" not in graph:
        logger.error("FAILED: Graph output is missing nodes or edges keys!")
        sys.exit(1)
        
    logger.info(f"PASSED: Extracted {len(graph['nodes'])} nodes and {len(graph['edges'])} edges.")
    
    # 5. Test Graph RAG Query
    logger.info("Executing comprehensive Graph RAG query...")
    query_result = await rag_service.query_rag_graph("Tell me about Active Directory authentication and threats", top_k=2)
    logger.info(f"Answer: {query_result.get('answer')}")
    logger.info(f"Latency: {query_result.get('latency')}s")
    logger.info(f"Graph structure returned: {query_result.get('graph')}")
    
    if not query_result.get("answer"):
        logger.error("FAILED: Answer is empty!")
        sys.exit(1)
        
    logger.info("=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===")

if __name__ == "__main__":
    asyncio.run(test_integration())
