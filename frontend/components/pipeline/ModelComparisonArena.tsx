'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Trophy, Zap, Clock, HardDrive, Cpu, Gauge, ArrowRight } from 'lucide-react';

interface ModelInfo {
  model_key: string;
  display_name: string;
  accuracy_potential: string;
  training_speed: string;
  inference_speed: string;
  model_size: string;
  hardware: string;
  parameters: string;
  use_cases: string[];
  suitability_score: number;
}

interface Props {
  models: ModelInfo[];
  onSelectForTraining?: (modelKey: string) => void;
}

const METRICS = [
  { key: 'accuracy_potential', label: 'Accuracy Potential', icon: Gauge, levels: ['Low', 'Medium', 'High', 'Very High'] },
  { key: 'training_speed', label: 'Training Speed', icon: Clock, levels: ['Slow', 'Medium', 'Fast', 'Very Fast'] },
  { key: 'inference_speed', label: 'Inference Speed', icon: Zap, levels: ['Slow', 'Medium', 'Fast', 'Very Fast'] },
  { key: 'model_size', label: 'Model Size', icon: HardDrive, levels: ['Large', 'Medium', 'Small'], invert: true },
  { key: 'hardware', label: 'Hardware Req.', icon: Cpu, levels: ['High GPU', 'Medium GPU', 'Low GPU', 'CPU'], invert: true },
];

export default function ModelComparisonArena({ models, onSelectForTraining }: Props) {
  if (!models || models.length < 2) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 48, textAlign: 'center',
      }}>
        <BarChart3 size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          Select at least 2 models from the Advisor to compare
        </p>
      </div>
    );
  }

  const getLevelValue = (value: string, levels: string[]) => {
    const idx = levels.indexOf(value);
    return idx >= 0 ? ((idx + 1) / levels.length) * 100 : 50;
  };

  const getBarColor = (pct: number) => {
    if (pct >= 75) return '#22C55E';
    if (pct >= 50) return '#3B82F6';
    if (pct >= 25) return '#F59E0B';
    return '#EF4444';
  };

  const bestModel = models.reduce((best, m) => m.suitability_score > best.suitability_score ? m : best, models[0]);

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
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Model Comparison Arena</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Comparing {models.length} models side-by-side
          </p>
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 140, textAlign: 'left' }}>Metric</th>
              {models.map(m => (
                <th key={m.model_key} style={{
                  ...thStyle, textAlign: 'center',
                  background: m.model_key === bestModel.model_key ? 'var(--color-primary-subtle)' : undefined,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{m.display_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>{m.parameters}</span>
                    {m.model_key === bestModel.model_key && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: 'var(--color-primary)',
                        background: 'var(--color-primary-subtle)', padding: '1px 6px',
                        borderRadius: 4, textTransform: 'uppercase',
                      }}>👑 Best</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(metric => {
              const values = models.map(m => {
                const val = (m as any)[metric.key] as string;
                return { value: val, pct: getLevelValue(val, metric.levels) };
              });
              const maxPct = Math.max(...values.map(v => v.pct));

              return (
                <tr key={metric.key}>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <metric.icon size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {metric.label}
                      </span>
                    </div>
                  </td>
                  {values.map((v, i) => (
                    <td key={i} style={{
                      ...tdStyle, textAlign: 'center',
                      background: models[i].model_key === bestModel.model_key ? 'var(--color-primary-subtle)' : undefined,
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 700,
                          color: v.pct === maxPct ? '#22C55E' : 'var(--text-primary)',
                        }}>
                          {v.pct === maxPct && '🏆 '}{v.value}
                        </span>
                        <div style={{ width: '80%', height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 3, width: `${v.pct}%`,
                            background: getBarColor(v.pct),
                            transition: 'width 0.5s ease-out',
                          }} />
                        </div>
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* Suitability Score Row */}
            <tr>
              <td style={{ ...tdStyle, borderTop: '2px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>
                  ⭐ Suitability Score
                </span>
              </td>
              {models.map(m => (
                <td key={m.model_key} style={{
                  ...tdStyle, textAlign: 'center',
                  borderTop: '2px solid var(--border)',
                  background: m.model_key === bestModel.model_key ? 'var(--color-primary-subtle)' : undefined,
                }}>
                  <span style={{
                    fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-heading)',
                    color: m.model_key === bestModel.model_key ? 'var(--color-primary)' : 'var(--text-primary)',
                  }}>
                    {m.suitability_score}
                  </span>
                </td>
              ))}
            </tr>

            {/* Select for Training Row */}
            <tr>
              <td style={tdStyle}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Action</span>
              </td>
              {models.map(m => (
                <td key={m.model_key} style={{ ...tdStyle, textAlign: 'center' }}>
                  <button
                    onClick={() => onSelectForTraining?.(m.model_key)}
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '6px 14px', borderRadius: 8 }}
                  >
                    Select <ArrowRight size={12} />
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: 13,
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border)',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px',
  borderBottom: '1px solid var(--border-light)',
  verticalAlign: 'middle',
};
