'use client';

import { useState } from 'react';
import {
  Type, Trash2, Copy, Code, Hash, Tag, Play,
  CheckCircle, AlertTriangle, CaseSensitive,
} from 'lucide-react';
import api from '@/lib/api';

interface Props {
  fileId: string;
  profile: any;
  onCleaningComplete?: (result: any) => void;
}

export default function TextCleaningPanel({ fileId, profile, onCleaningComplete }: Props) {
  const [selectedOps, setSelectedOps] = useState<any[]>([]);
  const [isCleaning, setIsCleaning] = useState(false);
  const [results, setResults] = useState<any>(null);

  const columns = profile?.columns || [];
  const textCols = columns.filter((c: any) => c.dtype === 'object' || c.avg_length > 10);
  const missingCols = Object.keys(profile?.missing_values || {});
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
          Text Data Cleaning
        </h3>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {profile?.row_count} rows × {profile?.column_count} columns
        </p>
      </div>

      {/* Quick actions */}
      <div className="card-flat">
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Quick Actions</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {hasDuplicates && (
            <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => addOp({ type: 'drop_duplicates' })}>
              <Copy size={12} /> Remove Duplicates
            </button>
          )}
          {missingCols.length > 0 && (
            <button className="btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => addOp({ type: 'drop_missing' })}>
              <Trash2 size={12} /> Drop Missing Rows
            </button>
          )}
          {textCols.slice(0, 3).map((col: any) => (
            <button key={`norm-${col.name}`} className="btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => addOp({ type: 'normalize_text', column: col.name })}>
              <CaseSensitive size={12} /> Normalize: {col.name}
            </button>
          ))}
          {textCols.slice(0, 2).map((col: any) => (
            <button key={`stop-${col.name}`} className="btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }} onClick={() => addOp({ type: 'remove_stopwords', column: col.name })}>
              <Type size={12} /> Remove Stopwords: {col.name}
            </button>
          ))}
        </div>
      </div>

      {/* Operation builder */}
      <div className="card-flat">
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Add Operation</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {[
            { type: 'drop_duplicates', label: 'Drop Duplicates', icon: Copy, needsCol: false },
            { type: 'drop_missing', label: 'Drop Missing', icon: Trash2, needsCol: false },
            { type: 'normalize_text', label: 'Normalize Text', icon: CaseSensitive, needsCol: true },
            { type: 'remove_stopwords', label: 'Remove Stopwords', icon: Type, needsCol: true },
            { type: 'remove_punctuation', label: 'Remove Punct.', icon: Hash, needsCol: true },
            { type: 'fix_encoding', label: 'Fix Encoding', icon: Code, needsCol: true },
            { type: 'check_label_consistency', label: 'Normalize Labels', icon: Tag, needsCol: true },
          ].map(opDef => (
            <TextOpButton key={opDef.type} opDef={opDef} columns={columns} onAdd={addOp} />
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
            <button onClick={() => setSelectedOps([])} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
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
                </span>
                <button onClick={() => removeOp(op.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execute */}
      <button className="btn-primary" onClick={handleClean} disabled={isCleaning || selectedOps.length === 0}>
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
              {results.success ? 'Text Cleaning Complete' : results.error || 'Cleaning Failed'}
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

function TextOpButton({ opDef, columns, onAdd }: { opDef: any; columns: any[]; onAdd: (op: any) => void }) {
  const [showCols, setShowCols] = useState(false);

  if (!opDef.needsCol) {
    return (
      <button
        className="btn-secondary"
        style={{ fontSize: 12, padding: '8px 12px', justifyContent: 'flex-start' }}
        onClick={() => onAdd({ type: opDef.type })}
      >
        <opDef.icon size={12} /> {opDef.label}
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
        <opDef.icon size={12} /> {opDef.label}
      </button>
      {showCols && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 200, overflow: 'auto', marginTop: 4,
        }}>
          {columns.map((col: any) => (
            <button
              key={col.name}
              onClick={() => { onAdd({ type: opDef.type, column: col.name }); setShowCols(false); }}
              style={{
                display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
                color: 'var(--text-primary)',
              }}
              onMouseOver={e => (e.currentTarget.style.background = 'var(--color-primary-subtle)')}
              onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
            >
              {col.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
