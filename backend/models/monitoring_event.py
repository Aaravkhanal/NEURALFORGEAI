"""
NeuralForge — Monitoring Event Model
Tracks live inference telemetry and data drift.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class MonitoringEvent(Base):
    __tablename__ = "monitoring_events"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    deployment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("deployment_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    event_type: Mapped[str] = mapped_column(String(50), nullable=False) # latency | drift | error | alert
    value: Mapped[float] = mapped_column(Float, nullable=False)
    
    metadata_info: Mapped[dict] = mapped_column(JSON, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    deployment = relationship("DeploymentRecord")
