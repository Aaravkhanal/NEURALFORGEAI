"""
NeuralForge — Pydantic Schemas
Request/response models for the REST API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


# ============================================================
# Auth Schemas
# ============================================================

class OAuthCallback(BaseModel):
    code: str
    provider: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    provider: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Project Schemas
# ============================================================

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    problem_type: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None
    problem_type: Optional[str] = None
    config: Optional[dict] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    problem_type: Optional[str] = None
    config: dict = {}
    created_at: datetime
    updated_at: datetime
    file_count: int = 0
    conversation_count: int = 0

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: list[ProjectResponse]
    total: int


# ============================================================
# Chat Schemas
# ============================================================

class ChatMessage(BaseModel):
    role: str  # user | assistant | agent
    content: str
    agent_name: Optional[str] = None
    metadata: Optional[dict] = None
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    message: str
    project_id: str
    conversation_id: Optional[str] = None
    include_dataset: bool = False
    agent_mode: str = "auto"  # auto | specific agent name
    model: Optional[str] = None


class ChatResponse(BaseModel):
    conversation_id: str
    message: ChatMessage
    agent_flow: Optional[list[dict]] = None


class ConversationResponse(BaseModel):
    id: str
    project_id: str
    title: str
    messages: list[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# File Schemas
# ============================================================

class FileResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    file_type: str
    file_size: Optional[int] = None
    dataset_type: Optional[str] = None  # text | image | tabular
    cleaning_status: Optional[str] = None  # pending | analyzing | in_progress | cleaned
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns_info: dict = {}
    image_metadata: dict = {}
    analysis_report: dict = {}
    cleaned_file_path: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DatasetProfileResponse(BaseModel):
    file_id: str
    filename: str
    dataset_type: str  # text | image | tabular
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    columns: list[dict] = []
    missing_values: dict = {}
    data_types: dict = {}
    statistics: dict = {}
    correlations: Optional[dict] = None
    sample_data: list[dict] = []
    # Image-specific
    image_metadata: dict = {}
    # Text-specific
    text_length_distribution: dict = {}
    label_distribution: dict = {}
    # Tabular-specific
    outliers: dict = {}
    feature_distributions: dict = {}
    duplicate_info: dict = {}


class DatasetUploadResponse(BaseModel):
    """Response after a successful dataset upload."""
    file: FileResponse
    validation: dict = {}
    summary: dict = {}


# ============================================================
# Cleaning Schemas
# ============================================================

class CleaningOperationRequest(BaseModel):
    operations: list[dict]


class CleaningResponse(BaseModel):
    success: bool
    output_path: Optional[str] = None
    rows: Optional[int] = None
    columns: Optional[int] = None
    remaining_images: Optional[int] = None
    report: dict = {}


# ============================================================
# Training Schemas
# ============================================================

class TrainingStartRequest(BaseModel):
    file_id: str
    task_type: str
    model_name: str
    target_column: Optional[str] = None
    training_config: dict = {}
    augmentation_config: dict = {}
    model_config: dict = {}


class AutoMLStartRequest(BaseModel):
    file_id: str
    task_type: Optional[str] = None  # Auto-detect if not provided
    target_column: Optional[str] = None
    training_config: dict = {}


class TrainingJobResponse(BaseModel):
    id: str
    project_id: str
    file_id: Optional[str] = None
    task_type: str
    model_name: str
    status: str
    progress: float = 0.0
    current_epoch: int = 0
    total_epochs: int = 0
    metrics: dict = {}
    is_automl: bool = False
    automl_results: dict = {}
    error_message: Optional[str] = None
    training_config: dict = {}
    augmentation_config: dict = {}
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TrainingJobListResponse(BaseModel):
    jobs: list[TrainingJobResponse]
    total: int


# ============================================================
# Model Schemas
# ============================================================

class TrainedModelResponse(BaseModel):
    id: str
    training_job_id: str
    project_id: str
    model_name: str
    task_type: str
    model_format: str
    model_size: Optional[int] = None
    metrics: dict = {}
    train_metrics: dict = {}
    generalization_gap: Optional[float] = None
    overfitting_status: str = "Unknown"
    export_formats: dict = {}
    version: int = 1
    is_best: bool = False
    dataset_info: dict = {}
    training_params: dict = {}
    feature_names: list = []
    feature_types: dict = {}
    global_shap_values: dict = {}
    created_at: datetime

    class Config:
        from_attributes = True


class ModelExportRequest(BaseModel):
    format: str  # pt | onnx | pkl | joblib | saved_model
    include_inference_package: bool = False


class ModelExportResponse(BaseModel):
    model_id: str
    format: str
    download_url: str
    file_size: Optional[int] = None


class DeploymentPackageRequest(BaseModel):
    target: str  # fastapi | flask | docker | huggingface | onnx_runtime
    model_id: str


class DeploymentPackageResponse(BaseModel):
    model_id: str
    target: str
    download_url: str
    files: dict = {}  # filename -> content preview


# ============================================================
# Research Schemas
# ============================================================

class ResearchSearchRequest(BaseModel):
    query: str
    source: str = "arxiv"  # arxiv | web
    max_results: int = Field(10, ge=1, le=50)


class PaperResponse(BaseModel):
    title: str
    authors: list[str]
    summary: str
    published: Optional[str] = None
    pdf_url: Optional[str] = None
    content_preview: Optional[str] = None


class ResearchResultResponse(BaseModel):
    id: str
    query: str
    papers: list[dict]
    summaries: list[dict]
    source: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# Agent Schemas
# ============================================================

class AgentInfo(BaseModel):
    id: str
    name: str
    description: str
    emoji: str
    capabilities: list[str]


class AgentExecutionRequest(BaseModel):
    project_id: str
    agent_ids: list[str] = []  # Empty = auto-route
    input_data: dict = {}


class AgentStatusResponse(BaseModel):
    agent_id: str
    status: str  # idle | running | completed | error
    current_step: Optional[str] = None
    progress: float = 0.0
    output: Optional[dict] = None


# ============================================================
# Dashboard Schemas
# ============================================================

class DashboardStats(BaseModel):
    total_projects: int = 0
    active_projects: int = 0
    total_conversations: int = 0
    total_files: int = 0
    total_research: int = 0
    total_training_jobs: int = 0
    total_trained_models: int = 0
    recent_projects: list[ProjectResponse] = []
    recent_activity: list[dict] = []


# ============================================================
# Available Models Catalog
# ============================================================

class ModelCatalogEntry(BaseModel):
    name: str
    display_name: str
    task_types: list[str]
    description: str
    parameters: Optional[str] = None
    recommended: bool = False


class ModelCatalogResponse(BaseModel):
    task_type: str
    models: list[ModelCatalogEntry]
