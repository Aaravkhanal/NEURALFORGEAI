import asyncio
import httpx
from core.security import create_access_token

async def test_synthetic():
    url = "http://localhost:8000/api/discovery/generate-synthetic"
    token = create_access_token({"sub": "test_user_123"})
    headers = {"Authorization": f"Bearer {token}"}
    
    payload = {
        "project_description": "House price prediction",
        "project_type": "tabular",
        "num_rows": 10
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("Generating synthetic dataset...")
        res = await client.post(url, json=payload, headers=headers)
        data = res.json()
        print("Response:", data)

if __name__ == "__main__":
    asyncio.run(test_synthetic())
