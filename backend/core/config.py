"""
NeuralForge Backend — Configuration
Pydantic Settings for environment variable management with validation and defaults.
"""

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- App ---
    environment: str = "development"
    log_level: str = "INFO"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    max_upload_size_mb: int = 500  # Increased for image datasets

    # --- Database ---
    database_url: str = "sqlite+aiosqlite:///./neuralforge.db"

    # --- Security ---
    jwt_secret: str = "change-me-to-a-random-256-bit-secret"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 72

    # --- OAuth ---
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    github_client_id: Optional[str] = None
    github_client_secret: Optional[str] = None

    # --- LLM Providers ---
    nvidia_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    default_llm_provider: str = "nvidia"
    default_model_name: str = "meta/llama-3.1-70b-instruct"

    # --- Search & Research ---
    tavily_api_key: Optional[str] = None
    serper_api_key: Optional[str] = None
    jina_api_key: Optional[str] = None
    kaggle_api_token: Optional[str] = None

    # --- Redis & Celery ---
    redis_url: Optional[str] = "redis://localhost:6379/0"
    celery_broker_url: Optional[str] = "redis://localhost:6379/0"
    celery_result_backend: Optional[str] = "redis://localhost:6379/1"

    # --- File Storage ---
    storage_backend: str = "local"
    upload_dir: str = "./uploads"
    model_storage_dir: str = "./models_storage"
    gcs_bucket_name: Optional[str] = None
    gcs_credentials_json: Optional[str] = None

    # --- Training Defaults ---
    default_batch_size: int = 32
    default_epochs: int = 10
    default_learning_rate: float = 0.001
    default_validation_split: float = 0.2
    max_concurrent_training_jobs: int = 3

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def cors_origins(self) -> list[str]:
        if self.is_production:
            return [self.frontend_url]
        return ["http://localhost:3000", "http://127.0.0.1:3000", self.frontend_url]

    def get_available_providers(self) -> list[str]:
        """Return list of LLM providers that have API keys configured."""
        providers = []
        if self.nvidia_api_key:
            providers.append("nvidia")
        if self.openai_api_key:
            providers.append("openai")
        if self.anthropic_api_key:
            providers.append("anthropic")
        if self.groq_api_key:
            providers.append("groq")
        if self.openrouter_api_key:
            providers.append("openrouter")
        return providers


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()
