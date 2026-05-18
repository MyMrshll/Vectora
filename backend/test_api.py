import requests
import time

BASE_URL = "http://localhost:8000"

def test_root():
    print("Testing Root Endpoint...")
    res = requests.get(f"{BASE_URL}/")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}\n")

def test_health():
    print("Testing Health Endpoint...")
    res = requests.get(f"{BASE_URL}/health")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}\n")

def test_models():
    print("Testing Models Endpoint...")
    res = requests.get(f"{BASE_URL}/api/models/")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}\n")

def test_document_pipeline():
    print("Testing Document Pipeline (Upload -> Ingestion -> Query)...")
    
    # 1. Upload document
    print("1. Uploading test document...")
    files = {"file": ("test_knowledge.txt", b"Vectora is a state-of-the-art Retrieval-Augmented Generation Admin Platform. It integrates FastAPI, Qdrant, and Google Gemini models. The neural search capability ensures low latency and high accuracy.")}
    res = requests.post(f"{BASE_URL}/api/documents/", files=files)
    print(f"Upload Status: {res.status_code}")
    doc = res.json()
    print(f"Upload Response: {doc}")
    doc_id = doc["id"]
    
    # Wait a brief moment for background thread processing
    time.sleep(2)
    
    # 2. Get document status
    print("\n2. Getting document details...")
    res = requests.get(f"{BASE_URL}/api/documents/{doc_id}")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}")
    
    # 3. Get list of documents
    print("\n3. Listing all documents...")
    res = requests.get(f"{BASE_URL}/api/documents/")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}")

    # 4. Get chunks
    print("\n4. Retrieving chunks for the document...")
    res = requests.get(f"{BASE_URL}/api/chunks/", params={"document_id": doc_id})
    print(f"Status: {res.status_code}")
    chunks = res.json()
    print(f"Response (found {len(chunks)} chunks): {chunks}")
    
    # 5. Query RAG
    print("\n5. Querying the RAG system...")
    query_payload = {
        "question": "What technologies does Vectora integrate?",
        "top_k": 3,
        "temperature": 0.7
    }
    res = requests.post(f"{BASE_URL}/api/query/", json=query_payload)
    print(f"Query Status: {res.status_code}")
    query_res = res.json()
    print(f"Query Answer: {query_res['answer']}")
    print(f"Latency: {query_res['latency']}s")
    print(f"Retrieved Chunks Count: {len(query_res['retrieved_chunks'])}")
    
    # 6. Fetch query logs
    print("\n6. Fetching query audit logs...")
    res = requests.get(f"{BASE_URL}/api/query/logs")
    print(f"Status: {res.status_code}")
    print(f"Response: {res.json()}")

    # 7. Clean up document
    print(f"\n7. Deleting document {doc_id}...")
    res = requests.delete(f"{BASE_URL}/api/documents/{doc_id}")
    print(f"Delete Status: {res.status_code}")
    print(f"Response: {res.json()}\n")

if __name__ == "__main__":
    print("=== STARTING VECTORA BACKEND ENDPOINT TESTS ===\n")
    test_root()
    test_health()
    test_models()
    test_document_pipeline()
    print("=== TESTS COMPLETED SUCCESSFULLY ===")
