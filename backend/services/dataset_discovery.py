"""
NeuralForge — Dataset Discovery Service (Production)
Real-time dataset search across Kaggle, HuggingFace, and OpenML APIs.
Uses DatasetQualityAnalyzer for scoring and ranking — no hardcoded catalogs.
LLM is used ONLY for recommendation explanations, never for dataset invention.
"""

import logging
import json
from typing import Optional

logger = logging.getLogger("neuralforge.discovery")


async def search_datasets_with_llm(description: str, max_results: int = 5) -> list[dict]:
    """
    Search for datasets using real APIs across Kaggle, HuggingFace, and OpenML.
    Steps:
      1. Search all three platforms concurrently
      2. Merge and deduplicate results
      3. Score with DatasetQualityAnalyzer (statistical, not LLM)
      4. Use LLM only for recommendation reasoning text
      5. Return top N sorted by suitability
    """
    from services.kaggle_service import kaggle_service
    from services.hf_service import hf_service
    from services.openml_service import openml_service
    from services.dataset_analyzer_live import DatasetQualityAnalyzer

    import asyncio

    all_datasets: list[dict] = []

    # ── Step 1: Search all platforms concurrently ──────────────
    kaggle_task = _safe_search(
        kaggle_service.search_datasets, description, limit=max_results, source_label="Kaggle"
    )
    hf_task = _safe_search(
        hf_service.search_datasets, description, limit=max_results, source_label="HuggingFace"
    )
    openml_task = _safe_search(
        openml_service.search_datasets, description, limit=max_results, source_label="OpenML"
    )

    k_results, h_results, o_results = await asyncio.gather(
        kaggle_task, hf_task, openml_task
    )

    all_datasets.extend(k_results)
    all_datasets.extend(h_results)
    all_datasets.extend(o_results)

    logger.info(
        "Dataset search found: Kaggle=%d, HuggingFace=%d, OpenML=%d",
        len(k_results), len(h_results), len(o_results),
    )

    # ── Step 2: Deduplicate by name (case-insensitive) ────────
    seen_names = set()
    unique = []
    for ds in all_datasets:
        key = ds.get("name", "").lower().strip()
        if key and key not in seen_names:
            seen_names.add(key)
            unique.append(ds)
    all_datasets = unique

    if not all_datasets:
        logger.info("No API results found, falling back to LLM recommendation")
        return await _llm_recommend_datasets(description, max_results)

    # ── Step 3: Score and rank with DatasetQualityAnalyzer ────
    ranked = DatasetQualityAnalyzer.rank_datasets(all_datasets, description)

    # ── Step 4: Add LLM recommendation reasoning (optional) ──
    ranked = ranked[:max_results]
    try:
        ranked = await _add_llm_reasoning(ranked, description)
    except Exception as e:
        logger.warning("LLM reasoning failed, using basic reasoning: %s", e)
        for i, ds in enumerate(ranked):
            ds["recommendation_reason"] = (
                f"Ranked #{i+1} based on suitability score of {ds.get('suitability_score', 0):.0f}/100."
            )

    # ── Step 5: Normalize output format ──────────────────────
    for ds in ranked:
        _normalize_output(ds)

    return ranked


async def _safe_search(search_fn, query: str, limit: int, source_label: str) -> list[dict]:
    """Safely call a search function, returning empty list on failure."""
    try:
        logger.info("Searching %s for: %s", source_label, query[:80])
        results = await search_fn(query, limit=limit)
        return results or []
    except Exception as e:
        logger.warning("%s search failed: %s", source_label, e)
        return []


