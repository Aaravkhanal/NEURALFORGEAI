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

@router.post("/generate-llm")
async def generate_code_llm(
    request: LLMCodeGenRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Generate production-ready ML package using NVIDIA LLM (fast 8b model).
    Uses ===FILE: name=== delimiters to avoid JSON escaping issues.
    """
    import re as _re
    from langchain_openai import ChatOpenAI
    from langchain_core.messages import HumanMessage, SystemMessage
    from core.config import get_settings
    _cfg = get_settings()

    if not _cfg.nvidia_api_key:
        raise HTTPException(status_code=503, detail="NVIDIA API key not configured")

    features_block = (
        f"Features (use EXACTLY as-is): [{', '.join(request.feature_names)}]"
        if request.feature_names
        else "Features: not available, use generic names matching the problem"
    )
    metrics_block = (
        f"Training metrics: {json.dumps(request.training_metrics)}"
        if request.training_metrics else ""
    )
    fmt = request.model_format.lstrip(".")
    loader = {
        "onnx": "onnxruntime.InferenceSession",
        "pt": "torch.load",
        "pth": "torch.load",
        "h5": "tf.keras.models.load_model",
        "keras": "tf.keras.models.load_model",
        "ubj": "xgb.Booster + load_model()",
    }.get(fmt, "joblib.load")

    feat_list = ", ".join(request.feature_names) if request.feature_names else "feature1, feature2"
    is_cls = "classif" in request.task_type.lower()

    prompt = f"""Generate a production ML package. Separate files with ===FILE: filename=== on its own line.

Context:
Problem: {request.problem_description}
Model: {request.model_name} ({request.model_format}), load with {loader}
Task: {request.task_type}, target: {request.target_column}
{features_block}
{metrics_block}

Generate these 5 files — complete, no placeholders, no TODO:

===FILE: train.py===
Full training script: load CSV, preprocess [{feat_list}], train {request.model_name}, save model.pkl, print {"accuracy/F1" if is_cls else "RMSE/R2"}.

===FILE: inference.py===
Functions: load_model(path), preprocess(data:dict)->DataFrame with exact features, predict(data:dict)->dict.
Sample input with realistic domain values. if __name__=="__main__": run and print.

===FILE: app.py===
FastAPI: lifespan startup loads model once. POST /predict with Pydantic model [{feat_list}]. GET /health. CORS all origins.

===FILE: requirements.txt===
One package per line, pinned major versions.

===FILE: README.md===
## Setup, ## Train, ## API (curl example with realistic feature values), ## Features table."""

    try:
        llm = ChatOpenAI(
            model="meta/llama-3.1-8b-instruct",
            temperature=0.05,
            max_tokens=3500,
            api_key=_cfg.nvidia_api_key,
            base_url="https://integrate.api.nvidia.com/v1",
        )
        response = llm.invoke([
            SystemMessage(content="Output ONLY file contents with ===FILE: name=== delimiters. No preamble."),
            HumanMessage(content=prompt),
        ])
        raw = response.content.strip()

        parts = _re.split(r'={3}FILE:\s*(.+?)\s*={3}', raw)
        files: dict = {}
        for i in range(1, len(parts), 2):
            fname = parts[i].strip()
            content = parts[i + 1].strip() if i + 1 < len(parts) else ""
            content = _re.sub(r'^```[a-zA-Z]*\n?', '', content)
            content = _re.sub(r'\n?```$', '', content).strip()
            if fname and content:
                files[fname] = content

        if not files:
            raise ValueError("LLM returned no file sections. Raw: " + raw[:300])

    except Exception as e:
        logger.error(f"LLM code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

    return {"files": files}
