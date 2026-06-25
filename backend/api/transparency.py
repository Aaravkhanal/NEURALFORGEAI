"""
NeuralForge — Transparency API Routes
Training transparency reports, explainability exports, and chart data endpoints.
"""

import io
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from core.config import get_settings
from models.trained_model import TrainedModel
from models.training_job import TrainingJob

logger = logging.getLogger("neuralforge.transparency_api")
router = APIRouter(prefix="/api/transparency", tags=["transparency"])
settings = get_settings()


@router.get("/report/{model_id}")
async def get_training_report(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the full training transparency report as JSON."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    # Check if report is already cached
    if model_record.transparency_report:
        return model_record.transparency_report

    # Generate report on-the-fly
    from services.transparency_service import TransparencyService

    # Get training job info
    training_job_info = {}
    if model_record.training_job_id:
        job_result = await db.execute(
            select(TrainingJob).where(TrainingJob.id == model_record.training_job_id)
        )
        job = job_result.scalar_one_or_none()
        if job:
            training_job_info = {
                "total_epochs": job.total_epochs,
                "best_epoch": job.metrics.get("best_epoch") if job.metrics else None,
                "training_curves": {
                    "train_loss": job.metrics.get("train_loss", []) if job.metrics else [],
                    "val_loss": job.metrics.get("val_loss", []) if job.metrics else [],
                    "val_accuracy": job.metrics.get("val_accuracy", []) if job.metrics else [],
                },
                "automl_results": job.automl_results or {},
            }

    report = TransparencyService.generate_training_report(
        model_name=model_record.model_name,
        task_type=model_record.task_type,
        metrics=model_record.metrics or {},
        dataset_info=model_record.dataset_info or {},
        training_params=model_record.training_params or {},
        feature_names=model_record.feature_names or [],
        feature_importance=model_record.global_shap_values or {},
        automl_results=training_job_info.get("automl_results"),
        training_job_info=training_job_info,
    )

    # Cache report on the model record
    model_record.transparency_report = report
    await db.flush()

    return report


@router.get("/report/{model_id}/export")
async def export_report(
    model_id: str,
    format: str = Query("html", description="Export format: json, html, pdf"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Download the training report as PDF, HTML, or JSON."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    from services.transparency_service import TransparencyService

    # Get or generate report
    report = model_record.transparency_report
    if not report:
        # Generate minimal report
        report = TransparencyService.generate_training_report(
            model_name=model_record.model_name,
            task_type=model_record.task_type,
            metrics=model_record.metrics or {},
            dataset_info=model_record.dataset_info or {},
            training_params=model_record.training_params or {},
            feature_names=model_record.feature_names or [],
            feature_importance=model_record.global_shap_values or {},
        )

    safe_name = model_record.model_name.replace(" ", "_").lower()

    if format == "json":
        content = TransparencyService.export_report_json(report)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}_report.json"'},
        )

    elif format == "html":
        content = TransparencyService.export_report_html(report)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="text/html",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}_report.html"'},
        )

    elif format == "pdf":
        content = TransparencyService.export_report_pdf(report)
        if not content:
            raise HTTPException(status_code=500, detail="PDF generation failed. Ensure reportlab is installed.")
        return StreamingResponse(
            io.BytesIO(content),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}_report.pdf"'},
        )

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {format}. Use json, html, or pdf.")


@router.get("/report/{model_id}/charts")
async def get_report_charts(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get chart data for the transparency dashboard.
    Returns: feature importance, confusion matrix data, training curves, leaderboard.
    """
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Trained model not found")

    charts = {
        "feature_importance": model_record.global_shap_values or {},
        "metrics": model_record.metrics or {},
        "training_curves": {},
        "leaderboard": [],
    }

    # Get training curves from training job
    if model_record.training_job_id:
        job_result = await db.execute(
            select(TrainingJob).where(TrainingJob.id == model_record.training_job_id)
        )
        job = job_result.scalar_one_or_none()
        if job and job.metrics:
            charts["training_curves"] = {
                "train_loss": job.metrics.get("train_loss", []),
                "val_loss": job.metrics.get("val_loss", []),
                "train_accuracy": job.metrics.get("train_accuracy", []),
                "val_accuracy": job.metrics.get("val_accuracy", []),
            }
            if job.automl_results and "leaderboard" in job.automl_results:
                charts["leaderboard"] = job.automl_results["leaderboard"]

    return charts
