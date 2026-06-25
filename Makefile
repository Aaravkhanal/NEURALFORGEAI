# ============================================================
# NeuralForge — Development Commands
# ============================================================

.PHONY: help install dev backend frontend docker-up docker-down test lint clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Setup ---
install: ## Install all dependencies
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# --- Development ---
dev: ## Run both backend and frontend in dev mode
	@echo "Starting NeuralForge in development mode..."
	@make backend & make frontend

backend: ## Run FastAPI backend (port 8000)
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend: ## Run Next.js frontend (port 3000)
	cd frontend && npm run dev

# --- Docker ---
docker-up: ## Start all services with Docker Compose
	docker compose up --build -d

docker-down: ## Stop all Docker services
	docker compose down

docker-logs: ## View Docker logs
	docker compose logs -f

# --- Database ---
db-migrate: ## Run database migrations
	cd backend && alembic upgrade head

db-reset: ## Reset database (WARNING: destroys data)
	cd backend && rm -f neuralforge.db && alembic upgrade head

# --- Testing ---
test: ## Run all tests
	cd backend && python -m pytest tests/ -v
	cd frontend && npm run lint

test-backend: ## Run backend tests only
	cd backend && python -m pytest tests/ -v

# --- Lint ---
lint: ## Run linters
	cd backend && python -m ruff check .
	cd frontend && npm run lint

# --- Clean ---
clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	rm -rf frontend/.next frontend/out
	rm -rf backend/*.db
