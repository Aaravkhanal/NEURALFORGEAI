"""
NeuralForge — Playground API Routes
Interactive model prediction, explainability, and data tracing endpoints.
"""

import os
import logging
from typing import Optional, List, Dict, Any

import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from core.config import get_settings
from models.trained_model import TrainedModel

logger = logging.getLogger("neuralforge.playground_api")
router = APIRouter(prefix="/api/playground", tags=["playground"])
settings = get_settings()


# ── Request/Response Models ─────────────────────────────────────

class PredictRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]

class ExplainRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]
    methods: List[str] = ["shap", "decision_path", "confidence"]  # shap, lime, decision_path, confidence, teacher

class TraceRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]
    k: int = 5

class ParseTextRequest(BaseModel):
    text_input: str
    feature_schema: List[Dict[str, Any]]  # [{name, type, default}]
    problem_context: Optional[str] = None


# ── Endpoints ───────────────────────────────────────────────────

@router.get("/models")
async def list_playground_models(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all trained models available for playground predictions."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.user_id == user_id)
        .order_by(TrainedModel.created_at.desc())
    )
    models = result.scalars().all()

    return {
        "models": [
            {
                "id": m.id,
                "model_name": m.model_name,
                "task_type": m.task_type,
                "model_format": m.model_format,
                "version": m.version,
                "metrics": m.metrics or {},
                "feature_count": len(m.feature_names) if m.feature_names else 0,
                "is_best": m.is_best,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in models
        ]
    }


@router.get("/models/{model_id}/features")
async def get_model_features(
    model_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the feature schema for a model's input form."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    from services.playground_service import PlaygroundService

    feature_names = model_record.feature_names or []
    feature_types = model_record.feature_types or {}

    schema = PlaygroundService.get_feature_schema(
        feature_names=feature_names,
        feature_types=feature_types,
        training_data_path=model_record.training_data_path,
    )

    return {
        "model_id": model_id,
        "model_name": model_record.model_name,
        "task_type": model_record.task_type,
        "features": schema,
    }


@router.post("/predict")
async def predict(
    request: PredictRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Make predictions with a trained model."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == request.model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    from services.playground_service import PlaygroundService

    try:
        # Load model
        model = PlaygroundService.load_model(model_record.model_path, model_record.model_format)

        # Load preprocessors
        preprocessors = PlaygroundService.load_preprocessors(model_record.preprocessing_path)

        # Preprocess input
        df = PlaygroundService.preprocess_input(
            request.data,
            feature_names=model_record.feature_names,
            feature_types=model_record.feature_types,
            preprocessors=preprocessors,
        )

        # Predict
        prediction_result = PlaygroundService.predict(model, df, model_record.model_format)

        return {
            "model_id": request.model_id,
            "model_name": model_record.model_name,
            **prediction_result,
        }

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict/explain")
async def predict_with_explanation(
    request: ExplainRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Predict + full XAI explanation (SHAP, LIME, decision path, confidence, teacher)."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == request.model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    from services.playground_service import PlaygroundService
    from services.explainability import ExplainabilityService

    try:
        # Load model
        model = PlaygroundService.load_model(model_record.model_path, model_record.model_format)
        preprocessors = PlaygroundService.load_preprocessors(model_record.preprocessing_path)

        # Preprocess
        df = PlaygroundService.preprocess_input(
            request.data,
            feature_names=model_record.feature_names,
            feature_types=model_record.feature_types,
            preprocessors=preprocessors,
        )

        # Predict
        prediction_result = PlaygroundService.predict(model, df, model_record.model_format)

        # Initialize explainer
        explainer = ExplainabilityService(settings.upload_dir)
        feature_names = model_record.feature_names or list(df.columns)

        # Determine if tree-based
        is_tree = _is_tree_model(model)

        response = {
            "model_id": request.model_id,
            "model_name": model_record.model_name,
            "prediction": prediction_result,
            "explanations": {},
        }

        # Load background data for SHAP/LIME
        X_background = None
        if model_record.training_data_path and os.path.exists(model_record.training_data_path):
            try:
                train_df = pd.read_csv(model_record.training_data_path, nrows=500)
                target = (model_record.dataset_info or {}).get("target")
                if target and target in train_df.columns:
                    X_background = train_df.drop(columns=[target])
                    # Basic preprocessing to match model input
                    for col in X_background.select_dtypes(include=["object", "category"]).columns:
                        from sklearn.preprocessing import LabelEncoder
                        X_background[col] = LabelEncoder().fit_transform(X_background[col].astype(str))
                    X_background = X_background.fillna(0)
            except Exception as e:
                logger.warning(f"Could not load training data for explanation: {e}")

        # SHAP explanation
        if "shap" in request.methods:
            shap_result = explainer.generate_shap_local_explanation(
                model, df, X_background, is_tree=is_tree, feature_names=feature_names,
            )
            response["explanations"]["shap"] = shap_result

        # LIME explanation
        if "lime" in request.methods:
            X_train_np = X_background.values if X_background is not None else df.values
            lime_result = explainer.generate_lime_explanation(
                model, df.values[0], X_train_np, feature_names,
            )
            response["explanations"]["lime"] = lime_result

        # Decision path
        if "decision_path" in request.methods:
            path = explainer.extract_decision_path(model, df, feature_names)
            response["explanations"]["decision_path"] = path

        # Confidence breakdown
        if "confidence" in request.methods:
            breakdown = ExplainabilityService.generate_confidence_breakdown(model, df)
            response["explanations"]["confidence"] = breakdown

        # AI Teacher Mode
        if "teacher" in request.methods:
            feature_contribs = {}
            if "shap" in response["explanations"]:
                feature_contribs = response["explanations"]["shap"].get("contributions", {})

            feature_values = request.data[0] if request.data else {}
            decision_path = response["explanations"].get("decision_path", [])

            explanation_text = ExplainabilityService.generate_natural_language_explanation(
                prediction=prediction_result["predictions"][0] if prediction_result["predictions"] else "N/A",
                confidence=prediction_result["confidence"][0] if prediction_result.get("confidence") else None,
                feature_contributions=feature_contribs,
                model_type=model_record.model_name,
                feature_values=feature_values,
                decision_path=decision_path,
            )
            response["explanations"]["teacher"] = {"text": explanation_text}

        return response

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Model file not found on disk")
    except Exception as e:
        logger.error(f"Explanation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@router.post("/trace")
async def trace_prediction(
    request: TraceRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Dataset-to-Knowledge tracing: find similar training examples and cluster info."""
    result = await db.execute(
        select(TrainedModel).where(TrainedModel.id == request.model_id, TrainedModel.user_id == user_id)
    )
    model_record = result.scalar_one_or_none()
    if not model_record:
        raise HTTPException(status_code=404, detail="Model not found")

    from services.playground_service import PlaygroundService
    from services.data_lineage import DataLineageService

    try:
        # Load and preprocess input
        preprocessors = PlaygroundService.load_preprocessors(model_record.preprocessing_path)
        df = PlaygroundService.preprocess_input(
            request.data,
            feature_names=model_record.feature_names,
            feature_types=model_record.feature_types,
            preprocessors=preprocessors,
        )

        feature_names = model_record.feature_names or list(df.columns)
        response = {"model_id": request.model_id, "similar_examples": [], "cluster_info": {}, "lineage": {}}

        # Load training data
        if model_record.training_data_path and os.path.exists(model_record.training_data_path):
            train_df = pd.read_csv(model_record.training_data_path)
            target = (model_record.dataset_info or {}).get("target")

            y_train = None
            if target and target in train_df.columns:
                y_train = train_df[target].values
                X_train = train_df.drop(columns=[target])
            else:
                X_train = train_df

            # Basic preprocessing
            for col in X_train.select_dtypes(include=["object", "category"]).columns:
                from sklearn.preprocessing import LabelEncoder
                X_train[col] = LabelEncoder().fit_transform(X_train[col].astype(str))
            X_train = X_train.fillna(0)

            # Similar examples
            response["similar_examples"] = DataLineageService.find_similar_training_examples(
                df.values[0], X_train, y_train, k=request.k, feature_names=feature_names,
            )

            # Cluster info
            response["cluster_info"] = DataLineageService.find_cluster_info(
                X_train, df.values[0], feature_names=feature_names,
            )

        # Data lineage
        response["lineage"] = DataLineageService.get_data_lineage(
            model_name=model_record.model_name,
            dataset_info=model_record.dataset_info or {},
            training_params=model_record.training_params or {},
        )

        return response

    except Exception as e:
        logger.error(f"Tracing failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Tracing failed: {str(e)}")


@router.post("/parse-text")
async def parse_text_to_features(
    request: ParseTextRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """
    Use LLM to convert natural language text into structured feature values
    that can be fed directly into a trained model for inference.
    """
    import json as _json
    try:
        from services.llm_service import get_best_available_llm
        llm = get_best_available_llm(temperature=0.1)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LLM service unavailable: {e}")

    schema_lines = "\n".join(
        f"  - {f.get('name')} ({f.get('type', 'number')}, default={f.get('default', 0)})"
        for f in request.feature_schema
    )
    context_hint = f"\nProblem context: {request.problem_context}" if request.problem_context else ""

    prompt = f"""You are an ML feature extraction assistant.{context_hint}

Extract structured feature values from this natural language input so it can be passed to a trained ML model.

Natural Language Input:
\"\"\"{request.text_input}\"\"\"

Required model features:
{schema_lines}

Rules:
- For each feature, extract the most appropriate value from the text.
- If a feature is not mentioned, use a sensible domain-appropriate default (NOT 0 for everything).
- Numeric features must be numbers (int or float). Categorical features must be strings.
- Return ONLY a flat JSON object — no nesting, no markdown, no explanation.

Example output: {{"age": 45, "bmi": 28.5, "gender": "male", "smoker": 0}}"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content.strip()
        # Strip markdown fences if present
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
        parsed = _json.loads(content)
        if not isinstance(parsed, dict):
            raise ValueError("LLM did not return a JSON object")
        return {"parsed_features": parsed, "raw_input": request.text_input}
    except _json.JSONDecodeError as e:
        raise HTTPException(status_code=422, detail=f"LLM returned non-JSON output: {e}")
    except Exception as e:
        logger.error(f"Text parsing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Text parsing failed: {str(e)}")


# ── Helpers ─────────────────────────────────────────────────────

def _is_tree_model(model) -> bool:
    """Check if a model is tree-based (for SHAP TreeExplainer)."""
    tree_types = []
    try:
        from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
        from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
        tree_types.extend([RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor, DecisionTreeClassifier, DecisionTreeRegressor])
    except ImportError:
        pass
    try:
        import xgboost as xgb
        tree_types.extend([xgb.XGBClassifier, xgb.XGBRegressor])
    except ImportError:
        pass
    try:
        import lightgbm as lgb
        tree_types.extend([lgb.LGBMClassifier, lgb.LGBMRegressor])
    except ImportError:
        pass
    try:
        import catboost as cb
        tree_types.extend([cb.CatBoostClassifier, cb.CatBoostRegressor])
    except ImportError:
        pass

    return isinstance(model, tuple(tree_types)) if tree_types else False
