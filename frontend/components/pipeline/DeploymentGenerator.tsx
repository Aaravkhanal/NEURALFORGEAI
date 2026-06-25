'use client';

import { useState } from 'react';
import { Package, Download, Server, Code, FileText, Check, Loader2, Copy } from 'lucide-react';

interface Props {
  modelName: string;
  taskType: string;
}

const TARGETS = [
  {
    id: 'fastapi', label: 'FastAPI', icon: '⚡', color: '#009688',
    desc: 'Production REST API with automatic Swagger docs',
  },
  {
    id: 'flask', label: 'Flask', icon: '🧪', color: '#333',
    desc: 'Lightweight web server for simple deployments',
  },
  {
    id: 'docker', label: 'Docker', icon: '🐳', color: '#2496ED',
    desc: 'Containerized deployment ready for any cloud',
  },
  {
    id: 'onnx', label: 'ONNX Runtime', icon: '⚙️', color: '#7B3FF2',
    desc: 'Optimized inference across platforms',
  },
];

// Template code generators
function generateFastAPI(model: string, task: string): Record<string, string> {
  return {
    'app.py': `"""
NeuralForge — Auto-Generated FastAPI Deployment
Model: ${model} | Task: ${task}
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import joblib
import json

app = FastAPI(
    title="NeuralForge Model API",
    description="Auto-generated inference API for ${model}",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model on startup
model = joblib.load("trained_model.joblib")

@app.get("/")
async def root():
    return {"status": "online", "model": "${model}", "task": "${task}"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/predict")
async def predict(data: dict):
    """Run inference on input data."""
    try:
        features = np.array(data.get("features", [])).reshape(1, -1)
        prediction = model.predict(features)
        probability = model.predict_proba(features) if hasattr(model, 'predict_proba') else None

        return {
            "prediction": prediction.tolist(),
            "probabilities": probability.tolist() if probability is not None else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
`,
    'requirements.txt': `fastapi>=0.104.0
uvicorn[standard]>=0.24.0
numpy>=1.24.0
joblib>=1.3.0
scikit-learn>=1.3.0
python-multipart>=0.0.6
`,
    'README.md': `# NeuralForge Model Deployment

## Quick Start
\`\`\`bash
pip install -r requirements.txt
python app.py
\`\`\`

Then visit: http://localhost:8080/docs

## API Endpoints
- \`GET /\` — Status check
- \`GET /health\` — Health check
- \`POST /predict\` — Run inference

## Example Request
\`\`\`bash
curl -X POST http://localhost:8080/predict \\
  -H "Content-Type: application/json" \\
  -d '{"features": [1.0, 2.0, 3.0]}'
\`\`\`
`,
  };
}

function generateDocker(model: string, task: string): Record<string, string> {
  return {
    'Dockerfile': `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
`,
    'docker-compose.yml': `version: "3.8"

services:
  model-api:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MODEL_NAME=${model}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
`,
    '.dockerignore': `__pycache__
*.pyc
.git
.env
*.md
`,
    'README.md': `# Docker Deployment

## Build & Run
\`\`\`bash
docker-compose up --build
\`\`\`

API available at: http://localhost:8080

## Production
\`\`\`bash
docker build -t neuralforge-model .
docker push your-registry/neuralforge-model:latest
\`\`\`
`,
  };
}

function generateFlask(model: string, task: string): Record<string, string> {
  return {
    'app.py': `"""
NeuralForge — Flask Deployment
"""
from flask import Flask, request, jsonify
import numpy as np
import joblib

app = Flask(__name__)
model = joblib.load("trained_model.joblib")

@app.route("/")
def index():
    return jsonify({"status": "online", "model": "${model}"})

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json
    features = np.array(data.get("features", [])).reshape(1, -1)
    prediction = model.predict(features)
    return jsonify({"prediction": prediction.tolist()})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
`,
    'requirements.txt': `flask>=3.0.0\nnumpy>=1.24.0\njoblib>=1.3.0\nscikit-learn>=1.3.0\n`,
    'README.md': `# Flask Deployment\n\n\`\`\`bash\npip install -r requirements.txt\npython app.py\n\`\`\`\n\nAPI at http://localhost:8080\n`,
  };
}

