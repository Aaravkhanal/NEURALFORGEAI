"""
NeuralForge — Checkpoint Service (Production)
Manages model checkpoint saving, loading, and listing for
continue-training and retrain-from-scratch workflows.
"""

import os
import json
import logging
import shutil
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import joblib

logger = logging.getLogger("neuralforge.checkpoint")


class CheckpointService:
    """Manages model training checkpoints for resume/retrain operations."""

    def __init__(self, storage_dir: str = None):
        self.storage_dir = storage_dir or os.getenv(
            "MODEL_STORAGE_DIR", "./models_storage"
        )
        os.makedirs(self.storage_dir, exist_ok=True)

    def _checkpoint_dir(self, job_id: str) -> str:
        path = os.path.join(self.storage_dir, f"{job_id}_checkpoints")
        os.makedirs(path, exist_ok=True)
        return path

    def save_checkpoint(
        self,
        job_id: str,
        model: Any,
        epoch: int,
        metrics: Dict[str, Any],
        model_format: str = "joblib",
        optimizer_state: Any = None,
        is_best: bool = False,
    ) -> str:
        """
        Save a training checkpoint.
        Returns the path to the saved checkpoint.
        """
        ckpt_dir = self._checkpoint_dir(job_id)
        ckpt_name = f"epoch_{epoch}"
        ckpt_path = os.path.join(ckpt_dir, ckpt_name)
        os.makedirs(ckpt_path, exist_ok=True)

        # Save model
        model_file = os.path.join(ckpt_path, f"model.{model_format}")
        try:
            if model_format in ("joblib", "pkl"):
                joblib.dump(model, model_file)
            elif model_format in ("pt", "pth"):
                import torch
                state = {
                    "model_state_dict": (
                        model.state_dict() if hasattr(model, "state_dict") else model
                    ),
                    "epoch": epoch,
                    "metrics": metrics,
                }
                if optimizer_state is not None:
                    state["optimizer_state_dict"] = optimizer_state
                torch.save(state, model_file)
            elif model_format in ("h5", "keras"):
                model.save(model_file)
            elif model_format in ("json", "bst"):
                model.save_model(model_file)
            elif model_format == "txt":
                model.save_model(model_file)
            else:
                joblib.dump(model, model_file)
        except Exception as e:
            logger.error("Failed to save checkpoint model: %s", e)
            raise

        # Save metadata
        metadata = {
            "job_id": job_id,
            "epoch": epoch,
            "model_format": model_format,
            "metrics": metrics,
            "is_best": is_best,
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "model_file": model_file,
        }
        meta_file = os.path.join(ckpt_path, "metadata.json")
        with open(meta_file, "w") as f:
            json.dump(metadata, f, indent=2, default=str)

        # If this is the best checkpoint, create/update a symlink
        if is_best:
            best_path = os.path.join(ckpt_dir, "best")
            if os.path.exists(best_path):
                if os.path.islink(best_path):
                    os.unlink(best_path)
                else:
                    shutil.rmtree(best_path)
            try:
                os.symlink(ckpt_path, best_path)
            except OSError:
                # Symlinks might not work on all systems, copy instead
                shutil.copytree(ckpt_path, best_path)

        logger.info(
            "Checkpoint saved: job=%s epoch=%d best=%s path=%s",
            job_id, epoch, is_best, ckpt_path,
        )
        return ckpt_path

    def load_checkpoint(
        self, job_id: str, epoch: Optional[int] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Load a checkpoint. If epoch is None, loads the best checkpoint.
        Returns dict with model, epoch, metrics, optimizer_state.
        """
        ckpt_dir = self._checkpoint_dir(job_id)

        if epoch is not None:
            ckpt_path = os.path.join(ckpt_dir, f"epoch_{epoch}")
        else:
            # Try best first, then latest
            best_path = os.path.join(ckpt_dir, "best")
            if os.path.exists(best_path):
                ckpt_path = best_path
            else:
                # Find latest epoch
                epochs = self._list_epoch_dirs(ckpt_dir)
                if not epochs:
                    return None
                ckpt_path = os.path.join(ckpt_dir, f"epoch_{max(epochs)}")

        if not os.path.exists(ckpt_path):
            logger.warning("Checkpoint not found: %s", ckpt_path)
            return None

        # Load metadata
        meta_file = os.path.join(ckpt_path, "metadata.json")
        if not os.path.exists(meta_file):
            logger.warning("Checkpoint metadata not found: %s", meta_file)
            return None

        with open(meta_file, "r") as f:
            metadata = json.load(f)

        model_format = metadata.get("model_format", "joblib")
        model_file = metadata.get("model_file", "")

        if not os.path.exists(model_file):
            # Try reconstructing path
            model_file = os.path.join(ckpt_path, f"model.{model_format}")

        if not os.path.exists(model_file):
            logger.error("Model file not found in checkpoint: %s", model_file)
            return None

        # Load model
        model = None
        optimizer_state = None
        try:
            if model_format in ("joblib", "pkl"):
                model = joblib.load(model_file)
            elif model_format in ("pt", "pth"):
                import torch
                state = torch.load(model_file, weights_only=False)
                model = state.get("model_state_dict", state)
                optimizer_state = state.get("optimizer_state_dict")
            elif model_format in ("h5", "keras"):
                from tensorflow import keras
                model = keras.models.load_model(model_file)
            elif model_format in ("json", "bst"):
                import xgboost as xgb
                model = xgb.XGBClassifier()
                model.load_model(model_file)
            elif model_format == "txt":
                import lightgbm as lgb
                model = lgb.Booster(model_file=model_file)
            else:
                model = joblib.load(model_file)
        except Exception as e:
            logger.error("Failed to load checkpoint model: %s", e)
            return None

        return {
            "model": model,
            "epoch": metadata.get("epoch", 0),
            "metrics": metadata.get("metrics", {}),
            "optimizer_state": optimizer_state,
            "model_format": model_format,
            "is_best": metadata.get("is_best", False),
        }

    def list_checkpoints(self, job_id: str) -> List[Dict[str, Any]]:
        """List all available checkpoints for a training job."""
        ckpt_dir = self._checkpoint_dir(job_id)
        if not os.path.exists(ckpt_dir):
            return []

        checkpoints = []
        epochs = self._list_epoch_dirs(ckpt_dir)

        for epoch in sorted(epochs):
            ckpt_path = os.path.join(ckpt_dir, f"epoch_{epoch}")
            meta_file = os.path.join(ckpt_path, "metadata.json")
            if os.path.exists(meta_file):
                with open(meta_file, "r") as f:
                    metadata = json.load(f)
                checkpoints.append({
                    "epoch": epoch,
                    "metrics": metadata.get("metrics", {}),
                    "is_best": metadata.get("is_best", False),
                    "saved_at": metadata.get("saved_at", ""),
                })

        return checkpoints

    def delete_checkpoint(self, job_id: str, epoch: int) -> bool:
        """Delete a specific checkpoint."""
        ckpt_dir = self._checkpoint_dir(job_id)
        ckpt_path = os.path.join(ckpt_dir, f"epoch_{epoch}")
        if os.path.exists(ckpt_path):
            shutil.rmtree(ckpt_path)
            logger.info("Deleted checkpoint: job=%s epoch=%d", job_id, epoch)
            return True
        return False

    @staticmethod
    def _list_epoch_dirs(ckpt_dir: str) -> List[int]:
        """List epoch numbers from checkpoint directory."""
        epochs = []
        for name in os.listdir(ckpt_dir):
            if name.startswith("epoch_"):
                try:
                    epochs.append(int(name.split("_")[1]))
                except ValueError:
                    continue
        return epochs


checkpoint_service = CheckpointService()
