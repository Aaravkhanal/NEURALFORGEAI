"""
NeuralForge — Deployment Record Model
Tracks deployed models and endpoints.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DeploymentRecord(Base):
    __tablename__ = "deployment_records"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("trained_models.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    provider: Mapped[str] = mapped_column(String(50), nullable=False) # aws | gcp | azure | docker
    endpoint_url: Mapped[str] = mapped_column(String(512), nullable=True)
    
    status: Mapped[str] = mapped_column(
        String(50), default="deploying"
    )  # deploying | active | stopped | failed
    
    config: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    stopped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project = relationship("Project")
    model = relationship("TrainedModel", foreign_keys=[model_id])
    user = relationship("User")
