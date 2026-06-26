"""
NeuralForge — Code Generation API Routes
Generate production-ready training code and downloadable notebook bundles.
"""

import io
import json
import zipfile
import logging
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id, get_optional_user_id
from models.file import File
from services.codegen_service import generate_training_code

logger = logging.getLogger("neuralforge.api.codegen")

router = APIRouter(prefix="/api/codegen", tags=["codegen"])


class CodeGenRequest(BaseModel):
    file_id: str
    model_key: str
    task_type: str
    framework: str = "pytorch"  # pytorch | tensorflow | scikit-learn
    target_column: Optional[str] = None


@router.post("/generate")
async def generate_code(
    request: CodeGenRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate training code for a model + framework."""
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    dataset_info = {
        "filename": file_record.filename,
        "num_classes": len((file_record.analysis_report or {}).get("label_distribution", {})) or 2,
        "num_features": file_record.column_count or 10,
        "columns": [c.get("name", "") for c in (file_record.columns_info or {}).get("columns", [])] if isinstance(file_record.columns_info, dict) else [],
        "row_count": file_record.row_count,
    }

    try:
        result = generate_training_code(
            model_key=request.model_key,
            task_type=request.task_type,
            framework=request.framework,
            dataset_info=dataset_info,
            target_column=request.target_column,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


@router.post("/notebook")
async def generate_notebook_bundle(
    request: CodeGenRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate and download a ZIP bundle with train.py + requirements.txt + README.md."""
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    dataset_info = {
        "filename": file_record.filename,
        "num_classes": len((file_record.analysis_report or {}).get("label_distribution", {})) or 2,
        "num_features": file_record.column_count or 10,
        "columns": [c.get("name", "") for c in (file_record.columns_info or {}).get("columns", [])] if isinstance(file_record.columns_info, dict) else [],
        "row_count": file_record.row_count,
    }

    try:
        gen = generate_training_code(
            model_key=request.model_key,
            task_type=request.task_type,
            framework=request.framework,
            dataset_info=dataset_info,
            target_column=request.target_column,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create ZIP bundle
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("train.py", gen["code"])
        zf.writestr("requirements.txt", gen["requirements"])
        zf.writestr("README.md", gen["readme"])

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="neuralforge_{request.model_key}_{request.framework}.zip"',
        },
    )


class LLMCodeGenRequest(BaseModel):
    problem_description: str
    model_name: str
    model_format: str = ".pkl"
    task_type: str = "tabular_regression"
    target_column: str = "target"
    feature_names: List[str] = []
    training_metrics: Optional[dict] = None
    preprocessing_info: Optional[str] = None


@router.post("/generate-llm")
async def generate_code_llm(
    request: LLMCodeGenRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Generate production-ready inference code using the NVIDIA LLM API.
    Returns 4 files: inference.py, app.py, requirements.txt, README.md
    """
    from services.llm_service import get_best_available_llm
    from langchain_core.messages import HumanMessage, SystemMessage

    features_block = (
        f"Exact feature names from training (use these verbatim): [{', '.join(request.feature_names)}]"
        if request.feature_names
        else "Feature names not available — infer appropriate names from the problem description"
    )
    metrics_block = (
        f"Achieved training metrics: {json.dumps(request.training_metrics)}"
        if request.training_metrics else ""
    )
    fmt = request.model_format.lstrip(".")
    loader = {
        "onnx": "onnxruntime.InferenceSession(model_path)",
        "pt": "torch.load(model_path, weights_only=True)",
        "pth": "torch.load(model_path, weights_only=True)",
        "h5": "tf.keras.models.load_model(model_path)",
        "keras": "tf.keras.models.load_model(model_path)",
        "ubj": "xgb.Booster(); model.load_model(model_path)",
        "json": "xgb.Booster(); model.load_model(model_path)",
    }.get(fmt, "joblib.load(model_path)")

    prompt = f"""You are a senior ML engineer generating a complete, production-ready Python inference package.

PROJECT CONTEXT:
- Problem: {request.problem_description}
- Model: {request.model_name} ({request.model_format})
- Task: {request.task_type}
- Target column: {request.target_column}
- {features_block}
- {metrics_block}
- Model loading: {loader}

Generate EXACTLY these 4 files. Return ONLY a valid JSON object with no markdown fences, no explanations, no prose outside the JSON:

{{
  "inference.py": "<complete script>",
  "app.py": "<complete FastAPI server>",
  "requirements.txt": "<one package per line>",
  "README.md": "<markdown guide>"
}}

FILE REQUIREMENTS:

inference.py:
- Header comment with exact pip packages needed
- load_model(path) using {loader}
- preprocess(data: dict) -> pd.DataFrame that casts and orders the exact features
- predict(data: dict) -> dict with "prediction" and optionally "confidence"
- Realistic sample_input using domain-appropriate values (not 0 or placeholder)
- if __name__ == "__main__": block that runs sample_input and prints the result
- Handle the actual task ({request.task_type}) correctly — regression returns float, classification returns label + probability

app.py:
- FastAPI with lifespan context to load model once at startup
- POST /predict accepting a JSON body with the exact features, returning prediction + confidence
- GET /health returning model name and status
- CORS middleware enabled
- Proper Pydantic request model with the exact feature names and correct types

requirements.txt:
- Exact packages for both files, pinned to working major versions
- No comments, one package per line

README.md:
- ## Setup with exact pip install command
- ## Run showing python inference.py and uvicorn app:app
- ## API with a complete working curl example using realistic values
- ## Features table with feature name and expected type for every feature"""

    try:
        llm = get_best_available_llm(temperature=0.05)
        response = llm.invoke([
            SystemMessage(content="You are an expert ML engineer. Output only valid JSON, no markdown, no extra text."),
            HumanMessage(content=prompt),
        ])
        raw = response.content.strip()
        # Strip any markdown fences the LLM might add
        raw = raw.replace("```json", "").replace("```", "").strip()
        j_start = raw.find("{")
        j_end = raw.rfind("}") + 1
        if j_start != -1 and j_end > j_start:
            raw = raw[j_start:j_end]
        parsed = json.loads(raw)
        files = {
            "inference.py": parsed.get("inference.py", "# Generation failed").strip(),
            "app.py": parsed.get("app.py", "# Generation failed").strip(),
            "requirements.txt": parsed.get("requirements.txt", "").strip(),
            "README.md": parsed.get("README.md", "").strip(),
        }
    except Exception as e:
        logger.error(f"LLM code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

    return {"files": files}
