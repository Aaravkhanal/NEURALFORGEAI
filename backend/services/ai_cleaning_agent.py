"""
NeuralForge — AI Cleaning Agent
LLM-powered data cleaning advisor that detects issues, explains them,
suggests fixes with impact previews, and applies fixes after approval.
"""

import logging
import json
from typing import Optional

import pandas as pd
import numpy as np

logger = logging.getLogger("neuralforge.ai_cleaning")


class AICleaningAgent:
    """AI-powered data cleaning agent that suggests and applies cleaning operations."""

    async def suggest(
        self,
        file_path: str,
        file_ext: str,
        target_column: Optional[str] = None,
    ) -> dict:
        """
        Analyze dataset and return AI-suggested cleaning operations with impact preview.

        Returns:
            {
                "suggestions": [...],
                "summary": "...",
                "quality_before": int,
                "quality_after_estimated": int,
            }
        """
        df = self._load_df(file_path, file_ext)
        if df is None:
            return {"error": "Could not load dataset", "suggestions": []}

        suggestions = []

        # ── 1. Missing Values ──────────────────────────────────
        missing_suggestions = self._analyze_missing_values(df, target_column)
        suggestions.extend(missing_suggestions)

        # ── 2. Duplicates ──────────────────────────────────────
        dup_suggestions = self._analyze_duplicates(df)
        suggestions.extend(dup_suggestions)

        # ── 3. Outliers ────────────────────────────────────────
        outlier_suggestions = self._analyze_outliers(df, target_column)
        suggestions.extend(outlier_suggestions)

        # ── 4. Constant Columns ────────────────────────────────
        const_suggestions = self._analyze_constant_columns(df, target_column)
        suggestions.extend(const_suggestions)

        # ── 5. High Cardinality ────────────────────────────────
        card_suggestions = self._analyze_high_cardinality(df, target_column)
        suggestions.extend(card_suggestions)

        # ── 6. Data Type Issues ────────────────────────────────
        dtype_suggestions = self._analyze_dtype_issues(df)
        suggestions.extend(dtype_suggestions)

        # ── Quality estimation ─────────────────────────────────
        quality_before = self._estimate_quality(df)
        quality_after = quality_before
        for s in suggestions:
            quality_after += s.get("quality_impact", 0)
        quality_after = min(100, max(0, quality_after))

        # ── LLM-enhanced summary ───────────────────────────────
        summary = await self._generate_summary(suggestions, len(df), len(df.columns))

        return {
            "suggestions": suggestions,
            "summary": summary,
            "quality_before": quality_before,
            "quality_after_estimated": quality_after,
            "total_issues": len(suggestions),
            "rows": len(df),
            "columns": len(df.columns),
        }

    # ── Missing Values Analysis ─────────────────────────────────

    def _analyze_missing_values(self, df: pd.DataFrame, target_col: Optional[str]) -> list[dict]:
        """Detect and suggest fixes for missing values."""
        suggestions = []
        for col in df.columns:
            if col == target_col:
                continue
            missing_count = int(df[col].isna().sum())
            missing_pct = round(float(df[col].isna().mean() * 100), 1)
            if missing_count == 0:
                continue

            suggestion = {
                "category": "missing_values",
                "severity": "high" if missing_pct > 20 else ("medium" if missing_pct > 5 else "low"),
                "column": col,
                "issue": f"{missing_pct}% missing values in '{col}' ({missing_count} rows)",
                "rows_affected": missing_count,
            }

            # Choose strategy based on column type and missing %
            if missing_pct > 60:
                suggestion["recommendation"] = f"Drop column '{col}' (>60% missing)"
                suggestion["explanation"] = (
                    f"Column '{col}' has {missing_pct}% missing values. "
                    "With more than 60% missing, imputation is unreliable. "
                    "Recommend dropping this column entirely."
                )
                suggestion["operation"] = {"type": "drop_column", "column": col}
                suggestion["quality_impact"] = 3
            elif pd.api.types.is_numeric_dtype(df[col]):
                skew = abs(df[col].dropna().skew()) if len(df[col].dropna()) > 2 else 0
                if skew > 1.0:
                    strategy = "median"
                    reason = f"median (skewness={skew:.1f}, so mean would be biased)"
                else:
                    strategy = "mean"
                    reason = f"mean (distribution is roughly symmetric, skew={skew:.1f})"

                suggestion["recommendation"] = f"Impute with {strategy}"
                suggestion["explanation"] = (
                    f"Column '{col}' has {missing_pct}% missing values. "
                    f"Recommend {reason}."
                )
                suggestion["operation"] = {"type": "impute", "column": col, "strategy": strategy}
                suggestion["quality_impact"] = min(5, int(missing_pct / 5))
            else:
                suggestion["recommendation"] = "Impute with mode (most frequent value)"
                suggestion["explanation"] = (
                    f"Categorical column '{col}' has {missing_pct}% missing values. "
                    "Recommend filling with the most frequent value."
                )
                suggestion["operation"] = {"type": "impute", "column": col, "strategy": "mode"}
                suggestion["quality_impact"] = min(4, int(missing_pct / 5))

            suggestions.append(suggestion)

        # Also check target column missing values
        if target_col and target_col in df.columns:
            target_missing = int(df[target_col].isna().sum())
            if target_missing > 0:
                pct = round(float(df[target_col].isna().mean() * 100), 1)
                suggestions.append({
                    "category": "missing_values",
                    "severity": "high",
                    "column": target_col,
                    "issue": f"{pct}% missing values in target column '{target_col}'",
                    "rows_affected": target_missing,
                    "recommendation": "Drop rows with missing target values",
                    "explanation": (
                        f"Target column '{target_col}' has {target_missing} missing values. "
                        "Rows without target values cannot be used for training."
                    ),
                    "operation": {"type": "drop_rows", "column": target_col},
                    "quality_impact": 5,
                })

        return suggestions

    # ── Duplicate Analysis ──────────────────────────────────────

    def _analyze_duplicates(self, df: pd.DataFrame) -> list[dict]:
        """Detect duplicate rows."""
        dup_count = int(df.duplicated().sum())
        if dup_count == 0:
            return []

        dup_pct = round(float(dup_count / len(df) * 100), 1)
        return [{
            "category": "duplicates",
            "severity": "high" if dup_pct > 10 else "medium",
            "column": None,
            "issue": f"{dup_count} duplicate rows found ({dup_pct}% of dataset)",
            "rows_affected": dup_count,
            "recommendation": "Remove duplicate rows",
            "explanation": (
                f"Found {dup_count} exact duplicate rows. "
                "Duplicates can bias model training and inflate metrics."
            ),
            "operation": {"type": "drop_duplicates"},
            "quality_impact": min(8, int(dup_pct / 2)),
        }]

    # ── Outlier Analysis ────────────────────────────────────────

    def _analyze_outliers(self, df: pd.DataFrame, target_col: Optional[str]) -> list[dict]:
        """Detect outliers in numeric columns using IQR method."""
        suggestions = []
        numeric_cols = df.select_dtypes(include=["number"]).columns

        for col in numeric_cols:
            if col == target_col:
                continue
            series = df[col].dropna()
            if len(series) < 20:
                continue

            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue

            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            outlier_count = int(((series < lower) | (series > upper)).sum())
            outlier_pct = round(float(outlier_count / len(series) * 100), 1)

            if outlier_count < 3 or outlier_pct < 0.5:
                continue

            suggestions.append({
                "category": "outliers",
                "severity": "medium" if outlier_pct > 5 else "low",
                "column": col,
                "issue": f"{outlier_count} outliers in '{col}' ({outlier_pct}%)",
                "rows_affected": outlier_count,
                "recommendation": f"Clip outliers using IQR method",
                "explanation": (
                    f"Found {outlier_count} outliers in '{col}' "
                    f"(values outside [{lower:.2f}, {upper:.2f}]). "
                    "Recommend IQR clipping to bound extreme values."
                ),
                "operation": {
                    "type": "handle_outliers",
                    "column": col,
                    "method": "iqr",
                    "action": "clip",
                },
                "quality_impact": min(3, int(outlier_pct / 3)),
            })

        return suggestions[:5]  # Cap at 5 outlier suggestions

    # ── Constant Columns ────────────────────────────────────────

    def _analyze_constant_columns(self, df: pd.DataFrame, target_col: Optional[str]) -> list[dict]:
        """Detect columns with zero variance."""
        suggestions = []
        for col in df.columns:
            if col == target_col:
                continue
            if df[col].nunique() <= 1:
                suggestions.append({
                    "category": "constant_column",
                    "severity": "high",
                    "column": col,
                    "issue": f"Column '{col}' has only {df[col].nunique()} unique value(s)",
                    "rows_affected": len(df),
                    "recommendation": f"Drop column '{col}' (zero information)",
                    "explanation": (
                        f"Column '{col}' has constant or near-constant values. "
                        "It provides no discriminative information for model training."
                    ),
                    "operation": {"type": "drop_column", "column": col},
                    "quality_impact": 3,
                })
        return suggestions

    # ── High Cardinality ────────────────────────────────────────

    def _analyze_high_cardinality(self, df: pd.DataFrame, target_col: Optional[str]) -> list[dict]:
        """Detect categorical columns with too many unique values."""
        suggestions = []
        for col in df.select_dtypes(include=["object", "category"]).columns:
            if col == target_col:
                continue
            unique_count = df[col].nunique()
            unique_pct = float(unique_count / max(len(df), 1) * 100)

            if unique_pct > 80 and unique_count > 50:
                suggestions.append({
                    "category": "high_cardinality",
                    "severity": "medium",
                    "column": col,
                    "issue": f"'{col}' has {unique_count} unique values ({unique_pct:.0f}% unique)",
                    "rows_affected": 0,
                    "recommendation": f"Consider dropping or frequency-encoding '{col}'",
                    "explanation": (
                        f"Column '{col}' has very high cardinality ({unique_count} unique values). "
                        "This is likely an ID or free-text column that won't help model training. "
                        "Consider dropping it or using frequency encoding."
                    ),
                    "operation": {"type": "drop_column", "column": col},
                    "quality_impact": 2,
                })
        return suggestions

    # ── Data Type Issues ────────────────────────────────────────

    def _analyze_dtype_issues(self, df: pd.DataFrame) -> list[dict]:
        """Detect potential data type mismatches."""
        suggestions = []
        for col in df.select_dtypes(include=["object"]).columns:
            # Check if object column is actually numeric
            try:
                numeric_vals = pd.to_numeric(df[col], errors="coerce")
                non_null = numeric_vals.notna().sum()
                if non_null / max(len(df), 1) > 0.8:
                    suggestions.append({
                        "category": "dtype_mismatch",
                        "severity": "low",
                        "column": col,
                        "issue": f"'{col}' stored as text but appears numeric",
                        "rows_affected": 0,
                        "recommendation": f"Convert '{col}' to numeric type",
                        "explanation": (
                            f"Column '{col}' is stored as text but {non_null} of {len(df)} "
                            "values are numeric. Converting to float would improve model performance."
                        ),
                        "operation": {"type": "correct_dtype", "column": col, "target_dtype": "float"},
                        "quality_impact": 2,
                    })
            except Exception:
                pass
        return suggestions[:3]  # Cap

    # ── Quality Estimation ──────────────────────────────────────

    def _estimate_quality(self, df: pd.DataFrame) -> int:
        """Estimate current data quality score 0-100."""
        score = 100
        total_cells = df.shape[0] * df.shape[1]
        total_missing = df.isna().sum().sum()
        missing_pct = total_missing / max(total_cells, 1) * 100

        if missing_pct > 30:
            score -= 30
        elif missing_pct > 10:
            score -= 15
        elif missing_pct > 5:
            score -= 8

        dup_pct = df.duplicated().sum() / max(len(df), 1) * 100
        if dup_pct > 20:
            score -= 15
        elif dup_pct > 5:
            score -= 8

        # Constant columns
        const_cols = sum(1 for c in df.columns if df[c].nunique() <= 1)
        score -= min(const_cols * 3, 10)

        return max(0, min(100, score))

    # ── LLM Summary ────────────────────────────────────────────

    async def _generate_summary(self, suggestions: list, rows: int, cols: int) -> str:
        """Generate a natural language summary of cleaning suggestions."""
        if not suggestions:
            return (
                f"Your dataset ({rows:,} rows × {cols} columns) looks clean! "
                "No significant issues detected."
            )

        category_counts = {}
        for s in suggestions:
            cat = s.get("category", "other")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        parts = [f"Found {len(suggestions)} issues in your dataset ({rows:,} rows × {cols} columns):"]

        if "missing_values" in category_counts:
            parts.append(f"• {category_counts['missing_values']} columns with missing values")
        if "duplicates" in category_counts:
            parts.append(f"• Duplicate rows detected")
        if "outliers" in category_counts:
            parts.append(f"• {category_counts['outliers']} columns with outliers")
        if "constant_column" in category_counts:
            parts.append(f"• {category_counts['constant_column']} constant column(s) (zero information)")
        if "high_cardinality" in category_counts:
            parts.append(f"• {category_counts['high_cardinality']} high-cardinality column(s)")
        if "dtype_mismatch" in category_counts:
            parts.append(f"• {category_counts['dtype_mismatch']} data type mismatch(es)")

        # Try LLM for enhanced summary
        try:
            from services.llm_service import get_best_available_llm
            llm = get_best_available_llm(temperature=0.3)
            prompt = (
                f"You are a data scientist. Summarize these data quality issues in 2-3 sentences:\n"
                f"Dataset: {rows} rows × {cols} columns\n"
                f"Issues: {json.dumps([{'issue': s['issue'], 'severity': s['severity']} for s in suggestions[:10]])}\n"
                f"Give practical advice. Be concise."
            )
            response = await llm.ainvoke(prompt)
            return response.content.strip()
        except Exception:
            return "\n".join(parts)

    # ── Utilities ──────────────────────────────────────────────

    def _load_df(self, file_path: str, ext: str) -> Optional[pd.DataFrame]:
        """Load dataframe from file."""
        try:
            if ext in (".csv", "csv"):
                return pd.read_csv(file_path)
            elif ext in (".xlsx", ".xls", "xlsx", "xls"):
                return pd.read_excel(file_path)
            elif ext in (".json", "json"):
                return pd.read_json(file_path)
            elif ext in (".parquet",):
                return pd.read_parquet(file_path)
            else:
                return pd.read_csv(file_path)
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")
            return None
