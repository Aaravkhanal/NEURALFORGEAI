import asyncio
from fastapi import FastAPI, Depends
from core.security import get_optional_user_id
import uvicorn

app = FastAPI()

@app.get("/test")
async def test(user_id=Depends(get_optional_user_id)):
    return {"user_id": user_id}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
