'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, Settings2, Activity, Terminal, CheckCircle2, Download,
  AlertCircle, Sliders, Zap, RefreshCw, Loader2,
  TrendingDown, TrendingUp, Package, FileJson, Archive,
} from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend,
} from 'recharts';

// ── Helpers ──────────────────────────────────────────────────────

const getToken = () =>
  typeof window !== 'undefined'
    ? (localStorage.getItem('neuralforge_token') || 'guest_token')
    : 'guest_token';

const toBackendTask = (p: string): string => {
  const t = (p || '').toLowerCase();
  if (t.includes('regression') || t.includes('forecast') || t.includes('time series')) return 'tabular_regression';
  if (t.includes('image') || t.includes('vision') || t.includes('object')) return 'image_classification';
  if (t.includes('nlp') || t.includes('text') || t.includes('language') || t.includes('sentiment')) return 'text_classification';
  return 'tabular_classification';
};

const toBackendModel = (name: string): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('xgboost')) return 'xgboost';
  if (n.includes('lightgbm') || n.includes('light gbm')) return 'lightgbm';
  if (n.includes('catboost')) return 'catboost';
  if (n.includes('random forest')) return 'random_forest';
  if (n.includes('gradient') || n.includes('gbm')) return 'gradient_boosting';
  if (n.includes('extra tree')) return 'extra_trees';
  if (n.includes('adaboost')) return 'adaboost';
  if (n.includes('svm') || n.includes('support vector')) return 'svm';
  if (n.includes('logistic')) return 'logistic_regression';
  return 'xgboost';
};

interface TrainingInsight {
  status: 'overtrained' | 'undertrained' | 'converged';
  title: string;
  message: string;
  action: string;
  color: string;
}

function analyzeTraining(data: any[]): TrainingInsight | null {
  if (data.length < 6) return null;
  const window = data.slice(-Math.max(6, Math.floor(data.length * 0.2)));
  const trainDelta = window[window.length - 1].train_loss - window[0].train_loss;
  const valDelta = window[window.length - 1].val_loss - window[0].val_loss;
  const allData = data;
  const bestVal = Math.min(...allData.map((d: any) => d.val_loss));
  const lastVal = allData[allData.length - 1].val_loss;
  const overfit = lastVal > bestVal * 1.05 && trainDelta < -0.001;

  if (overfit || (valDelta > 0.01 && trainDelta < -0.001)) {
    return {
      status: 'overtrained',
      title: 'Overfitting Detected',
      message: `Validation loss is rising (+${valDelta.toFixed(4)}) while training loss drops (${trainDelta.toFixed(4)}). Your model is memorizing the training data.`,
      action: 'Stop training. Go back and add regularization (dropout / L2), reduce max_depth, or use fewer estimators.',
      color: 'red',
    };
  }
  if (valDelta < -0.003 && trainDelta < -0.003) {
    return {
      status: 'undertrained',
      title: 'Still Learning — Underfit',
      message: `Both train loss (${trainDelta.toFixed(4)}) and val loss (${valDelta.toFixed(4)}) are still decreasing. The model has not converged.`,
      action: 'Retrain with more estimators / epochs. The model will continue to improve.',
      color: 'yellow',
    };
  }
  return {
    status: 'converged',
    title: 'Converged — Ready for Testing',
    message: `Loss curves have plateaued. Train loss: ${allData[allData.length - 1].train_loss.toFixed(4)}, Val loss: ${allData[allData.length - 1].val_loss.toFixed(4)}.`,
    action: 'Model is well-trained. Proceed to Model Testing.',
    color: 'green',
  };
}

// ── Component ────────────────────────────────────────────────────

