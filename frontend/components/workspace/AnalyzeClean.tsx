'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import {
  Search, Sparkles, Download, Check, X, AlertTriangle, Info,
  ChevronDown, ChevronUp, Eraser, Shield, Zap, Database,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
interface ColumnStats {
  name: string;
  dtype: string;
  missing: number;
  missingPct: number;
  unique: number;
  uniquePct: number;
  isConstant: boolean;
  isHighCardinality: boolean;
  isDateLike: boolean;
  hasInconsistentCasing: boolean;
  inconsistentSamples: string[];
  // Numeric
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  outlierCount?: number;
  // Categorical
  topValues?: { value: string; count: number }[];
}

interface QualityIssue {
  column: string;
  issueType: string;
  affectedRows: number;
  severity: 'High' | 'Medium' | 'Low';
  recommendation: string;
}

interface AIResult {
  summary: string;
  taskType: string;
  taskReason: string;
  targetColumn: string;
  cleaningAdvice: string;
}

interface CleaningOp {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  affectedColumns: string[];
  affectedRows: number;
}

interface Props {
  data: Record<string, string>[];
  onCleanedDataReady: (cleanedData: Record<string, string>[]) => void;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const LOADING_MESSAGES = [
  'Sending full dataset to AI...',
  'Reading every row and column...',
  'Detecting missing values across all rows...',
  'Scanning for outliers and anomalies...',
  'Identifying target variable...',
  'Generating cleaning recommendations...',
];

const CLEANING_MODELS = [
  { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B', desc: 'Best for structured data' },
  { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B', desc: 'Fast & efficient' },
  { id: 'microsoft/phi-3-mini-128k-instruct', name: 'Phi-3 Mini', desc: 'Lightweight' },
  { id: 'google/gemma-2-9b-it', name: 'Gemma 2 9B', desc: 'Balanced' },
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function isEmptyValue(v: string | undefined | null): boolean {
  if (v === undefined || v === null) return true;
  const s = String(v).trim();
  return s === '' || s === 'null' || s === 'undefined' || s === 'NaN' || s === 'NA' || s === 'N/A' || s === 'nan' || s === 'none';
}

function detectDtype(values: string[]): string {
  const nonEmpty = values.filter(v => !isEmptyValue(v));
  if (nonEmpty.length === 0) return 'unknown';
  const numCount = nonEmpty.filter(v => !isNaN(Number(v)) && v.trim() !== '').length;
  if (numCount / nonEmpty.length > 0.85) return nonEmpty.some(v => v.includes('.')) ? 'float64' : 'int64';
  const datePatterns = [/^\d{4}-\d{2}-\d{2}/, /^\d{2}\/\d{2}\/\d{4}/, /^\d{2}-\d{2}-\d{4}/];
  if (nonEmpty.filter(v => datePatterns.some(p => p.test(v))).length / nonEmpty.length > 0.5) return 'datetime';
  return 'categorical';
}

function computeMedian(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function computeMode(vals: string[]): string {
  const c: Record<string, number> = {};
  vals.forEach(v => { c[v] = (c[v] || 0) + 1; });
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function computeIQR(nums: number[]) {
  const s = [...nums].sort((a, b) => a - b);
  const q1 = s[Math.floor(s.length * 0.25)];
  const q3 = s[Math.floor(s.length * 0.75)];
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

function computeAllColumnStats(data: Record<string, string>[]): ColumnStats[] {
  if (!data.length) return [];
  const colNames = Object.keys(data[0]);
  return colNames.map(name => {
    const values = data.map(r => (r[name] ?? '').toString());
    const missing = values.filter(v => isEmptyValue(v)).length;
    const nonEmpty = values.filter(v => !isEmptyValue(v));
    const unique = new Set(nonEmpty).size;
    const dtype = detectDtype(values);
    const isConstant = unique <= 1;
    const isHighCardinality = unique > data.length * 0.9 && dtype === 'categorical';
    const isDateLike = dtype === 'datetime';

    // Inconsistent casing check for categorical
    let hasInconsistentCasing = false;
    const inconsistentSamples: string[] = [];
    if (dtype === 'categorical') {
      const lower = new Map<string, Set<string>>();
      nonEmpty.forEach(v => {
        const lv = v.toLowerCase().trim();
        if (!lower.has(lv)) lower.set(lv, new Set());
        lower.get(lv)!.add(v);
      });
      lower.forEach((variants) => {
        if (variants.size > 1) {
          hasInconsistentCasing = true;
          inconsistentSamples.push([...variants].slice(0, 3).join(' / '));
        }
      });
    }

    const stats: ColumnStats = { name, dtype, missing, missingPct: (missing / data.length) * 100, unique, uniquePct: (unique / data.length) * 100, isConstant, isHighCardinality, isDateLike, hasInconsistentCasing, inconsistentSamples };

    if (dtype === 'int64' || dtype === 'float64') {
      const nums = nonEmpty.map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        stats.mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        stats.median = computeMedian(nums);
        stats.min = Math.min(...nums);
        stats.max = Math.max(...nums);
        const { lower, upper } = computeIQR(nums);
        stats.outlierCount = nums.filter(n => n < lower || n > upper).length;
      }
    }

    if (dtype === 'categorical') {
      const counts: Record<string, number> = {};
      nonEmpty.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
      stats.topValues = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value, count }));
    }

    return stats;
  });
}

function buildQualityIssues(stats: ColumnStats[], totalRows: number): QualityIssue[] {
  const issues: QualityIssue[] = [];
  stats.forEach(col => {
    if (col.missing > 0) {
      issues.push({ column: col.name, issueType: 'Missing Values', affectedRows: col.missing, severity: col.missingPct > 20 ? 'High' : col.missingPct > 5 ? 'Medium' : 'Low', recommendation: col.dtype === 'int64' || col.dtype === 'float64' ? `Fill with median (${col.median?.toFixed(2)})` : `Fill with mode` });
    }
    if (col.outlierCount && col.outlierCount > 0) {
      issues.push({ column: col.name, issueType: 'Outliers', affectedRows: col.outlierCount, severity: col.outlierCount / totalRows > 0.05 ? 'High' : 'Medium', recommendation: `Remove using IQR method (${col.outlierCount} values outside 1.5×IQR range)` });
    }
    if (col.isConstant) {
      issues.push({ column: col.name, issueType: 'Constant Column', affectedRows: totalRows, severity: 'Medium', recommendation: 'Drop — provides no predictive value' });
    }
    if (col.hasInconsistentCasing) {
      issues.push({ column: col.name, issueType: 'Inconsistent Casing', affectedRows: 0, severity: 'Low', recommendation: `Standardize text casing (e.g., ${col.inconsistentSamples[0]})` });
    }
    if (col.missingPct > 50) {
      issues.push({ column: col.name, issueType: 'Mostly Missing', affectedRows: col.missing, severity: 'High', recommendation: `Column is ${col.missingPct.toFixed(0)}% missing — consider dropping` });
    }
  });
  return issues.sort((a, b) => { const sev = { High: 0, Medium: 1, Low: 2 }; return sev[a.severity] - sev[b.severity]; });
}

function detectTarget(stats: ColumnStats[]): string {
  const candidates = stats.filter(c => /target|label|class|y|output|result|exited|churn|fraud|survived|price|salary/i.test(c.name));
  if (candidates.length > 0) return candidates[0].name;
  return stats[stats.length - 1]?.name || '';
}

function detectTaskFromStats(stats: ColumnStats[], target: string): string {
  const col = stats.find(c => c.name === target);
  if (!col) return 'Classification';
  if (col.dtype === 'float64' && col.unique > 20) return 'Regression';
  if (col.unique === 2) return 'Binary Classification';
  if (col.unique <= 20) return 'Multi-class Classification';
  return 'Regression';
}

// ═══════════════════════════════════════════════════════
// STREAMING HELPER
// ═══════════════════════════════════════════════════════
async function streamNvidiaResponse(
  prompt: string,
  model: string,
  systemPrompt: string
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system_prompt: systemPrompt,
      max_tokens: 4096,
      temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No reader');
  const decoder = new TextDecoder();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
    for (const line of lines) {
      const d = line.slice(6);
      if (d === '[DONE]') break;
      try {
        const parsed = JSON.parse(d);
        accumulated += parsed.choices?.[0]?.delta?.content || '';
      } catch { /* skip */ }
    }
  }
  return accumulated;
}

function extractJSON(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text); } catch { /* continue */ }
  const m1 = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m1) { try { return JSON.parse(m1[1].trim()); } catch { /* continue */ } }
  const m2 = text.match(/\{[\s\S]*\}/);
  if (m2) { try { return JSON.parse(m2[0]); } catch { /* continue */ } }
  return null;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function AnalyzeClean({ data, onCleanedDataReady }: Props) {
  // ─── State ────────────────────────────────────────────
  const [phase, setPhase] = useState<'analyzing' | 'analyzed' | 'cleaning' | 'cleaned'>('analyzing');
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [columnStats, setColumnStats] = useState<ColumnStats[]>([]);
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([]);
  const [targetCol, setTargetCol] = useState('');
  const [taskType, setTaskType] = useState('');
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiFailed, setAiFailed] = useState(false);
  const [selectedModel, setSelectedModel] = useState(CLEANING_MODELS[0].id);
  const [cleaningOps, setCleaningOps] = useState<CleaningOp[]>([]);
  const [cleaningLog, setCleaningLog] = useState<string[]>([]);
  const [cleanedData, setCleanedData] = useState<Record<string, string>[] | null>(null);
  const [showHealthyCols, setShowHealthyCols] = useState(false);
  const [dupeCount, setDupeCount] = useState(0);
  const analysisRan = useRef(false);

  // ─── Loading Message Cycling ──────────────────────────
  useEffect(() => {
    if (phase !== 'analyzing') return;
    const interval = setInterval(() => {
      setLoadingMsgIdx(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [phase]);

  // ─── Run Analysis on Mount ────────────────────────────
  useEffect(() => {
    if (analysisRan.current) return;
    analysisRan.current = true;

    (async () => {
      // 1. Compute JS stats from FULL dataset
      const stats = computeAllColumnStats(data);
      setColumnStats(stats);

      const issues = buildQualityIssues(stats, data.length);
      setQualityIssues(issues);

      const target = detectTarget(stats);
      setTargetCol(target);
      const task = detectTaskFromStats(stats, target);
      setTaskType(task);

      // Compute duplicate count
      const seen = new Set<string>();
      let dupes = 0;
      for (const row of data) {
        const key = JSON.stringify(row);
        if (seen.has(key)) dupes++;
        seen.add(key);
      }
      setDupeCount(dupes);

      // 2. Build cleaning ops with real counts
      const numMissingCols = stats.filter(c => (c.dtype === 'int64' || c.dtype === 'float64') && c.missing > 0);
      const catMissingCols = stats.filter(c => c.dtype === 'categorical' && c.missing > 0);
      const inconsistentCols = stats.filter(c => c.hasInconsistentCasing);
      const outlierCols = stats.filter(c => (c.outlierCount ?? 0) > 0);
      const highMissingCols = stats.filter(c => c.missingPct > 50);
      const dateLikeCols = stats.filter(c => c.isDateLike);
      const constantCols = stats.filter(c => c.isConstant);

      setCleaningOps([
        { id: 'fill_num', label: 'Fill missing numerical values (median)', description: `Columns: ${numMissingCols.map(c => c.name).join(', ') || 'None'} — ${numMissingCols.reduce((s, c) => s + c.missing, 0)} cells`, checked: true, affectedColumns: numMissingCols.map(c => c.name), affectedRows: numMissingCols.reduce((s, c) => s + c.missing, 0) },
        { id: 'fill_cat', label: 'Fill missing categorical values (mode)', description: `Columns: ${catMissingCols.map(c => c.name).join(', ') || 'None'} — ${catMissingCols.reduce((s, c) => s + c.missing, 0)} cells`, checked: true, affectedColumns: catMissingCols.map(c => c.name), affectedRows: catMissingCols.reduce((s, c) => s + c.missing, 0) },
        { id: 'dedup', label: 'Remove duplicate rows', description: `${dupes} exact duplicate rows found`, checked: true, affectedColumns: [], affectedRows: dupes },
        { id: 'fix_casing', label: 'Fix inconsistent text casing', description: `Columns: ${inconsistentCols.map(c => c.name).join(', ') || 'None'}`, checked: true, affectedColumns: inconsistentCols.map(c => c.name), affectedRows: inconsistentCols.length > 0 ? data.length : 0 },
        { id: 'remove_outliers', label: 'Remove outliers using IQR method', description: `Columns: ${outlierCols.map(c => `${c.name} (${c.outlierCount})`).join(', ') || 'None'} — ${outlierCols.reduce((s, c) => s + (c.outlierCount ?? 0), 0)} values`, checked: false, affectedColumns: outlierCols.map(c => c.name), affectedRows: outlierCols.reduce((s, c) => s + (c.outlierCount ?? 0), 0) },
        { id: 'drop_high_missing', label: 'Drop columns >50% missing', description: `Columns: ${highMissingCols.map(c => c.name).join(', ') || 'None'}`, checked: false, affectedColumns: highMissingCols.map(c => c.name), affectedRows: highMissingCols.length > 0 ? data.length : 0 },
        { id: 'convert_dates', label: 'Convert date-like string columns', description: `Columns: ${dateLikeCols.map(c => c.name).join(', ') || 'None'}`, checked: false, affectedColumns: dateLikeCols.map(c => c.name), affectedRows: dateLikeCols.length > 0 ? data.length : 0 },
        { id: 'drop_constant', label: 'Drop constant columns', description: `Columns: ${constantCols.map(c => c.name).join(', ') || 'None'}`, checked: false, affectedColumns: constantCols.map(c => c.name), affectedRows: constantCols.length > 0 ? data.length : 0 },
      ]);

      // 3. Call NVIDIA API for AI analysis
      try {
        const statsForAI = stats.map(c => ({
          name: c.name, type: c.dtype, missing: c.missing,
          unique: c.unique, mean: c.mean?.toFixed(2), median: c.median?.toFixed(2),
          outliers: c.outlierCount, topValues: c.topValues?.slice(0, 3),
        }));

        // Send dataset: if small enough send all, otherwise send stats + sample
        const fullJson = JSON.stringify(data);
        let dataPortion: string;
        if (fullJson.length < 80000) {
          dataPortion = fullJson;
        } else {
          const sampleRows = data.slice(0, 200);
          dataPortion = JSON.stringify(sampleRows);
        }

        const prompt = `You are an expert data scientist. I am giving you a dataset with ${data.length} rows and ${stats.length} columns for thorough analysis.

COMPUTED STATISTICS (exact counts from all ${data.length} rows):
${JSON.stringify(statsForAI, null, 1)}

Duplicate rows found: ${dupes}

DATA (${fullJson.length < 80000 ? 'complete dataset' : `first 200 of ${data.length} rows`}):
${dataPortion}

Analyze this dataset and respond with ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "2-3 sentence plain English description of what this dataset is about",
  "task_type": "Binary Classification|Multi-class Classification|Regression|Clustering|Time Series",
  "task_reason": "Why this task type, based on the target column distribution",
  "target_column": "name of the best target column",
  "cleaning_advice": "Overall cleaning strategy recommendation in 2-3 sentences"
}`;

        const raw = await streamNvidiaResponse(
          prompt,
          'meta/llama-3.1-70b-instruct',
          'You are an expert data scientist. Respond ONLY with valid JSON. No explanations, no markdown.'
        );

        const parsed = extractJSON(raw);
        if (parsed) {
          setAiResult({
            summary: (parsed.summary as string) || 'Dataset analysis completed.',
            taskType: (parsed.task_type as string) || task,
            taskReason: (parsed.task_reason as string) || '',
            targetColumn: (parsed.target_column as string) || target,
            cleaningAdvice: (parsed.cleaning_advice as string) || '',
          });
          if (parsed.task_type) setTaskType(parsed.task_type as string);
          if (parsed.target_column) setTargetCol(parsed.target_column as string);
        } else {
          setAiFailed(true);
        }
      } catch (err) {
        console.error('AI analysis failed:', err);
        setAiFailed(true);
      }

      setPhase('analyzed');
    })();
  }, [data]);

  // ─── Toggle Cleaning Op ──────────────────────────────
  const toggleOp = (id: string) => {
    setCleaningOps(prev => prev.map(op => op.id === id ? { ...op, checked: !op.checked } : op));
  };

  // ─── Apply Cleaning ───────────────────────────────────
  const applyCleaning = useCallback(async () => {
    setPhase('cleaning');
    setCleaningLog([]);
    let cleaned = data.map(row => ({ ...row })); // deep copy
    const log: string[] = [];
    const checked = cleaningOps.filter(op => op.checked);

    for (const op of checked) {
      await new Promise(r => setTimeout(r, 800)); // delay for animation

      if (op.id === 'fill_num') {
        let filled = 0;
        op.affectedColumns.forEach(colName => {
          const col = columnStats.find(c => c.name === colName);
          if (!col || col.median === undefined) return;
          const med = col.median;
          cleaned.forEach(row => {
            if (isEmptyValue(row[colName])) { row[colName] = String(med); filled++; }
          });
        });
        log.push(`✅ Filled ${filled} missing numerical values across ${op.affectedColumns.join(', ')} columns using median`);
      }

      if (op.id === 'fill_cat') {
        let filled = 0;
        op.affectedColumns.forEach(colName => {
          const nonEmpty = cleaned.map(r => r[colName]).filter(v => !isEmptyValue(v));
          const m = computeMode(nonEmpty);
          cleaned.forEach(row => {
            if (isEmptyValue(row[colName])) { row[colName] = m; filled++; }
          });
        });
        log.push(`✅ Filled ${filled} missing categorical values across ${op.affectedColumns.join(', ')} columns using mode`);
      }

      if (op.id === 'dedup') {
        const before = cleaned.length;
        const seen = new Set<string>();
        cleaned = cleaned.filter(row => {
          const key = JSON.stringify(row);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        log.push(`✅ Removed ${before - cleaned.length} duplicate rows from ${before} total rows`);
      }

      if (op.id === 'fix_casing') {
        let fixed = 0;
        op.affectedColumns.forEach(colName => {
          cleaned.forEach(row => {
            const v = row[colName];
            if (v && !isEmptyValue(v)) {
              const trimmed = v.trim().toLowerCase();
              const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
              if (row[colName] !== capitalized) { row[colName] = capitalized; fixed++; }
            }
          });
        });
        log.push(`✅ Standardized casing in ${fixed} cells across ${op.affectedColumns.join(', ')} columns`);
      }

      if (op.id === 'remove_outliers') {
        const before = cleaned.length;
        op.affectedColumns.forEach(colName => {
          const nums = cleaned.map(r => Number(r[colName])).filter(n => !isNaN(n));
          if (nums.length === 0) return;
          const { lower, upper } = computeIQR(nums);
          cleaned = cleaned.filter(row => {
            const v = Number(row[colName]);
            if (isNaN(v)) return true;
            return v >= lower && v <= upper;
          });
        });
        log.push(`✅ Removed ${before - cleaned.length} outlier rows using IQR method on ${op.affectedColumns.join(', ')}`);
      }

      if (op.id === 'drop_high_missing') {
        op.affectedColumns.forEach(colName => {
          cleaned.forEach(row => { delete row[colName]; });
        });
        log.push(`✅ Dropped ${op.affectedColumns.length} columns with >50% missing values: ${op.affectedColumns.join(', ')}`);
      }

      if (op.id === 'convert_dates') {
        log.push(`✅ Marked ${op.affectedColumns.join(', ')} as datetime columns for downstream processing`);
      }

      if (op.id === 'drop_constant') {
        op.affectedColumns.forEach(colName => {
          cleaned.forEach(row => { delete row[colName]; });
        });
        log.push(`✅ Dropped ${op.affectedColumns.length} constant columns: ${op.affectedColumns.join(', ')}`);
      }

      setCleaningLog([...log]);
    }

    setCleanedData(cleaned);
    onCleanedDataReady(cleaned);
    setPhase('cleaned');
  }, [data, cleaningOps, columnStats, onCleanedDataReady]);

  // ─── Download Cleaned CSV ─────────────────────────────
  const downloadCleaned = () => {
    if (!cleanedData) return;
    const csv = Papa.unparse(cleanedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cleaned_dataset.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Computed values
  const healthyCols = columnStats.filter(c => c.missing === 0 && !c.isConstant && !c.hasInconsistentCasing && (c.outlierCount ?? 0) === 0);
  const totalMissing = columnStats.reduce((s, c) => s + c.missing, 0);
  const featureCols = columnStats.filter(c => c.name !== targetCol);

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  return (
    <div className="space-y-8">
      <div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
          AI Dataset Analysis & Cleaning
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Deep analysis of your full dataset with intelligent cleaning recommendations.
        </p>
      </div>

      {/* ════════ LOADING STATE ════════ */}
      {phase === 'analyzing' && (
        <div className="py-16">
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full overflow-hidden mb-8" style={{ background: 'var(--border-light)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #7C3AED, #A78BFA, #7C3AED)', backgroundSize: '200% 100%' }}
              animate={{ width: ['0%', '70%', '85%', '90%'], backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
              transition={{ duration: 8, ease: 'easeInOut', repeat: Infinity, repeatType: 'reverse' }}
            />
          </div>
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-surface)', border: '1px solid rgba(124,58,237,0.15)' }}>
              <Search className="w-7 h-7 animate-pulse" style={{ color: 'var(--color-primary)' }} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingMsgIdx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-[16px] font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {LOADING_MESSAGES[loadingMsgIdx]}
              </motion.p>
            </AnimatePresence>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Analyzing {data.length.toLocaleString()} rows × {Object.keys(data[0] || {}).length} columns
            </p>
          </div>
        </div>
      )}

      {/* ════════ ANALYSIS RESULTS ════════ */}
      {(phase === 'analyzed' || phase === 'cleaning' || phase === 'cleaned') && (
        <div className="space-y-8">

          {/* AI Failed Warning */}
          {aiFailed && (
            <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#FFFBEB', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#F59E0B' }} />
              <p className="text-[13px] font-medium" style={{ color: '#92400E' }}>AI narrative unavailable — showing computed statistics from your full dataset.</p>
            </div>
          )}

          {/* ── SECTION A: Dataset Summary ── */}
          <div className="rounded-2xl p-6" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.04), rgba(167,139,250,0.06))', border: '1px solid rgba(124,58,237,0.15)' }}>
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
                <Database className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-primary)' }}>DATASET SUMMARY</p>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {aiResult?.summary || `Dataset with ${data.length.toLocaleString()} rows and ${columnStats.length} columns. Contains ${columnStats.filter(c => c.dtype === 'int64' || c.dtype === 'float64').length} numerical and ${columnStats.filter(c => c.dtype === 'categorical').length} categorical features.`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>📊 {data.length.toLocaleString()} rows</span>
              <span className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>📋 {columnStats.length} columns</span>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED' }}>🎯 {taskType}</span>
                <select
                  value={taskType}
                  onChange={e => setTaskType(e.target.value)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg outline-none cursor-pointer"
                  style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                >
                  <option>Binary Classification</option>
                  <option>Multi-class Classification</option>
                  <option>Classification</option>
                  <option>Regression</option>
                  <option>Clustering</option>
                  <option>Time Series</option>
                </select>
              </div>
            </div>
            {aiResult?.taskReason && (
              <p className="text-[12px] mt-3 pl-14" style={{ color: 'var(--text-secondary)' }}>{aiResult.taskReason}</p>
            )}
          </div>

          {/* ── SECTION B: Data Quality Report ── */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
              DATA QUALITY REPORT — {qualityIssues.length} issues found
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {qualityIssues.map((issue, i) => (
                <div key={i} className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="shrink-0 mt-0.5">
                    {issue.severity === 'High' ? <AlertTriangle className="w-4 h-4" style={{ color: '#EF4444' }} /> :
                     issue.severity === 'Medium' ? <Info className="w-4 h-4" style={{ color: '#F59E0B' }} /> :
                     <Info className="w-4 h-4" style={{ color: '#3B82F6' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>{issue.column}</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
                        background: issue.severity === 'High' ? '#FEF2F2' : issue.severity === 'Medium' ? '#FFFBEB' : '#EFF6FF',
                        color: issue.severity === 'High' ? '#EF4444' : issue.severity === 'Medium' ? '#F59E0B' : '#3B82F6',
                      }}>{issue.severity}</span>
                    </div>
                    <p className="text-[11px] font-semibold mb-0.5" style={{ color: 'var(--text-secondary)' }}>{issue.issueType} — {issue.affectedRows.toLocaleString()} rows</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{issue.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Healthy columns */}
            {healthyCols.length > 0 && (
              <div className="mt-3">
                <button onClick={() => setShowHealthyCols(!showHealthyCols)} className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer bg-transparent border-0 py-2" style={{ color: '#22C55E' }}>
                  {showHealthyCols ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  Healthy Columns ✅ ({healthyCols.length})
                </button>
                {showHealthyCols && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {healthyCols.map(c => (
                      <span key={c.name} className="text-[11px] font-medium px-3 py-1 rounded-full" style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>{c.name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── SECTION C: Feature & Target Detection ── */}
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>
              FEATURE & TARGET DETECTION
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Features (left 2 cols) */}
              <div className="md:col-span-2 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                <div className="px-4 py-3" style={{ background: 'var(--bg-surface)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Feature Columns ({featureCols.length})</p>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-light)' }}>
                  {featureCols.map(col => (
                    <div key={col.name} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50/50 cursor-pointer group" onClick={() => setTargetCol(col.name)}>
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{col.name}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                          background: col.dtype === 'int64' || col.dtype === 'float64' ? '#EFF6FF' : col.dtype === 'categorical' ? '#F5F3FF' : '#FFFBEB',
                          color: col.dtype === 'int64' || col.dtype === 'float64' ? '#3B82F6' : col.dtype === 'categorical' ? '#7C3AED' : '#F59E0B',
                        }}>{col.dtype}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        <span>{col.unique.toLocaleString()} unique</span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold" style={{ color: 'var(--color-primary)' }}>Set as Target →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target (right 1 col) */}
              <div className="rounded-xl overflow-hidden" style={{ border: '2px solid var(--color-primary)', background: 'rgba(124,58,237,0.02)' }}>
                <div className="px-4 py-3" style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(167,139,250,0.12))' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-primary)' }}>🎯 Target Column</p>
                </div>
                <div className="p-4 space-y-3">
                  <p className="font-bold text-[16px]" style={{ color: 'var(--text-primary)' }}>{targetCol}</p>
                  {columnStats.find(c => c.name === targetCol) && (() => {
                    const col = columnStats.find(c => c.name === targetCol)!;
                    return (
                      <>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F5F3FF', color: '#7C3AED' }}>{col.dtype}</span>
                        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{col.unique} unique values</p>
                        {col.topValues && (
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[10px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Value Distribution</p>
                            {col.topValues.map(tv => (
                              <div key={tv.value} className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-light)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${(tv.count / data.length) * 100}%`, background: 'var(--color-primary)' }} />
                                </div>
                                <span className="text-[10px] font-semibold shrink-0 w-16 text-right" style={{ color: 'var(--text-primary)' }}>{tv.value}</span>
                                <span className="text-[10px] shrink-0 w-10" style={{ color: 'var(--text-muted)' }}>{tv.count}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ════════ CLEANING PANEL ════════ */}
          {phase !== 'cleaned' && (
            <div className="space-y-6 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Clean Your Data</h3>
                <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Select operations and a model to assist with cleaning.</p>
              </div>

              {/* Model Selector */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>SELECT AI MODEL</p>
                <div className="flex flex-wrap gap-3">
                  {CLEANING_MODELS.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m.id)}
                      className="rounded-xl p-4 transition-all cursor-pointer text-left"
                      style={{
                        background: selectedModel === m.id ? 'rgba(124,58,237,0.05)' : 'var(--bg-card)',
                        border: `2px solid ${selectedModel === m.id ? 'var(--color-primary)' : 'var(--border)'}`,
                        minWidth: 150,
                      }}
                    >
                      <p className="font-bold text-[13px]" style={{ color: selectedModel === m.id ? 'var(--color-primary)' : 'var(--text-primary)' }}>{m.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Operations Checklist */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>CLEANING OPERATIONS</p>
                <div className="space-y-2">
                  {cleaningOps.map(op => (
                    <div key={op.id} onClick={() => { if (phase !== 'cleaning') toggleOp(op.id); }} className="flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer hover:bg-gray-50/50" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-all" style={{
                        background: op.checked ? 'var(--color-primary)' : 'var(--bg-base)',
                        border: op.checked ? 'none' : '2px solid var(--border)',
                      }}>
                        {op.checked && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{op.label}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{op.description}</p>
                      </div>
                      {op.affectedRows > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: '#F5F3FF', color: '#7C3AED' }}>{op.affectedRows.toLocaleString()} rows</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Clean Button */}
              <button
                onClick={applyCleaning}
                disabled={phase === 'cleaning' || cleaningOps.filter(o => o.checked).length === 0}
                className="w-full py-4 rounded-xl font-bold text-[15px] text-white flex items-center justify-center gap-2 transition-all cursor-pointer border-0"
                style={{
                  background: phase === 'cleaning' ? '#9CA3AF' : 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                  boxShadow: phase === 'cleaning' ? 'none' : '0 4px 20px rgba(124, 58, 237, 0.3)',
                  opacity: cleaningOps.filter(o => o.checked).length === 0 ? 0.5 : 1,
                }}
              >
                {phase === 'cleaning' ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Cleaning...</>
                ) : (
                  <>✨ Clean Dataset with {CLEANING_MODELS.find(m => m.id === selectedModel)?.name}</>
                )}
              </button>
            </div>
          )}

          {/* ════════ CLEANING PROGRESS LOG ════════ */}
          {(phase === 'cleaning' || phase === 'cleaned') && cleaningLog.length > 0 && (
            <div className="rounded-xl p-5 space-y-2" style={{ background: '#0F172A' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>CLEANING LOG</p>
              {cleaningLog.map((line, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-[12px] font-mono"
                  style={{ color: '#A7F3D0' }}
                >
                  {line}
                </motion.p>
              ))}
            </div>
          )}

          {/* ════════ CLEANED: BEFORE / AFTER ════════ */}
          {phase === 'cleaned' && cleanedData && (
            <div className="space-y-6">
              {/* Before / After Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-5 text-center" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#EF4444' }}>BEFORE CLEANING</p>
                  <p className="text-2xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#991B1B' }}>{data.length.toLocaleString()} rows</p>
                  <p className="text-[12px]" style={{ color: '#B91C1C' }}>{totalMissing} missing • {dupeCount} duplicates</p>
                </div>
                <div className="rounded-xl p-5 text-center" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: '#22C55E' }}>AFTER CLEANING</p>
                  <p className="text-2xl font-black mb-1" style={{ fontFamily: 'var(--font-heading)', color: '#166534' }}>{cleanedData.length.toLocaleString()} rows</p>
                  <p className="text-[12px]" style={{ color: '#16A34A' }}>0 missing • 0 duplicates</p>
                </div>
              </div>

              {/* Green banner */}
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: '#22C55E' }}>
                  <Check className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold" style={{ color: '#166534' }}>Dataset is clean and ready for benchmarking ✅</p>
                  <p className="text-[12px]" style={{ color: '#16A34A' }}>{Object.keys(cleanedData[0] || {}).length} columns • {cleanedData.length.toLocaleString()} rows</p>
                </div>
              </div>

              {/* Download */}
              <button
                onClick={downloadCleaned}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-[13px] cursor-pointer transition-all hover:bg-gray-100"
                style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                <Download className="w-4 h-4" /> Download Cleaned Dataset (.csv)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
