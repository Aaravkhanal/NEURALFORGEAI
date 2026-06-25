'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileCode2, Copy, Download, Check, Terminal,
  Loader2, AlertCircle, BookOpen, FileText, Server,
} from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';

// ── File metadata ────────────────────────────────────────────────
const FILE_META: Record<string, {
  icon: React.ReactNode;
  label: string;
  lang: string;
  color: string;
  description: string;
}> = {
  'inference.py': {
    icon: <Terminal size={14} />,
    label: 'inference.py',
    lang: 'Python',
    color: '#3B82F6',
    description: 'Core inference script',
  },
  'app.py': {
    icon: <Server size={14} />,
    label: 'app.py',
    lang: 'Python',
    color: '#8B5CF6',
    description: 'FastAPI REST server',
  },
  'requirements.txt': {
    icon: <FileText size={14} />,
    label: 'requirements.txt',
    lang: 'Text',
    color: '#10B981',
    description: 'Python dependencies',
  },
  'README.md': {
    icon: <BookOpen size={14} />,
    label: 'README.md',
    lang: 'Markdown',
    color: '#F59E0B',
    description: 'Setup & usage guide',
  },
};

const FILE_ORDER = ['inference.py', 'app.py', 'requirements.txt', 'README.md'];

type GeneratedFiles = Record<string, string>;

const PLACEHOLDER: GeneratedFiles = {
  'inference.py': '# Generating inference script...',
  'app.py': '# Generating FastAPI server...',
  'requirements.txt': '# Generating dependencies...',
  'README.md': '# Generating setup guide...',
};

