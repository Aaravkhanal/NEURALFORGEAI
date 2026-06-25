"""
NeuralForge — Export API Routes
Endpoints for exporting cleaned datasets, trained models in multiple formats,
deployment packages, and auto-generated production code.
"""

import os
import io
import json
import shutil
import zipfile
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse as FastAPIFileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings
from models.file import File
from models.trained_model import TrainedModel

router = APIRouter(prefix="/api/export", tags=["export"])
settings = get_settings()


# ============================================================
# Cleaned Dataset Exports (existing)
# ============================================================

@router.get("/cleaned/{file_id}")
async def export_cleaned_dataset(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Export cleaned dataset as a ZIP file.
    Preserves folder structure, labels, and metadata for image datasets.
    For tabular/text, exports the cleaned CSV.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.cleaning_status != "cleaned":
        raise HTTPException(
            status_code=400,
            detail="Dataset has not been cleaned yet. Apply cleaning operations first.",
        )

    dataset_type = file_record.dataset_type or "tabular"

    if dataset_type == "image":
        # ZIP the cleaned image directory
        img_meta = file_record.image_metadata or {}
        image_dir = img_meta.get("extracted_path")

        if not image_dir or not os.path.exists(image_dir):
            raise HTTPException(status_code=400, detail="Cleaned image directory not found")

        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(image_dir):
                dirs[:] = [d for d in dirs if not d.startswith(".") and d != "__MACOSX"]
                for f in files:
                    if not f.startswith("."):
                        full_path = os.path.join(root, f)
                        arc_name = os.path.relpath(full_path, image_dir)
                        zf.write(full_path, arc_name)

            # Add metadata file
            metadata = {
                "original_filename": file_record.filename,
                "dataset_type": "image",
                "total_images": img_meta.get("total_images", 0),
                "classes": img_meta.get("classes", {}),
                "cleaning_report": img_meta.get("cleaning_report", {}),
            }
            zf.writestr("_metadata.json", json.dumps(metadata, indent=2))

        zip_buffer.seek(0)
        filename = f"{os.path.splitext(file_record.filename)[0]}_cleaned.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    else:
        # Tabular/Text — return cleaned CSV or ZIP with metadata
        cleaned_path = file_record.cleaned_file_path
        if not cleaned_path or not os.path.exists(cleaned_path):
            raise HTTPException(status_code=400, detail="Cleaned file not found")

        # Create ZIP with cleaned file + metadata
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(cleaned_path, os.path.basename(cleaned_path))

            # Add metadata
            report = file_record.analysis_report or {}
            cleaning_report = report.get("cleaning_report", {})
            metadata = {
                "original_filename": file_record.filename,
                "dataset_type": dataset_type,
                "rows_before": cleaning_report.get("rows_before"),
                "rows_after": cleaning_report.get("rows_after"),
                "columns_before": cleaning_report.get("columns_before"),
                "columns_after": cleaning_report.get("columns_after"),
                "operations_applied": cleaning_report.get("operations_applied", []),
            }
            zf.writestr("_metadata.json", json.dumps(metadata, indent=2))

        zip_buffer.seek(0)
        filename = f"{os.path.splitext(file_record.filename)[0]}_cleaned.zip"

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )


