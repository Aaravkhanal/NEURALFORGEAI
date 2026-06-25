from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from core.database import get_db
from models.experiment import Experiment

router = APIRouter(prefix="/api/experiments", tags=["Experiments"])

@router.get("/{project_id}", response_model=List[dict])
async def list_experiments(project_id: str, db: AsyncSession = Depends(get_db)):
    """List all experiments for a project (MLflow style)."""
    result = await db.execute(
        select(Experiment)
        .where(Experiment.project_id == project_id)
        .order_by(desc(Experiment.created_at))
    )
    experiments = result.scalars().all()
    
    return [
        {
            "id": exp.id,
            "name": exp.name,
            "status": exp.status,
            "hyperparameters": exp.hyperparameters,
            "metrics": exp.metrics,
            "created_at": exp.created_at,
            "duration_seconds": exp.duration_seconds
        }
        for exp in experiments
    ]

@router.get("/detail/{experiment_id}")
async def get_experiment(experiment_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed experiment info."""
    result = await db.execute(
        select(Experiment).where(Experiment.id == experiment_id)
    )
    exp = result.scalar_one_or_none()
    
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found")
        
    return {
        "id": exp.id,
        "name": exp.name,
        "description": exp.description,
        "status": exp.status,
        "hyperparameters": exp.hyperparameters,
        "metrics": exp.metrics,
        "artifacts": exp.artifacts,
        "created_at": exp.created_at,
    }
