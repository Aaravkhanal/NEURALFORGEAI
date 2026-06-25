'use client';

import { RotateCcw, GitMerge, Settings, Play, GitBranch } from 'lucide-react';

export default function IterativeTraining() {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <RotateCcw size={20} color="var(--color-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Iterative Training & Branching</h3>
      </div>
      
      <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <Play size={20} color="var(--color-success)" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Continue Training</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Resume from the current best checkpoint to improve accuracy.</p>
        </div>

        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <GitBranch size={20} color="#8B5CF6" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Branch Model</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Create a new training branch to experiment with different hyperparameters without losing progress.</p>
        </div>

        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <Settings size={20} color="var(--color-warning)" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Fine-Tune</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Adjust learning rate or unfreeze layers for the final epochs.</p>
        </div>

        <div style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s' }}>
          <GitMerge size={20} color="var(--color-info)" style={{ marginBottom: 12 }} />
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Transfer Learning</h4>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Use these weights as a base for a completely new dataset.</p>
        </div>
      </div>
    </div>
  );
}