async def _add_llm_reasoning(datasets: list[dict], description: str) -> list[dict]:
    """Use LLM to generate human-readable recommendation reasoning for each dataset."""
    try:
        from services.llm_service import get_best_available_llm
        llm = get_best_available_llm(temperature=0.2)
    except Exception:
        return datasets

    dataset_summaries = []
    for i, ds in enumerate(datasets):
        dataset_summaries.append(
            f"{i+1}. {ds.get('name')} "
            f"(source={ds.get('source')}, "
            f"samples={ds.get('samples', '?')}, "
            f"features={ds.get('features', '?')}, "
            f"missing={ds.get('missing_pct', 0):.1f}%, "
            f"suitability={ds.get('suitability_score', 0):.0f}/100)"
        )

    prompt = f"""For the project: "{description}"

Here are the top datasets found from real API searches, already ranked by statistical suitability:

{chr(10).join(dataset_summaries)}

For each dataset (numbered 1 to {len(datasets)}), write a 1-2 sentence explanation of WHY it was ranked at that position.
Focus on: data quality, relevance to the project, size appropriateness, and practical usability.

Return ONLY a JSON array of strings, one per dataset, in order.
Example: ["Dataset 1 is recommended because...", "Dataset 2 is acceptable because..."]
"""

    try:
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        if content.startswith("json"):
            content = content[4:].strip()

        reasons = json.loads(content)
        if isinstance(reasons, list):
            for i, reason in enumerate(reasons):
                if i < len(datasets):
                    datasets[i]["recommendation_reason"] = str(reason)
    except Exception as e:
        logger.warning("Failed to parse LLM reasoning: %s", e)

    return datasets


async def _llm_recommend_datasets(description: str, max_results: int = 5) -> list[dict]:
    """
    Last-resort fallback: use LLM knowledge to recommend datasets
    when ALL APIs fail. This is NOT the primary path.
    """
    try:
        from services.llm_service import get_best_available_llm
        llm = get_best_available_llm(temperature=0.3)

        prompt = f"""You are a dataset discovery engine. The user is looking for datasets for: "{description}"

All live API searches (Kaggle, HuggingFace, OpenML) returned no results.
Based on your knowledge, recommend {max_results} REAL datasets that exist on these platforms.

CRITICAL: Only recommend datasets you are confident actually exist. Include real URLs.
Do NOT invent fake datasets.

Return a JSON array with objects containing:
- "name": exact dataset name
- "source": platform (Kaggle, HuggingFace, OpenML, UCI, etc.)
- "source_url": real URL to the dataset
- "description": 1-2 sentence description
- "samples": estimated sample count (integer)
- "features": estimated feature count (integer)
- "size": estimated size string
- "downloads": estimated downloads (integer)
- "likes": estimated likes (integer)
- "missing_pct": estimated missing value percentage (float)
- "license": license type
- "recommendation_tier": "Recommended" for top 1, "Acceptable" for rest
- "recommendation_reason": why this dataset fits

Return ONLY the JSON array."""

        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)

        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        if content.startswith("json"):
            content = content[4:].strip()

        datasets = json.loads(content)
        if isinstance(datasets, list):
            from services.dataset_analyzer_live import DatasetQualityAnalyzer
            ranked = DatasetQualityAnalyzer.rank_datasets(datasets, description)
            for ds in ranked:
                _normalize_output(ds)
                ds["source_note"] = "Found via AI recommendation (APIs unavailable)"
            return ranked[:max_results]
    except Exception as e:
        logger.warning("LLM dataset recommendation also failed: %s", e)

    return []


def _normalize_output(ds: dict) -> None:
    """Ensure all required fields exist in a dataset result."""
    ds.setdefault("name", "Unknown Dataset")
    ds.setdefault("source", "Unknown")
    ds.setdefault("source_url", "")
    ds.setdefault("dataset_type", "Tabular")
    ds.setdefault("size", "Unknown")
    ds.setdefault("samples", 0)
    ds.setdefault("features", 0)
    ds.setdefault("classes", 0)
    ds.setdefault("labels", [])
    ds.setdefault("missing_pct", 0.0)
    ds.setdefault("suitability_score", 50)
    ds.setdefault("quality_score", ds.get("suitability_score", 50))
    ds.setdefault("popularity", "Medium")
    ds.setdefault("difficulty", "Medium")
    ds.setdefault("recommended_models", [])
    ds.setdefault("estimated_training_time", "Depends on hardware")
    ds.setdefault("hardware_requirements", "CPU")
    ds.setdefault("license", "Unknown")
    ds.setdefault("description", "No description available.")
    ds.setdefault("advantages", [])
    ds.setdefault("disadvantages", [])
    ds.setdefault("recommendation_tier", "Acceptable")
    ds.setdefault("recommendation_reason", "")


# ── Legacy compatibility functions ────────────────────────────

def _get_curated_datasets(description: str, max_results: int = 5) -> list[dict]:
    """
    DEPRECATED: This function no longer returns hardcoded data.
    Returns empty list — callers should use search_datasets_with_llm instead.
    """
    logger.warning(
        "_get_curated_datasets called — this is deprecated. "
        "Use search_datasets_with_llm for real API results."
    )
    return []


