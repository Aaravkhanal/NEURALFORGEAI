import asyncio
import json
import httpx
from core.security import create_access_token

async def test_chat():
    url = "http://localhost:8000/api/dataset-chat/ask"
    
    # Generate a fake JWT for a test user
    token = create_access_token({"sub": "test_user_123"})
    headers = {"Authorization": f"Bearer {token}"}
    
    # First message
    payload1 = {
        "question": "I am working on a text classification project for sentiment analysis.",
        "project_description": "Sentiment Analysis text classification",
        "history": []
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        print("--- Message 1 ---")
        res1 = await client.post(url, json=payload1, headers=headers)
        data1 = res1.json()
        print("Answer 1:", data1.get("answer"))
        
        # Second message, asking a follow up that requires context
        payload2 = {
            "question": "What algorithms should I use for it?",
            "project_description": "Sentiment Analysis text classification",
            "history": [
                {"role": "user", "content": payload1["question"]},
                {"role": "assistant", "content": data1.get("answer")}
            ]
        }
        
        print("\n--- Message 2 ---")
        res2 = await client.post(url, json=payload2, headers=headers)
        data2 = res2.json()
        print("Answer 2:", data2.get("answer"))

if __name__ == "__main__":
    asyncio.run(test_chat())
