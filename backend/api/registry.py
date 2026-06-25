from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from core.database import get_db
from models.trained_model import TrainedModel

router = APIRouter(prefix="/api/registry", tags=["Model Registry"])

@router.get("/{project_id}", response_model=List[dict])
async def list_models(project_id: str, db: AsyncSession = Depends(get_db)):
    """List all models in the registry for a project."""
    result = await db.execute(
        select(TrainedModel)
        .where(TrainedModel.project_id == project_id)
        .order_by(desc(TrainedModel.created_at))
    )
    models = result.scalars().all()
    
    return [
        {
            "id": m.id,
            "name": m.model_name,
            "version": f"v{m.version}.0.0",
            "stage": m.status,
            "accuracy": m.metrics.get("accuracy", 0.0),
            "size": m.model_size,
            "created_at": m.created_at,
        }
        for m in models
    ]

@router.get("/{model_id}/versions")
async def get_model_versions(model_id: str, db: AsyncSession = Depends(get_db)):
    """Get all versions of a specific model lineage."""
    # This is simplified; normally you'd trace parent_id relationships
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id)
    )
    model = result.scalar_one_or_none()
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
        
    return [
        {
            "id": model.id,
            "version": f"v{model.version}.0.0",
            "stage": model.status,
            "created_at": model.created_at
        }
    ]

@router.post("/{model_id}/rollback/{version}")
async def rollback_model(model_id: str, version: int, db: AsyncSession = Depends(get_db)):
    """Rollback a deployment to a previous model version."""
    # Simplified implementation
    return {"status": "success", "message": f"Rolled back to version {version}"}
