import asyncio
import psycopg2
from psycopg2 import OperationalError

async def test_conn(url):
    print(f"Testing URL: {url}")
    try:
        conn = psycopg2.connect(url, connect_timeout=5)
        print("SUCCESS!")
        conn.close()
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        return False

async def main():
    urls = [
        # 1. Pooler port 5432 with pgbouncer=true
        "postgresql://postgres.omyimdfplkxkzbcirmrc:Mantoles23%40%23@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres",
        # 2. Pooler port 6543
        "postgresql://postgres.omyimdfplkxkzbcirmrc:Mantoles23%40%23@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres",
        # 3. Direct DB IPv6 port 5432
        "postgresql://postgres:Mantoles23%40%23@db.omyimdfplkxkzbcirmrc.supabase.co:5432/postgres",
        # 4. Direct DB IPv6 port 6543
        "postgresql://postgres:Mantoles23%40%23@db.omyimdfplkxkzbcirmrc.supabase.co:6543/postgres",
        # 5. Let's try region-less or other possible pooler hosts if any
        "postgresql://postgres.omyimdfplkxkzbcirmrc:Mantoles23%40%23@ap-northeast-1.pooler.supabase.com:5432/postgres",
        "postgresql://postgres.omyimdfplkxkzbcirmrc:Mantoles23%40%23@ap-northeast-1.pooler.supabase.com:6543/postgres"
    ]
    for url in urls:
        await test_conn(url)
        print("-" * 50)

if __name__ == "__main__":
    asyncio.run(main())
