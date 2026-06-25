"""
NeuralForge — Files API Routes
Universal file upload supporting text, image, and tabular datasets.
Dataset profiling and analysis endpoints.
"""

import os
import uuid
import shutil

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Form
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id, get_optional_user_id
from core.config import get_settings
from models.project import Project
from models.file import File
from schemas import FileResponse, DatasetProfileResponse, DatasetUploadResponse
from services.dataset_service import DatasetService, SUPPORTED_EXTENSIONS

router = APIRouter(prefix="/api/files", tags=["files"])
settings = get_settings()


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    project_id: str = Form(...),
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload any dataset file: CSV, XLSX, JSON, TXT, ZIP (images), or individual images.
    Validates, detects dataset type, and generates initial summary.
    """
    # Verify project ownership
    # Verify project ownership if not default project
    if project_id != "default_project":
        result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = result.scalar_one_or_none()
        if not project:
            # Allow creation of dummy project if it doesn't exist for dev purposes
            pass
        elif project.user_id is not None and project.user_id != user_id:
             raise HTTPException(status_code=404, detail="Project not found")

    # Read file content
    filename = file.filename or "unknown"
    ext = os.path.splitext(filename)[1].lower()
    content = await file.read()
    file_size = len(content)

    # Validate upload
    validation = DatasetService.validate_upload(filename, content, settings.max_upload_size_mb)
    if not validation["valid"]:
        raise HTTPException(
            status_code=400,
            detail="; ".join(validation["errors"]),
        )

    # Create upload directory
    file_id = str(uuid.uuid4())
    upload_dir = os.path.join(settings.upload_dir, project_id, file_id)
    os.makedirs(upload_dir, exist_ok=True)

    # Save file
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Detect dataset type
    dataset_type = DatasetService.detect_dataset_type(filename, file_path)

    # Initialize metadata
    row_count = None
    column_count = None
    columns_info = {}
    image_metadata = {}

    # Handle ZIP extraction for image datasets
    if ext == ".zip" and dataset_type == "image":
        extract_dir = os.path.join(upload_dir, "extracted")
        extraction = DatasetService.extract_zip(file_path, extract_dir)
        image_metadata = {
            "total_images": extraction["total_files"],
            "num_classes": len(extraction["classes"]),
            "classes": extraction["classes"],
            "structure": extraction["structure"],
            "extracted_path": extraction["extracted_path"],
        }

    # Parse tabular/text datasets for basic metadata
    elif dataset_type in ("tabular", "text"):
        try:
            df = DatasetService._load_dataframe(file_path, ext)
            if df is not None:
                row_count = len(df)
                column_count = len(df.columns)
                for col in df.columns:
                    columns_info[col] = {
                        "dtype": str(df[col].dtype),
                        "non_null_count": int(df[col].notna().sum()),
                        "null_count": int(df[col].isna().sum()),
                        "unique_count": int(df[col].nunique()),
                    }
        except Exception:
            pass

    # Create database record
    file_record = File(
        id=file_id,
        project_id=project_id,
        filename=filename,
        file_type=ext.lstrip("."),
        file_path=file_path,
        file_size=file_size,
        dataset_type=dataset_type,
        cleaning_status="pending",
        row_count=row_count,
        column_count=column_count,
        columns_info=columns_info,
        image_metadata=image_metadata,
    )
    db.add(file_record)
    await db.flush()

    # Generate summary
    summary = {"type": dataset_type, "file_size_mb": round(file_size / (1024 * 1024), 2)}
    if dataset_type in ("tabular", "text") and row_count:
        summary["rows"] = row_count
        summary["columns"] = column_count
        summary["column_names"] = list(columns_info.keys())
    elif dataset_type == "image":
        summary["total_images"] = image_metadata.get("total_images", 0)
        summary["num_classes"] = image_metadata.get("num_classes", 0)
        summary["classes"] = image_metadata.get("classes", {})

    return DatasetUploadResponse(
        file=FileResponse.model_validate(file_record),
        validation=validation,
        summary=summary,
    )


@router.get("/{file_id}", response_model=FileResponse)
async def get_file(
    file_id: str,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get file metadata."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse.model_validate(file_record)


@router.get("/{file_id}/profile", response_model=DatasetProfileResponse)
async def get_dataset_profile(
    file_id: str,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed dataset profiling results.
    Auto-dispatches to the correct profiler based on dataset type.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    dataset_type = file_record.dataset_type or "tabular"
    ext = file_record.file_type

    # Update status
    file_record.cleaning_status = "analyzing"
    await db.flush()

    try:
        if dataset_type == "image":
            # Profile image dataset
            img_meta = file_record.image_metadata or {}
            extracted_path = img_meta.get("extracted_path")
            classes = img_meta.get("classes", {})

            if not extracted_path or not os.path.exists(extracted_path):
                raise HTTPException(status_code=400, detail="Image dataset not extracted")

            profile = DatasetService.profile_image_dataset(extracted_path, classes)

            # Update DB
            file_record.image_metadata = {**img_meta, **profile}
            file_record.analysis_report = profile
            file_record.cleaning_status = "pending"
            await db.flush()

            return DatasetProfileResponse(
                file_id=file_id,
                filename=file_record.filename,
                dataset_type="image",
                image_metadata=profile,
                duplicate_info={
                    "groups": len(profile.get("duplicate_groups", [])),
                    "total_duplicates": sum(
                        len(g) - 1 for g in profile.get("duplicate_groups", [])
                    ),
                },
            )

        elif dataset_type == "text":
            profile = DatasetService.profile_text_dataset(file_record.file_path, ext)

            file_record.analysis_report = profile
            file_record.cleaning_status = "pending"
            await db.flush()

            return DatasetProfileResponse(
                file_id=file_id,
                filename=file_record.filename,
                dataset_type="text",
                row_count=profile.get("row_count"),
                column_count=profile.get("column_count"),
                columns=profile.get("columns", []),
                missing_values=profile.get("missing_values", {}),
                text_length_distribution=profile.get("text_length_distribution", {}),
                label_distribution=profile.get("label_distribution", {}),
                duplicate_info=profile.get("duplicate_records", {}),
            )

        else:
            # Tabular profiling
            profile = DatasetService.profile_tabular_dataset(file_record.file_path, ext)

            file_record.analysis_report = profile
            file_record.cleaning_status = "pending"
            await db.flush()

            return DatasetProfileResponse(
                file_id=file_id,
                filename=file_record.filename,
                dataset_type="tabular",
                row_count=profile.get("row_count"),
                column_count=profile.get("column_count"),
                columns=profile.get("columns", []),
                missing_values=profile.get("missing_values", {}),
                data_types=profile.get("data_types", {}),
                statistics=profile.get("statistics", {}),
                correlations=profile.get("correlations"),
                sample_data=profile.get("sample_data", []),
                outliers=profile.get("outliers", {}),
                feature_distributions=profile.get("feature_distributions", {}),
                duplicate_info=profile.get("duplicate_rows", {}),
            )

    except HTTPException:
        raise
    except Exception as e:
        file_record.cleaning_status = "pending"
        await db.flush()
        raise HTTPException(status_code=500, detail=f"Error profiling dataset: {e}")


@router.get("/project/{project_id}", response_model=list[FileResponse])
async def list_project_files(
    project_id: str,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all files for a project."""
    result = await db.execute(
        select(File).where(File.project_id == project_id).order_by(File.created_at.desc())
    )
    files = result.scalars().all()
    return [FileResponse.model_validate(f) for f in files]


