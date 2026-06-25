'use client';

import { useState, useRef, useCallback, DragEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Search, Wand2, ArrowRight, FileText, Check, X,
  FolderOpen, Brain, Sparkles, Database, Cpu, Globe,
} from 'lucide-react';
import Papa from 'papaparse';
import AIDatasetFinder from './AIDatasetFinder';
import AIDatasetGenerator from './AIDatasetGenerator';

/* ─── Types ───────────────────────────────────────── */
interface ColumnInfo {
  name: string;
  detectedType: string;
  missing: number;
  unique: number;
  sample: string;
}

interface DatasetAnalysis {
  rows: number;
  cols: number;
  columns: ColumnInfo[];
  missingPct: number;
  duplicatesPct: number;
  healthScore: number;
  detectedTask: string;
}

interface Props {
  problemStatement: string;
  onDatasetReady: (result: {
    parsedData: Record<string, string>[];
    analysis: DatasetAnalysis;
    fileName: string;
    fileSize: string;
  }) => void;
}

/* ─── Helpers ─────────────────────────────────────── */
function detectColumnType(values: string[]): string {
  const nonEmpty = values.filter(v => v !== '' && v !== null && v !== undefined);
  if (nonEmpty.length === 0) return 'unknown';
  const numericCount = nonEmpty.filter(v => !isNaN(Number(v)) && v.trim() !== '').length;
  if (numericCount / nonEmpty.length > 0.85) return nonEmpty.some(v => v.includes('.')) ? 'float64' : 'int64';
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^\d{2}-\d{2}-\d{4}/];
  if (nonEmpty.filter(v => datePatterns.some(p => p.test(v))).length / nonEmpty.length > 0.5) return 'datetime';
  const uniqueRatio = new Set(nonEmpty).size / nonEmpty.length;
  if (uniqueRatio > 0.5 && nonEmpty[0]?.length > 50) return 'text';
  return 'categorical';
}

function detectTask(columns: ColumnInfo[]): string {
  const candidates = columns.filter(c => /target|label|class|y|output|result|exited|churn|fraud|survived/i.test(c.name));
  const candidate = candidates[0] || columns[columns.length - 1];
  if (!candidate) return 'Classification';
  if (candidate.detectedType === 'int64' || candidate.detectedType === 'categorical') {
    if (candidate.unique <= 10) return 'Classification';
  }
  if (candidate.detectedType === 'float64') return 'Regression';
  if (candidate.unique === 2) return 'Binary Classification';
  if (candidate.unique <= 20) return 'Multi-class Classification';
  return 'Regression';
}

function analyzeDataset(data: Record<string, string>[]): DatasetAnalysis {
  if (!data || data.length === 0) return { rows: 0, cols: 0, columns: [], missingPct: 0, duplicatesPct: 0, healthScore: 0, detectedTask: 'Unknown' };
  const colNames = Object.keys(data[0]);
  const rows = data.length;
  const cols = colNames.length;
  let totalMissing = 0;
  const columnInfos: ColumnInfo[] = colNames.map(name => {
    const values = data.map(row => (row[name] ?? '').toString());
    const missing = values.filter(v => v === '' || v === 'null' || v === 'undefined' || v === 'NaN' || v === 'NA' || v === 'N/A').length;
    totalMissing += missing;
    const nonEmpty = values.filter(v => v !== '' && v !== 'null' && v !== 'undefined');
    const unique = new Set(nonEmpty).size;
    return { name, detectedType: detectColumnType(values), missing, unique, sample: nonEmpty[0] || '' };
  });
  const missingPct = (totalMissing / (rows * cols)) * 100;
  const seen = new Set<string>();
  let dupes = 0;
  for (const row of data) { const key = JSON.stringify(row); if (seen.has(key)) dupes++; seen.add(key); }
  const duplicatesPct = (dupes / rows) * 100;
  const healthScore = Math.max(0, Math.min(100, Math.round(100 - (missingPct * 3) - (duplicatesPct * 2))));
  return { rows, cols, columns: columnInfos, missingPct, duplicatesPct, healthScore, detectedTask: detectTask(columnInfos) };
}

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json', '.parquet', '.tsv', '.txt'];

/* ─── Hub Options ─────────────────────────────────── */
const HUB_OPTIONS = [
  {
    id: 'upload' as const,
    icon: FolderOpen,
    title: 'Upload My Dataset',
    desc: 'Upload CSV, Excel, JSON, Parquet, or TSV files from your computer',
    gradient: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    accentColor: '#7C3AED',
    accentBg: 'rgba(124,58,237,0.08)',
    features: ['Drag & Drop', 'Auto-analyze', 'Instant preview'],
  },
  {
    id: 'discover' as const,
    icon: Search,
    title: 'Let AI Find a Dataset',
    desc: 'AI searches Kaggle, HuggingFace, UCI, OpenML & more — recommends the best one',
    gradient: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    accentColor: '#3B82F6',
    accentBg: 'rgba(59,130,246,0.08)',
    features: ['Web search', 'AI scoring', 'Compare & choose'],
  },
  {
    id: 'generate' as const,
    icon: Wand2,
    title: 'Generate Dataset Using AI',
    desc: 'Create a synthetic dataset with realistic features when no public data exists',
    gradient: 'linear-gradient(135deg, #F59E0B, #D97706)',
    accentColor: '#F59E0B',
    accentBg: 'rgba(245,158,11,0.08)',
    features: ['Custom schema', 'Realistic data', 'Download & train'],
  },
];

