'use client';

import { ArrowLeft, ArrowRight, Trophy, Star, CheckCircle, XCircle, Brain } from 'lucide-react';

interface DatasetResult {
  name: string;
  source: string;
  dataset_type: string;
  size: string;
  samples: number;
  classes: number;
  quality_score: number;
  difficulty: string;
  recommended_models: string[];
  estimated_training_time: string;
  hardware_requirements: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  [key: string]: any;
}

interface Props {
  datasetA: DatasetResult;
  datasetB: DatasetResult;
  onSelect: (dataset: DatasetResult) => void;
  onBack: () => void;
}

export default function DatasetComparison({ datasetA, datasetB, onSelect, onBack }: Props) {
  const scoreA = datasetA.quality_score || 0;
  const scoreB = datasetB.quality_score || 0;
  const samplesA = datasetA.samples || 0;
  const samplesB = datasetB.samples || 0;

  const winner = scoreA > scoreB + 5 ? 'A' : scoreB > scoreA + 5 ? 'B' : 'tie';

  const verdict = winner === 'A'
    ? `${datasetA.name} is recommended — it has a higher quality score and is better suited for production.`
    : winner === 'B'
      ? `${datasetB.name} is recommended — it has a higher quality score and is better suited for production.`
      : `Both datasets are comparable. Choose based on your priorities — ${samplesA > samplesB ? datasetA.name + ' has more data' : datasetB.name + ' has more data'}.`;

  const ROWS = [
    { label: 'Type', a: datasetA.dataset_type, b: datasetB.dataset_type },
    { label: 'Samples', a: samplesA.toLocaleString(), b: samplesB.toLocaleString(), winA: samplesA > samplesB, winB: samplesB > samplesA },
    { label: 'Classes', a: String(datasetA.classes), b: String(datasetB.classes) },
    { label: 'Size', a: datasetA.size, b: datasetB.size },
    { label: 'Quality Score', a: `${scoreA}/100`, b: `${scoreB}/100`, winA: scoreA > scoreB, winB: scoreB > scoreA },
    { label: 'Difficulty', a: datasetA.difficulty, b: datasetB.difficulty },
    { label: 'Training Time', a: datasetA.estimated_training_time, b: datasetB.estimated_training_time },
    { label: 'Hardware', a: datasetA.hardware_requirements, b: datasetB.hardware_requirements },
  ];

  return (
    <div className="pipeline-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '24px 28px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Trophy size={20} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Dataset Comparison
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Comparing {datasetA.name} vs {datasetB.name}
          </p>
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: '20%' }}>Metric</th>
              <th style={{
                ...thStyle, width: '40%', textAlign: 'center',
                background: winner === 'A' ? 'var(--color-success-subtle)' : undefined,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{datasetA.name}</span>
                  {winner === 'A' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)' }}>👑 Recommended</span>}
                </div>
              </th>
              <th style={{
                ...thStyle, width: '40%', textAlign: 'center',
                background: winner === 'B' ? 'var(--color-success-subtle)' : undefined,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{datasetB.name}</span>
                  {winner === 'B' && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)' }}>👑 Recommended</span>}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.label}>
                <td style={tdStyle}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{row.label}</span>
                </td>
                <td style={{
                  ...tdStyle, textAlign: 'center',
                  background: winner === 'A' ? 'var(--color-success-subtle)' : undefined,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: row.winA ? 700 : 500,
                    color: row.winA ? '#22C55E' : 'var(--text-primary)',
                  }}>
                    {row.winA && '🏆 '}{row.a}
                  </span>
                </td>
                <td style={{
                  ...tdStyle, textAlign: 'center',
                  background: winner === 'B' ? 'var(--color-success-subtle)' : undefined,
                }}>
                  <span style={{
                    fontSize: 13, fontWeight: row.winB ? 700 : 500,
                    color: row.winB ? '#22C55E' : 'var(--text-primary)',
                  }}>
                    {row.winB && '🏆 '}{row.b}
                  </span>
                </td>
              </tr>
            ))}

            {/* Advantages Row */}
            <tr>
              <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 600, color: '#22C55E' }}>Advantages</span></td>
              <td style={{ ...tdStyle, background: winner === 'A' ? 'var(--color-success-subtle)' : undefined }}>
                {datasetA.advantages?.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-success)', marginBottom: 4 }}>
                    <CheckCircle size={11} /> {a}
                  </div>
                ))}
              </td>
              <td style={{ ...tdStyle, background: winner === 'B' ? 'var(--color-success-subtle)' : undefined }}>
                {datasetB.advantages?.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-success)', marginBottom: 4 }}>
                    <CheckCircle size={11} /> {a}
                  </div>
                ))}
              </td>
            </tr>

            {/* Disadvantages Row */}
            <tr>
              <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-error)' }}>Disadvantages</span></td>
              <td style={{ ...tdStyle, background: winner === 'A' ? 'var(--color-success-subtle)' : undefined }}>
                {datasetA.disadvantages?.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-error)', marginBottom: 4 }}>
                    <XCircle size={11} /> {d}
                  </div>
                ))}
              </td>
              <td style={{ ...tdStyle, background: winner === 'B' ? 'var(--color-success-subtle)' : undefined }}>
                {datasetB.disadvantages?.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-error)', marginBottom: 4 }}>
                    <XCircle size={11} /> {d}
                  </div>
                ))}
              </td>
            </tr>

            {/* Recommended Models Row */}
            <tr>
              <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>Models</span></td>
              <td style={{ ...tdStyle, background: winner === 'A' ? 'var(--color-success-subtle)' : undefined }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {datasetA.recommended_models?.map((m, i) => (
                    <span key={i} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{m}</span>
                  ))}
                </div>
              </td>
              <td style={{ ...tdStyle, background: winner === 'B' ? 'var(--color-success-subtle)' : undefined }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {datasetB.recommended_models?.map((m, i) => (
                    <span key={i} style={{ padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{m}</span>
                  ))}
                </div>
              </td>
            </tr>

            {/* Select Row */}
            <tr>
              <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 700 }}>Action</span></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button className="btn-primary" onClick={() => onSelect(datasetA)} style={{ fontSize: 12, gap: 6 }}>
                  Select & Import <ArrowRight size={14} />
                </button>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <button className="btn-primary" onClick={() => onSelect(datasetB)} style={{ fontSize: 12, gap: 6 }}>
                  Select & Import <ArrowRight size={14} />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AI Verdict */}
      <div style={{
        background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary-glow)',
        borderRadius: 'var(--radius-lg)', padding: '16px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
      }}>
        <Brain size={18} color="var(--color-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 4 }}>AI Recommendation</p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{verdict}</p>
        </div>
      </div>

      <button className="btn-secondary" onClick={onBack} style={{ alignSelf: 'flex-start', gap: 6 }}>
        <ArrowLeft size={16} /> Back to Results
      </button>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '16px', fontSize: 13, color: 'var(--text-primary)',
  borderBottom: '2px solid var(--border)', fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid var(--border-light)',
  verticalAlign: 'middle',
};
