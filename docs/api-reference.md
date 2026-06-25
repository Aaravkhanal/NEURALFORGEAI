# NeuralForge REST API Reference

This document catalogs the REST API specifications available on the NeuralForge local/production servers.

---

## 1. Authentication Endpoints

All protected endpoints require passing the Bearer JWT token in headers:
`Authorization: Bearer <your-jwt-token>`

### `GET /api/auth/me`
- **Description**: Returns currently authenticated user meta fields.
- **Response Shape**:
  ```json
  {
    "id": "user-uuid-string",
    "email": "user@example.com",
    "name": "Jane Doe",
    "avatar_url": "https://...",
    "provider": "google",
    "created_at": "2026-05-30T00:00:00Z"
  }
  ```

---

## 2. Projects Endpoints

### `GET /api/projects`
- **Description**: Lists user's projects with pagination.
- **Query Params**: `skip` (default 0), `limit` (default 20).
- **Response**:
  ```json
  {
    "projects": [
      {
        "id": "proj-uuid",
        "name": "Churn Classifier",
        "description": "...",
        "status": "active",
        "problem_type": "classification",
        "created_at": "2026-05-30T00:00:00Z"
      }
    ],
    "total": 1
  }
  ```

### `POST /api/projects`
- **Description**: Creates a new project.
- **Request Body**:
  ```json
  {
    "name": "Dataset Predictor",
    "description": "Predicting custom target attributes",
    "problem_type": "regression"
  }
  ```

---

## 3. Dataset Assessment & Files

### `POST /api/files/upload`
- **Description**: Uploads CSV or Excel files. Requires `multipart/form-data`.
- **Request**:
  - `file`: Raw binary.
  - `project_id`: Form string.
- **Response**:
  ```json
  {
    "id": "file-uuid",
    "filename": "data.csv",
    "file_type": "csv",
    "file_size": 20480,
    "row_count": 100,
    "column_count": 5
  }
  ```

### `GET /api/files/{file_id}/profile`
- **Description**: Computes complete variables stats and correlation matrices.
