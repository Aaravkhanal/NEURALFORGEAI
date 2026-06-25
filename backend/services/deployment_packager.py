"""
NeuralForge — Deployment Packager Service
Creates downloadable deployment zip packages containing the model, inference scripts,
preprocessing pipeline, API servers, Dockerfile, cloud templates, and documentation.
"""

import os
import zipfile
import io
import logging
from typing import Dict, Any, List, Optional

from services.inference_codegen import InferenceCodegenService
from services.production_codegen import ProductionCodegenService

logger = logging.getLogger("neuralforge.deployment_packager")

class DeploymentPackagerService:

    @staticmethod
    def create_deployment_package(model_path: str, model_format: str, model_name: str, task_type: str, num_features: int = None) -> bytes:
        """
        Creates a ZIP archive in memory containing:
        - The model file itself
        - inference.py
        - server_fastapi.py
        - server_flask.py
        - requirements.txt
        - Dockerfile
        - README.md
        """
        memory_file = io.BytesIO()
        
        try:
            with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
                
                # 1. Add Model File
                if os.path.exists(model_path):
                    model_filename = os.path.basename(model_path)
                    # We always save the model in the zip under a standardized name so inference script works
                    standard_name = f"model.{model_format}" 
                    zf.write(model_path, standard_name)
                else:
                    logger.error(f"Model path does not exist: {model_path}")
                    raise FileNotFoundError("Model file not found")

                # 2. Add inference.py
                inference_code = InferenceCodegenService.generate_python_inference(model_format, model_name, task_type, num_features)
                zf.writestr("inference.py", inference_code)
                
                # 3. Add API Servers
                fastapi_code = InferenceCodegenService.generate_fastapi_server(model_format)
                zf.writestr("server_fastapi.py", fastapi_code)
                
                flask_code = InferenceCodegenService.generate_flask_server(model_format)
                zf.writestr("server_flask.py", flask_code)
                
                # 4. Add requirements.txt
                reqs_code = InferenceCodegenService.generate_requirements_txt(model_format)
                zf.writestr("requirements.txt", reqs_code)
                
                # 5. Add Dockerfile
                dockerfile_code = InferenceCodegenService.generate_dockerfile()
                zf.writestr("Dockerfile", dockerfile_code)
                
                # 6. Add README.md
                readme = f"""# Deployment Package for {model_name}

## Contents
* `model.{model_format}`: The trained model file.
* `inference.py`: Core python script to load model and make predictions.
* `server_fastapi.py`: FastAPI implementation for high-performance async API.
* `server_flask.py`: Flask implementation for a simpler API.
* `Dockerfile`: Containerization configuration.
* `requirements.txt`: Python dependencies.

## How to Run Locally
1. `pip install -r requirements.txt`
2. `uvicorn server_fastapi:app --host 0.0.0.0 --port 8000`
3. Test using: `curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d '{{"data": [{{...}}]}}'`

## How to Run via Docker
1. `docker build -t {model_name.lower().replace(' ', '_')}_api .`
2. `docker run -p 8000:8000 {model_name.lower().replace(' ', '_')}_api`
"""
                zf.writestr("README.md", readme)
                
        except Exception as e:
            logger.error(f"Error creating deployment package: {e}")
            raise e
            
        memory_file.seek(0)
        return memory_file.getvalue()

    @staticmethod
    def create_full_project_package(
        model_path: str,
        model_format: str,
        model_name: str,
        task_type: str,
        feature_names: List[str] = None,
        target_column: str = None,
        num_features: int = None,
        preprocessing_path: str = None,
        model_card_md: str = None,
        extra_model_paths: Dict[str, str] = None,
    ) -> bytes:
        """
        Creates a comprehensive project ZIP containing:
        - model.{format}: The trained model
        - predict.py: Standalone prediction script
        - preprocessing.py: Feature engineering + preprocessing pipeline
        - api.py: FastAPI production server
        - app_streamlit.py: Interactive Streamlit app
        - requirements.txt: Dependencies
        - Dockerfile: Container configuration
        - docker-compose.yml: Multi-service orchestration
        - README.md: Comprehensive documentation
        - MODEL_CARD.md: Model card with metrics and limitations
        - preprocessors.joblib: Saved preprocessing pipeline (if available)
        - Additional model formats (if available)
        """
        memory_file = io.BytesIO()
        safe_name = model_name.lower().replace(" ", "_").replace("-", "_")

        try:
            with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:

                # 1. Model File(s)
                if os.path.exists(model_path):
                    zf.write(model_path, f"model.{model_format}")
                else:
                    raise FileNotFoundError(f"Model file not found: {model_path}")

                # Additional export formats
                if extra_model_paths:
                    for fmt, path in extra_model_paths.items():
                        if path and os.path.exists(path):
                            zf.write(path, f"model.{fmt}")

                # 2. Preprocessing pipeline
                if preprocessing_path and os.path.exists(preprocessing_path):
                    zf.write(preprocessing_path, "preprocessors.joblib")

                preprocessing_code = _generate_preprocessing_script(feature_names, target_column)
                zf.writestr("preprocessing.py", preprocessing_code)

                # 3. predict.py — Standalone
                predict_result = ProductionCodegenService.generate(
                    "python", model_format, model_name, task_type,
                    feature_names, target_column, num_features,
                )
                zf.writestr("predict.py", predict_result["code"])

                # 4. api.py — FastAPI
                api_result = ProductionCodegenService.generate(
                    "fastapi", model_format, model_name, task_type,
                    feature_names, target_column, num_features,
                )
                zf.writestr("api.py", api_result["code"])

                # 5. app_streamlit.py
                streamlit_result = ProductionCodegenService.generate(
                    "streamlit", model_format, model_name, task_type,
                    feature_names, target_column, num_features,
                )
                zf.writestr("app_streamlit.py", streamlit_result["code"])

                # 6. requirements.txt
                requirements = _generate_full_requirements(model_format)
                zf.writestr("requirements.txt", requirements)

                # 7. Dockerfile
                dockerfile = f"""FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
"""
                zf.writestr("Dockerfile", dockerfile)

                # 8. docker-compose.yml
                compose = f"""version: "3.9"
services:
  {safe_name}:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MODEL_PATH=model.{model_format}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
"""
                zf.writestr("docker-compose.yml", compose)

                # 9. Model Card
                if model_card_md:
                    zf.writestr("MODEL_CARD.md", model_card_md)

                # 10. README.md
                readme = _generate_full_readme(model_name, model_format, task_type, safe_name, feature_names)
                zf.writestr("README.md", readme)

        except Exception as e:
            logger.error(f"Error creating full project package: {e}")
            raise e

        memory_file.seek(0)
        return memory_file.getvalue()


