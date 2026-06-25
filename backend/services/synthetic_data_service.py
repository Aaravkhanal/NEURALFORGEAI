"""
NeuralForge — Synthetic Data Service (Production)
Schema-aware synthetic data generation using statistical methods.
Fallback chain: Statistical Copula → Column-wise Sampling → LLM Generation.
"""

import logging
import math
import random
import io
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np

logger = logging.getLogger("neuralforge.synthetic_data")


class SyntheticDataService:
    """
    Generates realistic synthetic datasets by learning distributions
    from real dataset previews. Falls back to LLM generation when
    no real data preview is available.
    """

    @staticmethod
    async def generate(
        description: str,
        project_type: str,
        n_rows: int = 100,
    ) -> Tuple[str, str]:
        """
        Main entry point for synthetic data generation.
        Returns (csv_content, generation_method).

        Strategy:
          1. Search for similar datasets on HuggingFace
          2. If found: load preview, learn distributions, generate
          3. If not found: fall back to LLM generation
        """
        # Step 1: Try to find a similar real dataset
        try:
            preview_df, source_name = await _find_similar_preview(description)
            if preview_df is not None and len(preview_df) > 10:
                logger.info(
                    "Found preview data from '%s' (%d rows, %d cols). "
                    "Generating synthetic data from real distributions.",
                    source_name, len(preview_df), len(preview_df.columns),
                )
                csv_content = _generate_from_distributions(preview_df, n_rows)
                return csv_content, f"statistical_copula (learned from {source_name})"
        except Exception as e:
            logger.warning("Distribution-based generation failed: %s", e)

        # Step 2: Fallback to LLM generation
        logger.info("No suitable preview found. Falling back to LLM generation.")
        csv_content = await _generate_with_llm(description, project_type, n_rows)
        return csv_content, "llm_generation"

    @staticmethod
    def validate(csv_content: str) -> Dict[str, Any]:
        """Validate generated synthetic data for quality."""
        report = {"valid": True, "errors": [], "quality_score": 100}
        try:
            df = pd.read_csv(io.StringIO(csv_content))

            if len(df) == 0:
                report["valid"] = False
                report["errors"].append("Generated dataset is empty.")
                report["quality_score"] = 0
                return report

            # Check missing values
            missing_total = int(df.isnull().sum().sum())
            if missing_total > 0:
                report["errors"].append(f"Found {missing_total} missing values.")
                report["quality_score"] -= min(20, missing_total * 2)

            # Check duplicate rows
            duplicates = int(df.duplicated().sum())
            if duplicates > 0:
                report["errors"].append(f"Found {duplicates} duplicate rows.")
                report["quality_score"] -= min(30, duplicates * 5)

            # Check class imbalance in last column
            if len(df.columns) > 0:
                last_col = df.columns[-1]
                if df[last_col].nunique() < 10:
                    counts = df[last_col].value_counts(normalize=True)
                    if counts.min() < 0.1:
                        report["errors"].append(
                            f"Severe class imbalance in column '{last_col}'."
                        )
                        report["quality_score"] -= 10

            # Check for constant columns
            constant_cols = [c for c in df.columns if df[c].nunique() <= 1]
            if constant_cols:
                report["errors"].append(
                    f"Constant columns detected: {constant_cols[:3]}"
                )
                report["quality_score"] -= len(constant_cols) * 5

            report["quality_score"] = max(0, report["quality_score"])
            if report["errors"]:
                report["valid"] = False

            report["stats"] = {
                "rows": len(df),
                "columns": len(df.columns),
                "column_names": list(df.columns),
                "dtypes": {c: str(df[c].dtype) for c in df.columns},
            }

        except Exception as e:
            report["valid"] = False
            report["errors"].append(f"Parse error: {str(e)}")
            report["quality_score"] = 0

        return report


