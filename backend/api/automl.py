"""
NeuralForge — AutoML API
Routes for starting AutoML jobs, getting status, and generating explanations.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any, List

from core.database import get_db
from models.training_job import TrainingJob
from models.trained_model import TrainedModel
from models.file import File
from services.automl_engine import AutoMLEngine
from services.model_artifact import ModelArtifactService
from services.explainability import ExplainabilityService
from services.dataset_service import DatasetService

router = APIRouter(prefix="/api/automl", tags=["AutoML"])

@router.post("/{project_id}/start")
async def start_automl(project_id: str, payload: dict, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """
    Start an AutoML training job.
    Payload: {"file_id": "uuid", "target_column": "label", "task_type": "classification"}
    """
    # Note: In a real app we'd verify the user owns the project here
    # For now, we mock the basic structure to allow frontend integration.
    
    # 1. Fetch file path
    # file_record = await db.get(File, payload["file_id"])
    # df = DatasetService._load_dataframe(file_record.filepath, ".csv")
    
    # Due to async db constraints in this boilerplate, we'll return a mock job ID
    # In production, we'd dispatch a Celery task that instantiates AutoMLEngine
    job_id = "mock-automl-job-1234"
    
    return {
        "status": "queued",
        "job_id": job_id,
        "message": "AutoML training job queued successfully."
    }

@router.get("/{job_id}/status")
async def get_automl_status(job_id: str):
    """
    Get live metrics and status of an AutoML training job.
    """
    # Mock response for UI building
    return {
        "status": "training",
        "progress": 45.0,
        "current_epoch": 5,
        "total_epochs": 10,
        "metrics": {
            "train_loss": [0.8, 0.6, 0.4, 0.3, 0.25],
            "val_loss": [0.9, 0.7, 0.5, 0.4, 0.35],
            "train_accuracy": [0.6, 0.7, 0.8, 0.85, 0.88],
            "val_accuracy": [0.55, 0.65, 0.75, 0.8, 0.83]
        },
        "leaderboard": [
            {"model_name": "XGBoost", "accuracy": 0.88, "f1": 0.87},
            {"model_name": "Random Forest", "accuracy": 0.85, "f1": 0.84},
            {"model_name": "Logistic Regression", "accuracy": 0.75, "f1": 0.74}
        ]
    }

@router.post("/{model_id}/explain")
async def generate_explanation(model_id: str):
    """
    Generate SHAP/LIME explanation for a trained model.
    """
    return {
        "status": "success",
        "explanation_url": "/api/static/explanations/mock_shap_plot.png",
        "feature_importance": {
            "feature1": 0.45,
            "feature2": 0.25,
            "feature3": 0.15,
            "feature4": 0.10,
            "feature5": 0.05
        }
    }

@router.post("/{model_id}/retrain")
async def retrain_model(model_id: str, payload: dict, background_tasks: BackgroundTasks):
    """
    Retrain a specific model with new hyperparameters.
    Payload: {"hyperparameters": {"n_estimators": 200, "max_depth": 5}}
    """
    # Mocking the retrain response
    return {
        "status": "queued",
        "job_id": f"retrain-job-{model_id}",
        "message": "Model retraining queued with new hyperparameters.",
        "expected_duration": "2-5 minutes"
    }

@router.get("/retrain-status/{job_id}")
async def get_retrain_status(job_id: str):
    """
    Get live metrics and status of a retraining job, including epoch curves.
    """
    import random
    
    # Mocking epoch metrics for retraining curve visualization
    epochs = 50
    current_epoch = random.randint(10, epochs)
    
    # Generate realistic looking loss curves
    train_loss = [0.8 * (0.95 ** i) + random.uniform(-0.02, 0.02) for i in range(current_epoch)]
    val_loss = [0.85 * (0.96 ** i) + random.uniform(-0.02, 0.02) for i in range(current_epoch)]
    
    return {
        "job_id": job_id,
        "status": "training" if current_epoch < epochs else "completed",
        "progress": (current_epoch / epochs) * 100,
        "current_epoch": current_epoch,
        "total_epochs": epochs,
        "metrics": {
            "train_loss": train_loss,
            "val_loss": val_loss,
            "train_accuracy": [1 - l for l in train_loss],
            "val_accuracy": [1 - l for l in val_loss]
        }
    }
