import logging
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel

from core.database import get_db
from models.trained_model import TrainedModel
from models.training_job import TrainingJob

logger = logging.getLogger("neuralforge.api.models_history")
router = APIRouter(prefix="/api/models", tags=["Model History"])


class ModelHistoryResponse(BaseModel):
    id: str
    version: int
    model_name: str
    task_type: str
    epoch: Optional[int]
    status: str
    is_best: bool
    branch_name: str
    parent_id: Optional[str]
    metrics: Dict[str, Any]
    training_params: Dict[str, Any]
    dataset_info: Dict[str, Any]
    created_at: str

    class Config:
        from_attributes = True


@router.get("/{project_id}/history", response_model=List[ModelHistoryResponse])
async def get_model_history(project_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch the version history of trained models for a project."""
    stmt = select(TrainedModel).where(TrainedModel.project_id == project_id).order_by(desc(TrainedModel.version))
    result = await db.execute(stmt)
    models = result.scalars().all()
    
    # Format response
    history = []
    for m in models:
        history.append(ModelHistoryResponse(
            id=m.id,
            version=m.version,
            model_name=m.model_name,
            task_type=m.task_type,
            epoch=m.epoch,
            status=m.status,
            is_best=m.is_best,
            branch_name=m.branch_name,
            parent_id=m.parent_id,
            metrics=m.metrics or {},
            training_params=m.training_params or {},
            dataset_info=m.dataset_info or {},
            created_at=m.created_at.isoformat() if m.created_at else ""
        ))
    return history


@router.get("/{project_id}/performance")
async def get_model_performance_tracking(project_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch aggregated metrics across versions for plotting."""
    stmt = select(TrainedModel).where(TrainedModel.project_id == project_id).order_by(TrainedModel.version)
    result = await db.execute(stmt)
    models = result.scalars().all()

    versions = []
    accuracies = []
    val_losses = []
    precisions = []
    recalls = []
    f1s = []

    for m in models:
        metrics = m.metrics or {}
        versions.append(f"v{m.version}")
        accuracies.append(metrics.get("val_accuracy", metrics.get("accuracy", 0)))
        val_losses.append(metrics.get("val_loss", metrics.get("loss", 0)))
        precisions.append(metrics.get("val_precision", metrics.get("precision", 0)))
        recalls.append(metrics.get("val_recall", metrics.get("recall", 0)))
        f1s.append(metrics.get("val_f1", metrics.get("f1", 0)))

    return {
        "versions": versions,
        "metrics": {
            "accuracy": accuracies,
            "val_loss": val_losses,
            "precision": precisions,
            "recall": recalls,
            "f1": f1s
        }
    }


@router.get("/{project_id}/recommendation")
async def get_model_recommendation(project_id: str, db: AsyncSession = Depends(get_db)):
    """AI automatically identifies the best performing and best generalized version."""
    stmt = select(TrainedModel).where(TrainedModel.project_id == project_id)
    result = await db.execute(stmt)
    models = result.scalars().all()

    if not models:
        return {"recommended_version": None, "reason": "No models trained yet."}

    # Evaluate best model based on validation metrics and generalization gap
    best_model = None
    best_score = -float('inf')
    
    for m in models:
        metrics = m.metrics or {}
        val_acc = metrics.get("val_accuracy", metrics.get("accuracy", 0))
        train_acc = metrics.get("train_accuracy", val_acc)
        val_loss = metrics.get("val_loss", metrics.get("loss", 999))
        
        # Penalize overfitting: if train_acc is much higher than val_acc
        gap = max(0, train_acc - val_acc)
        overfitting_penalty = gap * 1.5 if gap > 5 else 0
        
        # Basic heuristic score
        score = (val_acc * 10) - (val_loss * 50) - overfitting_penalty
        
        if m.status == "Overfitted":
            score -= 1000 # Heavily penalize explicitly overfitted models

        if score > best_score:
            best_score = score
            best_model = m

    if not best_model:
        return {"recommended_version": None, "reason": "Could not determine a stable model."}

    return {
        "recommended_version": best_model.version,
        "recommended_id": best_model.id,
        "reason": f"Version {best_model.version} provides the best balance of performance and generalization. "
                  f"It achieved {best_model.metrics.get('val_accuracy', 0):.1f}% validation accuracy "
                  f"with a low validation loss of {best_model.metrics.get('val_loss', 0):.4f}, "
                  f"showing no significant signs of overfitting."
    }


@router.post("/{model_id}/restore")
async def restore_model_version(model_id: str, db: AsyncSession = Depends(get_db)):
    """Rollback to a specific version (sets it as the current active/best model)."""
    stmt = select(TrainedModel).where(TrainedModel.id == model_id)
    result = await db.execute(stmt)
    model_to_restore = result.scalars().first()

    if not model_to_restore:
        raise HTTPException(status_code=404, detail="Model not found")

    # Clear is_best flag for all other models in the project
    reset_stmt = select(TrainedModel).where(TrainedModel.project_id == model_to_restore.project_id)
    reset_result = await db.execute(reset_stmt)
    for m in reset_result.scalars().all():
        m.is_best = False

    model_to_restore.is_best = True
    model_to_restore.status = "Best Model"
    
    await db.commit()
    
    return {"status": "success", "message": f"Successfully restored Version {model_to_restore.version}"}
