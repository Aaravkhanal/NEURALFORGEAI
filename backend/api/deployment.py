"""
NeuralForge — Deployment API Routes
Generates Dockerfiles, FastAPIs, and handles model packaging.
"""

import os
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from models.file import File

router = APIRouter(prefix="/api/deployment", tags=["deployment"])

@router.post("/generate/{file_id}")
async def generate_deployment(
    file_id: str,
    model_name: str = Body(...),
    target_column: str = Body(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Generates the deployment boilerplate (Dockerfile, API, requirements) for the chosen model.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    dockerfile = f"""FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code and model
COPY . .

# Expose port
EXPOSE 8080

# Run API
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
"""

    main_py = f"""from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI(title="NeuralForge Deployed Model", version="1.0.0")

# Load model (mocked path for generated output)
try:
    model = joblib.load("model.joblib")
except Exception as e:
    model = None
    print(f"Warning: Model not found locally. {{e}}")

class PredictionRequest(BaseModel):
    # Depending on your dataset, define fields here
    features: dict

@app.post("/predict")
def predict(req: PredictionRequest):
    if not model:
        return {{"error": "Model not loaded properly."}}
    
    df = pd.DataFrame([req.features])
    prediction = model.predict(df)
    return {{"{target_column}_prediction": prediction[0].item() if hasattr(prediction[0], "item") else prediction[0]}}
    
@app.get("/health")
def health():
    return {{"status": "online", "model": "{model_name}"}}
"""

    requirements = """fastapi==0.104.0
uvicorn==0.24.0
pydantic==2.5.2
pandas==2.1.3
scikit-learn==1.3.2
xgboost==2.0.2
lightgbm==4.1.0
joblib==1.3.2
"""

    return {
        "status": "success",
        "dockerfile": dockerfile,
        "main_py": main_py,
        "requirements_txt": requirements,
        "instructions": [
            "1. Download all files into a directory.",
            "2. Ensure your trained 'model.joblib' is placed alongside these files.",
            "3. Run `docker build -t neuralforge-model .`",
            "4. Run `docker run -p 8080:8080 neuralforge-model`"
        ]
    }
