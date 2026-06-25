'use client';

import { useState } from 'react';
import { Package, Download, HardDrive, Cpu, CheckCircle, Loader2 } from 'lucide-react';

interface Props {
  modelName: string;
  taskType: string;
}

const EXPORT_FORMATS = [
  {
    id: 'pytorch', label: 'PyTorch', ext: '.pth', icon: '🔥',
    size: '~150 MB', compatibility: 'Python, C++, Mobile (via TorchScript)',
    useCases: ['Production inference', 'Fine-tuning', 'Research'],
    description: 'Native PyTorch checkpoint with model weights and optimizer state.',
  },
  {
    id: 'tensorflow', label: 'TensorFlow', ext: '.keras', icon: '🧠',
    size: '~180 MB', compatibility: 'Python, JavaScript (TF.js), Mobile (TF Lite)',
    useCases: ['Web deployment', 'Mobile apps', 'Edge devices'],
    description: 'Keras SavedModel format with full architecture and weights.',
  },
  {
    id: 'onnx', label: 'ONNX', ext: '.onnx', icon: '⚙️',
    size: '~120 MB', compatibility: 'Cross-platform (C++, C#, Java, Python)',
    useCases: ['Production APIs', 'Cross-language deployment', 'Optimized inference'],
    description: 'Open Neural Network Exchange format for maximum portability.',
  },
  {
    id: 'sklearn', label: 'Scikit-Learn', ext: '.joblib', icon: '🔬',
    size: '~50 MB', compatibility: 'Python',
    useCases: ['Tabular data', 'Quick prototyping', 'Scikit-learn pipelines'],
    description: 'Joblib serialized model with preprocessing pipeline.',
  },
  {
    id: 'safetensors', label: 'Safetensors', ext: '.safetensors', icon: '🔒',
    size: '~140 MB', compatibility: 'Python (Hugging Face ecosystem)',
    useCases: ['Hugging Face deployment', 'Safe model sharing', 'Fast loading'],
    description: 'Safe, fast-loading format designed for sharing ML models.',
  },
  {
    id: 'huggingface', label: 'Hugging Face', ext: 'model card', icon: '🤗',
    size: '~200 MB', compatibility: 'Python, JavaScript, Rust',
    useCases: ['Model Hub', 'Community sharing', 'API inference'],
    description: 'Full Hugging Face model repository with config, tokenizer, and model card.',
  },
];

export default function ModelExportCenter({ modelName, taskType }: Props) {
  const [selectedFormat, setSelectedFormat] = useState('pytorch');
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (formatId: string) => {
    setDownloading(formatId);
    // Simulate download
    await new Promise(r => setTimeout(r, 2000));
    setDownloading(null);

    const format = EXPORT_FORMATS.find(f => f.id === formatId);
    if (!format) return;

    // Create a demo file
    const content = `# NeuralForge Model Export\n# Model: ${modelName}\n# Format: ${format.label}\n# Task: ${taskType}\n\n# This is a placeholder. In production, the actual trained model weights would be here.\n`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuralforge_${modelName}${format.ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const selected = EXPORT_FORMATS.find(f => f.id === selectedFormat);

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
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Package size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Model Export Center</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Download your trained model in any format</p>
        </div>
      </div>

      {/* Format Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
        gap: 10, padding: '20px 24px',
      }}>
        {EXPORT_FORMATS.map(fmt => (
          <button
            key={fmt.id}
            onClick={() => setSelectedFormat(fmt.id)}
            style={{
              padding: '16px 14px', borderRadius: 14, textAlign: 'center',
              border: `2px solid ${selectedFormat === fmt.id ? 'var(--color-primary)' : 'var(--border)'}`,
              background: selectedFormat === fmt.id ? 'var(--color-primary-subtle)' : 'transparent',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 26, display: 'block', marginBottom: 6 }}>{fmt.icon}</span>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt.label}</p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{fmt.ext}</p>
          </button>
        ))}
      </div>

      {/* Selected Format Details */}
      {selected && (
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{
            padding: '20px', borderRadius: 14,
            background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 24 }}>{selected.icon}</span>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.label} Export</h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{selected.description}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Est. Size</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.size}</p>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>Compatibility</p>
                <p style={{ fontSize: 11, color: 'var(--text-primary)' }}>{selected.compatibility}</p>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Best For</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selected.useCases.map((uc, i) => (
                  <span key={i} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                    border: '1px solid var(--color-primary-glow)',
                  }}>{uc}</span>
                ))}
              </div>
            </div>

            <button
              className="btn-success"
              onClick={() => handleDownload(selected.id)}
              disabled={downloading === selected.id}
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            >
              {downloading === selected.id ? (
                <><Loader2 size={16} className="spin" /> Preparing Export...</>
              ) : (
                <><Download size={16} /> Download {selected.label} Model</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
