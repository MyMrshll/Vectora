import asyncio
import httpx
from app.core.config import settings

async def main():
    print("Testing gemini-2.5-flash...")
    url_25 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    payload = {"contents": [{"parts": [{"text": "Hello, respond with 'OK'"}]}]}
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url_25, json=payload, timeout=10.0)
            print(f"gemini-2.5-flash status: {res.status_code}")
            if res.status_code == 200:
                print("gemini-2.5-flash response:", res.json()["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            print("gemini-2.5-flash error:", e)

    print("\nTesting gemini-1.5-flash...")
    url_15 = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url_15, json=payload, timeout=10.0)
            print(f"gemini-1.5-flash status: {res.status_code}")
            if res.status_code == 200:
                print("gemini-1.5-flash response:", res.json()["candidates"][0]["content"]["parts"][0]["text"])
        except Exception as e:
            print("gemini-1.5-flash error:", e)

if __name__ == "__main__":
    asyncio.run(main())