def _generate_preprocessing_script(feature_names: List[str] = None, target_column: str = None) -> str:
    """Generate a preprocessing pipeline script."""
    features_str = ", ".join(f'"{f}"' for f in (feature_names or [])) if feature_names else "# Auto-detected from training data"
    return f'''"""
NeuralForge — Preprocessing Pipeline
Reproduces the exact feature engineering used during training.
"""

import pandas as pd
import numpy as np
import joblib
import os

# Feature names used during training
FEATURE_NAMES = [{features_str}]
TARGET_COLUMN = "{target_column or 'target'}"

def load_preprocessors(path="preprocessors.joblib"):
    """Load saved preprocessing pipeline."""
    if os.path.exists(path):
        return joblib.load(path)
    return None

def preprocess(df: pd.DataFrame, preprocessors=None) -> pd.DataFrame:
    """
    Apply the same preprocessing steps used during training.
    
    Args:
        df: Input DataFrame
        preprocessors: Loaded preprocessor dict (scaler, encoders)
    
    Returns:
        Preprocessed DataFrame ready for prediction
    """
    df = df.copy()
    
    # Drop target if present
    if TARGET_COLUMN in df.columns:
        df = df.drop(columns=[TARGET_COLUMN])
    
    # Handle missing values
    for col in df.select_dtypes(include=["number"]).columns:
        df[col] = df[col].fillna(df[col].median())
    
    for col in df.select_dtypes(include=["object", "category"]).columns:
        df[col] = df[col].fillna(df[col].mode().iloc[0] if len(df[col].mode()) > 0 else "Unknown")
    
    # Apply saved encoders if available
    if preprocessors:
        label_encoders = preprocessors.get("label_encoders", {{}})
        for col, classes in label_encoders.items():
            if col in df.columns:
                from sklearn.preprocessing import LabelEncoder
                le = LabelEncoder()
                le.classes_ = np.array(classes)
                # Handle unseen categories
                mask = df[col].astype(str).isin(classes)
                df.loc[~mask, col] = classes[0]  # Map unseen to first class
                df[col] = le.transform(df[col].astype(str))
        
        scaler = preprocessors.get("scaler")
        if scaler is not None:
            numeric_cols = df.select_dtypes(include=["number"]).columns
            df[numeric_cols] = scaler.transform(df[numeric_cols])
    
    return df

if __name__ == "__main__":
    # Example usage
    preprocessors = load_preprocessors()
    sample = pd.DataFrame([{{f: 0 for f in FEATURE_NAMES[:5]}}])
    processed = preprocess(sample, preprocessors)
    print("Preprocessed shape:", processed.shape)
    print(processed.head())
'''


def _generate_full_requirements(model_format: str) -> str:
    """Generate comprehensive requirements.txt."""
    reqs = [
        "# Core",
        "pandas>=2.0.0",
        "numpy>=1.24.0",
        "scikit-learn>=1.3.0",
        "joblib>=1.3.0",
        "",
        "# API Server",
        "fastapi>=0.100.0",
        "uvicorn>=0.22.0",
        "pydantic>=2.0.0",
        "",
        "# Interactive App",
        "streamlit>=1.30.0",
    ]

    if model_format in ("joblib", "pkl"):
        reqs.extend(["", "# ML Frameworks", "xgboost>=2.0.0", "lightgbm>=4.1.0"])
    elif model_format == "onnx":
        reqs.extend(["", "# ONNX Runtime", "onnxruntime>=1.15.0"])
    elif model_format in ("json", "bst"):
        reqs.extend(["", "# XGBoost", "xgboost>=2.0.0"])
    elif model_format == "txt":
        reqs.extend(["", "# LightGBM", "lightgbm>=4.1.0"])
    elif model_format in ("h5", "keras"):
        reqs.extend(["", "# TensorFlow", "tensorflow>=2.15.0"])
    elif model_format in ("pt", "pth"):
        reqs.extend(["", "# PyTorch", "torch>=2.2.0"])

    return "\n".join(reqs)


def _generate_full_readme(model_name, model_format, task_type, safe_name, feature_names) -> str:
    """Generate comprehensive README."""
    features_list = "\n".join(f"- `{f}`" for f in (feature_names or [])[:20])

    return f"""# {model_name} — NeuralForge Deployment Package

## 📦 Contents

| File | Description |
|------|-------------|
| `model.{model_format}` | Trained model file |
| `predict.py` | Standalone prediction script |
| `preprocessing.py` | Feature engineering pipeline |
| `api.py` | FastAPI production server |
| `app_streamlit.py` | Interactive Streamlit web app |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container configuration |
| `docker-compose.yml` | Multi-service orchestration |
| `MODEL_CARD.md` | Model documentation |

## 🚀 Quick Start

### Option 1: Python Script
```bash
pip install -r requirements.txt
python predict.py
```

### Option 2: REST API (FastAPI)
```bash
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8000
```
Test: `curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d '{{"data": [{{...}}]}}'`

### Option 3: Interactive App (Streamlit)
```bash
pip install -r requirements.txt
streamlit run app_streamlit.py
```

### Option 4: Docker
```bash
docker build -t {safe_name} .
docker run -p 8000:8000 {safe_name}
```

### Option 5: Docker Compose
```bash
docker-compose up -d
```

## 📊 Model Information

- **Model**: {model_name}
- **Task**: {task_type}
- **Format**: {model_format}

### Features
{features_list if features_list else "See MODEL_CARD.md for details."}

---
*Generated by NeuralForge AI Platform*
"""
