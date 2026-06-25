'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, Image, FileText, Table, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';

interface UploadResult {
  file: any;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  summary: any;
}

interface Props {
  projectId: string;
  onUploadComplete: (result: UploadResult) => void;
}

const ACCEPTED_FORMATS = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/json': ['.json'],
  'text/plain': ['.txt'],
  'application/zip': ['.zip'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const DATASET_TYPE_CONFIG = {
  image: { icon: Image, color: '#8B5CF6', label: 'Image Dataset', bgColor: 'rgba(139, 92, 246, 0.1)' },
  text: { icon: FileText, color: '#3B82F6', label: 'Text Dataset', bgColor: 'rgba(59, 130, 246, 0.1)' },
  tabular: { icon: Table, color: '#22C55E', label: 'Tabular Dataset', bgColor: 'rgba(34, 197, 94, 0.1)' },
};

export default function UniversalUploader({ projectId, onUploadComplete }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);
    setUploadResult(null);

    // Simulate progress for UX
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 300);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const formData = new FormData();
      formData.append('file', file);
      if (projectId) formData.append('project_id', projectId);

      const response = await fetch('/api/backend/files/upload', {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(errData.detail || `Upload failed (${response.status})`);
      }

      const result = await response.json();

      clearInterval(progressInterval);
      setProgress(100);
      setUploadResult(result);
      onUploadComplete(result);

      // Reset progress after animation
      setTimeout(() => setProgress(0), 1500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setProgress(0);
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [projectId]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  }, [projectId]);

  const resetUpload = () => {
    setUploadResult(null);
    setError(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Success state
  if (uploadResult) {
    const typeConfig = DATASET_TYPE_CONFIG[uploadResult.summary?.type as keyof typeof DATASET_TYPE_CONFIG] || DATASET_TYPE_CONFIG.tabular;
    const TypeIcon = typeConfig.icon;

    return (
      <div className="animate-fade-up" style={{ animation: 'fadeUp 0.4s ease forwards' }}>
        <div className="card-flat" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {/* Success header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'rgba(34, 197, 94, 0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}>
                <CheckCircle size={22} color="#22C55E" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                  Dataset Uploaded Successfully
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {uploadResult.file.filename}
                </p>
              </div>
            </div>
            <button onClick={resetUpload} className="btn-icon" aria-label="Reset upload">
              <X size={16} />
            </button>
          </div>

          {/* Dataset info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
            {/* Type badge */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: typeConfig.bgColor, border: `1px solid ${typeConfig.color}22`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <TypeIcon size={14} color={typeConfig.color} />
                <span style={{ fontSize: 11, fontWeight: 600, color: typeConfig.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Type
                </span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {typeConfig.label}
              </span>
            </div>

            {/* File size */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-base)', border: '1px solid var(--border-light)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                Size
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {uploadResult.summary?.file_size_mb?.toFixed(1) || '?'} MB
              </span>
            </div>

            {/* Rows (tabular/text) or Images */}
            {uploadResult.summary?.type !== 'image' ? (
              <>
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-base)', border: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Rows
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadResult.summary?.rows?.toLocaleString() || '—'}
                  </span>
                </div>
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-base)', border: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Columns
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadResult.summary?.columns || '—'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-base)', border: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Images
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadResult.summary?.total_images?.toLocaleString() || '—'}
                  </span>
                </div>
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-base)', border: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 4 }}>
                    Classes
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {uploadResult.summary?.num_classes || '—'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Validation warnings */}
          {uploadResult.validation?.warnings?.length > 0 && (
            <div style={{
              padding: '12px 16px', borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
              marginBottom: 16,
            }}>
              {uploadResult.validation.warnings.map((w: string, i: number) => (
                <p key={i} style={{ fontSize: 13, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} /> {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Upload zone */}
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{ opacity: isUploading ? 0.6 : 1, pointerEvents: isUploading ? 'none' : 'auto' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".csv,.xlsx,.xls,.json,.txt,.zip,.jpg,.jpeg,.png,.webp"
        />

        {isUploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div className="spinner-lg" />
            <div style={{ width: '100%', maxWidth: 300 }}>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                Uploading... {Math.round(progress)}%
              </p>
            </div>
          </div>
        ) : (
          <>
            <div style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 16px',
              background: 'var(--color-primary-subtle)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <FileUp size={28} color="var(--color-primary)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, fontFamily: 'var(--font-heading)' }}>
              Drop your dataset here
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 420, margin: '0 auto 20px' }}>
              Supports CSV, XLSX, JSON, TXT for text/tabular data, and ZIP/JPG/PNG/WEBP for image datasets
            </p>
            <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <Upload size={16} /> Browse Files
            </button>

            {/* Format chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 20 }}>
              {[
                { ext: 'CSV', icon: Table, color: '#22C55E' },
                { ext: 'XLSX', icon: Table, color: '#22C55E' },
                { ext: 'JSON', icon: FileText, color: '#3B82F6' },
                { ext: 'TXT', icon: FileText, color: '#3B82F6' },
                { ext: 'ZIP', icon: Image, color: '#8B5CF6' },
                { ext: 'JPG', icon: Image, color: '#8B5CF6' },
                { ext: 'PNG', icon: Image, color: '#8B5CF6' },
              ].map(({ ext, icon: Icon, color }) => (
                <span key={ext} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 100,
                  background: `${color}11`, border: `1px solid ${color}22`,
                  fontSize: 11, fontWeight: 600, color,
                }}>
                  <Icon size={10} /> {ext}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 'var(--radius-md)',
          background: 'var(--color-error-subtle)', border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <AlertCircle size={18} color="var(--color-error)" />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-error)' }}>Upload Failed</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{error}</p>
          </div>
          <button onClick={() => setError(null)} style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
          }}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
