"""
NeuralForge — Training API Routes
Submit training jobs to the Celery queue (or in-process fallback),
monitor progress, and manage jobs. Now uses dynamic model catalog generation.
"""

import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_optional_user_id
from models.project import Project
from models.file import File
from models.training_job import TrainingJob
from models.trained_model import TrainedModel
from schemas import (
    TrainingStartRequest, AutoMLStartRequest,
    TrainingJobResponse, TrainingJobListResponse,
    TrainedModelResponse,
    ModelCatalogEntry, ModelCatalogResponse,
)

logger = logging.getLogger("neuralforge.api.training")
router = APIRouter(prefix="/api/training", tags=["training"])


@router.get("/models/{task_type}", response_model=ModelCatalogResponse)
async def get_available_models(
    task_type: str,
    file_id: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    List available model architectures dynamically based on dataset.
    Never returns hardcoded catalogs.
    """
    from services.advisor_service import MODEL_DB, get_recommendations

    if file_id:
        # Generate dynamically based on dataset
        result = await db.execute(select(File).where(File.id == file_id))
        file_record = result.scalar_one_or_none()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")

        import os
        file_path = file_record.cleaned_file_path or file_record.file_path
        if file_path and os.path.exists(file_path) and file_record.dataset_type != "image":
            from services.dataset_analyzer import DatasetAnalyzer
            analyzer = DatasetAnalyzer()
            profile = analyzer.analyze(file_path)
        else:
            profile = {
                "dataset_type": file_record.dataset_type or "tabular",
                "row_count": file_record.row_count,
                "column_count": file_record.column_count,
            }

        recs = get_recommendations(profile, task_type=task_type, top_n=20)
        
        models = []
        for rec in recs["recommendations"]:
            models.append(ModelCatalogEntry(
                name=rec["model_key"],
                display_name=rec["display_name"],
                task_types=[task_type],
                description=rec["explanation"],
                parameters=rec["parameters"],
                recommended=rec["is_recommended"]
            ))
        
        if not models:
            raise HTTPException(status_code=404, detail=f"No models found for task type: {task_type}")
            
        return ModelCatalogResponse(task_type=task_type, models=models)

    else:
        # Return all eligible models for the task type without dataset context
        models = []
        for key, info in MODEL_DB.items():
            if task_type in info.get("task_types", []):
                models.append(ModelCatalogEntry(
                    name=key,
                    display_name=info["display_name"],
                    task_types=info["task_types"],
                    description=" ".join(info.get("strengths", [])),
                    parameters=info.get("parameters", "N/A"),
                    recommended=False
                ))

        if not models:
            raise HTTPException(status_code=404, detail=f"Unknown task type: {task_type}")

        return ModelCatalogResponse(task_type=task_type, models=models)


@router.post("/start", response_model=TrainingJobResponse)
async def start_training(
    request: TrainingStartRequest,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Submit a training job. Uses Celery if available, otherwise runs in-process."""
    # Verify file exists
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    project_id = file_record.project_id
    effective_user_id = user_id or "guest_user"

    # Verify project ownership only for authenticated (non-guest) users
    if user_id and user_id != "guest_user" and project_id:
        result = await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Project not found")

    job_id = str(uuid.uuid4())
    epochs = request.training_config.get("n_estimators", request.training_config.get("epochs", 100))

    job = TrainingJob(
        id=job_id,
        project_id=project_id,
        file_id=request.file_id,
        user_id=effective_user_id,
        task_type=request.task_type,
        model_name=request.model_name,
        model_config=request.model_config,
        training_config=request.training_config,
        augmentation_config=request.augmentation_config,
        target_column=request.target_column,
        status="queued",
        total_epochs=epochs,
    )
    db.add(job)
    await db.flush()

    task_type = request.task_type.lower()
    
    # Check if Celery is actually reachable
    celery_available = False
    try:
        from workers.celery_app import app as celery_app
        # Simple ping to check if broker is up
        celery_app.control.ping(timeout=0.5)
        celery_available = True
    except Exception:
        logger.warning("Celery broker not reachable. Falling back to in-process training.")

    try:
        if celery_available:
            # Dispatch to Celery
            if task_type in ("tabular_classification", "tabular_regression"):
                from workers.training_tasks import train_tabular
                file_path = file_record.cleaned_file_path or file_record.file_path
                celery_task = train_tabular.delay(
                    job_id, file_path, request.target_column,
                    request.model_name, request.training_config,
                )
            elif task_type == "image_classification":
                from workers.training_tasks import train_image_classification
                img_meta = file_record.image_metadata or {}
                dataset_path = img_meta.get("extracted_path", "")
                celery_task = train_image_classification.delay(
                    job_id, dataset_path, request.model_name,
                    request.training_config, request.augmentation_config,
                )
            elif task_type in ("text_classification", "sentiment_analysis"):
                from workers.training_tasks import train_text_classification
                file_path = file_record.cleaned_file_path or file_record.file_path
                text_col = request.model_config.get("text_column", "text")
                celery_task = train_text_classification.delay(
                    job_id, file_path, request.target_column,
                    text_col, request.model_name, request.training_config,
                )
            elif task_type == "object_detection":
                from workers.training_tasks import train_object_detection
                img_meta = file_record.image_metadata or {}
                dataset_path = img_meta.get("extracted_path", "")
                celery_task = train_object_detection.delay(
                    job_id, dataset_path, request.model_name, request.training_config,
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported task type: {task_type}")

            job.celery_task_id = celery_task.id
            await db.flush()

        else:
            # In-process Fallback
            if task_type in ("tabular_classification", "tabular_regression"):
                from workers.training_tasks import train_tabular
                file_path = file_record.cleaned_file_path or file_record.file_path
                background_tasks.add_task(
                    train_tabular, job_id, file_path, request.target_column,
                    request.model_name, request.training_config
                )
            else:
                raise HTTPException(
                    status_code=400, 
                    detail=f"In-process fallback currently only supports tabular tasks. Please start Celery for {task_type}."
                )
            
            job.celery_task_id = "in_process_" + job_id
            await db.flush()

    except Exception as e:
        job.status = "failed"
        job.error_message = f"Failed to start training: {str(e)}"
        await db.flush()

    return TrainingJobResponse.model_validate(job)


@router.post("/automl", response_model=TrainingJobResponse)
async def start_automl(
    request: AutoMLStartRequest,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Start an AutoML pipeline that tries multiple models and selects the best."""
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    project_id = file_record.project_id
    effective_user_id_automl = user_id or "guest_user"

    if user_id and user_id != "guest_user" and project_id:
        result = await db.execute(
            select(Project).where(Project.id == project_id, Project.user_id == user_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Project not found")

    job_id = str(uuid.uuid4())
    job = TrainingJob(
        id=job_id,
        project_id=project_id,
        file_id=request.file_id,
        user_id=effective_user_id_automl,
        task_type=request.task_type or "tabular_classification",
        model_name="AutoML",
        training_config=request.training_config,
        target_column=request.target_column,
        is_automl=True,
        status="queued",
    )
    db.add(job)
    await db.flush()

    # Check Celery
    celery_available = False
    try:
        from workers.celery_app import app as celery_app
        celery_app.control.ping(timeout=0.5)
        celery_available = True
    except Exception:
        pass

    try:
        from workers.training_tasks import train_automl
        file_path = file_record.cleaned_file_path or file_record.file_path
        
        if celery_available:
            celery_task = train_automl.delay(
                job_id, file_path, request.target_column, request.training_config,
            )
            job.celery_task_id = celery_task.id
        else:
            background_tasks.add_task(
                train_automl, job_id, file_path, request.target_column, request.training_config
            )
            job.celery_task_id = "in_process_" + job_id
            
        await db.flush()
    except Exception as e:
        job.status = "failed"
        job.error_message = f"Failed to start AutoML: {str(e)}"
        await db.flush()

    return TrainingJobResponse.model_validate(job)


@router.get("/jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job(
    job_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get training job status and metrics."""
    result = await db.execute(
        select(TrainingJob).where(TrainingJob.id == job_id, TrainingJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")
    return TrainingJobResponse.model_validate(job)


@router.get("/jobs", response_model=TrainingJobListResponse)
async def list_training_jobs(
    project_id: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all training jobs, optionally filtered by project."""
    query = select(TrainingJob).where(TrainingJob.user_id == user_id)
    if project_id:
        query = query.where(TrainingJob.project_id == project_id)
    query = query.order_by(TrainingJob.created_at.desc())

    result = await db.execute(query)
    jobs = result.scalars().all()
    return TrainingJobListResponse(
        jobs=[TrainingJobResponse.model_validate(j) for j in jobs],
        total=len(jobs),
    )


@router.post("/cancel/{job_id}")
async def cancel_training(
    job_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running training job."""
    result = await db.execute(
        select(TrainingJob).where(TrainingJob.id == job_id, TrainingJob.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Training job not found")

    if job.status not in ("queued", "training"):
        raise HTTPException(status_code=400, detail=f"Cannot cancel job with status: {job.status}")

    # Revoke Celery task if applicable
    if job.celery_task_id and not str(job.celery_task_id).startswith("in_process_"):
        try:
            from workers.celery_app import app as celery_app
            celery_app.control.revoke(job.celery_task_id, terminate=True)
        except Exception:
            pass

    job.status = "cancelled"
    job.completed_at = datetime.now(timezone.utc)
    await db.flush()

    return {"status": "cancelled", "job_id": job_id}


@router.get("/models-trained/{project_id}", response_model=list[TrainedModelResponse])
async def list_trained_models(
    project_id: str,
    user_id: Optional[str] = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all trained models for a project."""
    effective = user_id or "guest_user"
    result = await db.execute(
        select(TrainedModel).where(
            TrainedModel.project_id == project_id,
        ).order_by(TrainedModel.created_at.desc())
    )
    models = result.scalars().all()
    # Return models owned by this user OR by guest (for files uploaded without auth)
    visible = [m for m in models if m.user_id == effective or m.user_id == "guest_user" or m.user_id is None]
    return [TrainedModelResponse.model_validate(m) for m in visible]
