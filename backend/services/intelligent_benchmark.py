"""
NeuralForge — Intelligent Benchmark Engine (Production)
Dynamically selects, scores, and ranks models based on actual dataset
characteristics. No static model lists — selection is data-driven.
"""

import logging
import math
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger("neuralforge.intelligent_benchmark")


class IntelligentBenchmarkEngine:
    """
    Analyzes a dataset and dynamically recommends the best models
    based on real data characteristics: size, dimensionality,
    data types, class balance, and hardware constraints.
    """

    # Speed scores: higher = faster
    SPEED_SCORES = {
        "Very Fast": 5, "Fast": 4, "Medium": 3, "Slow": 2, "Very Slow": 1
    }

    @classmethod
    def analyze_dataset(
        cls,
        n_rows: int,
        n_features: int,
        task_type: str,
        target_type: str = "categorical",
        n_classes: int = 2,
        missing_pct: float = 0.0,
        has_categorical: bool = False,
        has_text: bool = False,
        has_images: bool = False,
        has_time_index: bool = False,
    ) -> Dict[str, Any]:
        """
        Analyze dataset characteristics and return a structured profile
        used for model selection.
        """
        # Size category
        if n_rows < 200:
            size_cat = "tiny"
        elif n_rows < 2000:
            size_cat = "small"
        elif n_rows < 20000:
            size_cat = "medium"
        elif n_rows < 200000:
            size_cat = "large"
        else:
            size_cat = "very_large"

        # Dimensionality
        if n_features < 5:
            dim_cat = "low"
        elif n_features < 50:
            dim_cat = "medium"
        elif n_features < 500:
            dim_cat = "high"
        else:
            dim_cat = "very_high"

        # Imbalance check
        is_imbalanced = n_classes >= 2 and target_type == "categorical"

        return {
            "n_rows": n_rows,
            "n_features": n_features,
            "task_type": task_type,
            "target_type": target_type,
            "n_classes": n_classes,
            "size_category": size_cat,
            "dimensionality": dim_cat,
            "missing_pct": missing_pct,
            "has_categorical": has_categorical,
            "has_text": has_text,
            "has_images": has_images,
            "has_time_index": has_time_index,
            "possibly_imbalanced": is_imbalanced,
        }

    @classmethod
    def select_candidate_models(
        cls, analysis: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Dynamically select candidate models based on dataset analysis.
        Returns scored and ranked candidates.
        """
        from services.advisor_service import MODEL_DB

        task_type = analysis["task_type"].lower()
        n_rows = analysis["n_rows"]
        size_cat = analysis["size_category"]

        # Map task type to MODEL_DB task types
        task_mapping = {
            "tabular_classification": ["tabular_classification"],
            "tabular_regression": ["tabular_regression"],
            "binary_classification": ["tabular_classification"],
            "multi_class_classification": ["tabular_classification"],
            "classification": ["tabular_classification"],
            "regression": ["tabular_regression"],
            "image_classification": ["image_classification"],
            "text_classification": ["text_classification", "sentiment_analysis"],
            "sentiment_analysis": ["text_classification", "sentiment_analysis"],
            "object_detection": ["object_detection"],
            "time_series": ["time_series"],
            "anomaly_detection": ["anomaly_detection"],
            "clustering": ["clustering"],
        }

        eligible_tasks = task_mapping.get(task_type, ["tabular_classification"])

        # Filter eligible models
        candidates = []
        for model_key, model_info in MODEL_DB.items():
            model_tasks = model_info.get("task_types", [])
            if not any(t in model_tasks for t in eligible_tasks):
                continue

            # Check minimum dataset size
            min_size = model_info.get("min_dataset_size", 0)
            if n_rows < min_size:
                continue

            # Score this model for this specific dataset
            score = cls._score_model(model_info, analysis)

            candidates.append({
                "model_key": model_key,
                "display_name": model_info.get("display_name", model_key),
                "parameters": model_info.get("parameters", "N/A"),
                "accuracy_potential": model_info.get("accuracy_potential", "Medium"),
                "training_speed": model_info.get("training_speed", "Medium"),
                "inference_speed": model_info.get("inference_speed", "Medium"),
                "model_size": model_info.get("model_size", "Medium"),
                "hardware": model_info.get("hardware", "CPU"),
                "use_cases": model_info.get("use_cases", []),
                "strengths": model_info.get("strengths", []),
                "weaknesses": model_info.get("weaknesses", []),
                "suitability_score": score,
                "ideal_range": model_info.get("ideal_dataset_range", [0, float("inf")]),
                "estimated_training_time": cls._estimate_training_time(
                    model_info, n_rows, analysis["n_features"]
                ),
                "estimated_accuracy": cls._estimate_accuracy(
                    model_info, analysis
                ),
            })

        # Sort by suitability score
        candidates.sort(key=lambda c: c["suitability_score"], reverse=True)

        # Assign recommendation tiers
        for i, c in enumerate(candidates):
            if i == 0:
                c["recommendation_tier"] = "Recommended"
                c["recommendation_reason"] = (
                    f"Best fit for your {analysis['size_category']} dataset "
                    f"({n_rows:,} rows × {analysis['n_features']} features). "
                    f"Expected accuracy: {c['estimated_accuracy']}."
                )
            elif c["suitability_score"] >= 60:
                c["recommendation_tier"] = "Acceptable"
                c["recommendation_reason"] = (
                    f"Good alternative with {c['accuracy_potential']} accuracy potential."
                )
            else:
                c["recommendation_tier"] = "Not Recommended"
                c["recommendation_reason"] = (
                    f"Not ideal for this dataset size/type. "
                    f"Score: {c['suitability_score']:.0f}/100."
                )

        return candidates

    @classmethod
    def _score_model(
        cls, model_info: Dict[str, Any], analysis: Dict[str, Any]
    ) -> float:
        """Score a model's suitability for a specific dataset (0-100)."""
        score = 50.0  # Base score
        n_rows = analysis["n_rows"]
        n_features = analysis["n_features"]

        # 1. Dataset size fit (±20 points)
        ideal_range = model_info.get("ideal_dataset_range", [0, float("inf")])
        if len(ideal_range) == 2:
            low, high = ideal_range
            if low <= n_rows <= high:
                # In ideal range
                score += 20
            elif n_rows < low:
                # Below ideal — penalty proportional to gap
                ratio = n_rows / max(low, 1)
                score += max(-15, 20 * (ratio - 1))
            else:
                # Above ideal — mild penalty
                score += 10

        # 2. Accuracy potential (±15 points)
        acc_map = {"Very High": 15, "High": 10, "Medium": 5, "Low": 0}
        score += acc_map.get(model_info.get("accuracy_potential", "Medium"), 5)

        # 3. Training speed (±10 points)
        speed = model_info.get("training_speed", "Medium")
        speed_bonus = cls.SPEED_SCORES.get(speed, 3)
        # Speed matters more for large datasets
        if analysis["size_category"] in ("large", "very_large"):
            score += speed_bonus * 2
        else:
            score += speed_bonus

        # 4. Hardware accessibility (±10 points)
        hw = model_info.get("hardware", "CPU")
        if hw == "CPU":
            score += 10  # Most accessible
        elif hw == "Low GPU":
            score += 5
        elif hw == "Medium GPU":
            score += 0
        else:  # High GPU
            score -= 5

        # 5. Categorical feature handling (±5 points)
        if analysis.get("has_categorical"):
            name = model_info.get("display_name", "").lower()
            if "catboost" in name:
                score += 5  # CatBoost excels with categories
            elif "lightgbm" in name:
                score += 3
            elif "xgboost" in name:
                score += 2

        # 6. Missing value handling (±5 points)
        if analysis.get("missing_pct", 0) > 5:
            name = model_info.get("display_name", "").lower()
            if any(x in name for x in ("xgboost", "lightgbm", "catboost")):
                score += 5  # Tree models handle missing values well
            elif any(x in name for x in ("svm", "knn", "logistic")):
                score -= 5  # These need clean data

        return max(0, min(100, score))

    @classmethod
    def _estimate_training_time(
        cls, model_info: Dict[str, Any], n_rows: int, n_features: int
    ) -> str:
        """Estimate training time based on model speed and dataset size."""
        speed = model_info.get("training_speed", "Medium")
        base_seconds = {
            "Very Fast": 2, "Fast": 10, "Medium": 60, "Slow": 300, "Very Slow": 900
        }
        base = base_seconds.get(speed, 60)

        # Scale by dataset size
        size_factor = math.log10(max(n_rows, 10)) / 3  # ~1.0 for 1K rows
        feature_factor = math.sqrt(n_features) / 5  # ~1.0 for 25 features

        estimated = base * size_factor * max(feature_factor, 0.5)

        if estimated < 10:
            return "<10 seconds"
        elif estimated < 60:
            return f"~{int(estimated)} seconds"
        elif estimated < 3600:
            return f"~{int(estimated/60)} minutes"
        else:
            return f"~{estimated/3600:.1f} hours"

    @classmethod
    def _estimate_accuracy(
        cls, model_info: Dict[str, Any], analysis: Dict[str, Any]
    ) -> str:
        """Estimate expected accuracy range based on model and dataset."""
        acc_potential = model_info.get("accuracy_potential", "Medium")
        size_cat = analysis["size_category"]

        # Base accuracy range by model potential
        ranges = {
            "Very High": (85, 98),
            "High": (75, 92),
            "Medium": (60, 85),
            "Low": (50, 75),
        }
        low, high = ranges.get(acc_potential, (60, 85))

        # Adjust by dataset size
        size_adjustments = {
            "tiny": -15, "small": -8, "medium": 0, "large": 3, "very_large": 5
        }
        adj = size_adjustments.get(size_cat, 0)
        low = max(10, low + adj)
        high = min(99, high + adj)

        return f"{low}-{high}%"


benchmark_engine = IntelligentBenchmarkEngine()