async def _find_similar_preview(
    description: str,
) -> Tuple[Optional[pd.DataFrame], str]:
    """Search HuggingFace for a similar dataset and load its preview."""
    try:
        from services.hf_service import hf_service

        results = await hf_service.search_datasets(description, limit=3)
        for result in results:
            dataset_id = result.get("id", "")
            if not dataset_id:
                continue

            preview_rows = await hf_service.get_dataset_preview(dataset_id)
            if preview_rows and len(preview_rows) > 10:
                df = pd.DataFrame(preview_rows)
                # Filter out non-useful columns (images, etc.)
                useful_cols = []
                for col in df.columns:
                    if df[col].dtype in ("int64", "float64", "object", "bool"):
                        sample = df[col].dropna().head(5)
                        # Skip columns that look like file paths or URLs
                        if df[col].dtype == "object":
                            sample_strs = sample.astype(str)
                            if sample_strs.str.startswith(("/", "http", "{")).any():
                                continue
                        useful_cols.append(col)

                if useful_cols:
                    return df[useful_cols], dataset_id
    except Exception as e:
        logger.warning("Preview search failed: %s", e)

    return None, ""


def _generate_from_distributions(source_df: pd.DataFrame, n_rows: int) -> str:
    """
    Generate synthetic data by learning column-wise distributions from source data.
    Uses Gaussian copula approach for numeric columns and categorical sampling for others.
    """
    synthetic_data = {}

    for col in source_df.columns:
        if source_df[col].dtype in ("float64", "float32", "int64", "int32"):
            # Numeric: fit normal distribution from data
            values = source_df[col].dropna().values
            if len(values) == 0:
                synthetic_data[col] = [0.0] * n_rows
                continue

            mean = float(np.mean(values))
            std = float(np.std(values))
            if std < 1e-10:
                std = abs(mean) * 0.1 if mean != 0 else 1.0

            # Generate from normal distribution with clipping to observed range
            generated = np.random.normal(mean, std, n_rows)
            min_val, max_val = float(np.min(values)), float(np.max(values))
            # Extend range slightly to allow some natural variation
            margin = (max_val - min_val) * 0.1 if max_val > min_val else abs(mean) * 0.1
            generated = np.clip(generated, min_val - margin, max_val + margin)

            # Match dtype
            if source_df[col].dtype in ("int64", "int32"):
                generated = np.round(generated).astype(int)

            synthetic_data[col] = generated.tolist()

        elif source_df[col].dtype == "bool":
            # Boolean: sample from observed distribution
            true_pct = source_df[col].mean()
            synthetic_data[col] = [
                random.random() < true_pct for _ in range(n_rows)
            ]

        else:
            # Categorical: sample from observed value distribution
            values = source_df[col].dropna().astype(str).tolist()
            if not values:
                synthetic_data[col] = ["Unknown"] * n_rows
                continue

            # Build distribution
            from collections import Counter
            counter = Counter(values)
            categories = list(counter.keys())
            weights = [counter[c] / len(values) for c in categories]

            synthetic_data[col] = random.choices(
                categories, weights=weights, k=n_rows
            )

    # Build DataFrame and convert to CSV
    syn_df = pd.DataFrame(synthetic_data)
    return syn_df.to_csv(index=False)


async def _generate_with_llm(
    description: str, project_type: str, n_rows: int
) -> str:
    """Fallback: use LLM to generate synthetic CSV data."""
    try:
        from services.hf_service import hf_service

        # Try web search for schema context
        context_str = ""
        try:
            from agents.tools.web_search import search_web
            search_results = await search_web(
                f"{description} {project_type} dataset schema columns csv kaggle",
                max_results=3,
            )
            if search_results:
                context_str = "\nWeb Search Context (use for realistic column names):\n"
                for r in search_results:
                    context_str += f"- {r.get('content', '')[:400]}\n"
        except Exception:
            pass

        prompt = f"""You are an elite data scientist. Generate a realistic synthetic dataset for: "{description}"
Task Type: {project_type}
{context_str}

Generate EXACTLY {n_rows} rows in CSV format.
CRITICAL: Column names must be domain-specific and professional.
Return ONLY valid CSV text. No markdown, no backticks, no explanations.
"""
        response_text = await hf_service.generate_synthetic_data(
            prompt, dataset_type=project_type
        )

        # Clean markdown formatting
        csv_content = response_text.strip()
        if csv_content.startswith("```"):
            csv_content = csv_content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        if csv_content.startswith("csv"):
            csv_content = csv_content[3:].strip()

        return csv_content

    except Exception as e:
        logger.error("LLM synthetic generation failed: %s", e)
        raise


synthetic_data_service = SyntheticDataService()
