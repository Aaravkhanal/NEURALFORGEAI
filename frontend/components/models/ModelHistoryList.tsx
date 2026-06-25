'use client';

import { History, GitCommit, CheckCircle, AlertTriangle, Star } from 'lucide-react';

interface ModelVersion {
  id: string;
  version: number;
  model_name: string;
  epoch: number;
  status: string;
  is_best: boolean;
  branch_name: string;
  metrics: any;
  created_at: string;
}

interface Props {
  versions: ModelVersion[];
  onSelectVersion: (id: string) => void;
  selectedIds: string[];
}

export default function ModelHistoryList({ versions, onSelectVersion, selectedIds }: Props) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <History size={18} color="var(--color-primary)" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Version History</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Select versions to compare</p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={thStyle}>Version</th>
              <th style={thStyle}>Branch</th>
              <th style={thStyle}>Epoch</th>
              <th style={thStyle}>Accuracy</th>
              <th style={thStyle}>Loss</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const isSelected = selectedIds.includes(v.id);
              return (
                <tr 
                  key={v.id} 
                  onClick={() => onSelectVersion(v.id)}
                  style={{ 
                    cursor: 'pointer',
                    background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                    borderBottom: '1px solid var(--border-light)',
                    transition: 'all 0.2s'
                  }}
                >
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={isSelected} readOnly />
                      <span style={{ fontWeight: 700 }}>v{v.version}</span>
                      {v.is_best && <Star size={12} fill="#F59E0B" color="#F59E0B" />}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4, width: 'fit-content' }}>
                      <GitCommit size={10} /> {v.branch_name}
                    </div>
                  </td>
                  <td style={tdStyle}>{v.epoch || '-'}</td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{(v.metrics?.val_accuracy || v.metrics?.accuracy || 0).toFixed(1)}%</span>
                  </td>
                  <td style={tdStyle}>
                    {(v.metrics?.val_loss || v.metrics?.loss || 0).toFixed(4)}
                  </td>
                  <td style={tdStyle}>
                    {v.status === 'Best Model' ? (
                      <span style={{ color: '#F59E0B', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><Star size={10}/> Best Model</span>
                    ) : v.status === 'Overfitted' ? (
                      <span style={{ color: 'var(--color-error)', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={10}/> Overfitted</span>
                    ) : (
                      <span style={{ color: 'var(--color-success)', fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={10}/> Stable</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: '12px 20px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase' };
const tdStyle: React.CSSProperties = { padding: '12px 20px', fontSize: 13, color: 'var(--text-primary)' };
