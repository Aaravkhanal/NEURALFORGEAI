"""
NeuralForge — Code Generation API Routes
Generate production-ready training code and downloadable notebook bundles.
"""

import io
import zipfile
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
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
