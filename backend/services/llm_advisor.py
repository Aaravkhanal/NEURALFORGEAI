"""
NeuralForge — LLM-Powered Model Advisor
Uses LLM reasoning to generate dynamic, contextual model recommendations
based on actual dataset analysis and problem statement. Never returns
hardcoded results.
"""

import json
import logging
from typing import Optional

logger = logging.getLogger("neuralforge.llm_advisor")


async def get_llm_recommendations(
    dataset_profile: dict,
    problem_statement: Optional[str] = None,
    business_objective: Optional[str] = None,
    max_models: int = 8,
) -> dict:
    """
    Use LLM to generate dynamic, contextual model recommendations.

    Sends dataset statistics + problem context to LLM. LLM returns ranked
    recommendations with explanations. Results are merged with static MODEL_DB
    metadata for complete recommendations.

    Args:
        dataset_profile: Output from DatasetAnalyzer.analyze()
        problem_statement: User's problem description
        business_objective: Optional business constraint
        max_models: Maximum recommendations to return

    Returns:
        Dict with ranked recommendations, analysis summary, and explanations.
    """
    from services.advisor_service import MODEL_DB, _score_model

    problem_type = dataset_profile.get("problem_type", "tabular_classification")
    compatible = dataset_profile.get("compatible_models", [])
    row_count = dataset_profile.get("row_count", 0)
    col_count = dataset_profile.get("column_count", 0)
    quality_score = dataset_profile.get("quality_score", 50)
    target_analysis = dataset_profile.get("target_analysis") or {}

    # ── Build dataset context for LLM ──────────────────────────
    context_lines = [
        f"Dataset: {row_count} rows × {col_count} columns",
        f"Problem type: {problem_type}",
        f"Data quality score: {quality_score}/100",
    ]

    # Target info
    if target_analysis:
        num_classes = target_analysis.get("num_classes")
        if num_classes:
            context_lines.append(f"Target: {num_classes} classes")
            if target_analysis.get("is_imbalanced"):
                context_lines.append(
                    f"⚠ Class imbalance detected (ratio: {target_analysis.get('imbalance_ratio', 'N/A')})"
                )
        elif target_analysis.get("type") == "continuous":
            context_lines.append(
                f"Target: continuous (mean={target_analysis.get('mean')}, std={target_analysis.get('std')})"
            )

    # Data quality issues
    dq = dataset_profile.get("data_quality", {})
    if dq.get("missing_pct", 0) > 0:
        context_lines.append(f"Missing values: {dq['missing_pct']}%")
    if dq.get("duplicate_pct", 0) > 0:
        context_lines.append(f"Duplicate rows: {dq['duplicate_pct']}%")

    cat_count = dq.get("categorical_columns", 0)
    num_count = dq.get("numeric_columns", 0)
    context_lines.append(f"Features: {num_count} numeric, {cat_count} categorical")

    # Outliers
    outliers = dataset_profile.get("outlier_analysis", [])
    if outliers:
        total_outlier_cols = len(outliers)
        context_lines.append(f"Outliers detected in {total_outlier_cols} columns")

    dataset_context = "\n".join(context_lines)

    # ── Try LLM-enhanced recommendations ───────────────────────
    llm_analysis = None
    try:
        llm_analysis = await _call_llm_for_recommendations(
            dataset_context, problem_type, problem_statement, business_objective,
            compatible, max_models
        )
    except Exception as e:
        logger.warning(f"LLM advisor failed, falling back to scoring: {e}")

    # ── Score-based recommendations (always computed) ──────────
    scored_models = []
    for key in compatible:
        if key in MODEL_DB:
            info = MODEL_DB[key]
            score = _score_model(key, info, dataset_profile)
            scored_models.append({
                "model_key": key,
                "info": info,
                "score": score,
            })

    scored_models.sort(key=lambda x: x["score"], reverse=True)

    # ── Merge LLM rankings with score-based rankings ──────────
    if llm_analysis and llm_analysis.get("rankings"):
        # Re-rank based on LLM preferences
        llm_rankings = llm_analysis["rankings"]
        llm_order = {r.get("model_key", "").lower(): i for i, r in enumerate(llm_rankings)}

        for model in scored_models:
            key = model["model_key"].lower()
            if key in llm_order:
                # Boost LLM-ranked models
                llm_rank = llm_order[key]
                model["score"] += max(0, (len(llm_rankings) - llm_rank) * 5)
                # Find the LLM explanation
                llm_entry = llm_rankings[llm_rank]
                model["llm_explanation"] = llm_entry.get("explanation", "")
                model["llm_score"] = llm_entry.get("score", model["score"])

        scored_models.sort(key=lambda x: x["score"], reverse=True)

    # ── Build final recommendations ────────────────────────────
    top_models = scored_models[:max_models]
    recommendations = []

    for rank, entry in enumerate(top_models, 1):
        info = entry["info"]
        rec = {
            "rank": rank,
            "model_key": entry["model_key"],
            "display_name": info["display_name"],
            "parameters": info.get("parameters", "N/A"),
            "accuracy_potential": info.get("accuracy_potential", "Medium"),
            "training_speed": info.get("training_speed", "Medium"),
            "inference_speed": info.get("inference_speed", "Medium"),
            "model_size": info.get("model_size", "Medium"),
            "hardware": info.get("hardware", "CPU"),
            "use_cases": info.get("use_cases", []),
            "strengths": info.get("strengths", []),
            "weaknesses": info.get("weaknesses", []),
            "suitability_score": round(entry["score"], 1),
            "is_recommended": rank == 1,
            "explanation": entry.get("llm_explanation") or _generate_dynamic_explanation(
                entry["model_key"], info, dataset_profile, problem_type, rank
            ),
        }
        recommendations.append(rec)

    # ── Analysis summary ──────────────────────────────────────
    analysis_summary = {
        "problem_type": problem_type,
        "problem_type_display": problem_type.replace("_", " ").title(),
        "dataset_summary": {
            "row_count": row_count,
            "column_count": col_count,
            "quality_score": quality_score,
            "num_classes": target_analysis.get("num_classes"),
            "is_imbalanced": target_analysis.get("is_imbalanced", False),
            "dataset_type": dataset_profile.get("dataset_type", "tabular"),
        },
        "data_quality": dq,
        "recommendations": recommendations,
        "total_models_evaluated": len(compatible),
        "llm_enhanced": llm_analysis is not None,
    }

    if llm_analysis:
        analysis_summary["llm_reasoning"] = llm_analysis.get("reasoning", "")

    return analysis_summary


