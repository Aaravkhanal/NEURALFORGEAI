# Cloud Deployments: Vercel, Railway, and Render

This document outlines options for hosting NeuralForge on standard cloud platforms for free or low-tier hosting.

---

## 1. Frontend: Next.js on Vercel

Vercel is the recommended and easiest host for the Next.js frontend.

### Configuration Steps

1. **Sign Up / Log In** to [Vercel](https://vercel.com).
2. **Import Repository**: Click "Add New" → "Project" and connect your GitHub repo.
3. **Configure Project**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
4. **Environment Variables**: Add these key-value pairs:
   - `NEXT_PUBLIC_BACKEND_URL`: The URL of your deployed backend (e.g., `https://neuralforge-api.up.railway.app`).
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID.
   - `NEXT_PUBLIC_GITHUB_CLIENT_ID`: Your GitHub OAuth Client ID.
5. **Deploy**: Click "Deploy". Vercel will build the Next.js static and standalone routes.

---

## 2. Backend: FastAPI on Railway

Railway is a premium cloud developer platform suitable for hosting Python, PostgreSQL, and SQLite volumes.

### Configuration Steps

1. **Sign Up / Log In** to [Railway](https://railway.app).
2. **Create Project**: Choose "New Project" → "Deploy from GitHub" and select your repository.
3. **Set Root Path**:
   - In Settings, set the Root Directory to `backend`.
4. **Add Variables**:
   - `PORT`: `8000`
   - `JWT_SECRET`: A random 256-bit secret string.
   - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`: At least one active LLM key.
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: OAuth credentials.
   - `DATABASE_URL`: `sqlite:////data/neuralforge.db` (or provision a Postgres service on Railway and bind the variable).
5. **Persistent Volumes** (if using SQLite):
   - Mount a volume in Railway settings to `/data` so SQLite databases and dataset uploads persist across redeploys.

---

## 3. Alternative: Full Stack on Render

Render supports hosting both frontend and backend Web Services using Docker.

### Deploying Backend on Render

1. **Create Web Service**: Select "Web Service" on Render and link your repo.
2. **Environment**: Docker
3. **Docker Context**: `.`
4. **Docker File Path**: `docker/Dockerfile.backend`
5. **Environment Variables**: Add keys, secrets, database urls, etc.

### Deploying Frontend on Render

1. **Create Web Service**: Select "Web Service" and link your repo.
2. **Environment**: Docker
3. **Docker Context**: `.`
4. **Docker File Path**: `docker/Dockerfile.frontend`
5. **Environment Variables**: Set `NEXT_PUBLIC_BACKEND_URL` to point to the backend web service URL.
