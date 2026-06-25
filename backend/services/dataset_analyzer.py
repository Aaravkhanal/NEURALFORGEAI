"""
NeuralForge — Dataset Analyzer Service
Performs comprehensive dataset analysis for dynamic model recommendations.
Examines column types, target variable, distributions, missing values,
class imbalance, and data structure to determine problem type and
compatible models.
"""

import logging
import os
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger("neuralforge.analyzer")


class DatasetAnalyzer:
    """Performs deep dataset analysis for dynamic recommendations."""

    # ── Problem type detection thresholds ──────────────────────
    CLASSIFICATION_UNIQUE_THRESHOLD = 20  # ≤ 20 unique values in target → classification
    TIMESERIES_DATE_KEYWORDS = [
        "date", "time", "timestamp", "datetime", "day", "month", "year",
        "period", "quarter", "week", "hour", "minute",
    ]

    def analyze(
        self,
        file_path: str,
        target_column: Optional[str] = None,
        problem_statement: Optional[str] = None,
        business_objective: Optional[str] = None,
    ) -> dict:
        """
        Perform comprehensive dataset analysis.

        Returns a rich profile dict used by all downstream components:
        advisor, training catalog, cleaning studio, framework recommender.
        """
        ext = os.path.splitext(file_path)[1].lower()
        df = self._load_dataframe(file_path, ext)
        if df is None:
            return self._empty_profile("Could not load dataset")

        profile = {
            "file_path": file_path,
            "row_count": len(df),
            "column_count": len(df.columns),
            "columns": list(df.columns),
            "memory_usage_mb": round(df.memory_usage(deep=True).sum() / 1024 / 1024, 2),
            "problem_statement": problem_statement,
            "business_objective": business_objective,
        }

        # ── Column-level analysis ──────────────────────────────
        columns_info = self._analyze_columns(df)
        profile["columns_info"] = columns_info

        # ── Data quality assessment ────────────────────────────
        quality = self._assess_quality(df, columns_info)
        profile["data_quality"] = quality

        # ── Target column analysis ─────────────────────────────
        if target_column and target_column in df.columns:
            target_analysis = self._analyze_target(df, target_column)
            profile["target_column"] = target_column
            profile["target_analysis"] = target_analysis
        else:
            profile["target_column"] = None
            profile["target_analysis"] = None

        # ── Problem type detection ─────────────────────────────
        problem_type = self._detect_problem_type(
            df, target_column, columns_info, problem_statement
        )
        profile["problem_type"] = problem_type
        profile["dataset_type"] = self._detect_dataset_type(df, columns_info)

        # ── Feature distributions ──────────────────────────────
        profile["feature_stats"] = self._compute_feature_stats(df, target_column)

        # ── Correlation matrix (numeric only) ──────────────────
        profile["correlation_matrix"] = self._compute_correlations(df)

        # ── Outlier analysis ───────────────────────────────────
        profile["outlier_analysis"] = self._detect_outliers(df)

        # ── Compatible models ──────────────────────────────────
        profile["compatible_models"] = self._get_compatible_models(profile)

        # ── Overall data quality score ─────────────────────────
        profile["quality_score"] = self._compute_quality_score(quality, profile)

        return profile

    # ── Column analysis ────────────────────────────────────────

    def _analyze_columns(self, df: pd.DataFrame) -> list[dict]:
        """Analyze each column's type, missing values, unique counts, etc."""
        results = []
        for col in df.columns:
            series = df[col]
            info = {
                "name": col,
                "dtype": str(series.dtype),
                "missing_count": int(series.isna().sum()),
                "missing_pct": round(float(series.isna().mean() * 100), 2),
                "unique_count": int(series.nunique()),
                "unique_pct": round(float(series.nunique() / max(len(series), 1) * 100), 2),
            }

            if pd.api.types.is_numeric_dtype(series):
                info["semantic_type"] = "numeric"
                clean = series.dropna()
                if len(clean) > 0:
                    info["mean"] = round(float(clean.mean()), 4)
                    info["std"] = round(float(clean.std()), 4)
                    info["min"] = float(clean.min())
                    info["max"] = float(clean.max())
                    info["median"] = float(clean.median())
                    info["skew"] = round(float(clean.skew()), 4)
                    info["kurtosis"] = round(float(clean.kurtosis()), 4)
                    info["q1"] = float(clean.quantile(0.25))
                    info["q3"] = float(clean.quantile(0.75))
            elif pd.api.types.is_datetime64_any_dtype(series):
                info["semantic_type"] = "datetime"
            else:
                info["semantic_type"] = "categorical"
                if info["unique_count"] <= 50:
                    try:
                        info["top_values"] = (
                            series.value_counts().head(10).to_dict()
                        )
                    except Exception:
                        info["top_values"] = {}

            results.append(info)
        return results

    # ── Target analysis ────────────────────────────────────────

    def _analyze_target(self, df: pd.DataFrame, target_col: str) -> dict:
        """Detailed analysis of the target variable."""
        series = df[target_col]
        result = {
            "dtype": str(series.dtype),
            "unique_count": int(series.nunique()),
            "missing_count": int(series.isna().sum()),
            "missing_pct": round(float(series.isna().mean() * 100), 2),
        }

        if pd.api.types.is_numeric_dtype(series) and series.nunique() <= self.CLASSIFICATION_UNIQUE_THRESHOLD:
            # Classification target
            result["type"] = "categorical"
            vc = series.value_counts()
            result["class_distribution"] = {str(k): int(v) for k, v in vc.items()}
            result["num_classes"] = int(series.nunique())
            if len(vc) >= 2:
                result["imbalance_ratio"] = round(
                    float(vc.iloc[0] / vc.iloc[-1]), 2
                )
                result["is_imbalanced"] = result["imbalance_ratio"] > 3.0
            else:
                result["imbalance_ratio"] = 1.0
                result["is_imbalanced"] = False
        elif pd.api.types.is_numeric_dtype(series):
            # Regression target
            result["type"] = "continuous"
            clean = series.dropna()
            if len(clean) > 0:
                result["mean"] = round(float(clean.mean()), 4)
                result["std"] = round(float(clean.std()), 4)
                result["min"] = float(clean.min())
                result["max"] = float(clean.max())
                result["skew"] = round(float(clean.skew()), 4)
        else:
            # Categorical string target
            result["type"] = "categorical"
            vc = series.value_counts()
            result["class_distribution"] = {str(k): int(v) for k, v in vc.head(30).items()}
            result["num_classes"] = int(series.nunique())
            if len(vc) >= 2:
                result["imbalance_ratio"] = round(
                    float(vc.iloc[0] / vc.iloc[-1]), 2
                )
                result["is_imbalanced"] = result["imbalance_ratio"] > 3.0

        return result

    # ── Problem type detection ─────────────────────────────────

    def _detect_problem_type(
        self,
        df: pd.DataFrame,
        target_col: Optional[str],
        columns_info: list[dict],
        problem_statement: Optional[str],
    ) -> str:
        """
        Auto-detect problem type from data characteristics and problem statement.
        Returns one of:
          tabular_classification, tabular_regression, time_series_forecasting,
          clustering, anomaly_detection, text_classification, image_classification,
          object_detection, recommendation, nlp
        """
        # Check problem statement keywords first
        if problem_statement:
            ps = problem_statement.lower()
            if any(w in ps for w in ["classify", "classification", "detect disease", "predict class", "spam", "sentiment", "fraud"]):
                if self._has_text_columns(df, columns_info):
                    return "text_classification"
                return "tabular_classification"
            if any(w in ps for w in ["regress", "predict price", "forecast value", "estimate"]):
                return "tabular_regression"
            if any(w in ps for w in ["time series", "forecast", "temporal", "predict future"]):
                return "time_series_forecasting"
            if any(w in ps for w in ["cluster", "segment", "group"]):
                return "clustering"
            if any(w in ps for w in ["anomaly", "outlier detection", "fraud detection"]):
                return "anomaly_detection"
            if any(w in ps for w in ["object detection", "bounding box", "yolo", "detect objects"]):
                return "object_detection"
            if any(w in ps for w in ["image classif", "vision", "picture", "photo"]):
                return "image_classification"
            if any(w in ps for w in ["recommend", "collaborative filtering"]):
                return "recommendation"
            if any(w in ps for w in ["nlp", "text generat", "summariz", "translat", "question answer"]):
                return "nlp"

        # Data-driven detection
        if target_col and target_col in df.columns:
            series = df[target_col]

            # Check for text-heavy datasets
            if self._has_text_columns(df, columns_info):
                if series.nunique() <= self.CLASSIFICATION_UNIQUE_THRESHOLD:
                    return "text_classification"

            # Check for time series
            if self._has_datetime_index(df, columns_info):
                if pd.api.types.is_numeric_dtype(series):
                    return "time_series_forecasting"

            # Classification vs Regression
            if series.dtype == "object" or (
                pd.api.types.is_numeric_dtype(series)
                and series.nunique() <= self.CLASSIFICATION_UNIQUE_THRESHOLD
            ):
                return "tabular_classification"
            else:
                return "tabular_regression"

        # No target column → unsupervised
        if self._has_datetime_index(df, columns_info):
            return "time_series_forecasting"

        return "tabular_classification"  # Safe default

    def _has_text_columns(self, df: pd.DataFrame, columns_info: list[dict]) -> bool:
        """Check if dataset has text-heavy columns (avg string length > 50)."""
        for info in columns_info:
            if info["semantic_type"] == "categorical" and info["unique_pct"] > 50:
                col = df[info["name"]]
                try:
                    avg_len = col.dropna().astype(str).str.len().mean()
                    if avg_len > 50:
                        return True
                except Exception:
                    pass
        return False

    def _has_datetime_index(self, df: pd.DataFrame, columns_info: list[dict]) -> bool:
        """Check if dataset has datetime columns suggesting time series."""
        for info in columns_info:
            if info["semantic_type"] == "datetime":
                return True
            # Check column name keywords
            name_lower = info["name"].lower()
            if any(kw in name_lower for kw in self.TIMESERIES_DATE_KEYWORDS):
                return True
        return False

    def _detect_dataset_type(self, df: pd.DataFrame, columns_info: list[dict]) -> str:
        """Detect whether the dataset is tabular, text, image, or time series."""
        if self._has_text_columns(df, columns_info):
            return "text"
        if self._has_datetime_index(df, columns_info):
            return "time_series"
        return "tabular"

    # ── Data quality assessment ─────────────────────────────────

    def _assess_quality(self, df: pd.DataFrame, columns_info: list[dict]) -> dict:
        """Assess overall data quality."""
        total_cells = df.shape[0] * df.shape[1]
        total_missing = df.isna().sum().sum()
        duplicate_rows = int(df.duplicated().sum())

        return {
            "total_cells": total_cells,
            "total_missing": int(total_missing),
            "missing_pct": round(float(total_missing / max(total_cells, 1) * 100), 2),
            "duplicate_rows": duplicate_rows,
            "duplicate_pct": round(float(duplicate_rows / max(len(df), 1) * 100), 2),
            "complete_rows": int((~df.isna().any(axis=1)).sum()),
            "complete_rows_pct": round(
                float((~df.isna().any(axis=1)).sum() / max(len(df), 1) * 100), 2
            ),
            "columns_with_missing": int((df.isna().sum() > 0).sum()),
            "high_cardinality_columns": sum(
                1 for c in columns_info
                if c["semantic_type"] == "categorical" and c["unique_pct"] > 80
            ),
            "constant_columns": sum(
                1 for c in columns_info if c["unique_count"] <= 1
            ),
            "numeric_columns": sum(
                1 for c in columns_info if c["semantic_type"] == "numeric"
            ),
            "categorical_columns": sum(
                1 for c in columns_info if c["semantic_type"] == "categorical"
            ),
            "datetime_columns": sum(
                1 for c in columns_info if c["semantic_type"] == "datetime"
            ),
        }

    # ── Feature statistics ─────────────────────────────────────

    def _compute_feature_stats(
        self, df: pd.DataFrame, target_col: Optional[str]
    ) -> list[dict]:
        """Compute distribution stats for each numeric feature."""
        stats = []
        numeric_cols = df.select_dtypes(include=["number"]).columns
        for col in numeric_cols:
            if col == target_col:
                continue
            series = df[col].dropna()
            if len(series) == 0:
                continue
            stats.append({
                "name": col,
                "mean": round(float(series.mean()), 4),
                "std": round(float(series.std()), 4),
                "min": float(series.min()),
                "max": float(series.max()),
                "median": float(series.median()),
                "skew": round(float(series.skew()), 4),
            })
        return stats[:30]  # Cap at 30 features

    # ── Correlation matrix ─────────────────────────────────────

    def _compute_correlations(self, df: pd.DataFrame) -> dict:
        """Compute correlation matrix for numeric columns."""
        numeric_df = df.select_dtypes(include=["number"])
        if numeric_df.shape[1] < 2 or numeric_df.shape[1] > 50:
            return {}
        try:
            corr = numeric_df.corr().round(3)
            return {
                "columns": list(corr.columns),
                "values": corr.values.tolist(),
            }
        except Exception:
            return {}

    # ── Outlier detection ──────────────────────────────────────

    def _detect_outliers(self, df: pd.DataFrame) -> list[dict]:
        """Detect outliers in numeric columns using IQR method."""
        outlier_info = []
        numeric_cols = df.select_dtypes(include=["number"]).columns
        for col in numeric_cols[:20]:  # Cap at 20 columns
            series = df[col].dropna()
            if len(series) < 10:
                continue
            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_count = int(((series < lower) | (series > upper)).sum())
            if outlier_count > 0:
                outlier_info.append({
                    "column": col,
                    "outlier_count": outlier_count,
                    "outlier_pct": round(float(outlier_count / len(series) * 100), 2),
                    "lower_bound": round(float(lower), 4),
                    "upper_bound": round(float(upper), 4),
                })
        return outlier_info

    # ── Compatible models ──────────────────────────────────────

    def _get_compatible_models(self, profile: dict) -> list[str]:
        """Return list of model keys compatible with this dataset/problem type."""
        problem_type = profile.get("problem_type", "tabular_classification")
        row_count = profile.get("row_count", 0)

        # Map problem types to compatible model task types
        TASK_TYPE_MAP = {
            "tabular_classification": ["tabular_classification"],
            "tabular_regression": ["tabular_regression"],
            "time_series_forecasting": ["time_series"],
            "clustering": ["clustering"],
            "anomaly_detection": ["anomaly_detection"],
            "text_classification": ["text_classification", "sentiment_analysis"],
            "image_classification": ["image_classification"],
            "object_detection": ["object_detection"],
            "nlp": ["text_classification", "sentiment_analysis"],
            "recommendation": ["tabular_classification"],
        }

        compatible_tasks = TASK_TYPE_MAP.get(problem_type, ["tabular_classification"])

        # Import MODEL_DB from advisor
        try:
            from services.advisor_service import MODEL_DB
            compatible = []
            for key, info in MODEL_DB.items():
                model_tasks = info.get("task_types", [])
                if any(t in compatible_tasks for t in model_tasks):
                    min_size = info.get("min_dataset_size", 0)
                    if row_count >= min_size or row_count == 0:
                        compatible.append(key)
            return compatible
        except Exception:
            return []

    # ── Quality score ──────────────────────────────────────────

    def _compute_quality_score(self, quality: dict, profile: dict) -> int:
        """Compute an overall quality score 0-100."""
        score = 100

        # Penalize missing values
        missing_pct = quality.get("missing_pct", 0)
        if missing_pct > 30:
            score -= 30
        elif missing_pct > 10:
            score -= 15
        elif missing_pct > 5:
            score -= 8

        # Penalize duplicates
        dup_pct = quality.get("duplicate_pct", 0)
        if dup_pct > 20:
            score -= 15
        elif dup_pct > 5:
            score -= 8

        # Penalize constant columns
        const_cols = quality.get("constant_columns", 0)
        score -= min(const_cols * 3, 10)

        # Reward dataset size
        rows = profile.get("row_count", 0)
        if rows < 50:
            score -= 15
        elif rows < 200:
            score -= 8
        elif rows > 10000:
            score += 5

        # Reward target balance
        target_analysis = profile.get("target_analysis")
        if target_analysis and target_analysis.get("is_imbalanced"):
            score -= 10

        return max(0, min(100, score))

    # ── Utilities ──────────────────────────────────────────────

    def _load_dataframe(self, file_path: str, ext: str) -> Optional[pd.DataFrame]:
        """Load a dataframe from file."""
        try:
            if ext in (".csv", "csv"):
                return pd.read_csv(file_path, nrows=50000)
            elif ext in (".xlsx", ".xls"):
                return pd.read_excel(file_path, nrows=50000)
            elif ext in (".json",):
                return pd.read_json(file_path)
            elif ext in (".parquet",):
                return pd.read_parquet(file_path)
            elif ext in (".tsv",):
                return pd.read_csv(file_path, sep="\t", nrows=50000)
            else:
                return pd.read_csv(file_path, nrows=50000)
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return None

    def _empty_profile(self, error: str) -> dict:
        """Return an empty profile with an error message."""
        return {
            "error": error,
            "row_count": 0,
            "column_count": 0,
            "columns": [],
            "columns_info": [],
            "data_quality": {},
            "problem_type": "unknown",
            "dataset_type": "unknown",
            "quality_score": 0,
            "compatible_models": [],
        }
