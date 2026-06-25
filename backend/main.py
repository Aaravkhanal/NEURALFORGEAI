"""
NeuralForge Backend — Main Application
FastAPI app factory with CORS, middleware, routes, and lifespan management.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import get_settings
from core.database import init_db, close_db

settings = get_settings()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("neuralforge")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    logger.info("🚀 Starting NeuralForge Backend...")
    logger.info(f"   Environment: {settings.environment}")
    logger.info(f"   Database: {settings.database_url.split('://')[0]}")
    logger.info(f"   LLM Providers: {settings.get_available_providers() or ['none configured']}")

    # Create uploads directory
    os.makedirs(settings.upload_dir, exist_ok=True)

    # Initialize database
    await init_db()
    logger.info("   Database initialized ✓")

    # Force OpenAPI generation to ensure validation and logging on boot
    try:
        app.openapi()
        logger.info("OpenAPI schema generated successfully.")
    except Exception as e:
        logger.error(f"OpenAPI generation failed at startup: {e}")
        raise e

    # Audit & Log route table
    logger.info("⚡ NeuralForge Backend Routing Table:")
    for route in app.routes:
        methods = getattr(route, "methods", None)
        methods_str = f" [{', '.join(methods)}]" if methods else ""
        logger.info(f"   Route: {route.path}{methods_str}")

    logger.info(f"   OpenAPI URL: {app.openapi_url}")
    logger.info(f"   Docs URL: /docs")
    logger.info(f"   ReDoc URL: /redoc")

    yield

    # Shutdown
    await close_db()
    logger.info("NeuralForge Backend shutdown complete.")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="NeuralForge API",
        description="Multi-LLM Agent System for Machine Learning — API",
        version="1.0.0",
        lifespan=lifespan,
        docs_url=None,
        redoc_url=None,
    )

    # Custom Documentation Routes with stable, pinned CDNs
    from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html

    @app.get("/docs", include_in_schema=False)
    async def custom_swagger_ui_html():
        return get_swagger_ui_html(
            openapi_url=app.openapi_url or "/openapi.json",
            title=app.title + " - Swagger UI",
            oauth2_redirect_url=app.swagger_ui_oauth2_redirect_url,
            swagger_js_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js",
            swagger_css_url="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css",
        )

    @app.get("/redoc", include_in_schema=False)
    async def custom_redoc_html():
        return get_redoc_html(
            openapi_url=app.openapi_url or "/openapi.json",
            title=app.title + " - ReDoc",
            redoc_js_url="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js",
        )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes
    from api.auth import router as auth_router
    from api.projects import router as projects_router
    from api.chat import router as chat_router
    from api.files import router as files_router
    from api.research import router as research_router
    from api.agents import router as agents_router
    from api.dashboard import router as dashboard_router
    from api.cleaning import router as cleaning_router
    from api.training import router as training_router
    from api.deployment import router as deployment_router
    from api.export import router as export_router
    from api.advisor import router as advisor_router
    from api.codegen import router as codegen_router
    from api.dataset_chat import router as dataset_chat_router
    from api.discovery import router as discovery_router
    from api.discovery_advanced import router as discovery_advanced_router
    from api.models_history import router as models_history_router
    from api.automl import router as automl_router
    from api.playground import router as playground_router
    from api.transparency import router as transparency_router
    from api.health import router as health_router
    from api.consultant import router as consultant_router
    from api.experiments import router as experiments_router
    from api.registry import router as registry_router
    from api.dataset_versions import router as dataset_versions_router
    from api.framework import router as framework_router
    from api.cleaning_analysis import router as cleaning_analysis_router
    from api.training_sse import router as training_sse_router
    from api.nl_parser import router as nl_parser_router

    app.include_router(auth_router)
    app.include_router(projects_router)
    app.include_router(health_router)
    app.include_router(consultant_router)
    app.include_router(chat_router)
    app.include_router(files_router)
    app.include_router(research_router)
    app.include_router(agents_router)
    app.include_router(dashboard_router)
    app.include_router(cleaning_router)
    app.include_router(training_router)
    app.include_router(deployment_router)
    app.include_router(export_router)
    app.include_router(advisor_router)
    app.include_router(codegen_router)
    app.include_router(dataset_chat_router)
    app.include_router(discovery_router)
    app.include_router(discovery_advanced_router)
    app.include_router(models_history_router)
    app.include_router(automl_router)
    app.include_router(playground_router)
    app.include_router(transparency_router)
    app.include_router(experiments_router)
    app.include_router(registry_router)
    app.include_router(dataset_versions_router)
    app.include_router(framework_router)
    app.include_router(cleaning_analysis_router)
    app.include_router(training_sse_router)
    app.include_router(nl_parser_router)

    # Required Routes
    @app.get("/")
    async def root():
        """Root route returning application metadata and health status."""
        return {
            "title": "NeuralForge API",
            "description": "Multi-LLM Agent System for Machine Learning — API Server",
            "version": "1.0.0",
            "status": "active",
            "environment": settings.environment,
            "docs_url": "/docs" if not settings.is_production else None
        }

    @app.get("/health")
    async def health_check():
        """Health check route returning healthy status."""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "environment": settings.environment,
            "providers": settings.get_available_providers(),
        }

    @app.get("/api/v1/status")
    async def api_status():
        """API status route."""
        return {
            "status": "online",
            "version": "1.0.0",
            "message": "NeuralForge API is fully functional."
        }

    # Backward compatibility endpoint
    @app.get("/api/health")
    async def legacy_health_check():
        return await health_check()

    return app


# Create app instance
app = create_app()
