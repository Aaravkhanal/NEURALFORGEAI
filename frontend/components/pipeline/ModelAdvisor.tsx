'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Zap, Clock, Cpu, HardDrive, ChevronDown, ChevronUp,
  Star, Award, Gauge, CheckCircle, Loader2,
} from 'lucide-react';

interface ModelRecommendation {
  rank: number;
  model_key: string;
  display_name: string;
  parameters: string;
  accuracy_potential: string;
  training_speed: string;
  inference_speed: string;
  model_size: string;
  hardware: string;
  use_cases: string[];
  strengths: string[];
  weaknesses: string[];
  suitability_score: number;
  is_recommended: boolean;
  explanation: string;
}

interface AdvisorData {
  task_type: string;
  task_type_display: string;
  dataset_summary: {
    dataset_size: number;
    num_classes: number;
    num_features: number;
    dataset_type: string;
  };
  recommendations: ModelRecommendation[];
  total_models_evaluated: number;
}

interface Props {
  fileId: string;
  taskTypeOverride?: string;
  onAdvisorLoaded?: (data: AdvisorData) => void;
  onModelSelected?: (models: string[]) => void;
}

const SPEED_COLORS: Record<string, string> = {
  'Very Fast': '#22C55E',
  'Fast': '#34D399',
  'Medium': '#F59E0B',
  'Slow': '#EF4444',
};

const ACCURACY_COLORS: Record<string, string> = {
  'Very High': '#7C3AED',
  'High': '#3B82F6',
  'Medium': '#F59E0B',
  'Low': '#EF4444',
};

const HW_ICONS: Record<string, string> = {
  'CPU': '💻',
  'Low GPU': '🟢',
  'Medium GPU': '🟡',
  'High GPU': '🔴',
};