@router.get("/cleaned/{file_id}/csv")
async def export_cleaned_csv(
    file_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Direct CSV download for tabular/text cleaned datasets."""
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.dataset_type == "image":
        raise HTTPException(status_code=400, detail="Use /cleaned/{file_id} for image datasets")

    cleaned_path = file_record.cleaned_file_path
    if not cleaned_path or not os.path.exists(cleaned_path):
        raise HTTPException(status_code=400, detail="Cleaned file not found")

    filename = f"{os.path.splitext(file_record.filename)[0]}_cleaned.csv"

    return FastAPIFileResponse(
        path=cleaned_path,
        media_type="text/csv",
        filename=filename,
    )


# ============================================================
# Model Export — Multi-Format Download
# ============================================================

@router.get("/model/{model_id}/formats")
async def get_model_export_formats(
    model_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List available export formats for a trained model."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    # Get available formats from the stored export_formats dict
    stored_formats = model_record.export_formats or {}

    # Build the format list with metadata
    format_list = []
    format_metadata = {
        "pkl": {"label": "Pickle (.pkl)", "icon": "📦", "description": "Python standard serialization"},
        "joblib": {"label": "Joblib (.joblib)", "icon": "⚙️", "description": "Optimized for NumPy arrays, best for sklearn"},
        "onnx": {"label": "ONNX (.onnx)", "icon": "🔄", "description": "Cross-platform inference runtime"},
        "json": {"label": "XGBoost JSON (.json)", "icon": "📋", "description": "Native XGBoost portable format"},
        "bst": {"label": "XGBoost Binary (.bst)", "icon": "⚡", "description": "Fast-loading XGBoost binary"},
        "txt": {"label": "LightGBM (.txt)", "icon": "📝", "description": "Native LightGBM text format"},
        "h5": {"label": "Keras H5 (.h5)", "icon": "🧪", "description": "TensorFlow/Keras SavedModel"},
        "pt": {"label": "PyTorch (.pt)", "icon": "🔥", "description": "PyTorch state dict"},
        "pth": {"label": "PyTorch (.pth)", "icon": "🔥", "description": "PyTorch checkpoint"},
    }

    for fmt, path in stored_formats.items():
        if path and os.path.exists(path):
            meta = format_metadata.get(fmt, {"label": f".{fmt}", "icon": "📁", "description": ""})
            format_list.append({
                "format": fmt,
                "label": meta["label"],
                "icon": meta["icon"],
                "description": meta["description"],
                "size_bytes": os.path.getsize(path),
                "available": True,
            })

    # Also check the primary model file
    if model_record.model_path and os.path.exists(model_record.model_path):
        primary_fmt = model_record.model_format
        if not any(f["format"] == primary_fmt for f in format_list):
            meta = format_metadata.get(primary_fmt, {"label": f".{primary_fmt}", "icon": "📁", "description": ""})
            format_list.append({
                "format": primary_fmt,
                "label": meta["label"],
                "icon": meta["icon"],
                "description": meta["description"],
                "size_bytes": os.path.getsize(model_record.model_path),
                "available": True,
            })

    return {
        "model_id": model_id,
        "model_name": model_record.model_name,
        "formats": format_list,
    }


@router.get("/model/{model_id}")
async def download_model(
    model_id: str,
    format: str = Query("joblib", description="Export format: pkl, joblib, onnx, h5, pt, json, txt"),
    db: AsyncSession = Depends(get_db),
):
    """Download a trained model in a specific format."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    # Check stored export formats
    export_formats = model_record.export_formats or {}

    # Try to find the requested format
    file_path = None

    if format == model_record.model_format:
        file_path = model_record.model_path
    elif format in export_formats:
        file_path = export_formats[format]

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(
            status_code=404,
            detail=f"Model not available in format '{format}'. Use /formats to see available options."
        )

    filename = f"{model_record.model_name}_v{model_record.version}.{format}"

    return FastAPIFileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=filename,
    )


# ============================================================
# Full Project Package Download
# ============================================================

@router.get("/package/{model_id}")
async def download_full_package(
    model_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Download a complete deployment package (ZIP) for a trained model."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    if not model_record.model_path or not os.path.exists(model_record.model_path):
        raise HTTPException(status_code=400, detail="Model file not found on disk")

    from services.deployment_packager import DeploymentPackagerService
    from services.model_artifact import ModelArtifactService

    # Generate model card
    model_card = ModelArtifactService(settings.upload_dir).generate_model_card(
        model_info={
            "model_name": model_record.model_name,
            "task_type": model_record.task_type,
            "algorithm": model_record.model_name,
            "version": model_record.version,
        },
        dataset_info=model_record.dataset_info or {},
        metrics=model_record.metrics or {},
    )

    try:
        package_bytes = DeploymentPackagerService.create_full_project_package(
            model_path=model_record.model_path,
            model_format=model_record.model_format,
            model_name=model_record.model_name,
            task_type=model_record.task_type,
            feature_names=model_record.feature_names or [],
            target_column=(model_record.dataset_info or {}).get("target"),
            num_features=len(model_record.feature_names) if model_record.feature_names else None,
            preprocessing_path=model_record.preprocessing_path,
            model_card_md=model_card,
            extra_model_paths=model_record.export_formats or {},
        )
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail="Model file not found on disk")

    filename = f"{model_record.model_name}_v{model_record.version}_deployment.zip"

    return StreamingResponse(
        io.BytesIO(package_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ============================================================
# Production Code Generation
# ============================================================

@router.get("/code/{model_id}")
async def get_production_code(
    model_id: str,
    target: str = Query("fastapi", description="Target: python, fastapi, flask, streamlit, docker, aws, gcp, azure, huggingface"),
    db: AsyncSession = Depends(get_db),
):
    """Generate production-ready code for a specific deployment target."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    from services.production_codegen import ProductionCodegenService

    code_result = ProductionCodegenService.generate(
        target=target,
        model_format=model_record.model_format,
        model_name=model_record.model_name,
        task_type=model_record.task_type,
        feature_names=model_record.feature_names or [],
        target_column=(model_record.dataset_info or {}).get("target"),
        num_features=len(model_record.feature_names) if model_record.feature_names else None,
    )

    return {
        "model_id": model_id,
        "target": target,
        **code_result,
    }


@router.get("/code/targets")
async def get_code_targets():
    """List available code generation targets."""
    from services.production_codegen import ProductionCodegenService
    return {"targets": ProductionCodegenService.get_available_targets()}
