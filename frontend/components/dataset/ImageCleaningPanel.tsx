'use client';

import { useState } from 'react';
import {
  Trash2, Copy, Eye, Image, Maximize, Palette, Scale, Loader2,
  CheckCircle, AlertTriangle, Play, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';

interface Props {
  fileId: string;
  imageMetadata: any;
  onCleaningComplete?: (result: any) => void;
}

export default function ImageCleaningPanel({ fileId, imageMetadata, onCleaningComplete }: Props) {
  const [isCleaning, setIsCleaning] = useState(false);
  const [selectedOps, setSelectedOps] = useState<Set<string>>(new Set());
  const [resizeWidth, setResizeWidth] = useState(224);
  const [resizeHeight, setResizeHeight] = useState(224);
  const [targetFormat, setTargetFormat] = useState('png');
  const [dupThreshold, setDupThreshold] = useState(5);
  const [results, setResults] = useState<any>(null);

  const toggleOp = (op: string) => {
    const next = new Set(selectedOps);
    next.has(op) ? next.delete(op) : next.add(op);
    setSelectedOps(next);
  };

  const operations = [
    { id: 'remove_corrupt', label: 'Remove Corrupt Images', desc: 'Detect and remove broken/incomplete image files', icon: Trash2, color: '#EF4444', count: imageMetadata?.corrupt_images?.length || 0 },
    { id: 'remove_duplicates', label: 'Remove Duplicates', desc: 'Remove near-duplicate images using perceptual hashing', icon: Copy, color: '#F59E0B', count: imageMetadata?.duplicate_groups?.length || 0 },
    { id: 'filter_quality', label: 'Quality Filtering', desc: 'Remove blurry, overexposed, and underexposed images', icon: Eye, color: '#8B5CF6', count: 0 },
    { id: 'resize_all', label: 'Resize Images', desc: `Standardize all images to ${resizeWidth}×${resizeHeight}px`, icon: Maximize, color: '#3B82F6', count: null },
    { id: 'convert_format', label: 'Convert Format', desc: `Convert all images to .${targetFormat}`, icon: Palette, color: '#22C55E', count: null },
  ];

  const handleClean = async () => {
    if (selectedOps.size === 0) return;
    setIsCleaning(true);

    const ops: any[] = [];
    if (selectedOps.has('remove_corrupt')) ops.push({ type: 'remove_corrupt' });
    if (selectedOps.has('remove_duplicates')) ops.push({ type: 'remove_duplicates', threshold: dupThreshold });
    if (selectedOps.has('filter_quality')) ops.push({ type: 'filter_quality', remove_blurry: true, remove_overexposed: true, remove_underexposed: true, remove_low_resolution: true });
    if (selectedOps.has('resize_all')) ops.push({ type: 'resize_all', width: resizeWidth, height: resizeHeight });
    if (selectedOps.has('convert_format')) ops.push({ type: 'convert_format', target_format: targetFormat });

    try {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Image Cleaning</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Select operations to apply to your image dataset</p>
        </div>
        <span className="badge badge-primary">
          {imageMetadata?.total_images || 0} images
        </span>
      </div>

      {/* Operation cards */}
      {operations.map(op => (
        <div key={op.id}>
          <div
            onClick={() => toggleOp(op.id)}
            className="card-flat"
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
              border: selectedOps.has(op.id) ? `2px solid ${op.color}` : '1px solid var(--border)',
              padding: '16px 20px',
              background: selectedOps.has(op.id) ? `${op.color}08` : 'var(--bg-card)',
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 'var(--radius-md)',
              background: `${op.color}15`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <op.icon size={20} color={op.color} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{op.label}</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{op.desc}</p>
            </div>
            {op.count !== null && op.count > 0 && (
              <span className="badge badge-warning">{op.count} found</span>
            )}
            <div className={`toggle ${selectedOps.has(op.id) ? 'active' : ''}`} />
          </div>

          {/* Resize options */}
          {op.id === 'resize_all' && selectedOps.has('resize_all') && (
            <div style={{ padding: '12px 20px 12px 78px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Size:</span>
              {[
                { w: 224, h: 224 }, { w: 256, h: 256 }, { w: 512, h: 512 },
              ].map(s => (
                <button
                  key={`${s.w}x${s.h}`}
                  onClick={() => { setResizeWidth(s.w); setResizeHeight(s.h); }}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: resizeWidth === s.w ? '1px solid var(--color-primary)' : '1px solid var(--border)',
                    background: resizeWidth === s.w ? 'var(--color-primary-subtle)' : 'transparent',
                    color: resizeWidth === s.w ? 'var(--color-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  {s.w}×{s.h}
                </button>
              ))}
            </div>
          )}

          {/* Format options */}
          {op.id === 'convert_format' && selectedOps.has('convert_format') && (
            <div style={{ padding: '12px 20px 12px 78px', display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Format:</span>
              {['png', 'jpg', 'webp'].map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setTargetFormat(fmt)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: targetFormat === fmt ? '1px solid var(--color-primary)' : '1px solid var(--border)',
                    background: targetFormat === fmt ? 'var(--color-primary-subtle)' : 'transparent',
                    color: targetFormat === fmt ? 'var(--color-primary)' : 'var(--text-muted)',
                    cursor: 'pointer', textTransform: 'uppercase',
                  }}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <button
          className="btn-primary"
          onClick={handleClean}
          disabled={isCleaning || selectedOps.size === 0}
          style={{ flex: 1 }}
        >
          {isCleaning ? (
            <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Cleaning...</>
          ) : (
            <><Play size={16} /> Apply {selectedOps.size} Operation{selectedOps.size !== 1 ? 's' : ''}</>
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="card-flat" style={{
          background: results.success ? 'rgba(34, 197, 94, 0.05)' : 'rgba(239, 68, 68, 0.05)',
          border: `1px solid ${results.success ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          padding: '16px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {results.success ? <CheckCircle size={18} color="#22C55E" /> : <AlertTriangle size={18} color="#EF4444" />}
            <span style={{ fontSize: 14, fontWeight: 600, color: results.success ? '#22C55E' : '#EF4444' }}>
              {results.success ? 'Cleaning Complete' : 'Cleaning Failed'}
            </span>
          </div>
          {results.report?.operations_applied?.map((op: any, i: number) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {op.status === 'success' ? '✓' : '✗'} {op.detail || op.type}
            </p>
          ))}
          {results.remaining_images !== undefined && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginTop: 8 }}>
              {results.remaining_images} images remaining
            </p>
          )}
        </div>
      )}
    </div>
  );
}
