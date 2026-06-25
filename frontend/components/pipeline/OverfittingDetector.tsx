'use client';

import { AlertTriangle, TrendingDown, PauseCircle, Settings2, XCircle } from 'lucide-react';

interface Alert {
  type: 'overfitting' | 'plateau' | 'underfitting';
  severity: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  actions: string[];
}

interface Props {
  alerts: Alert[];
  onActionClick: (action: string) => void;
  onDismiss?: (index: number) => void;
}

export default function OverfittingDetector({ alerts, onActionClick, onDismiss }: Props) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {alerts.map((alert, idx) => {
        const isHigh = alert.severity === 'high';
        const color = isHigh ? 'var(--color-error)' : 'var(--color-warning)';
        const bg = isHigh ? 'var(--color-error-subtle)' : 'var(--color-warning-subtle)';
        
        return (
          <div key={idx} className="pipeline-step-enter" style={{
            background: bg, border: `1px solid ${color}`, borderRadius: 'var(--radius-lg)',
            padding: '16px 20px', display: 'flex', gap: 16, position: 'relative'
          }}>
            <div style={{ marginTop: 2 }}>
              {alert.type === 'overfitting' ? <AlertTriangle size={24} color={color} /> :
               alert.type === 'underfitting' ? <TrendingDown size={24} color={color} /> :
               <PauseCircle size={24} color={color} />}
            </div>
            
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                {alert.title}
              </h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 12 }}>
                {alert.message}
              </p>
              
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {alert.actions.map((action, ai) => (
                  <button
                    key={ai}
                    onClick={() => onActionClick(action)}
                    style={{
                      padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      background: 'var(--bg-card)', border: `1px solid ${color}`, color: color,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            {onDismiss && (
              <button
                onClick={() => onDismiss(idx)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <XCircle size={16} color="var(--text-muted)" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
