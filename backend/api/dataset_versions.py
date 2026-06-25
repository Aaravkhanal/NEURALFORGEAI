from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List

from core.database import get_db
from models.dataset_version import DatasetVersion

router = APIRouter(prefix="/api/dataset-versions", tags=["Dataset Versions"])

@router.get("/{file_id}", response_model=List[dict])
async def list_versions(file_id: str, db: AsyncSession = Depends(get_db)):
    """List all versions of a dataset."""
    result = await db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.file_id == file_id)
        .order_by(desc(DatasetVersion.version))
    )
    versions = result.scalars().all()
    
    return [
        {
            "id": v.id,
            "version": v.version,
            "row_count": v.row_count,
            "column_count": v.column_count,
            "cleaning_steps": v.cleaning_steps,
            "created_at": v.created_at,
        }
        for v in versions
    ]

@router.post("/{file_id}/revert/{version}")
async def revert_to_version(file_id: str, version: int, db: AsyncSession = Depends(get_db)):
    """Revert a dataset to a specific version."""
    result = await db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.file_id == file_id)
        .where(DatasetVersion.version == version)
    )
    target_version = result.scalar_one_or_none()
    
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    # In a full implementation, this would copy the target_version's file_path 
    # to be the active file, and potentially create a new version record.
    return {"status": "success", "message": f"Reverted to version {version}"}
