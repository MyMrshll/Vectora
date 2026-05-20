import asyncio
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app.core.vector_store import get_active_vector_store
from app.services.rag_service import rag_service

async def main():
    print("Initializing active vector store...")
    try:
        store = await get_active_vector_store()
        print(f"Active vector store client initialized successfully.")
    except Exception as e:
        print(f"Failed to initialize vector store: {e}")
        return

    print("\nListing collections in Qdrant:")
    try:
        collections = store.list_collections()
        print(f"Collections: {collections}")
    except Exception as e:
        print(f"Failed to list collections: {e}")
        return

    print("\nInitializing/Verifying default collection...")
    try:
        collection_name = "security_knowledge"
        store.init_collection(collection_name, size=768)
        print(f"Collection '{collection_name}' is ready.")
    except Exception as e:
        print(f"Failed to init collection: {e}")
        return

    print("\nAttempting dummy search on 'security_knowledge' collection...")
    try:
        import random
        dummy_vector = [random.uniform(-0.1, 0.1) for _ in range(768)]
        results = store.search(collection_name=collection_name, query_vector=dummy_vector, limit=2)
        print(f"Search succeeded. Found {len(results)} results:")
        for r in results:
            print(f" - ID: {r.id}, Score: {r.score}, Payload: {r.payload}")
    except Exception as e:
        print(f"Search failed with error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
