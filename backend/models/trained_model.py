"""
NeuralForge — Trained Model Record
Stores metadata and paths for trained model artifacts.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Integer, Float, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class TrainedModel(Base):
    __tablename__ = "trained_models"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    training_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Model identity
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # File paths
    model_path: Mapped[str] = mapped_column(String(512), nullable=False)
    model_format: Mapped[str] = mapped_column(String(20), nullable=False)  # pt | onnx | pkl | joblib | saved_model
    model_size: Mapped[int] = mapped_column(Integer, nullable=True)  # bytes

    # Performance metrics
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"accuracy": 0.95, "f1": 0.94, "precision": 0.96, "recall": 0.93, "mse": null, "r2": null}
    train_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    generalization_gap: Mapped[float] = mapped_column(Float, nullable=True)
    overfitting_status: Mapped[str] = mapped_column(String(50), default="Unknown")

    # Export availability
    export_formats: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"pt": "/path/to/model.pt", "onnx": "/path/to/model.onnx", "pkl": null}

    # Versioning
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_best: Mapped[bool] = mapped_column(Boolean, default=False)
    epoch: Mapped[int] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Stable")  # Stable | Best Model | Overfitted
    
    # Branching / Genealogy
    parent_id: Mapped[str] = mapped_column(String(36), ForeignKey("trained_models.id", ondelete="SET NULL"), nullable=True)
    branch_name: Mapped[str] = mapped_column(String(100), default="main")

    # MLOps Layer
    experiment_id: Mapped[str] = mapped_column(String(36), ForeignKey("experiments.id", ondelete="SET NULL"), nullable=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id", ondelete="SET NULL"), nullable=True)
    deployment_id: Mapped[str] = mapped_column(String(36), ForeignKey("deployment_records.id", ondelete="SET NULL"), nullable=True)
    download_count: Mapped[int] = mapped_column(Integer, default=0)

    # Metadata
    dataset_info: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"filename": "data.csv", "rows": 1000, "target": "label"}

    training_params: Mapped[dict] = mapped_column(JSON, default=dict)
    # Copy of training config for reproducibility

    # Explainability metadata
    feature_names: Mapped[list] = mapped_column(JSON, default=list)
    # ["age", "income", "tenure", ...]

    feature_types: Mapped[dict] = mapped_column(JSON, default=dict)
    # {"age": "numeric", "gender": "categorical", ...}

    preprocessing_path: Mapped[str] = mapped_column(String(512), nullable=True)
    # Path to saved scaler/encoders (joblib)

    training_data_path: Mapped[str] = mapped_column(String(512), nullable=True)
    # Path to a snapshot of training data for tracing

    global_shap_values: Mapped[dict] = mapped_column(JSON, default=dict)
    # Precomputed global SHAP feature importance

    transparency_report: Mapped[dict] = mapped_column(JSON, default=dict)
    # Full training transparency report

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    training_job = relationship("TrainingJob", back_populates="trained_models")
    project = relationship("Project", back_populates="trained_models")
    user = relationship("User", back_populates="trained_models")
