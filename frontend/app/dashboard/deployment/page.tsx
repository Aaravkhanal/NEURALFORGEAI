'use client';

import { useState, useEffect } from 'react';
import { Cloud, Box, Rocket, Copy, Check, ExternalLink, Terminal, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';

const PROVIDERS = [
  {
    id: 'docker',
    name: 'Docker (Local)',
    icon: Box,
    color: '#2496ED',
    desc: 'Run the inference API in a container on any machine',
    consoleUrl: 'https://hub.docker.com',
    consoleName: 'Docker Hub',
  },
  {
    id: 'aws',
    name: 'AWS SageMaker',
    icon: Cloud,
    color: '#FF9900',
    desc: 'Managed serverless endpoint on AWS',
    consoleUrl: 'https://console.aws.amazon.com/sagemaker',
    consoleName: 'AWS Console',
  },
  {
    id: 'gcp',
    name: 'Google Cloud Vertex AI',
    icon: Cloud,
    color: '#4285F4',
    desc: 'Scalable auto-managed endpoint on GCP',
    consoleUrl: 'https://console.cloud.google.com/vertex-ai',
    consoleName: 'GCP Console',
  },
  {
    id: 'azure',
    name: 'Azure ML',
    icon: Cloud,
    color: '#0078D4',
    desc: 'Enterprise managed deployment on Azure',
    consoleUrl: 'https://ml.azure.com',
    consoleName: 'Azure ML Studio',
  },
];

type Step = { title: string; cmd: string; note?: string };

function getDeploySteps(provider: string, modelName: string, taskType: string): Step[] {
  const tag = modelName.toLowerCase().replace(/\s+/g, '-') || 'my-model';

  switch (provider) {
    case 'docker':
      return [
        { title: '1. Build the image', cmd: `docker build -t ${tag}:latest .` },
        { title: '2. Run the container', cmd: `docker run -d -p 8000:8000 --name ${tag} ${tag}:latest` },
        { title: '3. Test the endpoint', cmd: `curl -X POST http://localhost:8000/predict \\\n  -H "Content-Type: application/json" \\\n  -d '{"feature1": 1.0}'` },
        { title: '4. Push to Docker Hub (optional)', cmd: `docker tag ${tag}:latest your-org/${tag}:latest\ndocker push your-org/${tag}:latest`, note: 'Replace your-org with your Docker Hub username' },
      ];
    case 'aws':
      return [
        { title: '1. Install AWS CLI + SageMaker SDK', cmd: `pip install awscli boto3 sagemaker` },
        { title: '2. Build & push container to ECR', cmd: `aws ecr create-repository --repository-name ${tag}\ndocker build -t ${tag} .\naws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com\ndocker push <account>.dkr.ecr.<region>.amazonaws.com/${tag}:latest` },
        { title: '3. Create SageMaker model + endpoint', cmd: `python deploy_aws.py` },
        { title: '4. Test live endpoint', cmd: `aws sagemaker-runtime invoke-endpoint \\\n  --endpoint-name ${tag}-endpoint \\\n  --content-type application/json \\\n  --body '{"feature1": 1.0}' output.json && cat output.json`, note: 'Replace feature1 with your actual feature names' },
      ];
    case 'gcp':
      return [
        { title: '1. Install gcloud CLI', cmd: `gcloud auth login\ngcloud config set project YOUR_PROJECT_ID` },
        { title: '2. Build & push to Artifact Registry', cmd: `gcloud builds submit --tag gcr.io/YOUR_PROJECT/${tag}:latest .` },
        { title: '3. Deploy to Cloud Run (quickest)', cmd: `gcloud run deploy ${tag} \\\n  --image gcr.io/YOUR_PROJECT/${tag}:latest \\\n  --platform managed \\\n  --region us-central1 \\\n  --allow-unauthenticated`, note: 'For Vertex AI endpoint, use the GCP Console' },
        { title: '4. Test endpoint', cmd: `curl -X POST https://YOUR_CLOUDRUN_URL/predict \\\n  -H "Content-Type: application/json" \\\n  -d '{"feature1": 1.0}'` },
      ];
    case 'azure':
      return [
        { title: '1. Install Azure CLI + ML extension', cmd: `pip install azure-ai-ml azure-identity\naz login\naz extension add -n ml` },
        { title: '2. Create Azure ML workspace (if needed)', cmd: `az ml workspace create -n my-workspace -g my-resource-group` },
        { title: '3. Register model & create endpoint', cmd: `az ml model create --name ${tag} --path ./model.pkl\naz ml online-endpoint create --name ${tag}-ep -f endpoint.yaml` },
        { title: '4. Test the deployment', cmd: `az ml online-endpoint invoke \\\n  --name ${tag}-ep \\\n  --request-file request.json` },
      ];
    default:
      return [];
  }
}

function getDockerfile(modelName: string): string {
  return `FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
`;
}

export default function DeploymentPage() {
  const { markStageComplete, selectedModel, trainedModelId, problemContext } = usePipeline();
  const [provider, setProvider] = useState('docker');
  const [copied, setCopied] = useState<string | null>(null);
  const [showDockerfile, setShowDockerfile] = useState(false);

  useEffect(() => { markStageComplete('/dashboard/deployment'); }, [markStageComplete]);

  const modelName = selectedModel || 'my-model';
  const taskType = problemContext?.task_type || 'tabular_regression';
  const steps = getDeploySteps(provider, modelName, taskType);
  const selectedProvider = PROVIDERS.find(p => p.id === provider)!;
  const dockerfile = getDockerfile(modelName);

  const copyCmd = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 08</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-1">Deployment</h1>
      <p className="text-[15px] text-[#888] mb-6">
        Deploy <strong className="text-[#1a1a1a]">{modelName}</strong> to a production environment.
        {!trainedModelId && <span className="text-[#FF4400]"> Train a model first to get the download package.</span>}
      </p>

      <div className="flex gap-6">
        {/* Left: provider + steps */}
        <div className="flex-1 space-y-5">
          {/* Provider selection */}
          <div className="dashed-card">
            <span className="section-label block mb-4">DEPLOYMENT TARGET</span>
            <div className="grid grid-cols-2 gap-3">
              {PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`text-left border rounded-xl p-4 transition-all ${
                    provider === p.id
                      ? 'border-[#FF4400] bg-[#FFF8F0]'
                      : 'border-[#f0ebe1] bg-white hover:border-[#e0d5c9]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-1.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: provider === p.id ? p.color + '18' : '#f8f6f2' }}
                    >
                      <p.icon size={16} style={{ color: provider === p.id ? p.color : '#888' }} />
                    </div>
                    <span className="font-bold text-[13px] text-[#1a1a1a]">{p.name}</span>
                  </div>
                  <p className="text-[11px] text-[#888]">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Deployment steps */}
          <div className="dashed-card">
            <div className="flex items-center justify-between mb-4">
              <span className="section-label">DEPLOYMENT STEPS — {selectedProvider.name.toUpperCase()}</span>
              <a
                href={selectedProvider.consoleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-[#FF4400] font-bold hover:underline"
              >
                Open {selectedProvider.consoleName}
                <ExternalLink size={11} />
              </a>
            </div>

            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="bg-[#fdfaf7] border border-[#f0ebe1] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-bold text-[#1a1a1a]">{step.title}</span>
                    <button
                      onClick={() => copyCmd(`step-${i}`, step.cmd)}
                      className="flex items-center gap-1 text-[10px] text-[#888] hover:text-[#FF4400] transition-colors"
                    >
                      {copied === `step-${i}` ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                      {copied === `step-${i}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="text-[11.5px] leading-[1.7] text-[#1a1a1a] bg-[#1a1a1a] text-[#D4D4D4] rounded-lg p-3 overflow-x-auto"
                    style={{ fontFamily: "'Space Mono', monospace" }}>
                    {step.cmd}
                  </pre>
                  {step.note && (
                    <p className="mt-1.5 text-[10px] text-[#888]">⚠ {step.note}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dockerfile */}
          <div className="dashed-card">
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setShowDockerfile(v => !v)}
            >
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-[#888]" />
                <span className="section-label">DOCKERFILE</span>
              </div>
              {showDockerfile ? <ChevronUp size={14} className="text-[#888]" /> : <ChevronDown size={14} className="text-[#888]" />}
            </button>
            {showDockerfile && (
              <div className="mt-4 relative">
                <button
                  onClick={() => copyCmd('dockerfile', dockerfile)}
                  className="absolute top-3 right-3 flex items-center gap-1 text-[10px] text-[#666] hover:text-[#FF4400] transition-colors z-10"
                >
                  {copied === 'dockerfile' ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                  {copied === 'dockerfile' ? 'Copied' : 'Copy'}
                </button>
                <pre className="text-[11.5px] leading-[1.7] bg-[#1a1a1a] text-[#D4D4D4] rounded-xl p-4 overflow-x-auto"
                  style={{ fontFamily: "'Space Mono', monospace" }}>
                  {dockerfile}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right: context + action panel */}
        <div className="w-[300px] shrink-0 space-y-4">
          {/* Model context */}
          <div className="dashed-card">
            <span className="section-label block mb-3">MODEL CONTEXT</span>
            <div className="space-y-2 text-[12px]">
              <div className="flex justify-between">
                <span className="text-[#888]">Model</span>
                <span className="font-bold text-[#1a1a1a]">{modelName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">Task</span>
                <span className="font-bold text-[#1a1a1a]">{taskType || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888]">Model ID</span>
                <span className="font-mono text-[11px] text-[#888]">{trainedModelId ? trainedModelId.slice(0, 12) + '…' : 'Not trained'}</span>
              </div>
            </div>
          </div>

          {/* Download package */}
          {trainedModelId && (
            <div className="dashed-card-filled text-center space-y-3">
              <Rocket size={28} className="mx-auto text-[#FF4400]" />
              <div>
                <p className="font-bold text-[15px] text-[#1a1a1a]">Download Package</p>
                <p className="text-[11px] text-[#888] mt-1">Trained model + all generated files ready to deploy</p>
              </div>
              <button
                onClick={async () => {
                  const token = localStorage.getItem('neuralforge_token');
                  const res = await fetch(`/api/backend/export/package/${trainedModelId}`, {
                    headers: { ...(token && { Authorization: `Bearer ${token}` }) },
                  });
                  if (res.ok) {
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `model_package.zip`; a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                className="btn-coral w-full py-3"
              >
                <Download size={16} />
                Download model.zip
              </button>
            </div>
          )}

          {/* Open console CTA */}
          <a
            href={selectedProvider.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block dashed-card hover:border-[#FF4400] transition-colors text-center"
          >
            <div className="w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center"
              style={{ background: selectedProvider.color + '18' }}>
              <selectedProvider.icon size={20} style={{ color: selectedProvider.color }} />
            </div>
            <p className="font-bold text-[13px] text-[#1a1a1a]">Open {selectedProvider.consoleName}</p>
            <p className="text-[11px] text-[#888] mt-0.5 flex items-center justify-center gap-1">
              {selectedProvider.consoleUrl.replace('https://', '')}
              <ExternalLink size={10} />
            </p>
          </a>
        </div>
      </div>

      <PipelineNav
        prevLink="/dashboard/codegen"
        prevTitle="Code Generation"
        nextLink="/dashboard/monitoring"
        nextTitle="Monitoring"
      />
    </div>
  );
}
