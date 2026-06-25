"""
NeuralForge — Celery Application
Async task queue for training jobs, data processing, and model export.
"""

import os
from celery import Celery

# Default broker/backend from environment or config
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

app = Celery(
    "neuralforge",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=[
        "workers.training_tasks",
    ],
)

# Celery configuration
app.conf.update(
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Time limits
    task_time_limit=86400,       # 24 hours max per task
    task_soft_time_limit=82800,  # Soft limit at 23 hours

    # Result expiry
    result_expires=604800,  # 7 days

    # Routing
    task_routes={
        "workers.training_tasks.train_tabular": {"queue": "training-cpu"},
        "workers.training_tasks.train_image_classification": {"queue": "training-gpu"},
        "workers.training_tasks.train_text_classification": {"queue": "training-gpu"},
        "workers.training_tasks.train_object_detection": {"queue": "training-gpu"},
        "workers.training_tasks.train_automl": {"queue": "training-cpu"},
    },

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=10,

    # Timezone
    timezone="UTC",
    enable_utc=True,
)
