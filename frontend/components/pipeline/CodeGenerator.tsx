'use client';

import { useState, useEffect } from 'react';
import { Code, Copy, Download, Check, FileText, BookOpen, Loader2 } from 'lucide-react';

interface Props {
  fileId: string;
  modelKey: string;
  taskType: string;
  targetColumn?: string;
}

const FRAMEWORKS = [
  { id: 'pytorch', label: 'PyTorch', icon: '🔥', color: '#EE4C2C' },
  { id: 'tensorflow', label: 'TensorFlow', icon: '🧠', color: '#FF6F00' },
  { id: 'scikit-learn', label: 'Scikit-Learn', icon: '🔬', color: '#F7931E' },
];

const TABS = [
  { id: 'code', label: 'train.py', icon: Code },
  { id: 'requirements', label: 'requirements.txt', icon: FileText },
  { id: 'readme', label: 'README.md', icon: BookOpen },
];

export default function CodeGenerator({ fileId, modelKey, taskType, targetColumn }: Props) {
  const [framework, setFramework] = useState('pytorch');
  const [activeTab, setActiveTab] = useState('code');
  const [generated, setGenerated] = useState<{ code: string; requirements: string; readme: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const generateCode = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/codegen/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            file_id: fileId,
            model_key: modelKey,
            task_type: taskType,
            framework,
            target_column: targetColumn,
          }),
        }
      );
      if (!res.ok) throw new Error('Code generation failed');
      const result = await res.json();
      setGenerated(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      generateCode();
    });
  }, [framework]);

  const handleCopy = async () => {
    if (!generated) return;
    const content = activeTab === 'code' ? generated.code : activeTab === 'requirements' ? generated.requirements : generated.readme;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadBundle = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/codegen/notebook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            file_id: fileId,
            model_key: modelKey,
            task_type: taskType,
            framework,
            target_column: targetColumn,
          }),
        }
      );
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `neuralforge_${modelKey}_${framework}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const activeContent = generated
    ? (activeTab === 'code' ? generated.code : activeTab === 'requirements' ? generated.requirements : generated.readme)
    : '';

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, #22C55E, #16A34A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Code size={18} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Generated Training Code
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Production-ready • Copy & paste into your environment
          </p>
        </div>

        <button
          onClick={handleDownloadBundle}
          disabled={downloading || !generated}
          className="btn-success"
          style={{ fontSize: 12, padding: '8px 16px', gap: 6 }}
        >
          {downloading ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
          {downloading ? 'Preparing...' : 'Download Bundle (.zip)'}
        </button>
      </div>

      {/* Framework Selector */}
      <div style={{
        display: 'flex', gap: 8, padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
      }}>
        {FRAMEWORKS.map(fw => (
          <button
            key={fw.id}
            onClick={() => setFramework(fw.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 10,
              border: `2px solid ${framework === fw.id ? fw.color : 'var(--border)'}`,
              background: framework === fw.id ? `${fw.color}10` : 'transparent',
              color: framework === fw.id ? fw.color : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            <span>{fw.icon}</span>
            {fw.label}
          </button>
        ))}
      </div>

      {/* File Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                borderBottom: `2px solid ${isActive ? 'var(--color-primary)' : 'transparent'}`,
                transition: 'all 0.15s', marginBottom: -1,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}

        <button
          onClick={handleCopy}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: copied ? 'var(--color-success-subtle)' : 'transparent',
            color: copied ? 'var(--color-success)' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code Display */}
      <div style={{ position: 'relative', maxHeight: 500, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Loader2 size={24} className="spin" style={{ color: 'var(--color-primary)', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Generating {FRAMEWORKS.find(f => f.id === framework)?.label} code...
            </p>
          </div>
        ) : error ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-error)' }}>
            {error}
          </div>
        ) : (
          <pre style={{
            padding: '20px 24px', margin: 0, fontSize: 12.5, lineHeight: 1.7,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            background: 'var(--bg-surface)',
            overflowX: 'auto', whiteSpace: 'pre',
          }}>
            {activeContent}
          </pre>
        )}
      </div>
    </div>
  );
}
