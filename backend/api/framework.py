"""
NeuralForge — Framework Recommendation API
Endpoints for recommending ML frameworks based on dataset analysis.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from core.database import get_db
from core.security import get_current_user_id, get_optional_user_id
from models.file import File

logger = logging.getLogger("neuralforge.api.framework")
router = APIRouter(prefix="/api/framework", tags=["framework"])


class FrameworkRecommendRequest(BaseModel):
    file_id: Optional[str] = None
    problem_type: Optional[str] = None
    target_column: Optional[str] = None
    problem_statement: Optional[str] = None


@router.post("/recommend")
async def recommend_frameworks(
    request: FrameworkRecommendRequest,
    user_id: str | None = Depends(get_optional_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Recommend ML frameworks based on dataset analysis.
    Returns ranked frameworks with scores and explanations.
    """
    from services.framework_advisor import recommend_frameworks as _recommend
    from services.dataset_analyzer import DatasetAnalyzer

    dataset_profile = {}

    if request.file_id:
        # Analyze actual dataset
        result = await db.execute(select(File).where(File.id == request.file_id))
        file_record = result.scalar_one_or_none()
        if not file_record:
            raise HTTPException(status_code=404, detail="File not found")

        import os
        file_path = file_record.cleaned_file_path or file_record.file_path
        if file_path and os.path.exists(file_path):
            analyzer = DatasetAnalyzer()
            dataset_profile = analyzer.analyze(
                file_path,
                target_column=request.target_column,
                problem_statement=request.problem_statement,
            )

    if not dataset_profile:
        # Minimal profile for recommendation
        dataset_profile = {
            "problem_type": request.problem_type or "tabular_classification",
            "row_count": 0,
            "column_count": 0,
            "data_quality": {},
        }

    recommendations = _recommend(
        dataset_profile,
        problem_type=request.problem_type,
    )

    return {
        "problem_type": dataset_profile.get("problem_type", request.problem_type),
        "recommendations": recommendations,
    }
