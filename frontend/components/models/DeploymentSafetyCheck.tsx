'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface Recommendation {
  recommended_version: number;
  recommended_id: string;
  reason: string;
}

interface Props {
  currentVersion: number;
  recommendation: Recommendation | null;
  onProceedAnyway: () => void;
  onDeployRecommended: () => void;
}

export default function DeploymentSafetyCheck({ currentVersion, recommendation, onProceedAnyway, onDeployRecommended }: Props) {
  if (!recommendation || recommendation.recommended_version === currentVersion) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div className="pipeline-step-enter" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 32, width: '100%', maxWidth: 500,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--color-warning-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={32} color="var(--color-warning)" />
          </div>
        </div>
        
        <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 12 }}>
          Deployment Safety Check
        </h3>
        
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
          You are attempting to deploy <strong>Version {currentVersion}</strong>. However, the AI recommends deploying <strong>Version {recommendation.recommended_version}</strong> instead because it demonstrates significantly better generalization and lower overfitting risk.
        </p>

        <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-surface)', border: '1px solid var(--border-light)', marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>AI Reason</p>
          <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>{recommendation.reason}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button className="btn-success" onClick={onDeployRecommended} style={{ justifyContent: 'center', padding: '14px' }}>
            <ShieldCheck size={18} /> Deploy Recommended Version {recommendation.recommended_version}
          </button>
          <button className="btn-secondary" onClick={onProceedAnyway} style={{ justifyContent: 'center', background: 'transparent', border: 'none' }}>
            Proceed with Version {currentVersion} Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