// ── Component ────────────────────────────────────────────────────
export default function CodeGenPage() {
  const {
    markStageComplete,
    problemContext,
    problemDescription,
    selectedModel,
    trainedModelId,
    datasetProfile,
    targetColumn,
  } = usePipeline();

  useEffect(() => { markStageComplete('/dashboard/codegen'); }, [markStageComplete]);

  const [modelFormat, setModelFormat] = useState('.pkl (Scikit-Learn)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFiles>({});
  const [selectedFile, setSelectedFile] = useState('inference.py');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [modelMeta, setModelMeta] = useState<any>(null);
  const hasGenerated = useRef(false);

  // Fetch model metadata
  useEffect(() => {
    if (!trainedModelId) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
    fetch(`/api/backend/playground/models/${trainedModelId}/features`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setModelMeta(data); })
      .catch(() => {});
  }, [trainedModelId]);

  const generateCode = useCallback(async () => {
    setIsGenerating(true);
    setCodeError(null);
    setGeneratedFiles(PLACEHOLDER);

    const featureNames: string[] =
      modelMeta?.features?.map((f: any) => f.name) ||
      datasetProfile?.columns?.map((c: any) => c.name).filter((n: string) => n !== targetColumn) ||
      [];

    const formatKey = modelFormat.split(' ')[0];

    try {
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemDescription: problemDescription || problemContext?.domain || 'Machine learning prediction task',
          modelFormat: formatKey,
          modelName: selectedModel || modelMeta?.model_name || 'Trained Model',
          taskType: problemContext?.task_type || modelMeta?.task_type || 'tabular_classification',
          featureNames,
          targetColumn: targetColumn || problemContext?.prediction_target || 'target',
          trainingMetrics: modelMeta?.metrics || null,
          preprocessingInfo: featureNames.length > 0
            ? `Features: [${featureNames.slice(0, 8).join(', ')}${featureNames.length > 8 ? ', ...' : ''}]`
            : null,
        }),
      });

      const data = await res.json();

      if (data.files) {
        setGeneratedFiles(data.files);
      } else if (data.code) {
        // Backwards compat if API returns old format
        setGeneratedFiles({ ...PLACEHOLDER, 'inference.py': data.code });
      } else {
        throw new Error('No files returned from generation API');
      }
    } catch (e: any) {
      setCodeError('Code generation failed: ' + e.message);
      setGeneratedFiles({
        'inference.py': '# Generation error — see error message above.',
        'app.py': '# Generation error.',
        'requirements.txt': '',
        'README.md': '',
      });
    } finally {
      setIsGenerating(false);
    }
  }, [modelFormat, problemDescription, problemContext, selectedModel, modelMeta, datasetProfile, targetColumn]);

  // Auto-generate: wait for model meta if we have a model ID, otherwise generate immediately
  useEffect(() => {
    if (hasGenerated.current) return;
    if (trainedModelId && !modelMeta) return; // wait for meta to load
    hasGenerated.current = true;
    generateCode();
  }, [modelMeta, trainedModelId, generateCode]);

  const handleRegenerate = () => {
    hasGenerated.current = false;
    generateCode();
  };

  const handleCopy = () => {
    const content = generatedFiles[selectedFile] || '';
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (trainedModelId) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
        const res = await fetch(`/api/backend/export/package/${trainedModelId}`, {
          headers: { ...(token && { Authorization: `Bearer ${token}` }) },
        });
        if (res.ok) {
          const blob = await res.blob();
          triggerDownload(blob, `neuralforge_package_${trainedModelId.slice(0, 8)}.zip`);
          return;
        }
      }
      // Fallback: bundle generated files into a client-side ZIP-like download (just selected file)
      const content = generatedFiles[selectedFile] || '';
      const blob = new Blob([content], { type: 'text/plain' });
      triggerDownload(blob, selectedFile);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadFile = (filename: string) => {
    const content = generatedFiles[filename] || '';
    const blob = new Blob([content], { type: 'text/plain' });
    triggerDownload(blob, filename);
  };

  const currentContent = generatedFiles[selectedFile] || '';
  const selectedMeta = FILE_META[selectedFile];
  const featureCount = modelMeta?.features?.length || datasetProfile?.columns?.length || 0;

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="shrink-0 mb-5">
        <div className="stage-badge mb-4">STAGE 07</div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-1 flex items-center gap-3">
              Code Generation
              {isGenerating && <Loader2 size={22} className="animate-spin text-[#FF4400]" />}
            </h1>
            <p className="text-[14px] text-[#888]">
              LLM-generated production package — 4 files tailored to your training context.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#888] font-bold">Format:</span>
              <select
                value={modelFormat}
                onChange={(e) => setModelFormat(e.target.value)}
                className="bg-white border border-[#f0ebe1] rounded-lg px-2 py-1 text-[12px] font-bold text-[#1a1a1a] outline-none cursor-pointer"
              >
                <option>.pkl (Scikit-Learn)</option>
                <option>.onnx (ONNX Runtime)</option>
                <option>.pb (TensorFlow)</option>
                <option>.pt (PyTorch)</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="btn-outline py-1.5 px-4 text-[12px] flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <FileCode2 size={13} />}
                Regenerate All
              </button>
              <button
                onClick={handleDownload}
                disabled={isDownloading || isGenerating}
                className="btn-coral min-w-[200px] flex justify-center items-center gap-2 disabled:opacity-60"
              >
                {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {isDownloading ? 'Packaging...' : trainedModelId ? 'Download Package (.zip)' : `Download ${selectedFile}`}
              </button>
            </div>
            {trainedModelId && (
              <p className="text-[10px] text-[#aaa]">ZIP: trained model + all 4 generated files</p>
            )}
          </div>
        </div>

        {codeError && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-red-600">{codeError}</p>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex gap-5">
        {/* Left: file list + context */}
        <div className="w-[240px] shrink-0 flex flex-col gap-4">
          {/* File List */}
          <div className="dashed-card flex-1 p-4 flex flex-col">
            <p className="section-label mb-3">FILES</p>
            <div className="space-y-1.5 flex-1">
              {FILE_ORDER.map((filename) => {
                const meta = FILE_META[filename];
                const isSelected = selectedFile === filename;
                const hasContent = !!(generatedFiles[filename] && !generatedFiles[filename].startsWith('#'));
                return (
                  <button
                    key={filename}
                    onClick={() => setSelectedFile(filename)}
                    className={`w-full text-left p-2.5 rounded-xl border transition-all duration-150 group ${
                      isSelected
                        ? 'bg-[#FFF8F0] border-[#FF4400]'
                        : 'border-[#f0ebe1] hover:border-[#e0d5c9] hover:bg-[#fafaf8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div
                        className="flex items-center gap-1.5 text-[12px] font-bold"
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          color: isSelected ? meta.color : '#444',
                        }}
                      >
                        <span style={{ color: isSelected ? meta.color : '#888' }}>{meta.icon}</span>
                        {meta.label}
                      </div>
                      {isGenerating && isSelected ? (
                        <Loader2 size={10} className="animate-spin text-[#FF4400]" />
                      ) : hasContent ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                      ) : null}
                    </div>
                    <p className="text-[10px] text-[#888]">{meta.description}</p>
                  </button>
                );
              })}
            </div>

            {/* Training context summary */}
            <div className="mt-4 pt-4 border-t border-[#f0ebe1]">
              <p className="text-[10px] font-bold text-[#aaa] uppercase tracking-wider mb-2">Context</p>
              <div className="space-y-1 text-[11px] text-[#666]">
                <p><span className="font-bold text-[#444]">Model:</span>{' '}{selectedModel || modelMeta?.model_name || '—'}</p>
                <p><span className="font-bold text-[#444]">Task:</span>{' '}{problemContext?.task_type || '—'}</p>
                <p><span className="font-bold text-[#444]">Target:</span>{' '}{targetColumn || problemContext?.prediction_target || '—'}</p>
                <p><span className="font-bold text-[#444]">Features:</span>{' '}{featureCount > 0 ? `${featureCount} cols` : '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: code editor */}
        <div className="flex-1 bg-[#1a1a1a] rounded-xl overflow-hidden border border-[#2d2d2d] shadow-lg flex flex-col">
          {/* Editor top bar */}
          <div className="h-11 bg-[#252525] border-b border-[#333] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-3">
              {/* Dot decorations */}
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#444]" />
                <span className="w-3 h-3 rounded-full bg-[#444]" />
                <span className="w-3 h-3 rounded-full bg-[#444]" />
              </div>
              <div className="flex items-center gap-2 ml-1">
                <span style={{ color: selectedMeta?.color || '#888' }}>{selectedMeta?.icon}</span>
                <span
                  className="text-[13px] text-[#ccc]"
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  {selectedFile}
                </span>
                <span className="text-[10px] text-[#555] border border-[#333] rounded px-1.5 py-0.5">
                  {selectedMeta?.lang}
                </span>
                {isGenerating && (
                  <span className="text-[10px] text-[#FF4400] animate-pulse">generating...</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDownloadFile(selectedFile)}
                disabled={isGenerating}
                className="flex items-center gap-1.5 text-[11px] text-[#666] hover:text-[#aaa] transition-colors disabled:opacity-40"
              >
                <Download size={12} />
                Save file
              </button>
              <div className="w-px h-4 bg-[#333]" />
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[11px] text-[#666] hover:text-[#aaa] transition-colors"
              >
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* File tab strip */}
          <div className="flex border-b border-[#2a2a2a] bg-[#1e1e1e] px-2 shrink-0 overflow-x-auto">
            {FILE_ORDER.map((filename) => {
              const meta = FILE_META[filename];
              const isActive = selectedFile === filename;
              return (
                <button
                  key={filename}
                  onClick={() => setSelectedFile(filename)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-[#FF4400] text-white bg-[#1a1a1a]'
                      : 'border-transparent text-[#666] hover:text-[#999]'
                  }`}
                  style={{ fontFamily: "'Space Mono', monospace" }}
                >
                  <span style={{ color: isActive ? meta.color : '#555' }}>{meta.icon}</span>
                  {filename}
                </button>
              );
            })}
          </div>

          {/* Code content */}
          <div className="flex-1 overflow-auto p-5">
            <pre
              className="text-[12.5px] leading-[1.7] min-h-full"
              style={{
                fontFamily: "'Space Mono', monospace",
                color: selectedFile === 'README.md' ? '#D4D4D4' : '#D4D4D4',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {currentContent || (isGenerating ? PLACEHOLDER[selectedFile] : '# Click Regenerate to generate files')}
            </pre>
          </div>

          {/* Status bar */}
          <div className="h-7 bg-[#111] border-t border-[#222] flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-[#444]">
                {currentContent ? `${currentContent.split('\n').length} lines` : '—'}
              </span>
              <span className="text-[10px] text-[#444]">{selectedMeta?.lang}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isGenerating ? 'bg-[#FF4400] animate-pulse' : 'bg-green-500'}`}
              />
              <span className="text-[10px] text-[#444]">
                {isGenerating ? 'Generating...' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <PipelineNav
        prevLink="/dashboard/training"
        prevTitle="Model Training"
        nextLink="/dashboard/deployment"
        nextTitle="Deployment"
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