export default function ModelAdvisor({ fileId, taskTypeOverride, onAdvisorLoaded, onModelSelected }: Props) {
  const [data, setData] = useState<AdvisorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/advisor/recommend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            file_id: fileId,
            task_type: taskTypeOverride || null,
            top_n: 5,
          }),
        }
      );
      if (!res.ok) throw new Error('Failed to get recommendations');
      const result = await res.json();
      setData(result);
      onAdvisorLoaded?.(result);
      // Auto-select the recommended model
      if (result.recommendations?.length > 0) {
        const rec = result.recommendations[0].model_key;
        setSelectedModels(new Set([rec]));
        onModelSelected?.([rec]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchRecommendations();
    });
  }, [fileId, taskTypeOverride]);

  const toggleModel = (key: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      onModelSelected?.(Array.from(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center',
      }}>
        <Loader2 size={28} className="spin" style={{ margin: '0 auto 16px', color: 'var(--color-primary)' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}>
          AI Advisor is analyzing your dataset...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--color-error)',
        borderRadius: 'var(--radius-xl)', padding: 32, textAlign: 'center',
      }}>
        <p style={{ color: 'var(--color-error)', fontSize: 14 }}>{error || 'Failed to load'}</p>
      </div>
    );
  }

  const summary = data.dataset_summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Analysis Summary Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-subtle), var(--bg-surface))',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--color-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={20} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              AI Model Advisor
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {data.total_models_evaluated} models evaluated • {data.recommendations.length} recommended
            </p>
          </div>
        </div>

        {/* Dataset summary chips */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Chip label="Task Detected" value={data.task_type_display} color="var(--color-primary)" />
          <Chip label="Dataset Size" value={summary.dataset_size?.toLocaleString() || '—'} color="var(--color-info)" />
          {summary.num_classes > 0 && <Chip label="Classes" value={String(summary.num_classes)} color="var(--color-success)" />}
          {summary.num_features > 0 && <Chip label="Features" value={String(summary.num_features)} color="var(--color-warning)" />}
        </div>
      </div>

      {/* Model Recommendation Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.recommendations.map((rec) => {
          const isExpanded = expandedModel === rec.model_key;
          const isSelected = selectedModels.has(rec.model_key);

          return (
            <div
              key={rec.model_key}
              style={{
                background: 'var(--bg-card)',
                border: `2px solid ${isSelected ? 'var(--color-primary)' : rec.is_recommended ? 'var(--color-primary-light)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                transition: 'all 0.2s',
                boxShadow: isSelected ? 'var(--shadow-purple)' : rec.is_recommended ? 'var(--shadow-md)' : 'none',
              }}
            >
              {/* Card Header */}
              <div
                style={{
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedModel(isExpanded ? null : rec.model_key)}
              >
                {/* Rank Badge */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: rec.rank === 1 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : rec.rank === 2 ? 'linear-gradient(135deg, #9CA3AF, #6B7280)' : rec.rank === 3 ? 'linear-gradient(135deg, #CD7F32, #A0522D)' : 'var(--border-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: rec.rank <= 3 ? 'white' : 'var(--text-muted)',
                  fontSize: 14, fontWeight: 800,
                }}>
                  {rec.rank <= 3 ? <Award size={18} /> : `#${rec.rank}`}
                </div>

                {/* Model Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {rec.display_name}
                    </h4>
                    {rec.is_recommended && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: 'var(--color-primary)',
                        background: 'var(--color-primary-subtle)', padding: '2px 8px',
                        borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.5,
                      }}>
                        ⭐ Best Match
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {rec.parameters} parameters
                  </span>
                </div>

                {/* Quick Badges */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <MetricBadge icon={<Gauge size={12} />} label={rec.accuracy_potential} color={ACCURACY_COLORS[rec.accuracy_potential] || '#6B7280'} />
                  <MetricBadge icon={<Zap size={12} />} label={rec.training_speed} color={SPEED_COLORS[rec.training_speed] || '#6B7280'} />
                  <MetricBadge icon={<HardDrive size={12} />} label={rec.model_size} color="#6B7280" />
                </div>

                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleModel(rec.model_key); }}
                  style={{
                    width: 28, height: 28, borderRadius: 8, border: 'none',
                    background: isSelected ? 'var(--color-primary)' : 'var(--border-light)',
                    color: isSelected ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                >
                  {isSelected ? <CheckCircle size={16} /> : <span style={{ fontSize: 12 }}>+</span>}
                </button>

                {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{
                  padding: '0 20px 20px',
                  borderTop: '1px solid var(--border-light)',
                }}>
                  {/* Why this model? */}
                  <div style={{
                    padding: '14px 16px', borderRadius: 12, margin: '16px 0',
                    background: 'var(--color-primary-subtle)',
                    border: '1px solid var(--color-primary-glow)',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 6 }}>
                      💡 Why this model?
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {rec.explanation}
                    </p>
                  </div>

                  {/* Detail Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 14 }}>
                    <DetailCell label="Accuracy" value={rec.accuracy_potential} color={ACCURACY_COLORS[rec.accuracy_potential]} />
                    <DetailCell label="Train Speed" value={rec.training_speed} color={SPEED_COLORS[rec.training_speed]} />
                    <DetailCell label="Inference" value={rec.inference_speed} color={SPEED_COLORS[rec.inference_speed]} />
                    <DetailCell label="Size" value={rec.model_size} />
                    <DetailCell label="Hardware" value={rec.hardware} icon={HW_ICONS[rec.hardware]} />
                  </div>

                  {/* Use Cases */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Best For
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {rec.use_cases.map((uc, i) => (
                        <span key={i} style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 6,
                          background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                          border: '1px solid var(--border)',
                        }}>{uc}</span>
                      ))}
                    </div>
                  </div>

                  {/* Strengths */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                      Key Strengths
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {rec.strengths.map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <CheckCircle size={12} color="var(--color-success)" style={{ marginTop: 2, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
      borderRadius: 8, background: `${color}10`, border: `1px solid ${color}30`,
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

function MetricBadge({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
      borderRadius: 6, background: `${color}10`, color, fontSize: 11, fontWeight: 600,
    }}>
      {icon}
      {label}
    </div>
  );
}

function DetailCell({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 10,
      background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
    }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--text-primary)' }}>
        {icon && <span style={{ marginRight: 4 }}>{icon}</span>}
        {value}
      </p>
    </div>
  );
}
