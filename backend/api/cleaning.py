"""
NeuralForge — Data Cleaning API Routes
Enhanced cleaning endpoints for tabular, text, and image datasets.
"""

import os
from typing import Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_optional_user_id
from models.file import File
from schemas import CleaningResponse
from services.cleaning_service import CleaningService

router = APIRouter(prefix="/api/cleaning", tags=["cleaning"])


@router.post("/apply/{file_id}", response_model=CleaningResponse)
async def apply_cleaning(
    file_id: str,
    operations: list[dict] = Body(...),
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Apply cleaning operations to a dataset.
    Dispatches to the appropriate cleaner based on dataset type.

    For tabular/text datasets, operations format:
    [{"type": "impute", "column": "Age", "strategy": "mean"}, ...]

    For image datasets, operations format:
    [{"type": "remove_corrupt"}, {"type": "remove_duplicates", "threshold": 5}, ...]
    """
    # Fetch file
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    dataset_type = file_record.dataset_type or "tabular"

    # Update status
    file_record.cleaning_status = "in_progress"
    await db.flush()

    try:
        if dataset_type == "image":
            # Image cleaning
            img_meta = file_record.image_metadata or {}
            image_dir = img_meta.get("extracted_path")
            if not image_dir or not os.path.exists(image_dir):
                raise HTTPException(status_code=400, detail="Image dataset not found")

            result_data = CleaningService.clean_images(image_dir, operations)

            # Update file record
            file_record.cleaning_status = "cleaned"
            file_record.image_metadata = {
                **img_meta,
                "cleaning_report": result_data.get("report", {}),
                "total_images": result_data.get("remaining_images", img_meta.get("total_images", 0)),
            }
            await db.flush()

            return CleaningResponse(
                success=True,
                remaining_images=result_data.get("remaining_images"),
                report=result_data.get("report", {}),
            )

        elif dataset_type == "text":
            # Text cleaning
            result_data = CleaningService.clean_text(
                file_record.file_path, file_record.file_type, operations
            )

            if not result_data["success"]:
                file_record.cleaning_status = "pending"
                await db.flush()
                raise HTTPException(status_code=400, detail=result_data.get("error", "Cleaning failed"))

            # Update file record
            file_record.cleaning_status = "cleaned"
            file_record.cleaned_file_path = result_data["output_path"]
            file_record.analysis_report = {
                **(file_record.analysis_report or {}),
                "cleaning_report": result_data.get("report", {}),
            }
            await db.flush()

            return CleaningResponse(
                success=True,
                output_path=result_data["output_path"],
                rows=result_data["rows"],
                columns=result_data["columns"],
                report=result_data.get("report", {}),
            )

        else:
            # Tabular cleaning
            result_data = CleaningService.clean_tabular(
                file_record.file_path, file_record.file_type, operations
            )

            if not result_data["success"]:
                file_record.cleaning_status = "pending"
                await db.flush()
                raise HTTPException(status_code=400, detail=result_data.get("error", "Cleaning failed"))

            # Update file record
            file_record.cleaning_status = "cleaned"
            file_record.cleaned_file_path = result_data["output_path"]
            file_record.analysis_report = {
                **(file_record.analysis_report or {}),
                "cleaning_report": result_data.get("report", {}),
            }
            await db.flush()

            return CleaningResponse(
                success=True,
                output_path=result_data["output_path"],
                rows=result_data["rows"],
                columns=result_data["columns"],
                report=result_data.get("report", {}),
            )

    except HTTPException:
        raise
    except Exception as e:
        file_record.cleaning_status = "pending"
        await db.flush()
        raise HTTPException(status_code=500, detail=f"Cleaning error: {e}")


@router.get("/status/{file_id}")
async def get_cleaning_status(
    file_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the cleaning status for a file."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    report = {}
    if file_record.analysis_report:
        report = file_record.analysis_report.get("cleaning_report", {})

    return {
        "file_id": file_id,
        "status": file_record.cleaning_status,
        "cleaned_file_path": file_record.cleaned_file_path,
        "report": report,
    }


@router.post("/reset/{file_id}")
async def reset_cleaning(
    file_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Reset cleaning status back to pending."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove cleaned file if exists
    if file_record.cleaned_file_path and os.path.exists(file_record.cleaned_file_path):
        os.remove(file_record.cleaned_file_path)

    file_record.cleaning_status = "pending"
    file_record.cleaned_file_path = None
    await db.flush()

    return {"status": "reset", "file_id": file_id}
