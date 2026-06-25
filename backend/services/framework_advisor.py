"""
NeuralForge — Framework Recommendation Engine
Recommends ML frameworks with scores and explanations before training.
Considers dataset characteristics, problem type, and user constraints.
"""

import logging
from typing import Optional

logger = logging.getLogger("neuralforge.framework_advisor")


# ── Framework Knowledge Base ───────────────────────────────────

FRAMEWORK_DB = {
    "xgboost": {
        "display_name": "XGBoost",
        "category": "gradient_boosting",
        "compatible_tasks": ["tabular_classification", "tabular_regression"],
        "strengths": [
            "State-of-the-art for tabular data",
            "Built-in regularization",
            "Handles missing values natively",
            "GPU acceleration available",
        ],
        "best_for": "Structured/tabular data with mixed features",
        "speed_rating": 90,
        "accuracy_rating": 95,
        "ease_rating": 85,
    },
    "lightgbm": {
        "display_name": "LightGBM",
        "category": "gradient_boosting",
        "compatible_tasks": ["tabular_classification", "tabular_regression"],
        "strengths": [
            "Fastest gradient boosting framework",
            "Handles large datasets efficiently",
            "Native categorical support",
            "Low memory usage",
        ],
        "best_for": "Large datasets where training speed matters",
        "speed_rating": 98,
        "accuracy_rating": 93,
        "ease_rating": 82,
    },
    "catboost": {
        "display_name": "CatBoost",
        "category": "gradient_boosting",
        "compatible_tasks": ["tabular_classification", "tabular_regression"],
        "strengths": [
            "Handles categorical features natively",
            "Minimal hyperparameter tuning",
            "Ordered boosting prevents overfitting",
        ],
        "best_for": "Datasets with many categorical features",
        "speed_rating": 80,
        "accuracy_rating": 94,
        "ease_rating": 95,
    },
    "scikit-learn": {
        "display_name": "Scikit-Learn",
        "category": "classical_ml",
        "compatible_tasks": [
            "tabular_classification", "tabular_regression",
            "clustering", "anomaly_detection",
        ],
        "strengths": [
            "Comprehensive classical ML library",
            "Excellent documentation",
            "Pipeline and preprocessing tools",
            "Cross-validation built-in",
        ],
        "best_for": "Classical ML models (SVM, RF, LogReg, KNN)",
        "speed_rating": 75,
        "accuracy_rating": 75,
        "ease_rating": 95,
    },
    "pytorch": {
        "display_name": "PyTorch",
        "category": "deep_learning",
        "compatible_tasks": [
            "image_classification", "object_detection",
            "text_classification", "time_series",
            "tabular_classification", "tabular_regression",
        ],
        "strengths": [
            "Most flexible deep learning framework",
            "Dynamic computation graphs",
            "Massive ecosystem (torchvision, torchaudio, etc.)",
            "Best for research and production",
        ],
        "best_for": "Deep learning tasks (vision, NLP, custom architectures)",
        "speed_rating": 85,
        "accuracy_rating": 98,
        "ease_rating": 65,
    },
    "tensorflow": {
        "display_name": "TensorFlow/Keras",
        "category": "deep_learning",
        "compatible_tasks": [
            "image_classification", "object_detection",
            "text_classification", "time_series",
            "tabular_classification", "tabular_regression",
        ],
        "strengths": [
            "Keras high-level API for fast prototyping",
            "TFLite for mobile deployment",
            "TensorBoard visualization",
            "TFServing for production",
        ],
        "best_for": "Production deployment with Keras simplicity",
        "speed_rating": 80,
        "accuracy_rating": 95,
        "ease_rating": 80,
    },
    "huggingface": {
        "display_name": "HuggingFace Transformers",
        "category": "transformers",
        "compatible_tasks": ["text_classification", "sentiment_analysis", "nlp"],
        "strengths": [
            "Largest pretrained model hub",
            "Simple Trainer API",
            "BERT, RoBERTa, T5, etc.",
            "Easy fine-tuning",
        ],
        "best_for": "NLP and text classification tasks",
        "speed_rating": 60,
        "accuracy_rating": 98,
        "ease_rating": 80,
    },
    "autogluon": {
        "display_name": "AutoGluon",
        "category": "automl",
        "compatible_tasks": ["tabular_classification", "tabular_regression"],
        "strengths": [
            "Fully automated ML pipeline",
            "Trains and ensembles multiple models",
            "Zero configuration needed",
            "Often wins competitions",
        ],
        "best_for": "Getting best results with zero ML expertise",
        "speed_rating": 30,
        "accuracy_rating": 97,
        "ease_rating": 99,
    },
}