export default function TrainingPage() {
  const {
    markStageComplete, selectedModel, fileId, targetColumn,
    problemContext, setTrainedModelId, datasetProfile, trainedModelId,
  } = usePipeline();

  const activeModel = selectedModel || 'XGBoost';

  // ── Data split ────────────────────────────────────────────────
  const [trainPct, setTrainPct] = useState(70);
  const [valPct, setValPct]   = useState(15);
  const [testPct, setTestPct] = useState(15);
  const [splitLocked, setSplitLocked] = useState(false);

  const totalRows = datasetProfile
    ? (Object.values(datasetProfile as Record<string, any>)[0]?.total_rows ?? 0)
    : 0;

  // Keep splits summing to 100 when user drags
  const handleTrainPct = (v: number) => {
    const clamped = Math.min(v, 95);
    const rem = 100 - clamped;
    const ratio = valPct / (valPct + testPct + 0.001);
    setTrainPct(clamped);
    setValPct(Math.round(rem * ratio));
    setTestPct(100 - clamped - Math.round(rem * ratio));
  };
  const handleValPct = (v: number) => {
    const clamped = Math.min(v, 100 - trainPct - 5);
    setValPct(clamped);
    setTestPct(100 - trainPct - clamped);
  };

  const aiSuggestSplit = () => {
    if (totalRows < 500) { setTrainPct(80); setValPct(10); setTestPct(10); }
    else if (totalRows < 5000) { setTrainPct(70); setValPct(15); setTestPct(15); }
    else { setTrainPct(80); setValPct(10); setTestPct(10); }
  };

  // ── Hyperparams ───────────────────────────────────────────────
  const [learningRate, setLearningRate] = useState('0.1');
  const [maxDepth, setMaxDepth] = useState(6);
  const [nEstimators, setNEstimators] = useState(100);
  const [useGpu, setUseGpu] = useState(true);
  const [earlyStop, setEarlyStop] = useState(true);
  const [regAlpha, setRegAlpha] = useState('0.0');
  const [regLambda, setRegLambda] = useState('1.0');

  // ── Column picker (when target col doesn't match dataset) ────
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [targetOverride, setTargetOverride] = useState<string>('');

  // Fetch real column names from dataset on mount so user can always pick
  useEffect(() => {
    if (!fileId) return;
    const token = getToken();
    fetch(`/api/backend/cleaning/analysis/${fileId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (profile?.columns) {
          const cols = profile.columns.map((c: any) => c.name);
          setAvailableColumns(cols);
          // Auto-set override if targetColumn not in columns
          if (targetColumn && !cols.includes(targetColumn)) {
            // Try to smart-pick: find the column whose acronym matches
            const words = targetColumn.replace(/[_-]/g, ' ').split(/\s+/).filter(Boolean);
            const acronym = words.map((w: string) => w[0]).join('').toLowerCase();
            const match = cols.find((c: string) => c.toLowerCase() === acronym)
              || cols.find((c: string) => c.toLowerCase().includes(acronym))
              || cols.find((c: string) => targetColumn.toLowerCase().includes(c.toLowerCase()));
            if (match) setTargetOverride(match);
          }
        }
      })
      .catch(() => {});
  }, [fileId, targetColumn]);

  const effectiveTarget = targetOverride || targetColumn || '';

  // ── Training state ────────────────────────────────────────────
  const [status, setStatus] = useState<'idle' | 'training' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [insight, setInsight] = useState<TrainingInsight | null>(null);
  const [finalMetrics, setFinalMetrics] = useState<Record<string, number> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [localModelId, setLocalModelId] = useState<string | null>(null);
  const [downloadFormats, setDownloadFormats] = useState<any[]>([]);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chartDataRef = useRef<any[]>([]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);
  useEffect(() => () => { esRef.current?.close(); }, []);

  const addLog = useCallback((msg: string) => setLogs(prev => [...prev, msg]), []);

  // ── Fetch trained model after job completes ───────────────────
  const resolveModelId = useCallback(async (jid: string, pid: string) => {
    const token = getToken();
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise(r => setTimeout(r, 1000 + attempt * 500));
      try {
        const res = await fetch(`/api/backend/training/models-trained/${pid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const models: any[] = await res.json();
          const match = models.find((m: any) => m.training_job_id === jid);
          if (match?.id) {
            setTrainedModelId(match.id);
            setLocalModelId(match.id);
            addLog(`[SUCCESS] Model persisted — ID: ${match.id.slice(0, 8)}...`);
            // Fetch available download formats
            const fmtRes = await fetch(`/api/backend/export/model/${match.id}/formats`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (fmtRes.ok) {
              const fmtData = await fmtRes.json();
              setDownloadFormats(fmtData.formats || []);
            }
            return match.id;
          }
        }
      } catch (_) {}
    }
    // Fallback to job ID so user can at least try to download
    setTrainedModelId(jid);
    setLocalModelId(jid);
    return jid;
  }, [addLog, setTrainedModelId]);

  // ── SSE Stream ────────────────────────────────────────────────
  const startSSE = useCallback((jid: string, pid: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/backend/training/stream/${jid}`);
    esRef.current = es;

    es.addEventListener('status', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      addLog(`[INFO] ${d.status} — epoch ${d.current_epoch}/${d.total_epochs}`);
    });

    es.addEventListener('metrics', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      const point = {
        epoch: d.epoch,
        train_loss: parseFloat(d.train_loss?.toFixed(6) ?? '0'),
        val_loss: parseFloat(d.val_loss?.toFixed(6) ?? '0'),
      };
      chartDataRef.current = [...chartDataRef.current, point];
      setChartData(chartDataRef.current);
      setCurrentEpoch(d.epoch);
      if (d.epoch % 10 === 0 || d.epoch === 1) {
        addLog(`[METRIC] Epoch ${d.epoch} — train: ${d.train_loss?.toFixed(4)}, val: ${d.val_loss?.toFixed(4)}`);
      }
    });

    es.addEventListener('progress', (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      setProgress(d.progress ?? 0);
      setCurrentEpoch(d.current_epoch ?? 0);
    });

    es.addEventListener('complete', async (e: MessageEvent) => {
      const d = JSON.parse(e.data);
      es.close();
      setStatus('completed');
      setProgress(100);
      const fm: Record<string, number> = d.final_metrics || {};
      setFinalMetrics(fm);
      const metricStr = Object.entries(fm)
        .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`)
        .join(', ');
      addLog(`[SUCCESS] Training complete! ${metricStr}`);
      markStageComplete('/dashboard/training');
      const finalInsight = analyzeTraining(chartDataRef.current);
      setInsight(finalInsight);
      await resolveModelId(jid, pid);
    });

    es.addEventListener('error', (e: MessageEvent) => {
      es.close();
      try {
        const d = JSON.parse((e as any).data || '{}');
        if (d.error) {
          setStatus('error');
          setErrorMsg(d.error);
          addLog(`[ERROR] ${d.error}`);
          return;
        }
      } catch (_) {}
    });

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        // Server closed the stream — normal after completion
      }
    };
  }, [addLog, markStageComplete, resolveModelId]);

  // ── Start Training ────────────────────────────────────────────
  const handleStart = async () => {
    if (!fileId) {
      setErrorMsg('No dataset selected. Complete the Dataset Sourcing stage first.');
      return;
    }
    setSplitLocked(true);
    setStatus('training');
    setErrorMsg(null);
    setFinalMetrics(null);
    setInsight(null);
    setChartData([]);
    chartDataRef.current = [];
    setProgress(0);
    setCurrentEpoch(0);
    setLocalModelId(null);
    setDownloadFormats([]);

    const rowCount = totalRows || '?';
    const colCount = availableColumns.length || (datasetProfile ? Object.keys(datasetProfile).length : '?');
    setLogs([
      `[INFO] Initializing ${activeModel} model...`,
      `[INFO] Dataset: ${rowCount} rows, ${colCount} columns`,
      `[INFO] Target column: ${effectiveTarget || '(auto-detect)'}`,
      `[INFO] Data split — Train: ${trainPct}%, Val: ${valPct}%, Test: ${testPct}%`,
      totalRows ? `[INFO] Split sizes — Train: ~${Math.round(totalRows * trainPct / 100)}, Val: ~${Math.round(totalRows * valPct / 100)}, Test: ~${Math.round(totalRows * testPct / 100)} rows` : `[INFO] Submitting training job...`,
    ]);

    try {
      const token = getToken();
      const taskType = toBackendTask(problemContext?.task_type || problemContext?.machine_learning_task || '');
      const modelKey = toBackendModel(activeModel);

      const res = await fetch('/api/backend/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          file_id: fileId,
          task_type: taskType,
          model_name: modelKey,
          target_column: effectiveTarget,
          training_config: {
            learning_rate: parseFloat(learningRate) || 0.1,
            max_depth: maxDepth,
            n_estimators: nEstimators,
            validation_split: valPct / 100,
            test_size: testPct / 100,
            use_gpu: useGpu,
            early_stopping_rounds: earlyStop ? 10 : null,
            random_seed: 42,
            reg_alpha: parseFloat(regAlpha) || 0.0,
            reg_lambda: parseFloat(regLambda) || 1.0,
          },
          model_config: {},
          augmentation_config: {},
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to start training' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const job = await res.json();
      setJobId(job.id);
      addLog(`[INFO] Job ${job.id.slice(0, 8)} queued (${taskType} / ${modelKey})`);
      addLog(`[INFO] Training on ${Math.round(totalRows * trainPct / 100) || '?'} rows, validating on ${Math.round(totalRows * valPct / 100) || '?'} rows...`);
      startSSE(job.id, job.project_id);
    } catch (err: any) {
      setStatus('error');
      setSplitLocked(false);
      setErrorMsg(err.message || 'Failed to start training');
      addLog(`[ERROR] ${err.message}`);
    }
  };

  const handleStop = () => {
    esRef.current?.close();
    setStatus('completed');
    addLog('[INFO] Training stopped by user.');
    setInsight(analyzeTraining(chartDataRef.current));
    markStageComplete('/dashboard/training');
  };

  // ── Retrain from scratch ──────────────────────────────────────
  const handleRetrain = () => {
    setSplitLocked(false);
    setStatus('idle');
    setChartData([]);
    chartDataRef.current = [];
    setFinalMetrics(null);
    setInsight(null);
    setLogs([]);
    setProgress(0);
    setCurrentEpoch(0);
    setLocalModelId(null);
    setDownloadFormats([]);
  };

  // ── Continue from existing checkpoint ────────────────────────
  const handleContinueTraining = async () => {
    if (!fileId || !localModelId) return;
    setSplitLocked(true);
    setStatus('training');
    setErrorMsg(null);
    setFinalMetrics(null);
    setInsight(null);
    // Keep existing chart data — new epochs append to it
    setProgress(0);
    setCurrentEpoch(0);
    setDownloadFormats([]);

    const prevEpochs = chartDataRef.current.length;
    addLog(`[INFO] Continuing from checkpoint (${prevEpochs} epochs already trained)...`);
    addLog(`[INFO] Adding ${nEstimators} more estimators to existing model...`);

    try {
      const token = getToken();
      const taskType = toBackendTask(problemContext?.task_type || problemContext?.machine_learning_task || '');
      const modelKey = toBackendModel(activeModel);

      const res = await fetch('/api/backend/training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          file_id: fileId,
          task_type: taskType,
          model_name: modelKey,
          target_column: effectiveTarget,
          training_config: {
            learning_rate: parseFloat(learningRate) || 0.1,
            max_depth: maxDepth,
            n_estimators: nEstimators,
            validation_split: valPct / 100,
            test_size: testPct / 100,
            use_gpu: useGpu,
            early_stopping_rounds: earlyStop ? 10 : null,
            random_seed: 42,
            reg_alpha: parseFloat(regAlpha) || 0.0,
            reg_lambda: parseFloat(regLambda) || 1.0,
            // Warm-start: backend will load this model and continue training from it
            continue_from_model_id: localModelId,
            epoch_offset: prevEpochs,
          },
          model_config: {},
          augmentation_config: {},
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Failed to continue training' }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      const job = await res.json();
      setJobId(job.id);
      addLog(`[INFO] Continuation job ${job.id.slice(0, 8)} queued...`);
      startSSE(job.id, job.project_id);
    } catch (err: any) {
      setStatus('completed');
      setSplitLocked(false);
      setErrorMsg(err.message || 'Failed to continue training');
      addLog(`[ERROR] ${err.message}`);
    }
  };

  // ── Download ──────────────────────────────────────────────────
  const handleDownload = async (format?: string) => {
    const mid = localModelId || trainedModelId || jobId;
    if (!mid) return;
    const token = getToken();
    const fmt = format || 'joblib';
    setDownloadingFormat(fmt);

    try {
      addLog(`[INFO] Downloading model in ${fmt} format...`);
      let url: string;
      let filename: string;

      if (format === 'package') {
        url = `/api/backend/export/package/${mid}`;
        filename = `${activeModel.toLowerCase().replace(/\s+/g, '_')}_deployment_package.zip`;
      } else {
        url = `/api/backend/export/model/${mid}?format=${fmt}`;
        filename = `${activeModel.toLowerCase().replace(/\s+/g, '_')}_model.${fmt}`;
      }

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      addLog(`[SUCCESS] Downloaded ${filename}`);
    } catch (e: any) {
      addLog(`[ERROR] Download failed: ${e.message}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────
  const isTraining = status === 'training';
  const isDone = status === 'completed';

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 05</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Model Training</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Configure your split, set hyperparameters, and train. Live loss curves stream from the backend.
      </p>

      {/* ── Error Banner ── */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl border bg-red-50 border-red-200 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[14px] font-bold text-red-700">Training Error</p>
            <p className="text-[13px] text-[#555] mt-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-[11px] text-red-400 mt-1 underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* ── AI Insight Banner ── */}
      {insight && (
        <div
          className={`mb-6 flex items-start gap-4 rounded-2xl px-5 py-4 border ${
            insight.color === 'red'
              ? 'bg-red-50 border-red-300'
              : insight.color === 'yellow'
              ? 'bg-yellow-50 border-yellow-300'
              : 'bg-green-50 border-green-300'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white ${
              insight.color === 'red' ? 'bg-red-500' : insight.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
            }`}
          >
            {insight.color === 'red' ? <TrendingUp size={18} /> : insight.color === 'yellow' ? <TrendingDown size={18} /> : <CheckCircle2 size={18} />}
          </div>
          <div className="flex-1">
            <p
              className={`text-[15px] font-bold mb-1 ${
                insight.color === 'red' ? 'text-red-800' : insight.color === 'yellow' ? 'text-yellow-800' : 'text-green-800'
              }`}
            >
              AI Analysis: {insight.title}
            </p>
            <p className={`text-[13px] mb-2 ${insight.color === 'red' ? 'text-red-700' : insight.color === 'yellow' ? 'text-yellow-700' : 'text-green-700'}`}>
              {insight.message}
            </p>
            <p className="text-[12px] font-bold text-[#555]">Recommendation: {insight.action}</p>
          </div>
          {(insight.status === 'undertrained' || insight.status === 'overtrained') && (
            <button
              onClick={handleRetrain}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#ddd] rounded-lg text-[12px] font-bold text-[#555] hover:border-[#FF4400] hover:text-[#FF4400] transition-colors shrink-0"
            >
              <RefreshCw size={12} /> Retrain
            </button>
          )}
        </div>
      )}

      <div className="flex gap-6">
        {/* ═══════════════════════════ Left Panel ═══════════════════════════ */}
        <div className="w-[300px] shrink-0 space-y-5">

          {/* ── Data Split ── */}
          <div className={`dashed-card transition-opacity ${splitLocked ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between mb-4 border-b border-[#f0ebe1] pb-3">
              <div className="flex items-center gap-2">
                <Sliders size={15} className="text-[#FF4400]" />
                <span className="section-label">DATA SPLIT</span>
              </div>
              <button
                onClick={aiSuggestSplit}
                className="flex items-center gap-1 text-[10px] font-bold text-[#FF4400] bg-[#FFF8F0] border border-[#FF4400]/30 rounded-lg px-2 py-1 hover:bg-[#FF4400] hover:text-white transition-colors"
              >
                <Zap size={10} /> AI Suggest
              </button>
            </div>

            <div className="space-y-4">
              {[
                { label: 'Train', pct: trainPct, color: '#FF4400', onChange: handleTrainPct, rows: Math.round(totalRows * trainPct / 100) },
                { label: 'Validation', pct: valPct, color: '#3B82F6', onChange: handleValPct, rows: Math.round(totalRows * valPct / 100) },
                { label: 'Test', pct: testPct, color: '#10B981', onChange: null, rows: Math.round(totalRows * testPct / 100) },
              ].map(({ label, pct, color, onChange, rows }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-bold text-[#555]">{label}</span>
                    <span className="text-[12px] font-bold" style={{ color, fontFamily: "'Space Mono', monospace" }}>
                      {pct}%{totalRows > 0 ? ` (${rows.toLocaleString()} rows)` : ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={90}
                    value={pct}
                    onChange={e => onChange?.(Number(e.target.value))}
                    disabled={!onChange}
                    className="w-full accent-[--split-color] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ '--split-color': color } as any}
                  />
                  <div className="h-1.5 rounded-full mt-1" style={{ background: color, width: `${pct}%`, opacity: 0.3 }} />
                </div>
              ))}
              <p className="text-[10px] text-[#aaa] mt-2">
                Train + Val + Test = {trainPct + valPct + testPct}%
                {trainPct + valPct + testPct !== 100 && <span className="text-red-500 ml-1">⚠ must equal 100</span>}
              </p>
            </div>
          </div>

          {/* ── Target Column Picker ── */}
          {availableColumns.length > 0 && (
            <div className={`dashed-card transition-opacity ${isTraining ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-2 mb-3 border-b border-[#f0ebe1] pb-3">
                <Activity size={15} className="text-[#FF4400]" />
                <span className="section-label">TARGET COLUMN</span>
              </div>
              {targetColumn && !availableColumns.includes(targetColumn) && !targetOverride && (
                <div className="mb-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠ "{targetColumn}" not found in dataset. Select the correct column below.
                </div>
              )}
              {targetColumn && !availableColumns.includes(targetColumn) && targetOverride && (
                <div className="mb-2 text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  ✓ Auto-matched "{targetColumn}" → <strong>{targetOverride}</strong>
                </div>
              )}
              <select
                value={effectiveTarget}
                onChange={e => setTargetOverride(e.target.value)}
                className="w-full h-9 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[13px] outline-none focus:border-[#FF4400] font-mono"
              >
                <option value="">— select target —</option>
                {availableColumns.map((col, i) => (
                  <option key={`${col}-${i}`} value={col}>{col}</option>
                ))}
              </select>
            </div>
          )}

          {/* ── Hyperparameters ── */}
          <div className={`dashed-card transition-opacity ${isTraining ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="flex items-center gap-2 mb-4 border-b border-[#f0ebe1] pb-3">
              <Settings2 size={15} className="text-[#FF4400]" />
              <span className="section-label">HYPERPARAMETERS</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Learning Rate', value: learningRate, onChange: setLearningRate, type: 'text', hint: 'e.g. 0.01 – 0.3' },
                { label: 'Reg Alpha (L1)', value: regAlpha, onChange: setRegAlpha, type: 'text', hint: 'L1 regularization' },
                { label: 'Reg Lambda (L2)', value: regLambda, onChange: setRegLambda, type: 'text', hint: 'L2 regularization' },
              ].map(({ label, value, onChange, type, hint }) => (
                <div key={label}>
                  <label className="text-[11px] font-bold text-[#555] mb-1 block">{label}</label>
                  <input
                    type={type}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={hint}
                    className="w-full h-8 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[12px] outline-none focus:border-[#FF4400] font-mono"
                  />
                </div>
              ))}
              <div>
                <label className="text-[11px] font-bold text-[#555] mb-1 block">Max Depth</label>
                <input
                  type="number"
                  value={maxDepth}
                  onChange={e => setMaxDepth(Number(e.target.value))}
                  min={1} max={20}
                  className="w-full h-8 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[12px] outline-none focus:border-[#FF4400] font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#555] mb-1 block">Estimators / Rounds</label>
                <input
                  type="number"
                  value={nEstimators}
                  onChange={e => setNEstimators(Number(e.target.value))}
                  min={10} max={2000}
                  className="w-full h-8 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[12px] outline-none focus:border-[#FF4400] font-mono"
                />
              </div>
              <div className="space-y-2 pt-1">
                {[
                  { key: 'useGpu', label: 'Use GPU Acceleration', val: useGpu, set: setUseGpu },
                  { key: 'earlyStop', label: `Early Stopping (10 rounds)`, val: earlyStop, set: setEarlyStop },
                ].map(({ key, label, val, set }) => (
                  <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => set(!val)}
                      className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${val ? 'bg-[#FF4400]' : 'bg-[#e0dbd4]'}`}
                    >
                      <div
                        className={`w-4 h-4 bg-white rounded-full mt-0.5 shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </div>
                    <span className="text-[12px] text-[#555]">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Action Button ── */}
          <div>
            {!isTraining && !isDone && (
              <button
                onClick={handleStart}
                disabled={!fileId || trainPct + valPct + testPct !== 100}
                className="w-full flex items-center justify-center gap-2 bg-[#FF4400] text-white rounded-xl py-3.5 font-bold text-[15px] shadow-[0_8px_24px_rgba(255,68,0,0.25)] hover:shadow-[0_12px_30px_rgba(255,68,0,0.35)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <Play size={18} className="ml-0.5" /> Start Training
              </button>
            )}
            {isTraining && (
              <button
                onClick={handleStop}
                className="w-full flex items-center justify-center gap-2 bg-[#1a1a1a] text-white rounded-xl py-3.5 font-bold text-[15px] hover:bg-[#333] transition-colors"
              >
                <Square size={16} /> Stop Training
              </button>
            )}
            {isDone && (
              <div className="space-y-2">
                {/* Continue from checkpoint */}
                <button
                  onClick={handleContinueTraining}
                  disabled={!localModelId}
                  className="w-full flex items-center justify-center gap-2 bg-[#FF4400] text-white rounded-xl py-3 font-bold text-[14px] shadow-[0_6px_20px_rgba(255,68,0,0.2)] hover:shadow-[0_8px_24px_rgba(255,68,0,0.3)] hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Play size={15} /> Continue Training
                </button>
                <p className="text-[10px] text-[#aaa] text-center -mt-1">
                  Adds more estimators to the same model
                </p>
                {/* Fresh retrain */}
                <button
                  onClick={handleRetrain}
                  className="w-full flex items-center justify-center gap-2 bg-white border-2 border-[#ddd] text-[#555] rounded-xl py-3 font-bold text-[14px] hover:border-[#FF4400] hover:text-[#FF4400] hover:bg-[#FFF8F0] transition-colors"
                >
                  <RefreshCw size={15} /> Retrain from Scratch
                </button>
                <p className="text-[10px] text-[#aaa] text-center -mt-1">
                  Resets model, adjust hyperparams first
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════ Main Panel ═══════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-5">

          {/* ── Live Loss Curve ── */}
          <div className="dashed-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={15} className="text-[#FF4400]" />
                <span className="section-label">LIVE METRICS — ACTUAL LOSS CURVE</span>
              </div>
              <div className="flex items-center gap-3">
                {isTraining && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[11px] text-green-600 font-bold">
                      LIVE — Epoch {currentEpoch}/{nEstimators}
                    </span>
                  </div>
                )}
                {isDone && chartData.length > 0 && (
                  <span className="text-[11px] text-[#10B981] font-bold">COMPLETE — {chartData.length} epochs</span>
                )}
                {!isTraining && chartData.length === 0 && (
                  <span className="text-[11px] text-[#999]">READY</span>
                )}
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe1" />
                  <XAxis
                    dataKey="epoch"
                    tick={{ fontSize: 10, fill: '#999' }}
                    axisLine={false}
                    tickLine={false}
                    label={{ value: 'Epoch', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#999' }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#999' }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 11 }}
                    formatter={(v: any, name: string) => [parseFloat(v).toFixed(6), name === 'train_loss' ? 'Train Loss' : 'Val Loss']}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v: string) => v === 'train_loss' ? 'Train Loss' : 'Validation Loss'}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="train_loss"
                    stroke="#FF4400"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="train_loss"
                  />
                  <Line
                    type="monotone"
                    dataKey="val_loss"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="val_loss"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex flex-col items-center justify-center text-[#ccc]">
                <Activity size={36} className="mb-3 opacity-30" />
                <p className="text-[13px]">Start training to view live loss curves</p>
                <p className="text-[11px] mt-1 text-[#ddd]">Real train and validation loss from your dataset</p>
              </div>
            )}

            {/* Progress bar */}
            {isTraining && (
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-[#999] mb-1">
                  <span>Progress</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-[#f0ebe1] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#FF4400] rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Final Metrics ── */}
          {isDone && finalMetrics && Object.keys(finalMetrics).length > 0 && (
            <div className="dashed-card">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 size={15} className="text-green-500" />
                <span className="section-label">FINAL METRICS — TEST SET EVALUATION</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(finalMetrics).map(([k, v]) => (
                  <div key={k} className="bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl p-3 text-center">
                    <span className="block text-[9px] text-[#888] font-bold uppercase tracking-wider mb-1">
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span className="block text-[22px] font-bold text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {typeof v === 'number'
                        ? v <= 1
                          ? `${(v * 100).toFixed(2)}%`
                          : v.toFixed(4)
                        : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Downloads ── */}
          {isDone && localModelId && (
            <div className="dashed-card">
              <div className="flex items-center gap-2 mb-4">
                <Download size={15} className="text-[#FF4400]" />
                <span className="section-label">DOWNLOAD TRAINED MODEL</span>
              </div>
              <p className="text-[12px] text-[#888] mb-4">
                Real trained model saved to disk. Download and use it locally with Python — no website required.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {/* Full deployment package */}
                <button
                  onClick={() => handleDownload('package')}
                  disabled={downloadingFormat === 'package'}
                  className="flex items-center gap-2 p-3 bg-[#FF4400] text-white rounded-xl hover:bg-[#e53d00] transition-colors disabled:opacity-50 col-span-2"
                >
                  {downloadingFormat === 'package' ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                  <div className="text-left">
                    <span className="block text-[13px] font-bold">Full Deployment Package (.zip)</span>
                    <span className="block text-[10px] opacity-75">Model + inference code + requirements + README</span>
                  </div>
                </button>

                {/* Available formats from backend */}
                {downloadFormats.map((fmt: any) => (
                  <button
                    key={fmt.format}
                    onClick={() => handleDownload(fmt.format)}
                    disabled={downloadingFormat === fmt.format}
                    className="flex items-center gap-2 p-3 bg-white border border-[#f0ebe1] rounded-xl hover:border-[#FF4400] hover:bg-[#FFF8F0] transition-colors disabled:opacity-50"
                  >
                    {downloadingFormat === fmt.format ? (
                      <Loader2 size={14} className="animate-spin text-[#FF4400] shrink-0" />
                    ) : (
                      <FileJson size={14} className="text-[#FF4400] shrink-0" />
                    )}
                    <div className="text-left min-w-0">
                      <span className="block text-[12px] font-bold text-[#1a1a1a] truncate">{fmt.label}</span>
                      <span className="block text-[10px] text-[#888] truncate">
                        {(fmt.size_bytes / 1024).toFixed(1)} KB — {fmt.description}
                      </span>
                    </div>
                  </button>
                ))}

                {/* Fallback: always show joblib if no formats loaded yet */}
                {downloadFormats.length === 0 && (
                  <button
                    onClick={() => handleDownload('joblib')}
                    disabled={downloadingFormat === 'joblib'}
                    className="flex items-center gap-2 p-3 bg-white border border-[#f0ebe1] rounded-xl hover:border-[#FF4400] hover:bg-[#FFF8F0] transition-colors disabled:opacity-50"
                  >
                    {downloadingFormat === 'joblib' ? (
                      <Loader2 size={14} className="animate-spin text-[#FF4400] shrink-0" />
                    ) : (
                      <Archive size={14} className="text-[#FF4400] shrink-0" />
                    )}
                    <div className="text-left">
                      <span className="block text-[12px] font-bold text-[#1a1a1a]">Joblib (.joblib)</span>
                      <span className="block text-[10px] text-[#888]">sklearn/XGBoost model — use with joblib.load()</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Quick usage snippet */}
              <div className="mt-4 bg-[#1a1a1a] rounded-xl p-4 text-[11px] font-mono text-[#aaa] leading-relaxed">
                <span className="text-[#666]"># Python usage after download</span>{'\n'}
                <span className="text-[#FF4400]">import</span> joblib{'\n'}
                model = joblib.load(<span className="text-[#a3e635]">&quot;model.joblib&quot;</span>){'\n'}
                prediction = model.predict(X_new)
              </div>
            </div>
          )}

          {/* ── Training Log ── */}
          <div className="bg-[#0d0d0d] border border-[#333] rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#333] flex items-center gap-2">
              <Terminal size={13} className="text-[#999]" />
              <span
                className="text-[11px] font-bold text-[#666]"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                TRAINING OUTPUT
              </span>
              {isTraining && <Loader2 size={11} className="text-[#FF4400] animate-spin ml-auto" />}
            </div>
            <div className="p-4 h-[200px] overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-[#555] text-[12px] font-mono">Waiting to start...</p>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={`text-[12px] font-mono mb-0.5 ${
                      log.startsWith('[ERROR]')
                        ? 'text-red-400'
                        : log.startsWith('[SUCCESS]')
                        ? 'text-green-400'
                        : log.startsWith('[METRIC]')
                        ? 'text-blue-400'
                        : 'text-[#aaa]'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>

      <PipelineNav
        prevLink="/dashboard/models"
        prevTitle="Model Benchmark"
        nextLink="/dashboard/testing"
        nextTitle="Model Testing"
      />
    </div>
  );
}