/* ════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════ */
export default function DatasetHub({ problemStatement, onDatasetReady }: Props) {
  const [mode, setMode] = useState<'hub' | 'upload' | 'discover' | 'generate'>('hub');

  // Upload state
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [analysis, setAnalysis] = useState<DatasetAnalysis | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── Upload File Processing ── */
  const processFile = useCallback((file: File) => {
    setUploadError('');
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      setUploadError(`Unsupported file type "${ext}". Please upload CSV, XLSX, JSON, Parquet, or TSV.`);
      return;
    }
    setFileName(file.name);
    const sizeKB = file.size / 1024;
    setFileSize(sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`);
    setIsUploading(true);
    setUploadProgress(0);
    let prog = 0;
    const progressInterval = setInterval(() => {
      prog += Math.random() * 20 + 10;
      if (prog >= 100) { prog = 100; clearInterval(progressInterval); }
      setUploadProgress(Math.min(100, Math.round(prog)));
    }, 200);

    if (ext === '.csv' || ext === '.tsv' || ext === '.txt') {
      Papa.parse(file, {
        header: true, skipEmptyLines: true, delimiter: ext === '.tsv' ? '\t' : undefined,
        complete: (results) => {
          clearInterval(progressInterval); setUploadProgress(100);
          setTimeout(() => {
            setIsUploading(false);
            const data = results.data as Record<string, string>[];
            setParsedData(data);
            setAnalysis(analyzeDataset(data));
          }, 500);
        },
        error: () => { clearInterval(progressInterval); setIsUploading(false); setUploadError('Failed to parse the file.'); },
      });
    } else if (ext === '.json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        clearInterval(progressInterval); setUploadProgress(100);
        try {
          let jsonData = JSON.parse(e.target?.result as string);
          if (!Array.isArray(jsonData)) jsonData = [jsonData];
          setTimeout(() => { setIsUploading(false); setParsedData(jsonData); setAnalysis(analyzeDataset(jsonData)); }, 500);
        } catch { setIsUploading(false); setUploadError('Failed to parse JSON file.'); }
      };
      reader.readAsText(file);
    } else {
      clearInterval(progressInterval);
      setTimeout(() => { setUploadProgress(100); setIsUploading(false); setUploadError(`${ext.toUpperCase()} parsing requires server-side processing. Please use CSV format.`); }, 1500);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) processFile(file); };
  const handleDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); };
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);

  const handleUploadContinue = () => {
    if (analysis && parsedData.length > 0) {
      onDatasetReady({ parsedData, analysis, fileName, fileSize });
    }
  };

  /* ════ RENDER ════ */

  // ── Hub Selection Screen ──
  if (mode === 'hub') {
    return (
      <div className="space-y-8">
        <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
            Dataset Discovery Hub
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7 }}>
            Choose how you&apos;d like to get your dataset. Upload your own, let AI find one, or generate synthetic data.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {HUB_OPTIONS.map((opt, i) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode(opt.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: 28, borderRadius: 'var(--radius-xl)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: 'pointer', textAlign: 'left', position: 'relative',
                  overflow: 'hidden', transition: 'all 0.3s',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {/* Top gradient bar on hover */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: opt.gradient, opacity: 0,
                  transition: 'opacity 0.3s',
                }} className="card-accent" />

                <div style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: opt.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20, boxShadow: `0 8px 24px ${opt.accentColor}33`,
                }}>
                  <Icon size={28} color="white" />
                </div>

                <h3 style={{
                  fontSize: 18, fontWeight: 800, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-heading)', marginBottom: 8, lineHeight: 1.2,
                }}>
                  {opt.title}
                </h3>
                <p style={{
                  fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7,
                  marginBottom: 16, flex: 1,
                }}>
                  {opt.desc}
                </p>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                  {opt.features.map(f => (
                    <span key={f} style={{
                      fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                      background: opt.accentBg, color: opt.accentColor,
                    }}>
                      {f}
                    </span>
                  ))}
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, color: opt.accentColor,
                }}>
                  Get Started <ArrowRight size={14} />
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Bottom stats */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
          {[
            { icon: <Database size={16} />, label: '50K+ datasets indexed', color: '#3B82F6' },
            { icon: <Globe size={16} />, label: '7+ data sources', color: '#22C55E' },
            { icon: <Brain size={16} />, label: 'AI-powered ranking', color: '#7C3AED' },
          ].map((stat, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              <span style={{ color: stat.color }}>{stat.icon}</span>
              {stat.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── AI Discover Mode ──
  if (mode === 'discover') {
    return (
      <AIDatasetFinder
        problemStatement={problemStatement}
        onDatasetReady={onDatasetReady}
        onBack={() => setMode('hub')}
        onSuggestGenerate={() => setMode('generate')}
      />
    );
  }

  // ── AI Generate Mode ──
  if (mode === 'generate') {
    return (
      <AIDatasetGenerator
        problemStatement={problemStatement}
        onDatasetReady={onDatasetReady}
        onBack={() => setMode('hub')}
      />
    );
  }

  // ── Upload Mode ──
  return (
    <div className="space-y-8">
      <button onClick={() => { setMode('hub'); setFileName(''); setParsedData([]); setAnalysis(null); setUploadError(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
        <span style={{ fontSize: 14 }}>←</span> Back to options
      </button>

      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Upload Your Dataset</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Upload your own dataset for AI-powered analysis.</p>
      </div>

      {!fileName && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className="rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300"
            style={{
              border: `2px dashed ${isDragOver ? 'var(--color-primary)' : 'var(--border)'}`,
              background: isDragOver ? 'rgba(124,58,237,0.04)' : 'var(--bg-card)',
              minHeight: 200, padding: '48px 24px',
            }}
          >
            <input ref={fileInputRef} type="file" className="hidden" accept=".csv,.xlsx,.xls,.json,.parquet,.tsv,.txt" onChange={handleFileSelect} />
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <Upload className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
            </div>
            <p className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Drag & drop your dataset here, or click to browse</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>CSV, XLSX, JSON, Parquet, TSV (Max 50MB)</p>
          </div>
          {uploadError && (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <X className="w-5 h-5 shrink-0" style={{ color: '#EF4444' }} />
              <p className="text-[13px] font-medium" style={{ color: '#DC2626' }}>{uploadError}</p>
            </div>
          )}
        </>
      )}

      {isUploading && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <FileText className="w-8 h-8" style={{ color: 'var(--color-primary)' }} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[14px] truncate" style={{ color: 'var(--text-primary)' }}>{fileName}</p>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{fileSize}</p>
            </div>
            <span className="text-[14px] font-bold" style={{ color: 'var(--color-primary)' }}>{uploadProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #7C3AED, #A78BFA)' }} />
          </div>
        </div>
      )}

      {!isUploading && analysis && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#22C55E' }}><Check className="w-5 h-5 text-white" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate" style={{ color: '#166534' }}>{fileName}</p>
              <p className="text-sm" style={{ color: '#16A34A' }}>{analysis.rows.toLocaleString()} rows • {analysis.cols} columns • {fileSize}</p>
            </div>
            <button onClick={() => { setFileName(''); setParsedData([]); setAnalysis(null); setUploadError(''); }} className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-red-50 cursor-pointer" style={{ color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent' }}>Remove</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { l: 'Dataset Health', v: `${analysis.healthScore} / 100`, c: analysis.healthScore >= 80 ? '#22C55E' : analysis.healthScore >= 60 ? '#F59E0B' : '#EF4444' },
              { l: 'Missing Values', v: `${analysis.missingPct.toFixed(1)}%`, c: analysis.missingPct > 5 ? '#EF4444' : analysis.missingPct > 1 ? '#F59E0B' : '#22C55E' },
              { l: 'Duplicates', v: `${analysis.duplicatesPct.toFixed(1)}%`, c: '#3B82F6' },
              { l: 'Columns', v: `${analysis.cols}`, c: '#8B5CF6' },
            ].map(s => (
              <div key={s.l} className="rounded-xl text-center" style={{ padding: 20, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{s.l}</p>
                <p className="text-2xl font-black" style={{ color: s.c, fontFamily: 'var(--font-heading)' }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Data Preview */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>Data Preview (first 5 rows)</p>
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--border)' }}>
              <table className="w-full text-left text-sm" style={{ minWidth: Math.max(600, analysis.cols * 120) }}>
                <thead style={{ background: 'var(--bg-surface)' }}><tr>{analysis.columns.map(c => <th key={c.name} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>{c.name}</th>)}</tr></thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-light)' }}>
                  {parsedData.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50/50">{analysis.columns.map(c => <td key={c.name} className="px-4 py-2.5 whitespace-nowrap text-[12px]" style={{ color: 'var(--text-primary)' }}>{String(row[c.name] ?? '').substring(0, 30)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Detection */}
          <div className="p-5 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(124,58,237,0.15)' }}>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}><Search className="w-5 h-5 text-white" /></div>
              <div>
                <p className="font-bold text-[14px]" style={{ color: 'var(--text-primary)' }}>AI detected this as a <span style={{ color: 'var(--color-primary)' }}>{analysis.detectedTask}</span> problem</p>
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Continue to deep analysis & cleaning</p>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleUploadContinue} className="btn-primary" style={{ gap: 6 }}>
              Continue <ArrowRight size={16} />
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}
