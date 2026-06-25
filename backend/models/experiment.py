"""
NeuralForge — Experiment Model
Tracks MLflow-style experiments, their hyperparams, and results.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    training_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_jobs.id", ondelete="SET NULL"), nullable=True
    )
    model_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("trained_models.id", ondelete="SET NULL"), nullable=True
    )
    dataset_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("dataset_versions.id", ondelete="SET NULL"), nullable=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Configuration
    hyperparameters: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Results
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    artifacts: Mapped[dict] = mapped_column(JSON, default=dict)

    # Status
    status: Mapped[str] = mapped_column(
        String(50), default="completed"
    )  # running | completed | failed | aborted
    
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    project = relationship("Project", back_populates="experiments")
    user = relationship("User")
    training_job = relationship("TrainingJob")
    model_version = relationship("TrainedModel", foreign_keys=[model_version_id])
    dataset_version = relationship("DatasetVersion")
