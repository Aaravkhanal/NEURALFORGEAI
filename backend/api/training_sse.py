"""
NeuralForge — Training SSE Stream (Production)
Server-Sent Events endpoint for real-time training metric streaming.
Reads metrics from the database and streams them to the frontend.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

logger = logging.getLogger("neuralforge.training_sse")

router = APIRouter(prefix="/api/training", tags=["training", "sse"])


@router.get("/stream/{job_id}")
async def stream_training_metrics(job_id: str):
    """
    SSE endpoint for real-time training metrics.
    Streams events as the training job progresses.

    Event types:
      - status: job status change (queued, training, completed, failed)
      - metrics: per-epoch training metrics
      - progress: progress percentage update
      - complete: training finished (final metrics)
      - error: training error
    """

    async def event_generator():
        last_epoch = -1
        last_status = None
        poll_count = 0
        max_polls = 3600  # 1 hour max
        queued_polls = 0   # consecutive polls with status="queued"
        QUEUED_TIMEOUT = 90  # seconds before declaring worker missing

        while poll_count < max_polls:
            poll_count += 1

            try:
                job = await _get_job_from_db(job_id)
                if not job:
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": f"Training job {job_id} not found."}),
                    }
                    return

                status = job.get("status", "queued")
                progress = job.get("progress", 0.0)
                current_epoch = job.get("current_epoch", 0)
                total_epochs = job.get("total_epochs", 0)
                metrics_raw = job.get("metrics", "{}")

                # Detect Celery worker not running: job stuck in "queued"
                if status == "queued":
                    queued_polls += 1
                    if queued_polls >= QUEUED_TIMEOUT:
                        yield {
                            "event": "error",
                            "data": json.dumps({
                                "error": (
                                    "Training job has been queued for over 90 seconds. "
                                    "The Celery worker may not be running. "
                                    "Start it with: cd backend && celery -A workers.celery_app worker --loglevel=info"
                                ),
                            }),
                        }
                        return
                else:
                    queued_polls = 0

                # Parse metrics
                try:
                    metrics = json.loads(metrics_raw) if isinstance(metrics_raw, str) else (metrics_raw or {})
                except json.JSONDecodeError:
                    metrics = {}

                # Send status update when it changes
                if status != last_status:
                    last_status = status
                    yield {
                        "event": "status",
                        "data": json.dumps({
                            "status": status,
                            "progress": progress,
                            "current_epoch": current_epoch,
                            "total_epochs": total_epochs,
                        }),
                    }

                # Forward informational messages written to error_message during training
                info_note = job.get("error_message", "")
                if info_note and status == "training" and info_note.startswith("AI "):
                    yield {
                        "event": "log",
                        "data": json.dumps({"message": info_note}),
                    }

                # Stream new epoch metrics — send ALL accumulated epochs since last poll
                epoch_history = metrics.get("epoch_history", [])
                if epoch_history and len(epoch_history) > last_epoch + 1:
                    new_epochs = epoch_history[last_epoch + 1:]
                    # Batch-send: if many epochs arrived, send summary points to keep UI responsive
                    if len(new_epochs) > 50:
                        step = max(1, len(new_epochs) // 50)
                        sampled = new_epochs[::step]
                        # always include the last one
                        if sampled[-1] != new_epochs[-1]:
                            sampled.append(new_epochs[-1])
                        for ep in sampled:
                            yield {"event": "metrics", "data": json.dumps(ep)}
                    else:
                        for ep in new_epochs:
                            yield {"event": "metrics", "data": json.dumps(ep)}
                    last_epoch = len(epoch_history) - 1

                # Progress heartbeat
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "progress": progress,
                        "current_epoch": current_epoch,
                        "total_epochs": total_epochs,
                    }),
                }

                # Terminal states
                if status == "completed":
                    final_metrics = metrics.get("final_metrics", {})
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "status": "completed",
                            "final_metrics": final_metrics,
                            "epoch_history": epoch_history,
                            "progress": 100.0,
                        }),
                    }
                    return

                if status in ("failed", "cancelled"):
                    error_msg = job.get("error_message") or "Training failed."
                    # Common errors → friendly messages
                    if "not found" in error_msg and "target" in error_msg.lower():
                        error_msg = (
                            f"{error_msg}\n\nHint: The target column was not found in the dataset. "
                            "Use the 'Ask AI to Derive Target' button on the training page, "
                            "or manually select the correct column from the dropdown."
                        )
                    yield {
                        "event": "error",
                        "data": json.dumps({"error": error_msg}),
                    }
                    return

            except Exception as e:
                logger.error("SSE stream error for job %s: %s", job_id, e)
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(e)}),
                }
                return

            await asyncio.sleep(0.3)   # 300 ms — fast enough to catch rapid XGBoost epochs

        yield {
            "event": "error",
            "data": json.dumps({"error": "Stream timeout (1 hour max)."}),
        }

    return EventSourceResponse(event_generator())


async def _get_job_from_db(job_id: str) -> Optional[dict]:
    """Fetch training job from database."""
    try:
        from core.database import async_session
        from sqlalchemy import text

        async with async_session() as session:
            result = await session.execute(
                text(
                    "SELECT id, status, progress, current_epoch, total_epochs, "
                    "metrics, error_message, created_at FROM training_jobs WHERE id = :job_id"
                ),
                {"job_id": job_id},
            )
            row = result.fetchone()
            if row:
                return {
                    "id": row[0],
                    "status": row[1],
                    "progress": float(row[2]) if row[2] else 0.0,
                    "current_epoch": int(row[3]) if row[3] else 0,
                    "total_epochs": int(row[4]) if row[4] else 0,
                    "metrics": row[5] or "{}",
                    "error_message": row[6],
                    "created_at": row[7],
                }
    except Exception as e:
        logger.error("Failed to fetch job %s from DB: %s", job_id, e)

    return None