async def _call_llm_for_recommendations(
    dataset_context: str,
    problem_type: str,
    problem_statement: Optional[str],
    business_objective: Optional[str],
    compatible_models: list[str],
    max_models: int,
) -> Optional[dict]:
    """Call LLM to get intelligent model rankings."""
    from services.llm_service import get_best_available_llm

    model_list = ", ".join(compatible_models[:20])
    problem_desc = problem_statement or "Not specified"
    objective = business_objective or "Not specified"

    prompt = f"""You are an expert ML engineer. Analyze this dataset and rank the best models.

DATASET ANALYSIS:
{dataset_context}

PROBLEM STATEMENT: {problem_desc}
BUSINESS OBJECTIVE: {objective}
DETECTED PROBLEM TYPE: {problem_type}

AVAILABLE MODELS: {model_list}

Return a JSON object with this exact structure:
{{
  "reasoning": "2-3 sentences explaining your analysis of this specific dataset",
  "rankings": [
    {{"model_key": "model_name", "score": 95, "explanation": "Why this model is best for THIS specific dataset"}}
  ]
}}

Rules:
- Rank models based on THIS dataset's characteristics, NOT generic advice
- Consider dataset size, feature types, missing values, class balance
- Score from 0-100 based on actual suitability
- Return at most {max_models} models
- Only use model keys from the AVAILABLE MODELS list
- Explanations must reference specific dataset characteristics
- Return ONLY the JSON, no markdown formatting"""

    try:
        llm = get_best_available_llm(temperature=0.2)
        response = await llm.ainvoke(prompt)
        content = response.content.strip()

        # Clean up potential markdown formatting
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        if content.endswith("```"):
            content = content[:-3]

        return json.loads(content.strip())
    except Exception as e:
        logger.warning(f"LLM recommendation call failed: {e}")
        return None


def _generate_dynamic_explanation(
    model_key: str,
    model_info: dict,
    profile: dict,
    problem_type: str,
    rank: int,
) -> str:
    """Generate explanation based on actual dataset characteristics."""
    name = model_info["display_name"]
    row_count = profile.get("row_count", 0)
    col_count = profile.get("column_count", 0)
    quality = profile.get("quality_score", 50)
    target = profile.get("target_analysis") or {}
    dq = profile.get("data_quality", {})

    parts = []

    if rank == 1:
        parts.append(f"{name} is the strongest match for your {row_count:,}-row dataset.")
    else:
        parts.append(f"{name} is a viable alternative for this problem.")

    # Reference actual dataset characteristics
    cat_cols = dq.get("categorical_columns", 0)
    if cat_cols > 0 and "catboost" in model_key.lower():
        parts.append(f"Your dataset has {cat_cols} categorical features — CatBoost handles these natively without encoding.")
    elif cat_cols > col_count * 0.5 and "catboost" not in model_key.lower():
        parts.append(f"Note: {cat_cols} of {col_count} features are categorical; encoding will be applied automatically.")

    missing_pct = dq.get("missing_pct", 0)
    if missing_pct > 5:
        if any("missing" in s.lower() for s in model_info.get("strengths", [])):
            parts.append(f"Handles the {missing_pct:.1f}% missing values in your data gracefully.")
        else:
            parts.append(f"Missing values ({missing_pct:.1f}%) should be imputed before training.")

    if target.get("is_imbalanced"):
        ratio = target.get("imbalance_ratio", "N/A")
        parts.append(f"Class imbalance detected (ratio {ratio}:1) — consider using class weights or SMOTE.")

    if row_count < 1000:
        speed = model_info.get("training_speed", "")
        if speed in ("Very Fast", "Fast"):
            parts.append(f"With only {row_count:,} samples, fast training avoids overfitting.")
    elif row_count > 100000:
        parts.append(f"Efficient handling of {row_count:,} rows is important — this model scales well.")

    hw = model_info.get("hardware", "CPU")
    if hw == "CPU":
        parts.append("Runs on CPU — no GPU required.")
    elif hw == "High GPU":
        parts.append("Requires GPU (16GB+ VRAM). Consider cloud services if not available locally.")

    if model_info.get("strengths"):
        parts.append(f"Key strength: {model_info['strengths'][0]}.")

    return " ".join(parts)
