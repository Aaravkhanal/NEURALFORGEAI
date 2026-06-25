# Deploying NeuralForge with Docker

This guide explains how to deploy NeuralForge in production using Docker and Docker Compose.

## Prerequisites

- Docker and Docker Compose installed on your host server.
- Publicly accessible domain name (optional but recommended for OAuth).
- API keys for OpenAI, Anthropic, or Groq.

## Setup Instructions

### 1. Clone & Configure Environments

Create a `.env` file in the root workspace based on `.env.example`:

```bash
# Environment config
ENVIRONMENT=production
JWT_SECRET=your-secure-jwt-secret-key-256

# LLM Providers (At least one required)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
GROQ_API_KEY=your-groq-api-key

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
```

### 2. Start Services

To build the optimized containers and start the background services:

```bash
docker compose up -d --build
```

This starts:
- **FastAPI backend** on port `8000`
- **Next.js frontend** on port `3000`
- Local volume mounting for database records and dataset uploads.

### 3. Verify Health

Ensure both services are running and healthy:

```bash
docker compose ps
```

Verify you can access the frontend dashboard by visiting `http://localhost:3000` in your browser.
