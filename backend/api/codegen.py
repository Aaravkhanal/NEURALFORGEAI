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


    feat_list = ", ".join(request.feature_names) if request.feature_names else "feature1, feature2"
    task = request.task_type
    is_cls = "classif" in task.lower()

    prompt = f"""You are a senior ML engineer. Generate a complete Python ML package for this project.

PROJECT CONTEXT:
- Problem: {request.problem_description}
- Model: {request.model_name} ({request.model_format})
- Task type: {task}
- Target column: {request.target_column}
- {features_block}
- {metrics_block}
- Model loading: {loader}

Determine the appropriate files for this project. Always include:
data_loader.py, train.py, evaluate.py, inference.py, app.py, requirements.txt, README.md

Add extra files only if genuinely needed for complexity (e.g. preprocessing.py).

Separate each file with EXACTLY this marker on its own line:
===FILE: <filename>===

Write ALL files completely. No placeholders, no "TODO", no ellipsis.

REQUIREMENTS PER FILE:
- data_loader.py: load_data(csv_path) -> cleaned DataFrame, handle missing values, encode categoricals
- train.py: full training script, reads CSV, trains {request.model_name}, saves model, prints metrics
- evaluate.py: loads saved model, computes {"accuracy/precision/recall/F1/confusion matrix" if is_cls else "RMSE/MAE/R2"} on test set
- inference.py: load_model({loader}), preprocess(data: dict)->DataFrame using features [{feat_list}], predict()->dict with prediction{"+ confidence" if is_cls else ""}, sample_input with realistic values, __main__ block
- app.py: FastAPI lifespan startup, POST /predict with Pydantic model of [{feat_list}], GET /health, CORS
- requirements.txt: one package per line, pinned major versions, no comments
- README.md: Setup / Train / Evaluate / API sections with exact commands and working curl example

Use real domain values — not 0 or placeholder."""

    try:
        from services.llm_service import get_best_available_llm
        from langchain_core.messages import HumanMessage, SystemMessage
        import re as _re

        llm = get_best_available_llm(temperature=0.05)
        response = llm.invoke([
            SystemMessage(content="Output ONLY file contents separated by ===FILE: name=== delimiters. No preamble or explanation."),
            HumanMessage(content=prompt),
        ])
        raw = response.content.strip()

        # Parse ===FILE: name=== sections
        parts = _re.split(r'={3}FILE:\s*(.+?)\s*={3}', raw)
        files: dict = {}
        for i in range(1, len(parts), 2):
            fname = parts[i].strip()
            content = parts[i + 1].strip() if i + 1 < len(parts) else ""
            content = _re.sub(r'^```[a-z]*\n?', '', content)
            content = _re.sub(r'\n?```$', '', content).strip()
            if fname and content:
                files[fname] = content

        if not files:
            raise ValueError("LLM did not produce file sections. Response: " + raw[:300])

    except Exception as e:
        logger.error(f"LLM code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

    return {"files": files}
