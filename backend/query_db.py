import asyncio
import os
import sys

# Add backend app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), "app"))

from app.core.database import prisma_client

async def main():
    print("Connecting to database...")
    await prisma_client.connect()
    
    print("\n--- VECTOR DATABASES ---")
    vector_dbs = await prisma_client.vectordb.find_many()
    for db in vector_dbs:
        print(f"ID: {db.id}")
        print(f"Name: {db.name}")
        print(f"Provider: {db.provider}")
        print(f"URL: {db.url}")
        print(f"Status: {db.status}")
        print(f"Active Collection: {db.active_collection}")
        print("-" * 30)

    print("\n--- DOCUMENTS ---")
    docs = await prisma_client.document.find_many()
    print(f"Total documents in database: {len(docs)}")
    for doc in docs:
        print(f"ID: {doc.id} | Filename: {doc.filename} | Status: {doc.status}")

    print("\n--- MODELS ---")
    models = await prisma_client.aimodel.find_many()
    for model in models:
        print(f"ID: {model.id} | Name: {model.model_name} | Provider: {model.provider} | Status: {model.status}")

    await prisma_client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
