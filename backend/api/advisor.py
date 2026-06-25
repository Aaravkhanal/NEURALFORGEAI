"""
NeuralForge — Advisor & Health Score API Routes
AI-powered model recommendations, explanations, and dataset health scoring.
Now uses DatasetAnalyzer for dynamic analysis and LLM-powered recommendations.
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from models.file import File
from services.advisor_service import get_recommendations, get_model_detail
from services.health_score_service import compute_health_score

logger = logging.getLogger("neuralforge.api.advisor")

router = APIRouter(prefix="/api/advisor", tags=["advisor"])


# ── Request / Response Schemas ────────────────────────────────

class AdvisorRequest(BaseModel):
    file_id: str
    task_type: Optional[str] = None  # Auto-detect if not provided
    target_column: Optional[str] = None
    problem_statement: Optional[str] = None
    business_objective: Optional[str] = None
    top_n: int = 8


class ExplainRequest(BaseModel):
    model_key: str
    file_id: str


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/recommend")
async def recommend_models(
    request: AdvisorRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get AI-powered model recommendations for a dataset.
    Uses DatasetAnalyzer for deep analysis and optional LLM reasoning.
    Recommendations are NEVER hardcoded — always generated dynamically.
    """
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # ── Dynamic analysis using DatasetAnalyzer ─────────────────
    file_path = file_record.cleaned_file_path or file_record.file_path

    if file_path and os.path.exists(file_path) and file_record.dataset_type != "image":
        # Full dynamic analysis on the actual dataset
        from services.dataset_analyzer import DatasetAnalyzer
        analyzer = DatasetAnalyzer()
        profile = analyzer.analyze(
            file_path,
            target_column=request.target_column,
            problem_statement=request.problem_statement,
            business_objective=request.business_objective,
        )
    else:
        # Fallback: build profile from stored file record metadata
        profile = {
            "dataset_type": file_record.dataset_type or "tabular",
            "row_count": file_record.row_count,
            "column_count": file_record.column_count,
            "columns_info": file_record.columns_info or {},
            "columns": (
                file_record.columns_info.get("columns", [])
                if isinstance(file_record.columns_info, dict) else []
            ),
            "image_metadata": file_record.image_metadata or {},
            "analysis_report": file_record.analysis_report or {},
            "data_quality": {},
        }

    # ── Try LLM-enhanced recommendations ───────────────────────
    try:
        from services.llm_advisor import get_llm_recommendations
        llm_result = await get_llm_recommendations(
            dataset_profile=profile,
            problem_statement=request.problem_statement,
            business_objective=request.business_objective,
            max_models=request.top_n,
        )
        return llm_result
    except Exception as e:
        logger.warning(f"LLM advisor failed, falling back to scoring: {e}")

    # ── Fallback: score-based recommendations ──────────────────
    recommendations = get_recommendations(
        profile=profile,
        task_type=request.task_type,
        top_n=request.top_n,
    )

    return recommendations


@router.post("/analyze")
async def analyze_dataset(
    request: AdvisorRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Perform deep dataset analysis without model recommendations.
    Returns problem type, data quality, feature stats, and more.
    """
    result = await db.execute(select(File).where(File.id == request.file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    file_path = file_record.cleaned_file_path or file_record.file_path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=400, detail="Dataset file not found on disk")

    from services.dataset_analyzer import DatasetAnalyzer
    analyzer = DatasetAnalyzer()
    profile = analyzer.analyze(
        file_path,
        target_column=request.target_column,
        problem_statement=request.problem_statement,
        business_objective=request.business_objective,
    )

    return profile


@router.get("/model/{model_key}")
async def get_model_info(model_key: str):
    """Get detailed information for a specific model."""
    info = get_model_detail(model_key)
    if not info:
        raise HTTPException(status_code=404, detail=f"Model '{model_key}' not found in catalog")
    return info


@router.get("/health-score/{file_id}")
async def get_health_score(
    file_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute and return dataset health score (0-100) with breakdowns.
    """
    result = await db.execute(select(File).where(File.id == file_id))
    file_record = result.scalar_one_or_none()
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    # Build profile dict from file record
    profile = {
        "dataset_type": file_record.dataset_type or "tabular",
        "row_count": file_record.row_count,
        "column_count": file_record.column_count,
        "columns": (
            file_record.columns_info.get("columns", [])
            if isinstance(file_record.columns_info, dict) else []
        ),
        "columns_info": file_record.columns_info or {},
        "image_metadata": file_record.image_metadata or {},
        "analysis_report": file_record.analysis_report or {},
        "missing_values": (file_record.analysis_report or {}).get("missing_values", {}),
        "label_distribution": (file_record.analysis_report or {}).get("label_distribution", {}),
        "duplicate_info": (file_record.analysis_report or {}).get("duplicate_info", {}),
        "statistics": (file_record.analysis_report or {}).get("statistics", {}),
        "correlations": (file_record.analysis_report or {}).get("correlations", {}),
        "feature_distributions": (file_record.analysis_report or {}).get("feature_distributions", {}),
    }

    health = compute_health_score(profile)
    health["file_id"] = file_id
    health["filename"] = file_record.filename
    health["dataset_type"] = file_record.dataset_type

    return health
