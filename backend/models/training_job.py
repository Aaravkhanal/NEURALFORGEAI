"""
NeuralForge — Training Job Model
Tracks model training jobs, their configuration, status, and results.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class TrainingJob(Base):
    __tablename__ = "training_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("files.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Task configuration
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # image_classification | object_detection | image_segmentation |
    # text_classification | sentiment_analysis | ner |
    # tabular_classification | tabular_regression

    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    # ResNet50, BERT, XGBoost, etc.

    model_config: Mapped[dict] = mapped_column(JSON, default=dict)
    # Model-specific params: pretrained weights, num_classes, etc.

    training_config: Mapped[dict] = mapped_column(JSON, default=dict)
    # {
    #   "epochs": 10, "batch_size": 32, "learning_rate": 0.001,
    #   "optimizer": "adam", "weight_decay": 0.0001,
    #   "validation_split": 0.2, "early_stopping": true,
    #   "early_stopping_patience": 5, "random_seed": 42
    # }

    augmentation_config: Mapped[dict] = mapped_column(JSON, default=dict)
    # {
    #   "horizontal_flip": true, "vertical_flip": false,
    #   "rotation": 15, "zoom": 0.1, "brightness": 0.2,
    #   "contrast": 0.2, "random_crop": false, "gaussian_noise": 0.01
    # }

    # Target column (for tabular/text tasks)
    target_column: Mapped[str] = mapped_column(String(255), nullable=True)

    # Job status
    status: Mapped[str] = mapped_column(
        String(20), default="queued", nullable=False
    )  # queued | training | completed | failed | cancelled

    progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0.0 to 100.0
    current_epoch: Mapped[int] = mapped_column(Integer, default=0)
    total_epochs: Mapped[int] = mapped_column(Integer, default=0)

    # Training metrics (updated in real-time)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    # {
    #   "train_loss": [0.5, 0.4, ...],
    #   "val_loss": [0.6, 0.5, ...],
    #   "train_accuracy": [0.7, 0.8, ...],
    #   "val_accuracy": [0.65, 0.75, ...],
    #   "best_epoch": 8,
    #   "best_accuracy": 0.92,
    #   "final_metrics": {"accuracy": 0.92, "f1": 0.91, "precision": 0.93, "recall": 0.90}
    # }

    # AutoML flag
    is_automl: Mapped[bool] = mapped_column(Boolean, default=False)
    automl_results: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"leaderboard": [{"model": "XGBoost", "accuracy": 0.95, ...}, ...]}

    # Error tracking
    error_message: Mapped[str] = mapped_column(Text, nullable=True)

    # Celery task ID for job management
    celery_task_id: Mapped[str] = mapped_column(String(255), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    project = relationship("Project", back_populates="training_jobs")
    file = relationship("File", back_populates="training_jobs")
    user = relationship("User", back_populates="training_jobs")
    trained_models = relationship("TrainedModel", back_populates="training_job", cascade="all, delete-orphan")
