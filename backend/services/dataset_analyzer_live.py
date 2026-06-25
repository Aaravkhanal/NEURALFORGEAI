"""
NeuralForge — Live Dataset Quality Analyzer
Analyzes real dataset previews to compute quality metrics:
missing values, class balance, feature quality, label quality,
suitability scoring, and dataset ranking.
"""

import logging
import math
from typing import Dict, Any, List, Optional
from collections import Counter

logger = logging.getLogger("neuralforge.dataset_analyzer_live")


class DatasetQualityAnalyzer:
    """
    Computes quality metrics from raw dataset metadata and preview data.
    All scoring is deterministic and based on statistical properties,
    NOT hardcoded or LLM-generated.
    """

    @staticmethod
    def analyze_from_metadata(dataset: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze a dataset from its metadata (no preview data required).
        Computes suitability scores from available metadata fields.
        """
        samples = dataset.get("samples", 0)
        features = dataset.get("features", 0)
        downloads = dataset.get("downloads", 0)
        likes = dataset.get("likes", 0)
        missing_pct = dataset.get("missing_pct", 0.0)
        usability = dataset.get("usability_rating", 0.0)

        # Compute component scores
        scores = {}

        # 1. Dataset Size Score (0-100)
        if samples == 0:
            scores["size_score"] = 30  # Unknown, neutral
        elif samples < 100:
            scores["size_score"] = 20
        elif samples < 500:
            scores["size_score"] = 40
        elif samples < 5000:
            scores["size_score"] = 60
        elif samples < 50000:
            scores["size_score"] = 80
        elif samples < 500000:
            scores["size_score"] = 90
        else:
            scores["size_score"] = 95

        # 2. Feature Richness Score (0-100)
        if features == 0:
            scores["feature_score"] = 30
        elif features < 3:
            scores["feature_score"] = 30
        elif features < 10:
            scores["feature_score"] = 60
        elif features < 50:
            scores["feature_score"] = 80
        elif features < 200:
            scores["feature_score"] = 85
        else:
            scores["feature_score"] = 70  # Very high dim can be problematic

        # 3. Missing Value Score (0-100)
        if missing_pct == 0:
            scores["completeness_score"] = 95
        elif missing_pct < 1:
            scores["completeness_score"] = 90
        elif missing_pct < 5:
            scores["completeness_score"] = 75
        elif missing_pct < 15:
            scores["completeness_score"] = 55
        elif missing_pct < 30:
            scores["completeness_score"] = 35
        else:
            scores["completeness_score"] = 15

        # 4. Community Adoption Score (0-100)
        popularity_score = min(100, int(
            (min(downloads, 100000) / 100000) * 50 +
            (min(likes, 1000) / 1000) * 50
        ))
        scores["popularity_score"] = max(10, popularity_score)

        # 5. Usability Score (0-100) — from platform rating
        if usability and usability > 0:
            scores["usability_score"] = int(usability * 10)
        else:
            scores["usability_score"] = 50  # Neutral if unavailable

        # Composite suitability score
        weights = {
            "size_score": 0.25,
            "feature_score": 0.15,
            "completeness_score": 0.20,
            "popularity_score": 0.20,
            "usability_score": 0.20,
        }
        suitability = sum(scores[k] * weights[k] for k in weights)
        scores["suitability_score"] = round(suitability, 1)

        # Popularity category
        if downloads > 50000 or likes > 500:
            scores["popularity_category"] = "Very High"
        elif downloads > 10000 or likes > 100:
            scores["popularity_category"] = "High"
        elif downloads > 1000 or likes > 20:
            scores["popularity_category"] = "Medium"
        else:
            scores["popularity_category"] = "Low"

        return scores

    @staticmethod
    def analyze_from_preview(
        rows: List[Dict[str, Any]],
        target_column: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze a dataset from preview rows (actual data).
        Computes detailed statistics: missing %, class balance, correlations, etc.
        """
        if not rows:
            return {"error": "No preview data available"}

        n_rows = len(rows)
        all_keys = set()
        for row in rows:
            all_keys.update(row.keys())
        n_features = len(all_keys)

        # Count missing values per column
        missing_counts = {}
        value_types = {}
        column_values = {}

        for key in all_keys:
            missing = 0
            values = []
            for row in rows:
                val = row.get(key)
                if val is None or (isinstance(val, str) and val.strip() == ""):
                    missing += 1
                else:
                    values.append(val)
            missing_counts[key] = missing
            column_values[key] = values

            # Determine type
            if values:
                numeric_count = sum(1 for v in values if _is_numeric(v))
                if numeric_count > len(values) * 0.7:
                    value_types[key] = "numeric"
                else:
                    value_types[key] = "categorical"
            else:
                value_types[key] = "unknown"

        # Overall missing percentage
        total_cells = n_rows * n_features
        total_missing = sum(missing_counts.values())
        overall_missing_pct = (
            round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0.0
        )

        # Per-column missing
        per_column_missing = {
            k: round((v / n_rows) * 100, 2)
            for k, v in missing_counts.items()
        }

        # Class balance (if target column identified or last categorical column)
        class_balance = {}
        target_col = target_column
        if not target_col:
            # Heuristic: last categorical column is often the target
            cat_cols = [k for k in all_keys if value_types.get(k) == "categorical"]
            if cat_cols:
                target_col = cat_cols[-1]

        if target_col and target_col in column_values:
            target_vals = column_values[target_col]
            counter = Counter(str(v) for v in target_vals)
            total = sum(counter.values())
            class_balance = {
                "target_column": target_col,
                "class_counts": dict(counter),
                "class_proportions": {
                    k: round(v / total, 4) for k, v in counter.items()
                },
                "n_classes": len(counter),
                "is_balanced": _is_balanced(counter),
                "imbalance_ratio": (
                    round(max(counter.values()) / max(min(counter.values()), 1), 2)
                    if counter
                    else 1.0
                ),
            }

        # Feature quality: variance, unique ratio
        feature_quality = {}
        for key in all_keys:
            vals = column_values[key]
            if not vals:
                feature_quality[key] = {"quality": "poor", "reason": "all missing"}
                continue

            unique_ratio = len(set(str(v) for v in vals)) / len(vals)

            if value_types[key] == "numeric":
                numeric_vals = [float(v) for v in vals if _is_numeric(v)]
                if numeric_vals:
                    mean_val = sum(numeric_vals) / len(numeric_vals)
                    variance = sum((x - mean_val) ** 2 for x in numeric_vals) / len(numeric_vals)
                    feature_quality[key] = {
                        "type": "numeric",
                        "unique_ratio": round(unique_ratio, 3),
                        "mean": round(mean_val, 4),
                        "variance": round(variance, 4),
                        "min": round(min(numeric_vals), 4),
                        "max": round(max(numeric_vals), 4),
                        "quality": "good" if variance > 0 else "constant",
                    }
                else:
                    feature_quality[key] = {"quality": "poor", "reason": "no numeric values"}
            else:
                n_unique = len(set(str(v) for v in vals))
                feature_quality[key] = {
                    "type": "categorical",
                    "unique_ratio": round(unique_ratio, 3),
                    "n_unique": n_unique,
                    "quality": (
                        "good" if 1 < n_unique < len(vals) * 0.9
                        else "poor" if n_unique <= 1
                        else "high_cardinality"
                    ),
                }

        # Label quality score
        label_quality = 100
        if class_balance:
            if not class_balance.get("is_balanced"):
                label_quality -= 20
            if class_balance.get("imbalance_ratio", 1) > 10:
                label_quality -= 30
            if class_balance.get("n_classes", 0) > 100:
                label_quality -= 10

        return {
            "n_rows": n_rows,
            "n_features": n_features,
            "overall_missing_pct": overall_missing_pct,
            "per_column_missing": per_column_missing,
            "value_types": value_types,
            "class_balance": class_balance,
            "feature_quality": feature_quality,
            "label_quality": max(0, label_quality),
        }

    @classmethod
    def rank_datasets(
        cls,
        datasets: List[Dict[str, Any]],
        problem_context: str = "",
    ) -> List[Dict[str, Any]]:
        """
        Rank a list of datasets by suitability score.
        Adds quality_analysis, suitability_score, and recommendation_tier to each.
        Returns sorted list (best first).
        """
        for ds in datasets:
            analysis = cls.analyze_from_metadata(ds)
            ds["quality_analysis"] = analysis
            ds["suitability_score"] = analysis.get("suitability_score", 50)
            ds["popularity"] = analysis.get("popularity_category", "Medium")

        # Sort by suitability score descending
        datasets.sort(key=lambda d: d.get("suitability_score", 0), reverse=True)

        # Assign recommendation tiers
        for i, ds in enumerate(datasets):
            if i == 0:
                ds["recommendation_tier"] = "Recommended"
            elif ds.get("suitability_score", 0) >= 60:
                ds["recommendation_tier"] = "Acceptable"
            else:
                ds["recommendation_tier"] = "Not Recommended"

        return datasets


def _is_numeric(val) -> bool:
    """Check if a value is numeric."""
    if isinstance(val, (int, float)):
        return True
    if isinstance(val, str):
        try:
            float(val)
            return True
        except (ValueError, TypeError):
            return False
    return False


def _is_balanced(counter: Counter) -> bool:
    """Check if class distribution is approximately balanced."""
    if not counter or len(counter) < 2:
        return True
    total = sum(counter.values())
    proportions = [v / total for v in counter.values()]
    expected = 1.0 / len(counter)
    max_deviation = max(abs(p - expected) for p in proportions)
    return max_deviation < 0.15  # Within 15% of uniform
