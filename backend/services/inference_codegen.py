"""
NeuralForge — Inference Codegen Service
Generates ready-to-use Python inference scripts and API (FastAPI/Flask) deployment code.
"""

from typing import Dict, Any

class InferenceCodegenService:
    """Generates inference code for trained models."""

    @staticmethod
    def generate_python_inference(model_format: str, model_name: str, task_type: str, num_features: int = None) -> str:
        """Generate a raw python inference script."""
        code = f'"""\nInference Script for {model_name}\nFormat: {model_format}\nTask: {task_type}\n"""\n\n'
        
        if model_format == "joblib":
            code += """import joblib
import pandas as pd
import numpy as np

# Load model
model = joblib.load("model.joblib")

def predict(input_data):
    \"\"\"
    input_data: list of dicts or pandas DataFrame
    \"\"\"
    if isinstance(input_data, list):
        input_data = pd.DataFrame(input_data)
        
    predictions = model.predict(input_data)
    
    # If the model has predict_proba, we can also return confidence scores
    if hasattr(model, "predict_proba"):
        probabilities = model.predict_proba(input_data)
        return {"predictions": predictions.tolist(), "probabilities": probabilities.tolist()}
        
    return {"predictions": predictions.tolist()}

if __name__ == "__main__":
    # Example usage
    sample_data = [{"feature1": 0.0, "feature2": 1.0}] # Replace with actual features
    print(predict(sample_data))
"""
        elif model_format == "onnx":
            code += f"""import onnxruntime as rt
import numpy as np

# Load ONNX model
sess = rt.InferenceSession("model.onnx")
input_name = sess.get_inputs()[0].name
label_name = sess.get_outputs()[0].name

def predict(input_data):
    \"\"\"
    input_data: numpy array of shape (N, {num_features or 'num_features'})
    \"\"\"
    input_data = np.array(input_data).astype(np.float32)
    pred_onx = sess.run([label_name], {{input_name: input_data}})[0]
    return {{"predictions": pred_onx.tolist()}}

if __name__ == "__main__":
    # Example usage
    sample_data = np.random.randn(1, {num_features or 10}).astype(np.float32)
    print(predict(sample_data))
"""
        else:
            code += f"# Code generation for {model_format} is not fully supported yet.\n"
            
        return code

    @staticmethod
    def generate_fastapi_server(model_format: str) -> str:
        """Generate a FastAPI server script."""
        code = """from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
import traceback

app = FastAPI(title="Model Inference API")

# Import our inference logic
try:
    from inference import predict
except ImportError:
    predict = None

class PredictionRequest(BaseModel):
    data: List[Dict[str, Any]]

class PredictionResponse(BaseModel):
    predictions: List[Any]
    probabilities: List[List[float]] = None

@app.post("/predict", response_model=PredictionResponse)
async def make_prediction(request: PredictionRequest):
    if not predict:
        raise HTTPException(status_code=500, detail="Inference logic not loaded properly.")
    
    try:
        result = predict(request.data)
        return PredictionResponse(
            predictions=result.get("predictions", []),
            probabilities=result.get("probabilities", None)
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": predict is not None}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
"""
        return code

    @staticmethod
    def generate_flask_server(model_format: str) -> str:
        """Generate a Flask server script."""
        code = """from flask import Flask, request, jsonify
import traceback

# Import our inference logic
try:
    from inference import predict
except ImportError:
    predict = None

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def make_prediction():
    if not predict:
        return jsonify({"error": "Inference logic not loaded properly."}), 500
        
    try:
        data = request.json.get("data", [])
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        result = predict(data)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 400

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "model_loaded": predict is not None})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
"""
        return code

    @staticmethod
    def generate_requirements_txt(model_format: str) -> str:
        base = ["pandas>=2.0.0", "numpy>=1.24.0", "fastapi>=0.100.0", "uvicorn>=0.22.0", "flask>=2.3.0"]
        if model_format == "joblib":
            base.extend(["joblib>=1.3.0", "scikit-learn>=1.3.0", "xgboost", "lightgbm"])
        elif model_format == "onnx":
            base.extend(["onnxruntime>=1.15.0"])
        return "\\n".join(base)

    @staticmethod
    def generate_dockerfile() -> str:
        return """FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# To run FastAPI:
CMD ["uvicorn", "server_fastapi:app", "--host", "0.0.0.0", "--port", "8000"]

# Or to run Flask (uncomment below and comment above):
# CMD ["python", "server_flask.py"]
"""
