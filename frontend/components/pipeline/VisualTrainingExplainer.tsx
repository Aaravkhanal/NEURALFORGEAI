'use client';

import { useState } from 'react';

interface Props {
  activeStage?: string;
}

const STAGES = [
  { id: 'dataset', label: 'Dataset', icon: '📊', desc: 'Your raw data is loaded into memory. Images are decoded, text is tokenized, tabular data is parsed into numerical arrays.' },
  { id: 'preprocess', label: 'Preprocessing', icon: '🧹', desc: 'Data is cleaned, normalized, and transformed. Images are resized, features are scaled, missing values are handled.' },
  { id: 'split', label: 'Train/Val Split', icon: '✂️', desc: 'Data is divided into training (80%) and validation (20%) sets. The model learns from training data and is tested on validation data it has never seen.' },
  { id: 'forward', label: 'Forward Pass', icon: '➡️', desc: 'Data flows through the neural network layers. Each layer transforms the data, extracting increasingly complex features.' },
  { id: 'loss', label: 'Loss Calculation', icon: '📉', desc: 'The model\'s predictions are compared to the correct answers. The "loss" measures how wrong the predictions are — lower is better.' },
  { id: 'backward', label: 'Backpropagation', icon: '⬅️', desc: 'The error is propagated backward through the network. Each weight learns how much it contributed to the error.' },
  { id: 'optimize', label: 'Weight Update', icon: '🔧', desc: 'Weights are adjusted to reduce the error. The optimizer (Adam, SGD) decides how much to change each weight.' },
  { id: 'validate', label: 'Validation', icon: '✅', desc: 'The updated model is tested on validation data to check if it generalizes well to unseen examples.' },
  { id: 'evaluate', label: 'Evaluation', icon: '📊', desc: 'Final metrics are computed: accuracy, precision, recall, F1 score. These tell you how well the model truly performs.' },
  { id: 'export', label: 'Model Export', icon: '📦', desc: 'The trained model weights are saved to a file (PyTorch .pth, TensorFlow .keras, ONNX, etc.) for deployment.' },
];

export default function VisualTrainingExplainer({ activeStage }: Props) {
  const [selectedStage, setSelectedStage] = useState<string | null>(activeStage || null);
  const selected = STAGES.find(s => s.id === selectedStage);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🧬</span>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>How Training Works</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Click any stage to learn what happens</p>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div style={{ padding: '24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 900 }}>
          {STAGES.map((stage, i) => {
            const isActive = activeStage === stage.id;
            const isSelected = selectedStage === stage.id;
            const isPast = activeStage ? STAGES.findIndex(s => s.id === activeStage) > i : false;

            return (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  onClick={() => setSelectedStage(isSelected ? null : stage.id)}
                  className={`workflow-node ${isActive ? 'active' : isPast ? 'completed' : ''}`}
                  style={{
                    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    minWidth: 70, position: 'relative',
                    border: isSelected ? '2px solid var(--color-primary)' : undefined,
                    boxShadow: isActive ? '0 0 16px var(--color-primary-glow)' : undefined,
                    animation: isActive ? 'pulse 2s ease-in-out infinite' : undefined,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{stage.icon}</span>
                  <span style={{ fontSize: 9, whiteSpace: 'nowrap' }}>{stage.label}</span>
                </button>
                {i < STAGES.length - 1 && (
                  <div style={{
                    width: 20, height: 2, background: isPast ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--border-light)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation Panel */}
      {selected && (
        <div className="pipeline-step-enter" style={{
          padding: '0 24px 24px',
        }}>
          <div style={{
            padding: '16px 20px', borderRadius: 14,
            background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary-glow)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{selected.icon}</span>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.label}</h4>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {selected.desc}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
