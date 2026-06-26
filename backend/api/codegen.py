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

    context = f"""Problem: {request.problem_description}
Model: {request.model_name} ({request.model_format})
Task: {request.task_type}
Target column: {request.target_column}
{features_block}
{metrics_block}
Model loading: {loader}"""

    try:
        llm = get_best_available_llm(temperature=0.05)

        def _gen(file_prompt: str) -> str:
            from langchain_core.messages import HumanMessage, SystemMessage
            r = llm.invoke([
                SystemMessage(content="You are an expert ML engineer. Output ONLY the raw file content — no markdown fences, no explanation, no extra text."),
                HumanMessage(content=file_prompt),
            ])
            content = r.content.strip()
            # Strip any accidental markdown code fences
            for fence in ("```python", "```text", "```markdown", "```"):
                if content.startswith(fence):
                    content = content[len(fence):].lstrip()
            if content.endswith("```"):
                content = content[:-3].rstrip()
            return content.strip()

        feat_list = ", ".join(request.feature_names) if request.feature_names else "feature1, feature2"
        task = request.task_type

        inference_py = _gen(f"""{context}

Write a complete Python inference.py script:
- Top comment: # Requires: <exact pip packages>
- load_model(path) function using {loader}
- preprocess(data: dict) -> pd.DataFrame: cast exact features to correct types, return in correct column order
- predict(data: dict) -> dict: call load_model, preprocess, model.predict, return {{"prediction": value}}
  {"- Also return confidence/probability if classification" if "classif" in task else ""}
- sample_input dict with realistic domain values for features: {feat_list}
- if __name__ == "__main__": run predict(sample_input), print result
Write only the Python file. No markdown.""")

        app_py = _gen(f"""{context}

Write a complete FastAPI app.py:
- Import FastAPI, CORSMiddleware, Pydantic BaseModel, pandas, and the model library
- Pydantic Features model with fields: {feat_list} (correct types)
- Load model once at startup (store in global)
- POST /predict: accepts Features body, preprocesses, calls model.predict, returns {{"prediction": ..., "model": "{request.model_name}"}}
- GET /health: returns {{"status": "ok", "model": "{request.model_name}"}}
- CORS enabled for all origins
Write only the Python file. No markdown.""")

        requirements_txt = _gen(f"""{context}

Write a requirements.txt for inference.py and app.py.
One package per line. Pin major versions (e.g. fastapi>=0.110, pandas>=2.0).
No comments. No extra text.""")

        readme_md = _gen(f"""{context}
Features: {feat_list}

Write a concise README.md:
## Setup
pip install command

## Run
How to run inference.py and uvicorn

## API
Complete curl example for POST /predict with realistic values for each feature

## Features
Markdown table: Feature | Type for each feature ({feat_list})

Write only the markdown file.""")

        files = {
            "inference.py": inference_py,
            "app.py": app_py,
            "requirements.txt": requirements_txt,
            "README.md": readme_md,
        }

    except Exception as e:
        logger.error(f"LLM code generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Code generation failed: {str(e)}")

    return {"files": files}