def recommend_frameworks(
    dataset_profile: dict,
    problem_type: Optional[str] = None,
    max_results: int = 5,
) -> list[dict]:
    """
    Recommend ML frameworks with scores and explanations.

    Args:
        dataset_profile: Output from DatasetAnalyzer.analyze()
        problem_type: Override problem type
        max_results: Maximum frameworks to recommend

    Returns:
        List of framework recommendations with scores and why.
    """
    if not problem_type:
        problem_type = dataset_profile.get("problem_type", "tabular_classification")

    row_count = dataset_profile.get("row_count", 0)
    col_count = dataset_profile.get("column_count", 0)
    dq = dataset_profile.get("data_quality", {})
    cat_cols = dq.get("categorical_columns", 0)

    results = []

    for key, fw in FRAMEWORK_DB.items():
        compatible_tasks = fw.get("compatible_tasks", [])

        # Map problem types
        task_matches = False
        if problem_type in compatible_tasks:
            task_matches = True
        elif problem_type == "time_series_forecasting" and "time_series" in compatible_tasks:
            task_matches = True
        elif problem_type in ("text_classification", "nlp") and any(
            t in compatible_tasks for t in ["text_classification", "nlp", "sentiment_analysis"]
        ):
            task_matches = True

        if not task_matches:
            continue

        # Score framework based on dataset
        score = _score_framework(key, fw, row_count, col_count, cat_cols, problem_type)
        why = _explain_framework(key, fw, row_count, cat_cols, problem_type)

        results.append({
            "framework_key": key,
            "display_name": fw["display_name"],
            "category": fw["category"],
            "score": score,
            "why": why,
            "strengths": fw["strengths"],
            "best_for": fw["best_for"],
            "speed_rating": fw["speed_rating"],
            "accuracy_rating": fw["accuracy_rating"],
            "ease_rating": fw["ease_rating"],
        })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:max_results]


def _score_framework(
    key: str, fw: dict,
    row_count: int, col_count: int, cat_cols: int,
    problem_type: str,
) -> int:
    """Score a framework 0-100 based on dataset fit."""
    base = (fw["accuracy_rating"] + fw["speed_rating"] + fw["ease_rating"]) / 3

    # Dataset size adjustments
    if row_count > 100000:
        if key == "lightgbm":
            base += 8  # LightGBM excels on large data
        elif key == "scikit-learn":
            base -= 5  # Sklearn can be slow on large data
        elif key in ("pytorch", "tensorflow"):
            base += 3  # DL benefits from more data
    elif row_count < 1000:
        if key in ("xgboost", "catboost", "scikit-learn"):
            base += 5  # Tree models work well on small data
        elif key in ("pytorch", "tensorflow"):
            base -= 10  # DL needs more data

    # Categorical features
    if cat_cols > col_count * 0.3:
        if key == "catboost":
            base += 10  # CatBoost handles categoricals natively

    # Problem type specificity
    if problem_type in ("text_classification", "nlp", "sentiment_analysis"):
        if key == "huggingface":
            base += 15  # HF is purpose-built for NLP
    elif problem_type in ("image_classification", "object_detection"):
        if key == "pytorch":
            base += 10  # PyTorch dominates CV
    elif problem_type in ("tabular_classification", "tabular_regression"):
        if key in ("xgboost", "lightgbm", "catboost"):
            base += 5  # Gradient boosting excels on tabular

    return min(100, max(0, round(base)))


def _explain_framework(
    key: str, fw: dict,
    row_count: int, cat_cols: int,
    problem_type: str,
) -> str:
    """Generate a concise explanation for why this framework is recommended."""
    name = fw["display_name"]
    parts = []

    if problem_type in ("tabular_classification", "tabular_regression"):
        if key == "xgboost":
            parts.append("Best overall for tabular data.")
            if row_count > 10000:
                parts.append(f"Handles your {row_count:,}-row dataset efficiently with GPU support.")
        elif key == "lightgbm":
            parts.append("Fastest training on large datasets.")
            if row_count > 50000:
                parts.append(f"Leaf-wise growth is ideal for your {row_count:,} rows.")
        elif key == "catboost":
            if cat_cols > 0:
                parts.append(f"Handles your {cat_cols} categorical columns natively — no encoding needed.")
            else:
                parts.append("Minimal tuning needed with ordered boosting.")
        elif key == "autogluon":
            parts.append("Trains multiple models automatically and picks the best ensemble.")
    elif problem_type in ("text_classification", "nlp"):
        if key == "huggingface":
            parts.append("Access to BERT, RoBERTa, and 100K+ pretrained models.")
    elif problem_type in ("image_classification", "object_detection"):
        if key == "pytorch":
            parts.append("Dominant framework for computer vision with torchvision.")

    if not parts:
        parts.append(fw["best_for"])

    return " ".join(parts)
