"""
NeuralForge — File / Dataset Model
Tracks uploaded files and their analysis metadata.
Supports text, image, and tabular dataset types.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class File(Base):
    __tablename__ = "files"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)  # csv | xlsx | json | zip | jpg | png | txt
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=True)  # bytes

    # Dataset classification
    dataset_type: Mapped[str] = mapped_column(
        String(20), nullable=True, default="tabular"
    )  # text | image | tabular

    # Cleaning status
    cleaning_status: Mapped[str] = mapped_column(
        String(20), nullable=True, default="pending"
    )  # pending | analyzing | in_progress | cleaned | failed

    # Tabular/Text metadata
    row_count: Mapped[int] = mapped_column(Integer, nullable=True)
    column_count: Mapped[int] = mapped_column(Integer, nullable=True)
    columns_info: Mapped[dict] = mapped_column(JSON, default=dict)  # column names, types, stats
    profile: Mapped[dict] = mapped_column(JSON, default=dict)  # full profiling results

    # Image-specific metadata
    image_metadata: Mapped[dict] = mapped_column(JSON, default=dict)
    # Structure: {
    #   "total_images": int,
    #   "num_classes": int,
    #   "classes": {"class_name": count, ...},
    #   "dataset_size_mb": float,
    #   "resolution_distribution": {"WxH": count, ...},
    #   "formats": {"jpg": count, ...},
    #   "corrupt_images": [paths...],
    #   "duplicate_groups": [[path1, path2], ...],
    #   "quality_report": {"blurry": [...], "overexposed": [...], ...}
    # }

    # Analysis report (full profiling results for any dataset type)
    analysis_report: Mapped[dict] = mapped_column(JSON, default=dict)

    # Cleaned file path (if cleaning has been applied)
    cleaned_file_path: Mapped[str] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    project = relationship("Project", back_populates="files")
    training_jobs = relationship("TrainingJob", back_populates="file", cascade="all, delete-orphan")