async def analyze_problem(description: str) -> dict:
    """Analyze a problem statement using LLM to extract task type, industry, target, etc."""
    try:
        from services.llm_service import get_best_available_llm
        llm = get_best_available_llm(temperature=0.1)

        prompt = f"""You are an expert AI Data Scientist. Analyze the following machine learning problem description and extract structured information.

Problem Description: "{description}"

Provide your analysis in JSON format with exactly these keys:
- "task_type": The machine learning task (e.g., "Binary Classification", "Multi-Class Classification", "Regression", "Time Series Forecasting", "Object Detection", "NLP").
- "industry": The industry domain (e.g., "Healthcare", "Finance", "Battery Recycling", "Automotive", "Retail").
- "domain": A more specific domain (e.g., "Lithium-ion Battery Health", "Customer Retention", "Medical Imaging").
- "prediction_target": What exactly the model is trying to predict (e.g., "State of Health", "Churn Status", "Price").
- "required_features": A list of strings representing expected column names or features needed (e.g., ["cycle_count", "voltage", "temperature"]).
- "estimated_size": A string estimating a realistic dataset size needed for this task (e.g., "10k - 50k rows", "100k+ rows", "1M+ rows").
- "recommended_model": The most suitable algorithm or model architecture (e.g., "XGBoost", "LSTM", "ResNet-50", "Random Forest").
- "difficulty": The technical difficulty ("Beginner", "Intermediate", "Advanced", "Expert").
- "training_strategy": A 2-4 word high-level strategy (e.g., "Baseline -> Finetuning", "Transfer Learning", "K-Fold Cross Validation").

Return ONLY the JSON object, nothing else.
"""
        response = await llm.ainvoke(prompt)
        content = response.content if hasattr(response, "content") else str(response)

        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0]
        if content.startswith("json"):
            content = content[4:].strip()

        return json.loads(content)
    except Exception as e:
        logger.error("Error analyzing problem: %s", e)
        return {
            "task_type": "Unknown",
            "industry": "General",
            "domain": "General Data Science",
            "prediction_target": "Unknown",
            "required_features": [],
        }


def compare_datasets(dataset_a: dict, dataset_b: dict) -> dict:
    """Generate a comparison between two datasets using real metrics."""
    from services.dataset_analyzer_live import DatasetQualityAnalyzer

    analysis_a = DatasetQualityAnalyzer.analyze_from_metadata(dataset_a)
    analysis_b = DatasetQualityAnalyzer.analyze_from_metadata(dataset_b)

    score_a = analysis_a.get("suitability_score", 50)
    score_b = analysis_b.get("suitability_score", 50)
    samples_a = dataset_a.get("samples", 0)
    samples_b = dataset_b.get("samples", 0)

    if score_a > score_b + 5:
        verdict = (
            f"{dataset_a['name']} is recommended — higher suitability score "
            f"({score_a:.0f} vs {score_b:.0f})."
        )
    elif score_b > score_a + 5:
        verdict = (
            f"{dataset_b['name']} is recommended — higher suitability score "
            f"({score_b:.0f} vs {score_a:.0f})."
        )
    elif samples_a > samples_b * 1.5:
        verdict = (
            f"{dataset_a['name']} is recommended — significantly more samples "
            f"({samples_a:,} vs {samples_b:,})."
        )
    elif samples_b > samples_a * 1.5:
        verdict = (
            f"{dataset_b['name']} is recommended — significantly more samples "
            f"({samples_b:,} vs {samples_a:,})."
        )
    else:
        verdict = (
            "Both datasets are comparable. Choose based on your specific "
            "requirements — smaller for speed, larger for accuracy."
        )

    return {
        "dataset_a": {**dataset_a, "analysis": analysis_a},
        "dataset_b": {**dataset_b, "analysis": analysis_b},
        "verdict": verdict,
        "comparison": {
            "suitability": {
                "a": score_a, "b": score_b,
                "winner": "a" if score_a > score_b else "b" if score_b > score_a else "tie",
            },
            "size": {
                "a": samples_a, "b": samples_b,
                "winner": "a" if samples_a > samples_b else "b" if samples_b > samples_a else "tie",
            },
        },
    }
