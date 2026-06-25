"""
NeuralForge — Dataset Discovery API Routes
AI-powered dataset search, comparison, and import.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id, get_optional_user_id
from services.dataset_discovery import (
    search_datasets_with_llm,
    _get_curated_datasets,
    compare_datasets,
    analyze_problem,
)

logger = logging.getLogger("neuralforge.api.discovery")

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


class DiscoverySearchRequest(BaseModel):
    description: str
    project_type: Optional[str] = None
    max_results: int = 5


class DatasetCompareRequest(BaseModel):
    dataset_a: dict
    dataset_b: dict


@router.post("/search")
async def search_datasets(
    request: DiscoverySearchRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Search for datasets using AI. Searches Kaggle, HuggingFace, UCI, etc.
    Falls back to curated catalog if web search is unavailable.
    """
    query = request.description
    if request.project_type:
        query = f"{request.project_type}: {query}"

    try:
        datasets = await search_datasets_with_llm(query, max_results=request.max_results)
    except Exception as e:
        logger.error(f"Discovery search failed: {e}")
        datasets = _get_curated_datasets(query, request.max_results)

    return {
        "query": request.description,
        "project_type": request.project_type,
        "results": datasets,
        "total": len(datasets),
    }


@router.post("/analyze-problem")
async def api_analyze_problem(
    request: DiscoverySearchRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Analyze a problem statement and extract structured AI context."""
    analysis = await analyze_problem(request.description)
    return analysis


@router.post("/compare")
async def compare_two_datasets(
    request: DatasetCompareRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """Compare two datasets side-by-side with AI verdict."""
    comparison = compare_datasets(request.dataset_a, request.dataset_b)
    return comparison


@router.get("/categories")
async def get_project_categories():
    """Return available project categories for the wizard."""
    return {
        "categories": [
            {
                "id": "medical",
                "label": "Medical AI",
                "icon": "🏥",
                "description": "Disease detection, medical imaging, diagnostics",
                "examples": ["Skin cancer detector", "X-ray analysis", "Retinal disease"],
            },
            {
                "id": "vehicle",
                "label": "Vehicle Detection",
                "icon": "🚗",
                "description": "Car detection, traffic analysis, autonomous driving",
                "examples": ["Vehicle counter", "License plate reader", "Traffic monitor"],
            },
            {
                "id": "face",
                "label": "Face Recognition",
                "icon": "👤",
                "description": "Facial recognition, attribute detection, verification",
                "examples": ["Face verification", "Emotion detection", "Age estimation"],
            },
            {
                "id": "object_detection",
                "label": "Object Detection",
                "icon": "📦",
                "description": "Detect and locate objects in images",
                "examples": ["Product detection", "Safety equipment", "Wildlife monitoring"],
            },
            {
                "id": "text_classification",
                "label": "Document Classification",
                "icon": "📄",
                "description": "Classify text, documents, or reviews",
                "examples": ["Sentiment analysis", "Spam detection", "Topic classification"],
            },
            {
                "id": "chatbot",
                "label": "Chatbot / NLP",
                "icon": "💬",
                "description": "Conversational AI, dialogue systems",
                "examples": ["Customer support bot", "FAQ assistant", "Language model"],
            },
            {
                "id": "crop_disease",
                "label": "Agriculture AI",
                "icon": "🌱",
                "description": "Crop disease detection, plant health analysis",
                "examples": ["Leaf disease detector", "Crop health monitor", "Weed detection"],
            },
            {
                "id": "tabular",
                "label": "Custom AI Project",
                "icon": "🧠",
                "description": "Tabular data, recommendations, predictions",
                "examples": ["Price prediction", "Churn prediction", "Recommendation system"],
            },
        ]
    }
