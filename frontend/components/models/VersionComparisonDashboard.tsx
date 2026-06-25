'use client';

import { SplitSquareHorizontal, CheckCircle, XCircle } from 'lucide-react';

interface ModelVersion {
  id: string;
  version: number;
  model_name: string;
  epoch: number;
  status: string;
  metrics: any;
}

interface Props {
  versions: ModelVersion[];
}

export default function VersionComparisonDashboard({ versions }: Props) {
  if (versions.length < 2) return null;

  const vA = versions[0];
  const vB = versions[1];

  const getWinner = (valA: number, valB: number, higherIsBetter: boolean) => {
    if (valA === valB) return 'tie';
    if (higherIsBetter) return valA > valB ? 'A' : 'B';
    return valA < valB ? 'A' : 'B';
  };

  const metrics = [
    { label: 'Accuracy', key: 'accuracy', higherIsBetter: true, format: (v: number) => `${v.toFixed(1)}%` },
    { label: 'Validation Accuracy', key: 'val_accuracy', higherIsBetter: true, format: (v: number) => `${v.toFixed(1)}%` },
    { label: 'Validation Loss', key: 'val_loss', higherIsBetter: false, format: (v: number) => v.toFixed(4) },
    { label: 'F1 Score', key: 'val_f1', higherIsBetter: true, format: (v: number) => v.toFixed(2) },
  ];

  return (
    <div className="pipeline-step-enter" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SplitSquareHorizontal size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Version Comparison</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Comparing v{vA.version} and v{vB.version}</p>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, width: '30%' }}>Metric</th>
            <th style={{ ...thStyle, width: '35%', textAlign: 'center' }}>Version {vA.version}</th>
            <th style={{ ...thStyle, width: '35%', textAlign: 'center' }}>Version {vB.version}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map(m => {
            const valA = vA.metrics[m.key] || vA.metrics[m.key.replace('val_', '')] || 0;
            const valB = vB.metrics[m.key] || vB.metrics[m.key.replace('val_', '')] || 0;
            const winner = getWinner(valA, valB, m.higherIsBetter);

            return (
              <tr key={m.key}>
                <td style={tdStyle}><span style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</span></td>
                <td style={{ ...tdStyle, textAlign: 'center', background: winner === 'A' ? 'var(--color-success-subtle)' : undefined }}>
                  <span style={{ fontSize: 13, fontWeight: winner === 'A' ? 700 : 500, color: winner === 'A' ? '#22C55E' : 'var(--text-primary)' }}>
                    {m.format(valA)}
                  </span>
                </td>
                <td style={{ ...tdStyle, textAlign: 'center', background: winner === 'B' ? 'var(--color-success-subtle)' : undefined }}>
                  <span style={{ fontSize: 13, fontWeight: winner === 'B' ? 700 : 500, color: winner === 'B' ? '#22C55E' : 'var(--text-primary)' }}>
                    {m.format(valB)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '16px', fontSize: 13, color: 'var(--text-primary)', borderBottom: '2px solid var(--border)', fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };
