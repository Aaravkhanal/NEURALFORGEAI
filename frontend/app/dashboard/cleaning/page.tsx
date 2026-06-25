'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3, AlertTriangle, CheckCircle2, Play, Loader2,
  Database, Zap, FileSearch, RefreshCw, Layers, Sparkles,
  HardDrive, AlertCircle, ChevronRight, PartyPopper,
} from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────

const STRATEGIES = ['Keep as-is', 'Mean', 'Median', 'Mode', 'Drop', 'Forward Fill', 'KNN Impute'];

function getDType(dtype: string): { label: string; cls: string } {
  if (/int/.test(dtype)) return { label: 'int', cls: 'type-int' };
  if (/float/.test(dtype)) return { label: 'float', cls: 'type-float' };
  if (/bool/.test(dtype)) return { label: 'bool', cls: 'type-bool' };
  if (/datetime/.test(dtype)) return { label: 'date', cls: 'type-date' };
  return { label: 'cat', cls: 'type-cat' };
}

function autoStrategy(dtype: string, nullCount: number, totalRows: number): string {
  if (nullCount === 0) return 'Keep as-is';
  if (nullCount / Math.max(totalRows, 1) > 0.6) return 'Drop';
  const { label } = getDType(dtype);
  return label === 'cat' ? 'Mode' : 'Median';
}

function strategyToOp(colName: string, strategy: string): object | null {
  if (strategy === 'Keep as-is') return null;
  if (strategy === 'Drop') return { type: 'drop_column', column: colName };
  if (strategy === 'Forward Fill') return { type: 'impute', column: colName, strategy: 'forward_fill' };
  if (strategy === 'KNN Impute') return { type: 'impute', column: colName, strategy: 'knn' };
  return { type: 'impute', column: colName, strategy: strategy.toLowerCase() };
}

interface ColInfo {
  name: string;
  dtype: string;
  null_count: number;
  outlier_count: number;
  unique_count?: number;
  strategy: string;
}

const CLEAN_STEPS = [
  { name: 'Scanning Missing Values', icon: FileSearch },
  { name: 'Detecting Outliers', icon: AlertTriangle },
  { name: 'Applying Operations', icon: Layers },
  { name: 'Encoding Categoricals', icon: RefreshCw },
  { name: 'Generating Quality Report', icon: Database },
];

const getToken = () =>
  typeof window !== 'undefined' ? (localStorage.getItem('neuralforge_token') || 'guest_token') : 'guest_token';

// ── Component ────────────────────────────────────────────────────

