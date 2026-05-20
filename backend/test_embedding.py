import asyncio
import httpx
from app.core.config import settings

async def main():
    print(f"API KEY: {settings.GEMINI_API_KEY[:8]}...")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "model": "models/text-embedding-004",
        "content": {
            "parts": [{"text": "Hello world"}]
        }
    }
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, timeout=10.0)
            print(f"text-embedding-004 response code: {res.status_code}")
            if res.status_code == 200:
                print(f"Dim: {len(res.json()['embedding']['values'])}")
        except Exception as e:
            print(f"text-embedding-004 failed: {e}")

    # Now let's try gemini-embedding-001 with outputDimensionality 1536
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={settings.GEMINI_API_KEY}"
    payload = {
        "model": "models/gemini-embedding-001",
        "content": {
            "parts": [{"text": "Hello world"}]
        },
        "outputDimensionality": 1536
    }
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload, timeout=10.0)
            print(f"gemini-embedding-001 response code: {res.status_code}")
            if res.status_code == 200:
                print(f"Dim: {len(res.json()['embedding']['values'])}")
            else:
                print(f"Error payload: {res.text}")
        except Exception as e:
            print(f"gemini-embedding-001 failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
