"""
NeuralForge — Dataset Chat API
Context-aware AI assistant that answers questions about the user's dataset.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from models.file import File

logger = logging.getLogger("neuralforge.api.dataset_chat")

router = APIRouter(prefix="/api/dataset-chat", tags=["dataset-chat"])


class DatasetChatRequest(BaseModel):
    question: str
    file_id: Optional[str] = None
    project_description: Optional[str] = None
    health_score: Optional[dict] = None
    advisor_results: Optional[dict] = None
    history: list[dict] = []  # Array of {role: str, content: str}


@router.post("/ask")
async def ask_about_dataset(
    request: DatasetChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Answer a question about the user's dataset using LLM with full context.
    """
    context_parts = []
    file_record = None

    if request.file_id:
        result = await db.execute(select(File).where(File.id == request.file_id))
        file_record = result.scalar_one_or_none()
    
    if file_record:
        # Build context from dataset info
        context_parts.extend([
            f"Dataset: {file_record.filename}",
            f"Type: {file_record.dataset_type or 'tabular'}",
            f"Rows: {file_record.row_count or 'unknown'}",
            f"Columns: {file_record.column_count or 'unknown'}",
        ])

        # Add column info
        cols_info = file_record.columns_info
        if isinstance(cols_info, dict) and "columns" in cols_info:
            col_list = cols_info["columns"][:15]
            cols_str = ", ".join(f"{c.get('name', '?')} ({c.get('dtype', '?')})" for c in col_list)
            context_parts.append(f"Columns: {cols_str}")

        # Add analysis info
        report = file_record.analysis_report or {}
        if report.get("missing_values"):
            missing = {k: v for k, v in report["missing_values"].items() if v > 0}
            if missing:
                context_parts.append(f"Missing values: {missing}")

        if report.get("label_distribution"):
            context_parts.append(f"Label distribution: {report['label_distribution']}")

        if report.get("duplicate_info"):
            context_parts.append(f"Duplicates: {report['duplicate_info']}")
    elif request.project_description:
        context_parts.append(f"Project Description: {request.project_description}")
        context_parts.append("Status: The user is currently in the dataset discovery phase and hasn't selected a dataset yet.")

    # Add health score if provided
    if request.health_score:
        context_parts.append(f"Health Score: {request.health_score.get('overall_score', '?')}/100")
        breakdown = request.health_score.get("breakdown", [])
        for b in breakdown:
            context_parts.append(f"  {b.get('label', '?')}: {b.get('score', '?')}/100 — {b.get('detail', '')}")

    # Add advisor if provided
    if request.advisor_results:
        task = request.advisor_results.get("task_type_display", "Unknown")
        context_parts.append(f"Detected task: {task}")
        recs = request.advisor_results.get("recommendations", [])
        if recs:
            top = recs[0]
            context_parts.append(f"Top recommended model: {top.get('display_name', '?')} (score: {top.get('suitability_score', '?')})")

    context = "\n".join(context_parts)
    
    history_str = ""
    if request.history:
        history_str = "\nCONVERSATION HISTORY:\n"
        for msg in request.history[-5:]: # Last 5 messages for context
            role = "User" if msg.get("role") == "user" else "Assistant"
            history_str += f"{role}: {msg.get('content')}\n"

    # Call LLM
    try:
        from services.llm_service import get_best_available_llm
        llm = get_best_available_llm(temperature=0.3)

        prompt = f"""You are an expert data scientist and AI engineer assistant for NeuralForge AI platform.

The user is interacting with the platform. Answer helpfully, concisely, and in plain English.
Avoid jargon unless the user asks technical questions. Be actionable — suggest specific next steps when relevant.

CURRENT PROJECT CONTEXT:
{context}
{history_str}

USER QUESTION: {request.question}

Provide a clear, helpful answer in 2-4 paragraphs. Use bullet points for lists."""

        response = llm.invoke(prompt)
        answer = response.content if hasattr(response, "content") else str(response)

    except Exception as e:
        logger.warning(f"LLM call failed: {e}")
        # Fallback: generate rule-based response
        answer = _fallback_response(request.question, file_record, file_record.analysis_report if file_record else {}, request.health_score)

    return {
        "question": request.question,
        "answer": answer,
        "file_id": request.file_id,
    }


def _fallback_response(question: str, file_record, report: dict, health_score: Optional[dict]) -> str:
    """Generate a basic response without LLM."""
    q_lower = question.lower()

    if "unhealthy" in q_lower or "health" in q_lower:
        if health_score:
            score = health_score.get("overall_score", 0)
            suggestions = health_score.get("suggestions", [])
            parts = [f"Your dataset health score is {score}/100."]
            for s in suggestions[:3]:
                parts.append(f"• **{s['area']}**: {s['message']}")
            return " ".join(parts)
        return "Upload and analyze your dataset first to get a health score."

    if "model" in q_lower or "recommend" in q_lower:
        return (
            "Model recommendations depend on your dataset type and size. "
            "Use the AI Model Advisor (Step 5) to get personalized recommendations "
            "with explanations for why each model suits your data."
        )

    if "duplicate" in q_lower:
        dup = report.get("duplicate_info", {})
        count = dup.get("duplicate_count", 0)
        return f"Your dataset has {count} duplicate rows. Removing duplicates can improve model performance and reduce training time."

    if "missing" in q_lower:
        missing = report.get("missing_values", {})
        missing_cols = {k: v for k, v in missing.items() if v > 0}
        if missing_cols:
            return f"These columns have missing values: {', '.join(f'{k} ({v})' for k, v in list(missing_cols.items())[:5])}. Consider imputation or dropping columns with >50% missing."
        return "Great news — no missing values detected in your dataset!"

    return (
        "I can help you understand your dataset, recommend models, explain metrics, "
        "and suggest improvements. Try asking: 'Why is my dataset unhealthy?', "
        "'Which model should I use?', or 'What features are most important?'"
    )
