"""
NeuralForge — Training SSE Stream (Production)
Server-Sent Events endpoint for real-time training metric streaming.
Reads metrics from the database and streams them to the frontend.
"""

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
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
        max_polls = 3600  # Max 1 hour of streaming (1s intervals)

        while poll_count < max_polls:
            poll_count += 1

            try:
                job = await _get_job_from_db(job_id)
                if not job:
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "error": f"Training job {job_id} not found."
                        }),
                    }
                    return

                status = job.get("status", "queued")
                progress = job.get("progress", 0.0)
                current_epoch = job.get("current_epoch", 0)
                total_epochs = job.get("total_epochs", 0)
                metrics_raw = job.get("metrics", "{}")

                # Parse metrics
                if isinstance(metrics_raw, str):
                    try:
                        metrics = json.loads(metrics_raw)
                    except json.JSONDecodeError:
                        metrics = {}
                else:
                    metrics = metrics_raw or {}

                # Send status update if changed
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

                # Send epoch metrics if new epoch
                epoch_history = metrics.get("epoch_history", [])
                if epoch_history and len(epoch_history) > last_epoch + 1:
                    for i in range(last_epoch + 1, len(epoch_history)):
                        epoch_data = epoch_history[i]
                        yield {
                            "event": "metrics",
                            "data": json.dumps(epoch_data),
                        }
                    last_epoch = len(epoch_history) - 1

                # Send progress update
                yield {
                    "event": "progress",
                    "data": json.dumps({
                        "progress": progress,
                        "current_epoch": current_epoch,
                        "total_epochs": total_epochs,
                    }),
                }

                # Check terminal states
                if status == "completed":
                    final_metrics = metrics.get("final_metrics", {})
                    yield {
                        "event": "complete",
                        "data": json.dumps({
                            "status": "completed",
                            "final_metrics": final_metrics,
                            "progress": 100.0,
                        }),
                    }
                    return

                if status == "failed":
                    yield {
                        "event": "error",
                        "data": json.dumps({
                            "status": "failed",
                            "error": job.get("error_message", "Unknown error"),
                        }),
                    }
                    return

            except Exception as e:
                logger.error("SSE stream error for job %s: %s", job_id, e)
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(e)}),
                }
                return

            await asyncio.sleep(1.0)  # Poll every second

        # Timeout
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
                    "metrics, error_message FROM training_jobs WHERE id = :job_id"
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
                }
    except Exception as e:
        logger.error("Failed to fetch job %s from DB: %s", job_id, e)

    return None
