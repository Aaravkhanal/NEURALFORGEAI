"""
NeuralForge — Research API Routes
Paper search, summarization, and research management.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from models.project import Project
from models.research import ResearchResult
from schemas import ResearchSearchRequest, ResearchResultResponse

router = APIRouter(prefix="/api/research", tags=["research"])


@router.post("/search", response_model=ResearchResultResponse)
async def search_papers(
    body: ResearchSearchRequest,
    project_id: str = None,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Search for research papers on arXiv or web."""
    from agents.tools.arxiv_search import search_arxiv_papers
    from agents.tools.web_search import search_web

    papers = []

    if body.source == "arxiv":
        papers = await search_arxiv_papers(body.query, max_results=body.max_results)
    elif body.source == "web":
        papers = await search_web(body.query, max_results=body.max_results)

    # Save to database if project_id provided
    research_result = ResearchResult(
        project_id=project_id or "global",
        query=body.query,
        papers=papers,
        summaries=[],
        source=body.source,
    )

    if project_id:
        db.add(research_result)
        await db.flush()

    return ResearchResultResponse.model_validate(research_result)


@router.get("/{project_id}", response_model=list[ResearchResultResponse])
async def get_project_research(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all research results for a project."""
    result = await db.execute(
        select(ResearchResult)
        .where(ResearchResult.project_id == project_id)
        .order_by(ResearchResult.created_at.desc())
    )
    results = result.scalars().all()
    return [ResearchResultResponse.model_validate(r) for r in results]
