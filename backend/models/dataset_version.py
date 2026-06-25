"""
NeuralForge — Dataset Version Model
Tracks versions of datasets after cleaning/feature engineering.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    version: Mapped[int] = mapped_column(Integer, default=1)
    
    # Transformation History
    cleaning_steps: Mapped[dict] = mapped_column(JSON, default=dict)
    feature_engineering_steps: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Schema Snapshot
    row_count: Mapped[int] = mapped_column(Integer, nullable=False)
    column_count: Mapped[int] = mapped_column(Integer, nullable=False)
    columns: Mapped[dict] = mapped_column(JSON, default=dict)
    
    # Storage
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    file = relationship("File")
    project = relationship("Project")
