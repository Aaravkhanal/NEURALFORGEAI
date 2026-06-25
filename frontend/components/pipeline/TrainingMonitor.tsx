'use client';

import { useState } from 'react';
import { Activity, Clock, Cpu, HardDrive, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface TrainingMetrics {
  epoch: number;
  total_epochs: number;
  train_loss: number;
  val_loss: number;
  train_acc: number;
  val_acc: number;
}

interface Props {
  jobId?: string;
  modelName: string;
  isActive: boolean;
  onComplete?: (results: any) => void;
}

export default function TrainingMonitor({ jobId, modelName, isActive, onComplete }: Props) {
  const [metrics, setMetrics] = useState<TrainingMetrics[]>([]);
  const [status, setStatus] = useState<'queued' | 'training' | 'completed' | 'failed'>('queued');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Simulated training data for demo when no real job is running
  const demoMetrics: TrainingMetrics[] = [
    { epoch: 1, total_epochs: 10, train_loss: 2.45, val_loss: 2.38, train_acc: 32.1, val_acc: 34.5 },
    { epoch: 2, total_epochs: 10, train_loss: 1.82, val_loss: 1.76, train_acc: 48.3, val_acc: 51.2 },
    { epoch: 3, total_epochs: 10, train_loss: 1.34, val_loss: 1.41, train_acc: 61.7, val_acc: 59.8 },
    { epoch: 4, total_epochs: 10, train_loss: 0.98, val_loss: 1.12, train_acc: 72.4, val_acc: 68.3 },
    { epoch: 5, total_epochs: 10, train_loss: 0.72, val_loss: 0.89, train_acc: 79.6, val_acc: 75.1 },
    { epoch: 6, total_epochs: 10, train_loss: 0.54, val_loss: 0.78, train_acc: 84.2, val_acc: 79.7 },
    { epoch: 7, total_epochs: 10, train_loss: 0.41, val_loss: 0.71, train_acc: 87.8, val_acc: 82.4 },
    { epoch: 8, total_epochs: 10, train_loss: 0.32, val_loss: 0.68, train_acc: 90.1, val_acc: 84.6 },
    { epoch: 9, total_epochs: 10, train_loss: 0.25, val_loss: 0.66, train_acc: 92.3, val_acc: 85.8 },
    { epoch: 10, total_epochs: 10, train_loss: 0.20, val_loss: 0.65, train_acc: 93.7, val_acc: 86.2 },
  ];

  const displayMetrics = metrics.length > 0 ? metrics : demoMetrics;
  const latestMetric = displayMetrics[displayMetrics.length - 1];
  const displayProgress = metrics.length > 0 ? progress : 100;
  const displayStatus = metrics.length > 0 ? status : 'completed';

  const maxLoss = Math.max(...displayMetrics.map(m => Math.max(m.train_loss, m.val_loss)));
  const chartH = 120;
  const chartW = 100;

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
          background: displayStatus === 'training' ? 'var(--color-warning-subtle)' :
                     displayStatus === 'completed' ? 'var(--color-success-subtle)' :
                     displayStatus === 'failed' ? 'var(--color-error-subtle)' : 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {displayStatus === 'training' ? <Loader2 size={18} className="spin" color="var(--color-warning)" /> :
           displayStatus === 'completed' ? <CheckCircle size={18} color="var(--color-success)" /> :
           displayStatus === 'failed' ? <XCircle size={18} color="var(--color-error)" /> :
           <Clock size={18} color="var(--text-muted)" />}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Training Monitor — {modelName}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {displayStatus === 'training' ? 'Training in progress...' :
             displayStatus === 'completed' ? 'Training completed successfully!' :
             displayStatus === 'failed' ? 'Training failed' : 'Waiting in queue...'}
          </p>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
          background: displayStatus === 'completed' ? 'var(--color-success-subtle)' : 'var(--bg-surface)',
          color: displayStatus === 'completed' ? 'var(--color-success)' : 'var(--text-muted)',
        }}>
          {displayStatus === 'completed' ? 'Done' : `${Math.round(displayProgress)}%`}
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ padding: '0 24px', marginTop: 16 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--border-light)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${displayProgress}%`,
            background: displayStatus === 'completed'
              ? 'linear-gradient(90deg, #22C55E, #34D399)'
              : 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Epoch {latestMetric.epoch}/{latestMetric.total_epochs}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {metrics.length > 0 ? `${elapsed}s elapsed` : 'Demo data shown'}
          </span>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
        padding: '20px 24px',
      }}>
        <MetricCard label="Train Loss" value={latestMetric.train_loss.toFixed(3)} color="var(--color-error)" />
        <MetricCard label="Val Loss" value={latestMetric.val_loss.toFixed(3)} color="var(--color-warning)" />
        <MetricCard label="Train Acc" value={`${latestMetric.train_acc.toFixed(1)}%`} color="var(--color-info)" />
        <MetricCard label="Val Acc" value={`${latestMetric.val_acc.toFixed(1)}%`} color="var(--color-success)" />
      </div>

      {/* Mini Loss Chart */}
      <div style={{ padding: '0 24px 24px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          Loss Over Epochs
        </p>
        <div style={{
          height: chartH + 20, background: 'var(--bg-surface)', borderRadius: 12,
          border: '1px solid var(--border-light)', padding: '10px 16px',
          position: 'relative', overflow: 'hidden',
        }}>
          <svg width="100%" height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
            {/* Train loss line */}
            <polyline
              fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              points={displayMetrics.map((m, i) =>
                `${(i / (displayMetrics.length - 1)) * chartW},${chartH - (m.train_loss / maxLoss) * (chartH - 10)}`
              ).join(' ')}
            />
            {/* Val loss line */}
            <polyline
              fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3"
              points={displayMetrics.map((m, i) =>
                `${(i / (displayMetrics.length - 1)) * chartW},${chartH - (m.val_loss / maxLoss) * (chartH - 10)}`
              ).join(' ')}
            />
          </svg>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--color-error)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Train Loss</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 12, height: 3, borderRadius: 2, background: 'var(--color-warning)', opacity: 0.7 }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Val Loss</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px', borderRadius: 12,
      background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 800, color, fontFamily: 'var(--font-heading)' }}>
        {value}
      </p>
    </div>
  );
}