function generateONNX(model: string, task: string): Record<string, string> {
  return {
    'convert_to_onnx.py': `"""Convert trained model to ONNX format for optimized inference."""
import joblib
import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

model = joblib.load("trained_model.joblib")
# Adjust input shape based on your model
initial_type = [("float_input", FloatTensorType([None, 10]))]

onnx_model = convert_sklearn(model, initial_types=initial_type)
with open("model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())

print("Saved: model.onnx")
`,
    'inference.py': `"""Run inference with ONNX Runtime."""
import onnxruntime as ort
import numpy as np

session = ort.InferenceSession("model.onnx")
input_name = session.get_inputs()[0].name

# Example input
X = np.random.randn(1, 10).astype(np.float32)
result = session.run(None, {input_name: X})
print(f"Prediction: {result[0]}")
`,
    'requirements.txt': `onnxruntime>=1.16.0\nskl2onnx>=1.16.0\nnumpy>=1.24.0\njoblib>=1.3.0\nscikit-learn>=1.3.0\n`,
    'README.md': `# ONNX Deployment\n\n1. Convert: \`python convert_to_onnx.py\`\n2. Inference: \`python inference.py\`\n\nONNX provides 2-10x faster inference across all platforms.\n`,
  };
}

export default function DeploymentGenerator({ modelName, taskType }: Props) {
  const [target, setTarget] = useState('fastapi');
  const [activeFile, setActiveFile] = useState('');
  const [copied, setCopied] = useState(false);

  const generators: Record<string, (m: string, t: string) => Record<string, string>> = {
    fastapi: generateFastAPI,
    flask: generateFlask,
    docker: generateDocker,
    onnx: generateONNX,
  };

  const files = generators[target]?.(modelName, taskType) || {};
  const fileNames = Object.keys(files);
  const currentFile = activeFile || fileNames[0] || '';
  const currentContent = files[currentFile] || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Deployment Package Generator
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Production-ready deployment code for {modelName}
          </p>
        </div>
      </div>

      {/* Target Selector */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 10, padding: '20px 24px',
      }}>
        {TARGETS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTarget(t.id); setActiveFile(''); }}
            style={{
              padding: '14px', borderRadius: 12,
              border: `2px solid ${target === t.id ? t.color : 'var(--border)'}`,
              background: target === t.id ? `${t.color}08` : 'transparent',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{t.icon}</span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: target === t.id ? t.color : 'var(--text-primary)',
              }}>{t.label}</span>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {t.desc}
            </p>
          </button>
        ))}
      </div>

      {/* File Tabs + Code */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', padding: '0 24px',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
        }}>
          {fileNames.map(name => (
            <button
              key={name}
              onClick={() => setActiveFile(name)}
              style={{
                padding: '10px 14px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: (currentFile === name) ? 700 : 500,
                color: (currentFile === name) ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${(currentFile === name) ? 'var(--color-primary)' : 'transparent'}`,
                marginBottom: -1, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <FileText size={12} />
              {name}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={handleCopy} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: copied ? 'var(--color-success-subtle)' : 'transparent',
              color: copied ? 'var(--color-success)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={handleDownload} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Download size={10} /> Save
            </button>
          </div>
        </div>

        <pre style={{
          padding: '20px 24px', margin: 0, fontSize: 12.5, lineHeight: 1.7,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-primary)',
          background: 'var(--bg-surface)',
          overflowX: 'auto', whiteSpace: 'pre',
          maxHeight: 400,
        }}>
          {currentContent}
        </pre>
      </div>
    </div>
  );
}