@router.delete("/{file_id}", status_code=204)
async def delete_file(
    file_id: str,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a file and its associated data."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete the upload directory (includes extracted images, cleaned files)
    upload_dir = os.path.dirname(file_record.file_path)
    if os.path.exists(upload_dir):
        shutil.rmtree(upload_dir, ignore_errors=True)

    await db.delete(file_record)


@router.get("/{file_id}/preview")
async def preview_dataset(
    file_id: str,
    rows: int = 20,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a preview of the dataset (first N rows for tabular/text, sample images for image)."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.dataset_type == "image":
        # Return sample image filenames
        img_meta = file_record.image_metadata or {}
        extracted_path = img_meta.get("extracted_path", "")
        samples = []
        if os.path.exists(extracted_path):
            from services.dataset_service import IMAGE_EXTENSIONS
            count = 0
            for root, dirs, files in os.walk(extracted_path):
                dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
                for f in files:
                    if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS and not f.startswith("."):
                        rel_path = os.path.relpath(os.path.join(root, f), extracted_path)
                        samples.append(rel_path)
                        count += 1
                        if count >= rows:
                            break
                if count >= rows:
                    break
        return {"type": "image", "samples": samples, "total": img_meta.get("total_images", 0)}

    else:
        # Tabular/text preview
        try:
            df = DatasetService._load_dataframe(file_record.file_path, file_record.file_type)
            if df is not None:
                return {
                    "type": file_record.dataset_type,
                    "data": df.head(rows).fillna("").to_dict(orient="records"),
                    "columns": list(df.columns),
                    "total_rows": len(df),
                }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading dataset: {e}")

    return {"type": file_record.dataset_type, "data": [], "columns": []}
