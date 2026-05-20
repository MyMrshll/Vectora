import asyncio
import logging
from app.core.database import prisma_client
from app.core.vector_store import get_active_vector_store

logging.basicConfig(level=logging.INFO)

async def main():
    await prisma_client.connect()
    
    # 1. Print all vectordbs
    dbs = await prisma_client.vectordb.find_many()
    print("\n--- VECTOR DBS IN PRISMA ---")
    for db in dbs:
        print(f"ID: {db.id}, Name: {db.name}, Provider: {db.provider}, URL: {db.url}, Active Collection: {db.active_collection}, Status: {db.status}")
    
    # 2. Print active vector store collections
    store = await get_active_vector_store()
    print("\n--- COLLECTIONS IN QDRANT ---")
    try:
        collections = store.client.get_collections().collections
        for col in collections:
            # Let's get detail of each collection
            info = store.client.get_collection(col.name)
            vector_size = info.config.params.vectors.size
            print(f"Collection: {col.name}, Vector Size: {vector_size}")
    except Exception as e:
        print("Failed to get Qdrant collections detail:", e)

    await prisma_client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
