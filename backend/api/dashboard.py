"""
NeuralForge — Dashboard API Routes
Aggregated statistics and recent activity for the dashboard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.security import get_current_user_id
from models.project import Project
from models.conversation import Conversation
from models.file import File
from models.research import ResearchResult
from schemas import DashboardStats, ProjectResponse

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated dashboard statistics for the current user."""

    # Total projects
    total_projects = (
        await db.execute(
            select(func.count(Project.id)).where(Project.user_id == user_id)
        )
    ).scalar() or 0

    # Active projects
    active_projects = (
        await db.execute(
            select(func.count(Project.id)).where(
                Project.user_id == user_id, Project.status == "active"
            )
        )
    ).scalar() or 0

    # Total conversations (across all user's projects)
    total_conversations = (
        await db.execute(
            select(func.count(Conversation.id))
            .join(Project, Conversation.project_id == Project.id)
            .where(Project.user_id == user_id)
        )
    ).scalar() or 0

    # Total files
    total_files = (
        await db.execute(
            select(func.count(File.id))
            .join(Project, File.project_id == Project.id)
            .where(Project.user_id == user_id)
        )
    ).scalar() or 0

    # Total research results
    total_research = (
        await db.execute(
            select(func.count(ResearchResult.id))
            .join(Project, ResearchResult.project_id == Project.id)
            .where(Project.user_id == user_id)
        )
    ).scalar() or 0

    # Recent projects (last 5)
    recent_result = await db.execute(
        select(Project)
        .where(Project.user_id == user_id)
        .order_by(Project.updated_at.desc())
        .limit(5)
    )
    recent_projects = [
        ProjectResponse.model_validate(p) for p in recent_result.scalars().all()
    ]

    return DashboardStats(
        total_projects=total_projects,
        active_projects=active_projects,
        total_conversations=total_conversations,
        total_files=total_files,
        total_research=total_research,
        recent_projects=recent_projects,
    )
