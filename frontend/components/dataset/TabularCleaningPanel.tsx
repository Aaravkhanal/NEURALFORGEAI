'use client';

import { useState } from 'react';
import {
  Eraser, Trash2, Copy, Type, Hash, Code, Tag, Play,
  CheckCircle, AlertTriangle, Loader2,
} from 'lucide-react';
import api from '@/lib/api';

interface Props {
  fileId: string;
  profile: any;
  onCleaningComplete?: (result: any) => void;
}

export default function TabularCleaningPanel({ fileId, profile, onCleaningComplete }: Props) {
  const [selectedOps, setSelectedOps] = useState<any[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const columns = profile?.columns || [];
  const missingCols = Object.keys(profile?.missing_values || {});
  const outlierCols = Object.keys(profile?.outliers || {});
  const hasDuplicates = (profile?.duplicate_info?.count || 0) > 0;

  const addOp = (op: any) => {
    setSelectedOps(prev => [...prev, { ...op, id: Date.now() + Math.random() }]);
  };

  const removeOp = (id: number) => {
    setSelectedOps(prev => prev.filter(op => op.id !== id));
  };

  const handleClean = async () => {
    if (selectedOps.length === 0) return;
    setIsCleaning(true);
    try {
      const ops = selectedOps.map(({ id, ...rest }) => rest);
      const result = await api.post(`/api/cleaning/apply/${fileId}`, ops);
      setResults(result);
      onCleaningComplete?.(result);
    } catch (err: any) {
      setResults({ success: false, error: err.message });
    } finally {
      setIsCleaning(false);
    }
  };

  const quickActions = [
    ...(hasDuplicates ? [{ label: 'Remove Duplicates', icon: Copy, op: { type: 'drop_duplicates' }, color: '#F59E0B' }] : []),
    ...missingCols.slice(0, 3).map(col => ({
      label: `Impute ${col}`,
      icon: Eraser,
      op: { type: 'impute', column: col, strategy: 'mean' },
      color: '#3B82F6',
    })),
    ...outlierCols.slice(0, 3).map(col => ({
      label: `Fix outliers: ${col}`,
      icon: Hash,
      op: { type: 'handle_outliers', column: col, method: 'iqr', action: 'clip' },
      color: '#8B5CF6',
    })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Tabular Data Cleaning
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {profile?.row_count} rows × {profile?.column_count} columns
        </p>
      </div>

      {/* Quick actions */}
      {quickActions.length > 0 && (
        <div className="card-flat">
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Recommended Actions</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {quickActions.map((qa, i) => (
              <button
                key={i}
                className="btn-secondary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => addOp(qa.op)}
              >
                <qa.icon size={12} /> {qa.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Manual operation builder */}
      <div className="card-flat">
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Add Operation</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {[
            { type: 'impute', label: 'Impute Missing', icon: Eraser, needsCol: true },
            { type: 'drop_column', label: 'Drop Column', icon: Trash2, needsCol: true },
            { type: 'drop_rows', label: 'Drop Null Rows', icon: Trash2, needsCol: true },
            { type: 'drop_duplicates', label: 'Drop Duplicates', icon: Copy, needsCol: false },
            { type: 'handle_outliers', label: 'Handle Outliers', icon: Hash, needsCol: true },
            { type: 'encode_label', label: 'Label Encode', icon: Tag, needsCol: true },
            { type: 'encode_onehot', label: 'One-Hot Encode', icon: Code, needsCol: true },
            { type: 'scale_standard', label: 'Standard Scale', icon: Hash, needsCol: true },
            { type: 'scale_minmax', label: 'Min-Max Scale', icon: Hash, needsCol: true },
          ].map(opType => (
            <OperationButton
              key={opType.type}
              opType={opType}
              columns={columns}
              onAdd={addOp}
            />
          ))}
        </div>
      </div>

      {/* Pipeline queue */}
      {selectedOps.length > 0 && (
        <div className="card-flat">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Pipeline ({selectedOps.length} operations)
            </h4>
            <button
              onClick={() => setSelectedOps([])}
              style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear All
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {selectedOps.map((op, i) => (
              <div key={op.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-base)', border: '1px solid var(--border-light)',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', width: 20 }}>{i + 1}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                  {op.type.replace(/_/g, ' ')}
                  {op.column && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> → {op.column}</span>}
                  {op.strategy && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> ({op.strategy})</span>}
                </span>
                <button
                  onClick={() => removeOp(op.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execute */}
      <button
        className="btn-primary"
        onClick={handleClean}
        disabled={isCleaning || selectedOps.length === 0}
      >
        {isCleaning ? (
          <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Cleaning...</>
        ) : (
          <><Play size={16} /> Apply Pipeline ({selectedOps.length} ops)</>
        )}
      </button>

      {/* Results */}
      {results && (
        <div className="card-flat" style={{
          background: results.success ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          border: `1px solid ${results.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {results.success ? <CheckCircle size={18} color="#22C55E" /> : <AlertTriangle size={18} color="#EF4444" />}
            <span style={{ fontSize: 14, fontWeight: 600, color: results.success ? '#22C55E' : '#EF4444' }}>
              {results.success ? 'Dataset Cleaned Successfully' : results.error || 'Cleaning Failed'}
            </span>
          </div>
          {results.report?.operations_applied?.map((op: any, i: number) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {op.status === 'success' ? '✓' : '✗'} {op.detail || op.type}
            </p>
          ))}
          {results.rows !== undefined && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>
              Output: {results.rows?.toLocaleString()} rows × {results.columns} columns
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function OperationButton({ opType, columns, onAdd }: { opType: any; columns: any[]; onAdd: (op: any) => void }) {
  const [showCols, setShowCols] = useState(false);
  const [strategy, setStrategy] = useState('mean');

  if (!opType.needsCol) {
    return (
      <button
        className="btn-secondary"
        style={{ fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start' }}
        onClick={() => onAdd({ type: opType.type })}
      >
        <opType.icon size={12} /> {opType.label}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn-secondary"
        style={{ fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start', width: '100%' }}
        onClick={() => setShowCols(!showCols)}
      >
        <opType.icon size={12} /> {opType.label}
      </button>
      {showCols && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 200, overflow: 'auto', marginTop: 4,
        }}>
          {opType.type === 'impute' && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 4 }}>
              {['mean', 'median', 'mode', 'zero'].map(s => (
                <button
                  key={s}
                  onClick={() => setStrategy(s)}
                  style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none',
                    background: strategy === s ? 'var(--color-primary-subtle)' : 'transparent',
                    color: strategy === s ? 'var(--color-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', fontWeight: 600, textTransform: 'capitalize',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {columns.map((col: any) => (
            <button
              key={col.name}
              onClick={() => {
                onAdd({
                  type: opType.type,
                  column: col.name,
                  ...(opType.type === 'impute' ? { strategy } : {}),
                  ...(opType.type === 'handle_outliers' ? { method: 'iqr', action: 'clip' } : {}),
                });
                setShowCols(false);
              }}
              style={{
                display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                color: 'var(--text-primary)', transition: 'background 0.1s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-primary-subtle)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              {col.name} <span style={{ color: 'var(--text-muted)' }}>({col.dtype})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
