"""
NeuralForge — Cleaning Analysis API
Endpoints for dataset analysis, previewing data, AI cleaning suggestions,
and exporting cleaned datasets in multiple formats.
"""

import os
import io
import logging

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from core.security import get_optional_user_id
from models.file import File

logger = logging.getLogger("neuralforge.api.cleaning_analysis")
router = APIRouter(prefix="/api/cleaning", tags=["cleaning", "analysis"])


# ── Analysis Endpoint ─────────────────────────────────────────

@router.get("/analysis/{file_id}")
async def get_dataset_analysis(
    file_id: str,
    target_column: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive dataset analysis for the cleaning studio.
    Returns missing value matrix, correlation matrix, feature distributions,
    class balance, outlier counts, and data type summary.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.cleaned_file_path or file_record.file_path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Dataset file not found on disk")

    from services.dataset_analyzer import DatasetAnalyzer
    analyzer = DatasetAnalyzer()
    profile = analyzer.analyze(
        file_path,
        target_column=target_column,
        problem_statement=None,
    )

    if profile.get("error"):
        raise HTTPException(status_code=400, detail=profile["error"])

    return profile


# ── Preview Endpoint ──────────────────────────────────────────

@router.get("/preview/{file_id}")
async def preview_dataset(
    file_id: str,
    rows: int = 100,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return first N rows of the dataset for preview."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.cleaned_file_path or file_record.file_path
    ext = file_record.file_type or os.path.splitext(file_path)[1].lower()

    try:
        if ext in (".csv", "csv"):
            df = pd.read_csv(file_path, nrows=rows)
        elif ext in (".xlsx", ".xls", "xlsx", "xls"):
            df = pd.read_excel(file_path, nrows=rows)
        elif ext in (".json", "json"):
            df = pd.read_json(file_path)
            df = df.head(rows)
        elif ext in (".parquet",):
            df = pd.read_parquet(file_path)
            df = df.head(rows)
        else:
            df = pd.read_csv(file_path, nrows=rows)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not load dataset: {e}")

    # Convert to JSON-safe format
    preview_data = df.head(rows).replace({float("nan"): None}).to_dict(orient="records")
    columns = []
    for col in df.columns:
        columns.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "sample": str(df[col].iloc[0]) if len(df) > 0 else None,
        })

    return {
        "rows": preview_data,
        "columns": columns,
        "total_rows": len(df),
        "showing": min(rows, len(df)),
    }


# ── AI Cleaning Suggestions ───────────────────────────────────

@router.get("/ai-suggest/{file_id}")
async def ai_suggest_cleaning(
    file_id: str,
    target_column: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get AI-powered cleaning suggestions for a dataset.
    Returns issues found, explanations, and recommended operations.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.cleaned_file_path or file_record.file_path
    ext = file_record.file_type or os.path.splitext(file_path)[1].lower()

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Dataset file not found on disk")

    from services.ai_cleaning_agent import AICleaningAgent
    agent = AICleaningAgent()
    suggestions = await agent.suggest(file_path, ext, target_column)

    if suggestions.get("error"):
        raise HTTPException(status_code=400, detail=suggestions["error"])

    return suggestions


# ── AI Apply Cleaning ──────────────────────────────────────────

class AIApplyRequest(BaseModel):
    operations: list[dict]
    target_column: Optional[str] = None


@router.post("/ai-apply/{file_id}")
async def ai_apply_cleaning(
    file_id: str,
    request: AIApplyRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Apply approved AI-suggested cleaning operations."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.file_path
    ext = file_record.file_type or os.path.splitext(file_path)[1].lower()

    from services.cleaning_service import CleaningService

    dataset_type = file_record.dataset_type or "tabular"

    try:
        if dataset_type == "text":
            result_data = CleaningService.clean_text(file_path, ext, request.operations)
        else:
            result_data = CleaningService.clean_tabular(file_path, ext, request.operations)

        if not result_data["success"]:
            raise HTTPException(status_code=400, detail=result_data.get("error", "Cleaning failed"))

        # Update file record
        file_record.cleaning_status = "cleaned"
        file_record.cleaned_file_path = result_data["output_path"]
        file_record.analysis_report = {
            **(file_record.analysis_report or {}),
            "cleaning_report": result_data.get("report", {}),
        }
        await db.flush()

        return {
            "success": True,
            "output_path": result_data["output_path"],
            "rows": result_data["rows"],
            "columns": result_data["columns"],
            "report": result_data.get("report", {}),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning error: {e}")


# ── Export Cleaned Dataset (XLSX / Parquet) ────────────────────

@router.get("/export/{file_id}/xlsx")
async def export_cleaned_xlsx(
    file_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Export cleaned dataset as Excel (.xlsx)."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    cleaned_path = file_record.cleaned_file_path or file_record.file_path
    if not cleaned_path or not os.path.exists(cleaned_path):
        raise HTTPException(status_code=400, detail="Dataset file not found")

    try:
        df = pd.read_csv(cleaned_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read dataset")

    buffer = io.BytesIO()
    df.to_excel(buffer, index=False, engine="openpyxl")
    buffer.seek(0)

    filename = f"{os.path.splitext(file_record.filename)[0]}_cleaned.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/{file_id}/parquet")
async def export_cleaned_parquet(
    file_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Export cleaned dataset as Parquet."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    cleaned_path = file_record.cleaned_file_path or file_record.file_path
    if not cleaned_path or not os.path.exists(cleaned_path):
        raise HTTPException(status_code=400, detail="Dataset file not found")

    try:
        df = pd.read_csv(cleaned_path)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read dataset")

    buffer = io.BytesIO()
    df.to_parquet(buffer, index=False)
    buffer.seek(0)

    filename = f"{os.path.splitext(file_record.filename)[0]}_cleaned.parquet"
    return StreamingResponse(
        buffer,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