export default function DataCleaningPage() {
  const { markStageComplete, fileId, targetColumn, setDatasetProfile } = usePipeline();

  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColInfo[]>([]);
  const [stats, setStats] = useState({ rows: 0, missing: 0, outliers: 0, duplicates: 0 });
  const [distData, setDistData] = useState<{ range: string; count: number }[]>([]);
  const [distLabel, setDistLabel] = useState('');
  const [isClean, setIsClean] = useState(false);

  const [globalOptions, setGlobalOptions] = useState({
    removeDuplicates: true,
    normalize: false,
    encodeCategorical: true,
    capOutliers: false,
  });

  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanStep, setCleanStep] = useState(0);
  const [cleanResult, setCleanResult] = useState<any>(null);
  const [cleanError, setCleanError] = useState<string | null>(null);

  // ── Fetch real analysis from backend ──────────────────────────
  const fetchAnalysis = useCallback(async () => {
    if (!fileId) return;
    setIsLoading(true);
    setLoadError(null);
    setCleanResult(null);
    setCleanError(null);
    setIsClean(false);

    const token = getToken();
    const qs = targetColumn ? `?target_column=${encodeURIComponent(targetColumn)}` : '';

    try {
      const res = await fetch(`/api/backend/cleaning/analysis/${fileId}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Analysis failed (${res.status})`);
      }

      const profile = await res.json();

      // Save to pipeline context for SHAP chart on models page
      if (profile.feature_distributions) {
        setDatasetProfile(profile.feature_distributions);
      }

      // Map to display columns — include actual unique counts
      const cols: ColInfo[] = (profile.columns || []).map((c: any) => ({
        name: c.name,
        dtype: c.dtype,
        null_count: c.null_count ?? 0,
        outlier_count: profile.outliers?.[c.name]?.count ?? 0,
        unique_count: c.unique_count ?? null,
        strategy: autoStrategy(c.dtype, c.null_count ?? 0, profile.row_count ?? 0),
      }));
      setColumns(cols);

      // Real stats
      const totalMissing = cols.reduce((s, c) => s + c.null_count, 0);
      const totalOutliers = cols.reduce((s, c) => s + c.outlier_count, 0);
      const duplicates = profile.duplicate_count ?? 0;
      setStats({ rows: profile.row_count || 0, missing: totalMissing, outliers: totalOutliers, duplicates });

      // Detect if dataset is already clean
      const datasetAlreadyClean = totalMissing === 0 && totalOutliers === 0 && duplicates === 0;
      setIsClean(datasetAlreadyClean);
      if (datasetAlreadyClean) {
        // Still mark stage complete so user can proceed
        markStageComplete('/dashboard/cleaning');
      }

      // Distribution chart for first numeric column with data
      const distKey = Object.keys(profile.feature_distributions || {})[0];
      if (distKey) {
        const d = profile.feature_distributions[distKey];
        const bins: number[] = d.bins || [];
        const counts: number[] = d.counts || [];
        const fmt = (n: number) =>
          Math.abs(n) >= 100 ? Math.round(n).toString() : parseFloat(n.toFixed(2)).toString();
        setDistLabel(distKey);
        setDistData(
          counts.slice(0, 10).map((count, i) => ({
            range: `${fmt(bins[i])}-${fmt(bins[i + 1])}`,
            count,
          }))
        );
      }
    } catch (e: any) {
      setLoadError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, targetColumn]);

  useEffect(() => { fetchAnalysis(); }, [fetchAnalysis]);

  // ── AI Optimal Cleaning ───────────────────────────────────────
  const handleAICleaning = async () => {
    if (!fileId) return;
    setIsCleaning(true);
    setCleanStep(0);
    setCleanResult(null);
    setCleanError(null);

    const token = getToken();
    const qs = targetColumn ? `?target_column=${encodeURIComponent(targetColumn)}` : '';

    try {
      // 1. Get AI suggestions (uses NVIDIA LLM API via backend)
      setCleanStep(0);
      const suggestRes = await fetch(`/api/backend/cleaning/ai-suggest/${fileId}${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!suggestRes.ok) {
        const err = await suggestRes.json().catch(() => ({}));
        throw new Error(err.detail || 'AI suggestion failed');
      }
      const suggestData = await suggestRes.json();
      setCleanStep(2);

      // 2. Build operations from AI suggestions + global options
      const ops: object[] = (suggestData.suggestions || [])
        .map((s: any) => s.operation)
        .filter(Boolean);

      if (globalOptions.removeDuplicates) ops.push({ type: 'drop_duplicates' });
      if (globalOptions.capOutliers) {
        columns
          .filter(c => c.outlier_count > 0 && /int|float/.test(c.dtype))
          .forEach(c => ops.push({ type: 'handle_outliers', column: c.name, method: 'iqr', action: 'clip' }));
      }

      setCleanStep(3);

      // 3. Apply operations
      const applyRes = await fetch(`/api/backend/cleaning/ai-apply/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          operations: ops,
          target_column: targetColumn || null,
        }),
      });

      if (!applyRes.ok) {
        const err = await applyRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Cleaning apply failed');
      }

      const result = await applyRes.json();
      setCleanStep(5);

      setTimeout(() => {
        setIsCleaning(false);
        setCleanResult({
          ...result,
          quality_before: suggestData.quality_before,
          quality_after: suggestData.quality_after_estimated,
          summary: suggestData.summary,
        });
        markStageComplete('/dashboard/cleaning');
      }, 600);
    } catch (e: any) {
      setIsCleaning(false);
      setCleanError(e.message);
    }
  };

  // ── Manual Pipeline ───────────────────────────────────────────
  const handleManualPipeline = async () => {
    if (!fileId) return;
    setIsCleaning(true);
    setCleanStep(0);
    setCleanResult(null);
    setCleanError(null);

    const token = getToken();

    const ops: object[] = [];
    for (const col of columns) {
      if (col.name === targetColumn) continue;
      const op = strategyToOp(col.name, col.strategy);
      if (op) ops.push(op);
    }
    if (globalOptions.removeDuplicates) ops.push({ type: 'drop_duplicates' });
    if (globalOptions.capOutliers) {
      columns
        .filter(c => c.outlier_count > 0 && /int|float/.test(c.dtype))
        .forEach(c => ops.push({ type: 'handle_outliers', column: c.name, method: 'iqr', action: 'clip' }));
    }
    if (globalOptions.encodeCategorical) {
      columns
        .filter(c => getDType(c.dtype).label === 'cat' && c.name !== targetColumn)
        .forEach(c => ops.push({ type: 'encode_label', column: c.name }));
    }
    if (globalOptions.normalize) {
      columns
        .filter(c => /int|float/.test(c.dtype) && c.name !== targetColumn)
        .forEach(c => ops.push({ type: 'normalize', column: c.name }));
    }

    let step = 0;
    const interval = setInterval(() => {
      step = Math.min(step + 1, CLEAN_STEPS.length - 1);
      setCleanStep(step);
    }, 900);

    try {
      const res = await fetch(`/api/backend/cleaning/apply/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(ops),
      });
      clearInterval(interval);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Cleaning failed');
      }

      const result = await res.json();
      setCleanStep(CLEAN_STEPS.length);

      setTimeout(() => {
        setIsCleaning(false);
        setCleanResult(result);
        markStageComplete('/dashboard/cleaning');
      }, 500);
    } catch (e: any) {
      clearInterval(interval);
      setIsCleaning(false);
      setCleanError(e.message);
    }
  };

  const handleDownloadCleaned = async () => {
    const token = getToken();
    const res = await fetch(`/api/backend/export/cleaned/${fileId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleaned_dataset.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleGlobal = (key: keyof typeof globalOptions) =>
    setGlobalOptions(g => ({ ...g, [key]: !g[key] }));

  const updateStrategy = (idx: number, strategy: string) => {
    const updated = [...columns];
    updated[idx] = { ...updated[idx], strategy };
    setColumns(updated);
  };

  // ── No file selected ──────────────────────────────────────────
  if (!fileId) {
    return (
      <div className="animate-fade-in">
        <div className="stage-badge mb-4">STAGE 03</div>
        <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-8">Data Cleaning</h1>
        <div className="dashed-card p-12 flex flex-col items-center text-center gap-4">
          <AlertCircle size={40} className="text-[#FF4400] opacity-40" />
          <p className="text-[18px] font-bold text-[#555]">No dataset selected</p>
          <p className="text-[14px] text-[#888]">
            Please go back to Dataset Sourcing and upload or select a dataset first.
          </p>
          <Link href="/dashboard/datasets" className="btn-coral mt-2">Go to Dataset Sourcing</Link>
        </div>
        <PipelineNav prevLink="/dashboard/datasets" prevTitle="Dataset Sourcing"
          nextLink="/dashboard/models" nextTitle="Model Benchmark" />
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="stage-badge mb-4">STAGE 03</div>
        <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-8">Data Cleaning</h1>
        <div className="dashed-card p-20 flex flex-col items-center gap-4">
          <Loader2 size={40} className="text-[#FF4400] animate-spin" />
          <p className="text-[16px] text-[#888]">Analyzing your dataset...</p>
          <p className="text-[12px] text-[#bbb]">Reading columns, detecting missing values, computing outliers</p>
        </div>
      </div>
    );
  }

  // ── Load error ────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="animate-fade-in">
        <div className="stage-badge mb-4">STAGE 03</div>
        <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-8">Data Cleaning</h1>
        <div className="dashed-card p-10 flex flex-col items-center gap-4 text-center">
          <AlertCircle size={32} className="text-red-500" />
          <p className="text-[15px] text-red-600 font-medium max-w-md">{loadError}</p>
          <p className="text-[12px] text-[#888] max-w-sm">
            Make sure the backend is running and your dataset was uploaded successfully.
          </p>
          <button onClick={fetchAnalysis} className="btn-coral mt-2">Retry Analysis</button>
        </div>
        <PipelineNav prevLink="/dashboard/datasets" prevTitle="Dataset Sourcing"
          nextLink="/dashboard/models" nextTitle="Model Benchmark" />
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 03</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Data Cleaning</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Real-time analysis from your uploaded dataset. Configure cleaning strategies per column.
      </p>

      {/* ── Dataset-is-clean banner ── */}
      {isClean && !cleanResult && (
        <div className="mb-6 flex items-start gap-4 bg-green-50 border border-green-300 rounded-2xl px-6 py-5">
          <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
            <PartyPopper size={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-green-800 mb-1">Your dataset is already clean!</h3>
            <p className="text-[13px] text-green-700 mb-3">
              No missing values, no outliers, and no duplicate rows were detected across all {columns.length} columns. You can proceed directly to Model Benchmarking.
            </p>
            <div className="flex gap-3">
              <Link href="/dashboard/models" className="btn-coral text-[13px] py-2 px-4">
                Continue to Model Benchmark <ChevronRight size={14} />
              </Link>
              <button
                onClick={handleManualPipeline}
                className="btn-outline text-[13px] py-2 px-4"
              >
                Apply Optional Encoding/Normalization
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'TOTAL ROWS', value: stats.rows.toLocaleString(), icon: BarChart3, alert: false },
          { label: 'MISSING CELLS', value: stats.missing.toString(), icon: AlertTriangle, alert: stats.missing > 0 },
          { label: 'OUTLIERS', value: stats.outliers.toString(), icon: AlertTriangle, alert: stats.outliers > 0 },
          { label: 'DUPLICATES', value: stats.duplicates.toString(), icon: Database, alert: stats.duplicates > 0 },
        ].map((s, i) => (
          <div key={i} className="metric-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={14} className={s.alert ? 'text-[#FF4400]' : 'text-[#999]'} />
              <span className="section-label">{s.label}</span>
            </div>
            <span
              className="text-[28px] font-bold"
              style={{ fontFamily: "'Space Mono', monospace", color: s.alert ? '#FF4400' : '#10B981' }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Clean error banner ── */}
      {cleanError && (
        <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] text-red-600 font-medium">{cleanError}</p>
            <button onClick={() => setCleanError(null)} className="text-[11px] text-red-400 mt-1 underline">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex gap-8">
        {/* ── Column Configuration Table ── */}
        <div className="flex-1 min-w-0">
          <div className="dashed-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-[#f0ebe1] flex items-center justify-between">
              <span className="section-label">COLUMN ANALYSIS — REAL DATA</span>
              <span className="text-[11px] text-[#aaa]">
                {columns.length} columns{targetColumn ? ` · target: ${targetColumn}` : ''}
              </span>
            </div>

            {/* Header */}
            <div
              className="grid grid-cols-[1fr_70px_80px_80px_80px_130px] px-6 py-3 text-[11px] text-[#999] font-bold tracking-wider border-b border-[#f0ebe1]"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              <span>Column</span>
              <span>Type</span>
              <span>Missing</span>
              <span>Outliers</span>
              <span>Unique</span>
              <span>Strategy</span>
            </div>

            {/* Rows */}
            <div className="max-h-[480px] overflow-y-auto">
              {columns.map((col, i) => {
                const dt = getDType(col.dtype);
                const isTarget = col.name === targetColumn;
                return (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_70px_80px_80px_80px_130px] px-6 py-3.5 border-b border-[#f8f4ee] items-center transition-colors ${
                      isTarget ? 'bg-[#FDFBF7]' : 'hover:bg-[#FDFBF7]'
                    }`}
                  >
                    <span
                      className="text-[13px] font-medium text-[#1a1a1a] flex items-center gap-2"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {col.name}
                      {isTarget && (
                        <span className="text-[9px] font-bold text-white bg-[#FF4400] rounded px-1.5 py-0.5">
                          TARGET
                        </span>
                      )}
                    </span>
                    <span>
                      <span className={`type-badge ${dt.cls}`}>{dt.label}</span>
                    </span>
                    <span
                      className={`text-[13px] font-bold ${col.null_count > 0 ? 'text-[#FF4400]' : 'text-[#22C55E]'}`}
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {col.null_count}
                    </span>
                    <span
                      className={`text-[13px] font-bold ${col.outlier_count > 0 ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {col.outlier_count}
                    </span>
                    <span
                      className="text-[13px] text-[#888]"
                      style={{ fontFamily: "'Space Mono', monospace" }}
                    >
                      {col.unique_count ?? '—'}
                    </span>
                    <select
                      value={col.strategy}
                      onChange={e => updateStrategy(i, e.target.value)}
                      disabled={isTarget}
                      className="text-[12px] bg-white border border-[#f0ebe1] rounded-lg px-2 py-1 text-[#555] outline-none focus:border-[#FF4400] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {STRATEGIES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="w-[280px] shrink-0 space-y-5">
          {/* Distribution chart */}
          {distData.length > 0 && (
            <div className="dashed-card">
              <span className="section-label block mb-0.5">
                {distLabel.replace(/_/g, ' ').toUpperCase()} DISTRIBUTION
              </span>
              <span className="text-[10px] text-[#bbb] block mb-3">Actual values from your dataset</span>
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={distData}>
                  <XAxis
                    dataKey="range"
                    tick={{ fontSize: 7, fill: '#999' }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="count" fill="#FF4400" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Global Options */}
          <div className="dashed-card">
            <span className="section-label block mb-4">GLOBAL OPTIONS</span>
            <div className="space-y-3">
              {([
                { key: 'removeDuplicates', label: 'Remove duplicate rows' },
                { key: 'normalize', label: 'Normalize numerical features' },
                { key: 'encodeCategorical', label: 'Encode categorical columns' },
                { key: 'capOutliers', label: 'Cap outliers at IQR' },
              ] as const).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer group" onClick={() => toggleGlobal(key)}>
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      globalOptions[key]
                        ? 'bg-[#FF4400] border-[#FF4400]'
                        : 'border-[#ddd] group-hover:border-[#FF4400]'
                    }`}
                  >
                    {globalOptions[key] && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <span className="text-[13px] text-[#555]">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action / Progress / Result */}
          {!isCleaning && !cleanResult ? (
            <div className="space-y-4">
              {/* AI Optimal */}
              <button
                onClick={handleAICleaning}
                className="w-full flex flex-col items-center justify-center gap-2 bg-[#FFF8F0] border-2 border-[#FF4400] rounded-2xl py-6 shadow-[0_8px_30px_rgba(255,68,0,0.1)] hover:shadow-[0_12px_40px_rgba(255,68,0,0.2)] hover:-translate-y-1 transition-all group overflow-hidden relative"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4400]/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#FF4400]/10 transition-all" />
                <div className="w-12 h-12 rounded-full bg-[#FF4400] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg z-10 mb-2">
                  <Sparkles size={24} />
                </div>
                <div className="z-10 text-center">
                  <span className="block text-[18px] font-bold text-[#1a1a1a] mb-1">AI Optimal Cleaning</span>
                  <span className="block text-[12px] font-bold text-[#FF4400]">LLM-powered auto-detect & fix</span>
                </div>
              </button>

              {/* Manual */}
              <button
                onClick={handleManualPipeline}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#f0ebe1] rounded-2xl py-4 hover:border-[#FF4400]/50 hover:bg-[#FDFBF7] transition-all group"
              >
                <div className="w-8 h-8 rounded-full bg-[#f0ebe1] flex items-center justify-center text-[#555] group-hover:bg-[#FFF8F0] group-hover:text-[#FF4400] transition-colors">
                  <Play size={14} className="ml-0.5" />
                </div>
                <div className="text-left">
                  <span className="block text-[15px] font-bold text-[#1a1a1a]">Run Manual Pipeline</span>
                  <span className="block text-[11px] text-[#888]">Apply your column selections above</span>
                </div>
              </button>
            </div>
          ) : isCleaning ? (
            /* Progress animation */
            <div className="bg-white border border-[#FF4400] rounded-2xl p-6 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-[#FF4400]/5 animate-pulse" />
              <div className="flex flex-col items-center relative z-10">
                <Loader2 size={36} className="text-[#FF4400] animate-spin mb-4" />
                <h3 className="text-[16px] font-bold text-[#1a1a1a] mb-6">Processing Dataset...</h3>
                <div className="w-full space-y-3">
                  {CLEAN_STEPS.map((step, i) => {
                    const isActive = i === cleanStep;
                    const isDone = i < cleanStep;
                    const Icon = step.icon;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                          isActive
                            ? 'bg-[#FFF8F0] border border-[#FF4400]/30 shadow-sm translate-x-1'
                            : isDone
                            ? 'opacity-50'
                            : 'opacity-25'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-[#FF4400] text-white animate-bounce'
                              : isDone
                              ? 'bg-green-500 text-white'
                              : 'bg-[#f0ebe1] text-[#999]'
                          }`}
                        >
                          {isDone ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                        </div>
                        <span
                          className={`text-[13px] font-bold ${
                            isActive ? 'text-[#FF4400]' : isDone ? 'text-green-600' : 'text-[#888]'
                          }`}
                        >
                          {step.name}
                        </span>
                        {isActive && <Loader2 size={13} className="text-[#FF4400] animate-spin ml-auto" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : cleanResult ? (
            /* Result panel */
            <div className="bg-white border border-green-500 rounded-2xl p-6 shadow-[0_8px_30px_rgba(34,197,94,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-green-500/5 rounded-full blur-2xl -mr-8 -mt-8" />

              <div className="flex items-center gap-3 mb-5 relative z-10">
                <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold text-[#1a1a1a]">Pipeline Complete!</h3>
                  <p className="text-[11px] text-green-600 font-bold">Dataset ready for training.</p>
                </div>
              </div>

              {/* Row counts */}
              <div className="grid grid-cols-2 gap-3 relative z-10 mb-4">
                <div className="bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl p-3 text-center">
                  <span className="block text-[9px] text-[#888] font-bold mb-1">ROWS BEFORE</span>
                  <span className="text-[20px] font-bold text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {(cleanResult.report?.rows_before ?? stats.rows).toLocaleString()}
                  </span>
                </div>
                <div className="bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl p-3 text-center">
                  <span className="block text-[9px] text-[#888] font-bold mb-1">ROWS AFTER</span>
                  <span className="text-[20px] font-bold text-green-600" style={{ fontFamily: "'Space Mono', monospace" }}>
                    {(cleanResult.rows ?? cleanResult.report?.rows_after ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Quality score */}
              {cleanResult.quality_before !== undefined && (
                <div className="bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl p-3 mb-4 relative z-10">
                  <span className="block text-[9px] text-[#888] font-bold mb-1.5">DATA QUALITY SCORE</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[20px] font-bold text-[#999]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {Math.round(cleanResult.quality_before)}
                    </span>
                    <ChevronRight size={14} className="text-[#aaa]" />
                    <span className="text-[22px] font-bold text-green-600" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {Math.round(cleanResult.quality_after ?? cleanResult.quality_before + 10)}
                    </span>
                    <span className="text-[11px] text-[#888]">/ 100</span>
                  </div>
                </div>
              )}

              {/* AI summary */}
              {cleanResult.summary && (
                <p className="text-[11px] text-[#555] mb-4 relative z-10 border-t border-[#f0ebe1] pt-3 leading-relaxed">
                  {cleanResult.summary}
                </p>
              )}

              {/* Operations applied */}
              {cleanResult.report?.operations_applied?.length > 0 && (
                <div className="mb-4 relative z-10">
                  <span className="block text-[9px] text-[#888] font-bold mb-1.5">OPERATIONS APPLIED</span>
                  <div className="space-y-1">
                    {cleanResult.report.operations_applied.slice(0, 5).map((op: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-[11px] text-[#555]">
                        <Zap size={11} className="text-[#FF4400] shrink-0" />
                        {op.detail || op.type}
                      </div>
                    ))}
                    {cleanResult.report.operations_applied.length > 5 && (
                      <p className="text-[10px] text-[#aaa]">
                        +{cleanResult.report.operations_applied.length - 5} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 relative z-10">
                <button onClick={handleDownloadCleaned} className="btn-outline flex-1 justify-center py-2 text-[12px]">
                  <HardDrive size={13} /> Download
                </button>
                <button onClick={() => { setCleanResult(null); fetchAnalysis(); }} className="btn-outline flex-1 justify-center py-2 text-[12px]">
                  <RefreshCw size={13} /> Rerun
                </button>
              </div>
              <Link href="/dashboard/models" className="btn-coral w-full justify-center mt-2 text-[13px]">
                Continue to Benchmarking <ChevronRight size={14} />
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <PipelineNav
        prevLink="/dashboard/datasets"
        prevTitle="Dataset Sourcing"
        nextLink="/dashboard/models"
        nextTitle="Model Benchmark"
      />
    </div>
  );
}
