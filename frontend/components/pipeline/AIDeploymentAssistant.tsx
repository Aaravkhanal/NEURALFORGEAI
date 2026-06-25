'use client';

import { useState } from 'react';
import {
  Rocket, CheckCircle, Copy, ExternalLink, ArrowRight,
  Loader2, Cloud, Server, Globe, Check, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Props {
  modelName: string;
  taskType: string;
}

const PLATFORMS = [
  {
    id: 'huggingface', label: 'Hugging Face Spaces', icon: '🤗', color: '#FFD21E',
    desc: 'Free hosting with Gradio UI. Most popular for ML models.',
    difficulty: 'Easy',
    steps: [
      'Create a free account at huggingface.co',
      'Install: pip install huggingface_hub',
      'Run: huggingface-cli login',
      'Upload model files to a new Space',
      'Your model will be live at hf.co/spaces/username/model',
    ],
    command: 'huggingface-cli upload ./model_files username/my-model --repo-type space',
    freeHosting: true,
  },
  {
    id: 'railway', label: 'Railway', icon: '🚂', color: '#9B59B6',
    desc: 'One-click deploy with $5/month free credits.',
    difficulty: 'Easy',
    steps: [
      'Create account at railway.app',
      'Connect your GitHub repository',
      'Railway auto-detects Dockerfile or Procfile',
      'Click Deploy — your API is live in 2 minutes',
    ],
    command: 'railway up',
    freeHosting: true,
  },
  {
    id: 'render', label: 'Render', icon: '🟢', color: '#46E3B7',
    desc: 'Free tier available. Auto-deploys from GitHub.',
    difficulty: 'Easy',
    steps: [
      'Create account at render.com',
      'New Web Service → connect GitHub repo',
      'Set build command: pip install -r requirements.txt',
      'Set start command: uvicorn app:app --host 0.0.0.0 --port $PORT',
      'Deploy — free tier available',
    ],
    command: 'git push origin main  # Render auto-deploys from GitHub',
    freeHosting: true,
  },
  {
    id: 'docker', label: 'Docker', icon: '🐳', color: '#2496ED',
    desc: 'Containerized deployment. Run anywhere.',
    difficulty: 'Medium',
    steps: [
      'Ensure Docker is installed locally',
      'Build: docker build -t my-model-api .',
      'Run: docker run -p 8080:8080 my-model-api',
      'Push to Docker Hub: docker push username/my-model-api',
      'Deploy container to any cloud provider',
    ],
    command: 'docker build -t neuralforge-model . && docker run -p 8080:8080 neuralforge-model',
    freeHosting: false,
  },
  {
    id: 'vercel', label: 'Vercel', icon: '▲', color: '#000000',
    desc: 'Serverless deployment. Great for lightweight models.',
    difficulty: 'Medium',
    steps: [
      'Install Vercel CLI: npm i -g vercel',
      'Create api/ directory with serverless function',
      'Run: vercel deploy',
      'Your API is live at *.vercel.app',
    ],
    command: 'vercel deploy --prod',
    freeHosting: true,
  },
  {
    id: 'aws', label: 'AWS Lambda', icon: '☁️', color: '#FF9900',
    desc: 'Scalable serverless. Pay per request.',
    difficulty: 'Hard',
    steps: [
      'Install AWS CLI and configure credentials',
      'Package model with dependencies in Lambda layer',
      'Create Lambda function with API Gateway trigger',
      'Deploy using SAM or Serverless Framework',
      'Configure auto-scaling and monitoring',
    ],
    command: 'sam deploy --guided',
    freeHosting: false,
  },
];

export default function AIDeploymentAssistant({ modelName, taskType }: Props) {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [deployStep, setDeployStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selected = PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.05), var(--bg-card))',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Rocket size={20} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            AI Deployment Assistant
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Deploy {modelName} to production in minutes
          </p>
        </div>
      </div>

      {!selectedPlatform ? (
        /* Platform Selection Grid */
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {PLATFORMS.map(p => (
            <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                onClick={() => setSelectedPlatform(p.id)}
                style={{
                  padding: '20px', borderRadius: 14, textAlign: 'left',
                  border: '2px solid var(--border)', background: 'transparent',
                  cursor: 'pointer', transition: 'all 0.2s', flex: 1,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = p.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 24 }}>{p.icon}</span>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</h4>
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: p.difficulty === 'Easy' ? '#22C55E' : p.difficulty === 'Medium' ? '#F59E0B' : '#EF4444',
                    }}>
                      {p.difficulty}
                    </span>
                  </div>
                  {p.freeHosting && (
                    <span style={{
                      marginLeft: 'auto', padding: '2px 6px', borderRadius: 4,
                      fontSize: 9, fontWeight: 700, background: 'var(--color-success-subtle)',
                      color: 'var(--color-success)',
                    }}>FREE</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{p.desc}</p>
              </button>
            </div>
          ))}
        </div>
      ) : selected && (
        /* Deployment Guide */
        <div className="pipeline-step-enter" style={{ padding: '24px' }}>
          <button onClick={() => { setSelectedPlatform(null); setDeployStep(0); }}
            className="btn-secondary" style={{ fontSize: 11, padding: '6px 12px', marginBottom: 16 }}>
            ← Choose Different Platform
          </button>

          <div style={{
            padding: '20px', borderRadius: 14,
            background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
            marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 28 }}>{selected.icon}</span>
              <div>
                <h4 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                  Deploy to {selected.label}
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.desc}</p>
              </div>
            </div>

            {/* Step-by-step Guide */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selected.steps.map((step, i) => {
                const isDone = i < deployStep;
                const isCurrent = i === deployStep;
                return (
                  <div
                    key={i}
                    onClick={() => setDeployStep(i)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                      padding: '10px 14px', borderRadius: 10,
                      background: isCurrent ? 'var(--color-primary-subtle)' : 'transparent',
                      border: `1px solid ${isCurrent ? 'var(--color-primary-glow)' : 'transparent'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDone ? '#22C55E' : isCurrent ? 'var(--color-primary)' : 'var(--border-light)',
                      color: isDone || isCurrent ? 'white' : 'var(--text-muted)',
                      fontSize: 11, fontWeight: 700,
                    }}>
                      {isDone ? <Check size={12} /> : i + 1}
                    </div>
                    <span style={{
                      fontSize: 13, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                      fontWeight: isCurrent ? 600 : 400,
                      textDecoration: isDone ? 'line-through' : 'none',
                      lineHeight: 1.5, marginTop: 2,
                    }}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Command */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <code style={{
              flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)',
              color: 'var(--color-primary)', whiteSpace: 'nowrap', overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              $ {selected.command}
            </code>
            <button onClick={() => handleCopy(selected.command)} style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
              background: copied ? 'var(--color-success-subtle)' : 'transparent',
              color: copied ? 'var(--color-success)' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Next Step Button */}
          {deployStep < selected.steps.length - 1 && (
            <button className="btn-primary" onClick={() => setDeployStep(prev => prev + 1)}
              style={{ marginTop: 12, width: '100%', justifyContent: 'center', gap: 6 }}>
              Mark Step {deployStep + 1} Complete <ArrowRight size={14} />
            </button>
          )}
          {deployStep >= selected.steps.length - 1 && (
            <div style={{
              marginTop: 12, padding: '14px 20px', borderRadius: 12,
              background: 'var(--color-success-subtle)', border: '1px solid var(--color-success)',
              textAlign: 'center',
            }}>
              <CheckCircle size={20} color="var(--color-success)" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-success)' }}>
                🎉 Deployment complete!
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                Your model is ready. Follow the commands above to go live.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
