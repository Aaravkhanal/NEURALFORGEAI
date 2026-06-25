'use client';

import { LineChart, Activity } from 'lucide-react';

interface Props {
  performanceData: {
    versions: string[];
    metrics: {
      accuracy: number[];
      val_loss: number[];
    };
  } | null;
}

export default function ModelPerformanceTracker({ performanceData }: Props) {
  if (!performanceData || performanceData.versions.length === 0) return null;

  const { versions, metrics } = performanceData;
  const maxAcc = Math.max(...metrics.accuracy, 100);
  const maxLoss = Math.max(...metrics.val_loss, 2);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={18} color="var(--color-primary)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Performance Evolution</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Accuracy and Loss across all versions</p>
        </div>
      </div>

      <div style={{ padding: 24, display: 'flex', gap: 24 }}>
        {/* Accuracy Chart */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>Accuracy (%)</h4>
          <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-light)', padding: '10px 0', position: 'relative' }}>
            <svg width="100%" height="100" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <polyline fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                points={metrics.accuracy.map((val, i) => `${(i / Math.max(1, versions.length - 1)) * 100},${100 - (val / maxAcc) * 100}`).join(' ')} 
              />
              {metrics.accuracy.map((val, i) => (
                <circle key={i} cx={(i / Math.max(1, versions.length - 1)) * 100} cy={100 - (val / maxAcc) * 100} r="3" fill="var(--color-success)" stroke="var(--bg-surface)" strokeWidth="1.5" />
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {versions.map((v, i) => <span key={i} style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v}</span>)}
          </div>
        </div>

        {/* Loss Chart */}
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>Validation Loss</h4>
          <div style={{ height: 120, background: 'var(--bg-surface)', borderRadius: 12, border: '1px solid var(--border-light)', padding: '10px 0', position: 'relative' }}>
            <svg width="100%" height="100" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
              <polyline fill="none" stroke="var(--color-error)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                points={metrics.val_loss.map((val, i) => `${(i / Math.max(1, versions.length - 1)) * 100},${100 - (val / maxLoss) * 100}`).join(' ')} 
              />
              {metrics.val_loss.map((val, i) => (
                <circle key={i} cx={(i / Math.max(1, versions.length - 1)) * 100} cy={100 - (val / maxLoss) * 100} r="3" fill="var(--color-error)" stroke="var(--bg-surface)" strokeWidth="1.5" />
              ))}
            </svg>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            {versions.map((v, i) => <span key={i} style={{ fontSize: 10, color: 'var(--text-muted)' }}>{v}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
