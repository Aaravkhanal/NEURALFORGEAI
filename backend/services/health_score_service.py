"""
NeuralForge — Dataset Health Score Service
Computes a 0-100 dataset health score with sub-metric breakdowns.
Provides traffic-light indicators and actionable improvement suggestions.
"""

import logging
import math
from typing import Optional

logger = logging.getLogger("neuralforge.health_score")


def _score_missing_values(profile: dict) -> dict:
    """Score based on missing value percentage. 100 = no missing, 0 = all missing."""
    missing = profile.get("missing_values", {})
    row_count = profile.get("row_count", 1) or 1

    if not missing:
        return {"score": 100, "label": "Missing Values", "detail": "No missing values detected", "color": "green"}

    total_cells = row_count * max(profile.get("column_count", 1), 1)
    total_missing = sum(v if isinstance(v, (int, float)) else 0 for v in missing.values())
    pct = (total_missing / total_cells) * 100 if total_cells > 0 else 0

    if pct == 0:
        score, color, detail = 100, "green", "No missing values detected"
    elif pct < 1:
        score, color, detail = 95, "green", f"{pct:.1f}% missing — excellent data completeness"
    elif pct < 5:
        score, color, detail = 80, "yellow", f"{pct:.1f}% missing — minor imputation may help"
    elif pct < 15:
        score, color, detail = 55, "orange", f"{pct:.1f}% missing — consider imputation strategies"
    elif pct < 30:
        score, color, detail = 30, "red", f"{pct:.1f}% missing — significant data gaps"
    else:
        score, color, detail = 10, "red", f"{pct:.1f}% missing — critical data completeness issues"

    return {"score": score, "label": "Missing Values", "detail": detail, "color": color}


def _score_duplicates(profile: dict) -> dict:
    """Score based on duplicate rows. 100 = no duplicates."""
    dup_info = profile.get("duplicate_info", {})
    dup_count = dup_info.get("duplicate_count", 0)
    row_count = profile.get("row_count", 1) or 1

    pct = (dup_count / row_count) * 100 if row_count > 0 else 0

    if pct == 0:
        score, color, detail = 100, "green", "No duplicate rows detected"
    elif pct < 1:
        score, color, detail = 92, "green", f"{dup_count} duplicates ({pct:.1f}%) — negligible"
    elif pct < 5:
        score, color, detail = 75, "yellow", f"{dup_count} duplicates ({pct:.1f}%) — consider removing"
    elif pct < 15:
        score, color, detail = 50, "orange", f"{dup_count} duplicates ({pct:.1f}%) — clean recommended"
    else:
        score, color, detail = 20, "red", f"{dup_count} duplicates ({pct:.1f}%) — significant redundancy"

    return {"score": score, "label": "Duplicates", "detail": detail, "color": color}


def _score_class_balance(profile: dict) -> dict:
    """Score based on class distribution balance using entropy."""
    label_dist = profile.get("label_distribution", {})

    if not label_dist:
        return {"score": 85, "label": "Class Balance", "detail": "No label column detected — skipping balance check", "color": "green"}

    values = [v for v in label_dist.values() if isinstance(v, (int, float)) and v > 0]
    if not values or len(values) < 2:
        return {"score": 90, "label": "Class Balance", "detail": "Single class or no distribution data", "color": "green"}

    total = sum(values)
    n = len(values)

    # Compute normalized entropy (1.0 = perfectly balanced)
    entropy = -sum((v / total) * math.log2(v / total) for v in values)
    max_entropy = math.log2(n)
    balance_ratio = entropy / max_entropy if max_entropy > 0 else 1.0

    # Compute imbalance ratio (max/min)
    imbalance_ratio = max(values) / min(values) if min(values) > 0 else float('inf')

    if balance_ratio > 0.95:
        score, color, detail = 100, "green", "Perfectly balanced classes"
    elif balance_ratio > 0.85:
        score, color, detail = 85, "green", f"Well balanced (ratio: {imbalance_ratio:.1f}:1)"
    elif balance_ratio > 0.7:
        score, color, detail = 65, "yellow", f"Moderate imbalance (ratio: {imbalance_ratio:.1f}:1)"
    elif balance_ratio > 0.5:
        score, color, detail = 40, "orange", f"Significant imbalance (ratio: {imbalance_ratio:.1f}:1) — consider oversampling"
    else:
        score, color, detail = 15, "red", f"Severe imbalance (ratio: {imbalance_ratio:.1f}:1) — SMOTE or weighted loss recommended"

    return {"score": score, "label": "Class Balance", "detail": detail, "color": color}


def _score_data_quality(profile: dict) -> dict:
    """Score based on type consistency and general data quality indicators."""
    columns = profile.get("columns", [])
    if not columns:
        return {"score": 75, "label": "Data Quality", "detail": "Unable to assess — no column info", "color": "yellow"}

    issues = 0
    total_checks = max(len(columns), 1)

    for col in columns:
        dtype = col.get("dtype", "")
        # Mixed types
        if "mixed" in dtype.lower() or "object" in dtype.lower():
            # Check if it should be numeric
            unique = col.get("unique", 0)
            count = col.get("count", 0)
            if count > 0 and unique / count < 0.05:  # Very few unique → likely categorical, ok
                pass
            else:
                issues += 0.5

        # Constant columns (zero variance)
        if col.get("unique", 1) <= 1:
            issues += 1

    quality_ratio = 1 - (issues / total_checks)
    score = int(quality_ratio * 100)
    score = max(10, min(100, score))

    if score >= 90:
        color, detail = "green", "Excellent type consistency and feature variance"
    elif score >= 70:
        color, detail = "yellow", "Minor type inconsistencies detected"
    elif score >= 50:
        color, detail = "orange", "Several data quality issues found"
    else:
        color, detail = "red", "Significant data quality problems"

    return {"score": score, "label": "Data Quality", "detail": detail, "color": color}


def _score_feature_quality(profile: dict) -> dict:
    """Score based on feature utility (variance, correlation, cardinality, leakage)."""
    columns = profile.get("columns", [])
    stats = profile.get("statistics", {})
    column_count = profile.get("column_count", 0)

    if column_count <= 1:
        return {"score": 70, "label": "Feature Quality", "detail": "Too few features to assess", "color": "yellow"}

    # Check for high-cardinality categoricals (potential ID columns)
    row_count = profile.get("row_count", 1) or 1
    id_like_cols = 0
    for col in columns:
        unique = col.get("unique", 0)
        if unique == row_count and col.get("dtype", "") in ("object", "string", "int64"):
            id_like_cols += 1

    # Check correlations for redundancy and DATA LEAKAGE RISKS
    correlations = profile.get("correlations", {})
    high_corr_pairs = 0
    leakage_risks = 0
    if isinstance(correlations, dict):
        for col_name, corrs in correlations.items():
            if isinstance(corrs, dict):
                for other_col, val in corrs.items():
                    if col_name != other_col and isinstance(val, (int, float)):
                        if abs(val) > 0.99:
                            leakage_risks += 1
                        elif abs(val) > 0.95:
                            high_corr_pairs += 1

    high_corr_pairs //= 2  # Each pair counted twice
    leakage_risks //= 2

    score = 100
    if id_like_cols > 0:
        score -= id_like_cols * 10
    if high_corr_pairs > 0:
        score -= high_corr_pairs * 5
    if leakage_risks > 0:
        score -= leakage_risks * 20  # Heavy penalty for leakage

    score = max(10, min(100, score))

    if score >= 85:
        color, detail = "green", "Features show good variance, no leakage risks, and low redundancy"
    elif score >= 65:
        color, detail = "yellow", f"Some redundant features detected ({high_corr_pairs} highly correlated pairs)"
    elif leakage_risks > 0:
        color, detail = "red", f"CRITICAL: {leakage_risks} features show perfect correlation (>0.99). High Data Leakage Risk!"
    else:
        color, detail = "orange", f"{id_like_cols} potential ID columns and {high_corr_pairs} redundant feature pairs"

    return {"score": score, "label": "Feature Quality", "detail": detail, "color": color}


def _score_label_consistency(profile: dict) -> dict:
    """Score label/target column consistency."""
    label_dist = profile.get("label_distribution", {})

    if not label_dist:
        return {"score": 80, "label": "Label Consistency", "detail": "No label information available", "color": "green"}

    num_classes = len(label_dist)
    min_samples = min(label_dist.values()) if label_dist else 0

    if min_samples >= 20:
        score, color, detail = 95, "green", f"All {num_classes} classes have sufficient samples (min: {min_samples})"
    elif min_samples >= 5:
        score, color, detail = 70, "yellow", f"Some classes have few samples (min: {min_samples}) — consider data augmentation"
    elif min_samples >= 1:
        score, color, detail = 40, "orange", f"Classes with very few samples detected (min: {min_samples})"
    else:
        score, color, detail = 15, "red", "Empty classes detected — data collection needed"

    return {"score": score, "label": "Label Consistency", "detail": detail, "color": color}


# ── Main Health Score Function ────────────────────────────────

def compute_health_score(profile: dict) -> dict:
    """
    Compute dataset health score (0-100) with sub-metric breakdowns.

    Args:
        profile: Dataset profile dict from the profiling service.

    Returns:
        Dict with overall score, letter grade, color, breakdown list,
        and improvement suggestions.
    """
    sub_scores = [
        _score_data_quality(profile),
        _score_class_balance(profile),
        _score_duplicates(profile),
        _score_missing_values(profile),
        _score_feature_quality(profile),
        _score_label_consistency(profile),
    ]

    # Weighted average (data quality and missing values weighted higher)
    weights = {
        "Data Quality": 0.20,
        "Class Balance": 0.18,
        "Duplicates": 0.12,
        "Missing Values": 0.20,
        "Feature Quality": 0.15,
        "Label Consistency": 0.15,
    }

    weighted_sum = sum(
        s["score"] * weights.get(s["label"], 1 / len(sub_scores))
        for s in sub_scores
    )
    overall_score = round(weighted_sum)
    overall_score = max(0, min(100, overall_score))

    # Letter grade
    if overall_score >= 90:
        grade, overall_color = "A", "green"
    elif overall_score >= 80:
        grade, overall_color = "B", "green"
    elif overall_score >= 70:
        grade, overall_color = "C", "yellow"
    elif overall_score >= 55:
        grade, overall_color = "D", "orange"
    else:
        grade, overall_color = "F", "red"

    # Generate improvement suggestions
    suggestions = []
    for s in sub_scores:
        if s["score"] < 60:
            suggestions.append({
                "area": s["label"],
                "severity": "high" if s["score"] < 30 else "medium",
                "message": s["detail"],
            })
        elif s["score"] < 80:
            suggestions.append({
                "area": s["label"],
                "severity": "low",
                "message": s["detail"],
            })

    return {
        "overall_score": overall_score,
        "grade": grade,
        "color": overall_color,
        "breakdown": sub_scores,
        "suggestions": suggestions,
        "total_metrics": len(sub_scores),
    }
