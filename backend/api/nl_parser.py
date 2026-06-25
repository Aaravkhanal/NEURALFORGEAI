"""
NeuralForge — Natural Language Parser API Route
Endpoint for parsing natural language into model input features.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.security import get_optional_user_id

logger = logging.getLogger("neuralforge.api.nl_parser")

router = APIRouter(prefix="/api/playground", tags=["playground", "nl"])


class NLParseRequest(BaseModel):
    model_id: str
    text: str


@router.post("/parse-natural-language")
async def parse_natural_language(
    request: NLParseRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Parse natural language text into structured model input features.
    Uses the model's feature schema to validate extracted values.
    """
    from services.nl_feature_parser import nl_feature_parser
    from services.playground_service import PlaygroundService

    # Get model feature schema
    try:
        from core.database import async_session_factory
        from sqlalchemy import text

        async with async_session_factory() as session:
            result = await session.execute(
                text(
                    "SELECT feature_names, feature_types, dataset_info "
                    "FROM trained_models WHERE id = :model_id"
                ),
                {"model_id": request.model_id},
            )
            row = result.fetchone()
            if not row:
                raise HTTPException(
                    status_code=404,
                    detail=f"Model {request.model_id} not found.",
                )

            import json
            feature_names = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or [])
            feature_types = json.loads(row[1]) if isinstance(row[1], str) else (row[1] or {})
            dataset_info = json.loads(row[2]) if isinstance(row[2], str) else (row[2] or {})

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch model schema: %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve model schema: {str(e)}",
        )

    # Build feature schema for NL parser
    training_data_path = dataset_info.get("training_data_path", "")
    schema = PlaygroundService.get_feature_schema(
        feature_names, feature_types, training_data_path
    )

    # Parse natural language
    result = await nl_feature_parser.parse(request.text, schema)

    return {
        "raw_text": result["raw_text"],
        "extracted_features": result["extracted_features"],
        "confidence_scores": result["confidence_scores"],
        "validation_errors": result["validation_errors"],
        "unmapped": result["unmapped"],
        "feature_schema": schema,
    }
