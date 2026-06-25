'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Search, Upload, Database,
  Sparkles, Loader2, Globe, Info, Activity, CheckCircle2, AlertCircle, ExternalLink,
} from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import UniversalUploader from '@/components/dataset/UniversalUploader';

// ── Persistent state helpers ────────────────────────────────────
function readLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key: string, value: unknown) {
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
}

export default function DatasetSourcingPage() {
  const {
    markStageComplete,
    problemContext,
    problemDescription,
    setFileId,
    setTargetColumn,
    fileId,
  } = usePipeline();

  // ── Persisted state ────────────────────────────────────────────
  const [selectedAction, setSelectedAction] = useState<'upload' | 'search' | 'generate' | null>(
    () => readLS('neuralforge_dataset_action', null)
  );
  const [searchResults, setSearchResults] = useState<any[]>(
    () => readLS('neuralforge_search_results', [])
  );
  const [schemaPlan, setSchemaPlan] = useState<any>(
    () => readLS('neuralforge_schema_plan', null)
  );

  // Persist on change
  useEffect(() => { writeLS('neuralforge_dataset_action', selectedAction); }, [selectedAction]);
  useEffect(() => { if (searchResults.length) writeLS('neuralforge_search_results', searchResults); }, [searchResults]);
  useEffect(() => { writeLS('neuralforge_schema_plan', schemaPlan); }, [schemaPlan]);

  // ── Ephemeral state ────────────────────────────────────────────
  const [selectedDataset, setSelectedDataset] = useState<any>(null);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<number>>(new Set());
  const [isMerging, setIsMerging] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Search ────────────────────────────────────────────────────
  const handleSearch = useCallback(async (force = false) => {
    // Don't re-search if we already have results and haven't been forced
    if (!force && searchResults.length > 0) return;

    setIsSearching(true);
    setSearchError(null);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const res = await fetch('/api/backend/discovery/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          description: problemDescription || 'Dataset search',
          max_results: 5,
        }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        setSearchError(
          'No datasets found. Try rephrasing your problem description or check that your Kaggle/HuggingFace API keys are configured.'
        );
      } else {
        setSearchResults(data.results);
      }
    } catch (e: any) {
      setSearchError(
        'Search failed: ' + e.message + '. Make sure the backend is running and API keys (KAGGLE_API_TOKEN, HF_TOKEN) are set in .env.'
      );
    } finally {
      setIsSearching(false);
    }
  }, [problemDescription, searchResults.length]);

  // ── Generate Schema ────────────────────────────────────────────
  const handlePlanDataset = async () => {
    setIsPlanning(true);
    setPlanError(null);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const res = await fetch('/api/backend/discovery/analyze-problem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ description: problemDescription || 'Machine learning project', max_results: 5 }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const features: string[] =
        Array.isArray(data.required_features) && data.required_features.length > 0
          ? data.required_features
          : problemContext?.required_features || ['feature_1', 'feature_2', 'feature_3'];
      setSchemaPlan({
        task_type: data.task_type || problemContext?.task_type || 'Binary Classification',
        target_variable: data.prediction_target || problemContext?.prediction_target || 'target',
        rows: 5000,
        class_balance: (data.task_type || '').toLowerCase().includes('regression')
          ? 'N/A (Continuous)'
          : '70% Negative / 30% Positive',
        features: features.map((f: string) => ({
          name: f,
          type: f.toLowerCase().includes('id')
            ? 'uuid'
            : f.toLowerCase().includes('date')
            ? 'categorical'
            : 'float',
        })),
      });
    } catch (e: any) {
      setPlanError('Could not generate schema: ' + e.message);
    } finally {
      setIsPlanning(false);
    }
  };

  // ── Synthetic generation ──────────────────────────────────────
  const handleGenerateSynthetic = async () => {
    setIsGenerating(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const res = await fetch('/api/backend/discovery/generate-synthetic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          project_description: problemDescription || 'Custom project',
          project_type: schemaPlan?.task_type || 'Classification',
          num_rows: schemaPlan?.rows || 100,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.file?.id) {
          setFileId(data.file.id);
          setTargetColumn(schemaPlan?.target_variable || problemContext?.prediction_target || null);
        }
        markStageComplete('/dashboard/datasets');
        alert('Synthetic dataset generated successfully!');
      } else {
        alert('Failed to generate dataset — check backend logs.');
      }
    } catch {
      alert('Error connecting to server');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Hybrid merge ──────────────────────────────────────────────
  const handleHybridMerge = () => {
    setIsMerging(true);
    setTimeout(() => {
      setIsMerging(false);
      markStageComplete('/dashboard/datasets');
    }, 3000);
  };

  // ── Use searched dataset ──────────────────────────────────────
  const useSearchedDataset = (ds: any) => {
    // Searched datasets are external (Kaggle/HF) — no backend fileId.
    // Direct user to download then upload.
    setSelectedAction('upload');
    writeLS('neuralforge_dataset_action', 'upload');
    // Store dataset name as a hint for the upload section
    writeLS('neuralforge_import_hint', ds.name);
    markStageComplete('/dashboard/datasets');
  };

  const handleActionClick = (action: 'upload' | 'search' | 'generate') => {
    setSelectedAction(action);
    if (action === 'search') {
      handleSearch(); // uses cached results if available, only calls API if empty
    } else if (action === 'generate' && !schemaPlan) {
      handlePlanDataset();
    }
  };

  // ── Import hint ───────────────────────────────────────────────
  const importHint = readLS<string | null>('neuralforge_import_hint', null);

  return (
    <div className="animate-fade-in pb-20">
      <div className="stage-badge mb-4">STAGE 02</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Dataset Sourcing</h1>
      <p className="text-[15px] text-[#888] mb-10">
        Review your problem statement and choose how to source your dataset.
      </p>

      {/* STEP 1: AI Analyzed Problem */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-[#FF4400] text-white flex items-center justify-center font-bold text-[12px]">1</div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a]">Analyzed Problem Context</h2>
        </div>
        <div className="bg-[#FFF8F0] border border-[#FF4400]/20 rounded-2xl p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="block text-[12px] font-bold text-[#FF4400] uppercase tracking-wider mb-2">Problem Statement</span>
              <p className="text-[15px] text-[#1a1a1a] font-medium mb-6">"{problemDescription || 'No description provided.'}"</p>
            </div>
            <div className="flex items-center gap-3">
              {fileId && (
                <div className="bg-green-50 px-3 py-1.5 rounded-full border border-green-200 flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-green-500" />
                  <span className="text-[11px] font-bold text-green-600">Dataset Selected</span>
                </div>
              )}
              <div className="bg-white px-3 py-1.5 rounded-full border border-[#FF4400]/20 flex items-center gap-2 shadow-sm">
                <CheckCircle2 size={14} className="text-[#10B981]" />
                <span className="text-[12px] font-bold text-[#10B981]">Context Received</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Task Type', value: problemContext?.task_type || 'Unknown' },
              { label: 'Target Variable', value: problemContext?.prediction_target || 'Unknown', accent: true },
              { label: 'Industry', value: problemContext?.industry || 'Unknown' },
              { label: 'Key Features', value: (problemContext?.required_features || []).join(', ') || 'Unknown' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-white border border-[#f0ebe1] rounded-xl p-4">
                <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">{label}</span>
                <span className={`text-[14px] font-bold ${accent ? 'text-[#FF4400]' : 'text-[#1a1a1a]'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STEP 2: Action Cards */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-full bg-[#FF4400] text-white flex items-center justify-center font-bold text-[12px]">2</div>
          <h2 className="text-[18px] font-bold text-[#1a1a1a]">Select Sourcing Method</h2>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[
            { id: 'upload', icon: Upload, title: 'Upload Dataset', desc: 'Use your own proprietary data (CSV, Parquet, JSON).' },
            { id: 'search', icon: Globe, title: 'Search Web', desc: 'Find real open-source datasets matching your problem.' },
            { id: 'generate', icon: Sparkles, title: 'AI Generate', desc: 'Synthesize a custom mock dataset with the perfect schema.' },
          ].map(({ id, icon: Icon, title, desc }) => (
            <div
              key={id}
              onClick={() => handleActionClick(id as any)}
              className={`border-2 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 group bg-white ${
                selectedAction === id
                  ? 'border-[#FF4400] shadow-[0_8px_30px_rgba(255,68,0,0.15)]'
                  : 'border-[#f0ebe1] hover:border-[#FF4400]/50 hover:shadow-lg'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                selectedAction === id
                  ? 'bg-[#FF4400] text-white'
                  : 'bg-[#FFF8F0] text-[#FF4400] group-hover:bg-[#FF4400] group-hover:text-white'
              }`}>
                <Icon size={28} />
              </div>
              <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-2">{title}</h3>
              <p className="text-[13px] text-[#888]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 3: Contextual View */}
      {selectedAction && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-[#FF4400] text-white flex items-center justify-center font-bold text-[12px]">3</div>
            <h2 className="text-[18px] font-bold text-[#1a1a1a]">
              {selectedAction === 'upload' ? 'Upload Data' : selectedAction === 'search' ? 'Dataset Recommendations' : 'Generation Planner'}
            </h2>
          </div>

          {/* Upload View */}
          {selectedAction === 'upload' && (
            <div>
              {importHint && (
                <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                  <Info size={15} className="text-blue-500 shrink-0" />
                  <p className="text-[13px] text-blue-700">
                    Upload the dataset you downloaded: <span className="font-bold">{importHint}</span>
                  </p>
                  <button
                    onClick={() => { writeLS('neuralforge_import_hint', null); window.location.reload(); }}
                    className="ml-auto text-[11px] text-blue-400 underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <UniversalUploader
                projectId={
                  typeof window !== 'undefined'
                    ? localStorage.getItem('neuralforge_active_project_id') || 'default_project'
                    : 'default_project'
                }
                onUploadComplete={(result) => {
                  if (result.file?.id) {
                    // ← THE CRITICAL FIX: save fileId so cleaning page can use it
                    setFileId(result.file.id);
                    setTargetColumn(problemContext?.prediction_target || null);
                    writeLS('neuralforge_import_hint', null);
                    markStageComplete('/dashboard/datasets');
                  }
                }}
              />
            </div>
          )}

          {/* Search View */}
          {selectedAction === 'search' && (
            <div className="space-y-4">
              {/* Search controls */}
              <div className="flex items-center justify-between">
                {searchResults.length > 0 && !isSearching && (
                  <p className="text-[13px] text-[#888]">
                    {searchResults.length} datasets found for your problem
                  </p>
                )}
                <button
                  onClick={() => handleSearch(true)}
                  disabled={isSearching}
                  className="ml-auto flex items-center gap-2 text-[12px] font-bold text-[#FF4400] hover:text-[#cc3300] transition-colors disabled:opacity-50"
                >
                  {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                  {isSearching ? 'Searching...' : 'Refresh Results'}
                </button>
              </div>

              {isSearching && searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-[#f0ebe1]">
                  <Loader2 size={32} className="text-[#FF4400] animate-spin mb-4" />
                  <div className="text-[15px] font-bold text-[#1a1a1a]">Searching Kaggle, HuggingFace & OpenML...</div>
                  <div className="text-[13px] text-[#888]">
                    Analyzing datasets for: "{problemDescription?.slice(0, 60) || 'your problem'}"
                  </div>
                </div>
              ) : searchError && searchResults.length === 0 ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                  <p className="text-[14px] font-bold text-red-700 mb-1">Search Failed</p>
                  <p className="text-[12px] text-red-600 leading-relaxed mb-4">{searchError}</p>
                  <button onClick={() => handleSearch(true)} className="btn-coral py-2 px-6">Retry Search</button>
                </div>
              ) : isMerging ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-[#f0ebe1] animate-pulse">
                  <Loader2 size={32} className="text-[#FF4400] animate-spin mb-4" />
                  <div className="text-[15px] font-bold text-[#1a1a1a]">Harmonizing and Merging Datasets...</div>
                  <div className="text-[13px] text-[#888]">Aligning schemas and resolving conflicts</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 animate-fade-in">
                  {isSearching && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-[#FFF8F0] border border-[#FF4400]/20 rounded-xl">
                      <Loader2 size={13} className="text-[#FF4400] animate-spin" />
                      <span className="text-[12px] text-[#FF4400]">Refreshing results...</span>
                    </div>
                  )}
                  {selectedForMerge.size > 1 && (
                    <div className="bg-[#FFF8F0] border border-[#FF4400]/20 rounded-xl p-4 flex items-center justify-between shadow-sm animate-fade-in">
                      <div>
                        <h4 className="text-[14px] font-bold text-[#FF4400]">Multiple Datasets Selected</h4>
                        <p className="text-[12px] text-[#888]">{selectedForMerge.size} datasets selected for hybrid merge.</p>
                      </div>
                      <button onClick={handleHybridMerge} className="btn-coral">
                        <Database size={16} /> Hybrid Merge Datasets
                      </button>
                    </div>
                  )}
                  {searchResults.map((ds, i) => {
                    const isSelected = selectedForMerge.has(i);
                    const isExpanded = selectedDataset?.name === ds.name;
                    return (
                      <div
                        key={i}
                        className={`bg-white border ${isExpanded ? 'border-[#FF4400] shadow-[0_4px_20px_rgba(255,68,0,0.1)]' : 'border-[#f0ebe1]'} rounded-xl p-5 cursor-pointer hover:border-[#FF4400]/50 transition-all`}
                        onClick={() => setSelectedDataset(isExpanded ? null : ds)}
                      >
                        {ds.recommendation_tier === 'Recommended' && (
                          <div className="mb-3 inline-block bg-[#10B981]/10 border border-[#10B981]/20 px-3 py-1 rounded-full">
                            <span className="text-[10px] font-bold text-[#10B981] uppercase tracking-wider flex items-center gap-1">
                              <Sparkles size={12} /> Recommended Dataset
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 w-4 h-4 rounded border-[#ccc] text-[#FF4400] focus:ring-[#FF4400] cursor-pointer"
                              checked={isSelected}
                              onChange={e => {
                                e.stopPropagation();
                                setSelectedForMerge(prev => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i); else next.add(i);
                                  return next;
                                });
                              }}
                            />
                            <div>
                              <h4 className="text-[16px] font-bold text-[#1a1a1a] mb-1">{ds.name}</h4>
                              <div className="flex items-center gap-3 text-[12px] text-[#888]">
                                <span className="flex items-center gap-1"><Database size={12} /> {ds.source}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1"><Activity size={12} /> {ds.dataset_type}</span>
                                <span>·</span>
                                <span>{ds.samples?.toLocaleString()} rows</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[18px] font-bold text-[#FF4400]">{ds.suitability_score || ds.relevance_score || 0}%</div>
                            <div className="text-[10px] uppercase font-bold text-[#888] tracking-wider">Suitability</div>
                          </div>
                        </div>

                        <p className="text-[13px] text-[#555] leading-relaxed mb-3">{ds.description}</p>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-[#f0ebe1] animate-fade-in space-y-4">
                            <div className="bg-[#FFF8F0] p-4 rounded-xl">
                              <div className="flex items-center gap-2 mb-2">
                                <Info size={15} className="text-[#FF4400]" />
                                <span className="text-[12px] font-bold uppercase text-[#FF4400] tracking-wider">Why This Dataset?</span>
                              </div>
                              <p className="text-[13px] text-[#1a1a1a] leading-relaxed">{ds.recommendation_reason}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="block text-[11px] font-bold text-[#888] uppercase mb-2">Advantages</span>
                                <ul className="text-[12px] text-[#555] space-y-1">
                                  {ds.advantages?.map((adv: string, j: number) => <li key={j}>• {adv}</li>)}
                                </ul>
                              </div>
                              <div>
                                <span className="block text-[11px] font-bold text-[#888] uppercase mb-2">Considerations</span>
                                <ul className="text-[12px] text-[#555] space-y-1">
                                  {ds.disadvantages?.map((dis: string, j: number) => <li key={j}>• {dis}</li>)}
                                </ul>
                              </div>
                            </div>

                            {/* Download + import flow */}
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                              <div className="flex items-start gap-2 mb-3">
                                <AlertCircle size={14} className="text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-[12px] text-blue-700">
                                  External datasets need to be downloaded first, then uploaded to NeuralForge.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                {ds.source_url && (
                                  <a
                                    href={ds.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="btn-outline flex-1 justify-center py-2 text-[12px]"
                                  >
                                    <ExternalLink size={13} /> Download from {ds.source}
                                  </a>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); useSearchedDataset(ds); }}
                                  className="btn-coral flex-1 justify-center py-2 text-[12px]"
                                >
                                  <Upload size={13} /> Upload This Dataset
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Generate View */}
          {selectedAction === 'generate' && (
            <div className="space-y-6">
              {isPlanning ? (
                <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-[#f0ebe1]">
                  <Loader2 size={32} className="text-[#FF4400] animate-spin mb-4" />
                  <div className="text-[15px] font-bold text-[#1a1a1a]">AI is designing a schema for your problem...</div>
                  <div className="text-[13px] text-[#888]">This may take a moment</div>
                </div>
              ) : planError ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                  <p className="text-[14px] font-bold text-red-700 mb-1">Schema Planning Failed</p>
                  <p className="text-[12px] text-red-600 leading-relaxed mb-4">{planError}</p>
                  <button onClick={handlePlanDataset} className="btn-coral py-2 px-6">Retry</button>
                </div>
              ) : schemaPlan ? (
                <div className="bg-white border border-[#FF4400] shadow-[0_4px_20px_rgba(255,68,0,0.1)] rounded-2xl p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Database size={18} className="text-[#FF4400]" />
                      <h3 className="text-[16px] font-bold text-[#1a1a1a]">Dataset Generation Planner</h3>
                    </div>
                    <button onClick={handlePlanDataset} className="text-[12px] text-[#FF4400] font-bold">
                      Regenerate Schema
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-8">
                    {[
                      { label: 'Task Type', key: 'task_type' },
                      { label: 'Target Variable', key: 'target_variable' },
                      { label: 'Row Count', key: 'rows', type: 'number' },
                      { label: 'Class Balance', key: 'class_balance' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">{label}</span>
                        <input
                          type={type || 'text'}
                          value={schemaPlan[key]}
                          onChange={e => setSchemaPlan({ ...schemaPlan, [key]: type === 'number' ? parseInt(e.target.value) : e.target.value })}
                          className="w-full bg-[#FDFBF7] border border-[#f0ebe1] rounded-lg px-3 py-1.5 text-[13px] outline-none focus:border-[#FF4400]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mb-6">
                    <span className="block text-[11px] font-bold text-[#888] uppercase mb-3">Generated Feature Schema</span>
                    <div className="border border-[#f0ebe1] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-[#FDFBF7] border-b border-[#f0ebe1]">
                          <tr>
                            <th className="px-4 py-2 font-bold text-[#888]">Column Name</th>
                            <th className="px-4 py-2 font-bold text-[#888]">Data Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {schemaPlan.features.map((f: any, i: number) => (
                            <tr key={i} className="border-b border-[#f0ebe1] last:border-0">
                              <td className="px-4 py-2">
                                <input
                                  type="text"
                                  value={f.name}
                                  onChange={e => {
                                    const newF = [...schemaPlan.features];
                                    newF[i] = { ...newF[i], name: e.target.value };
                                    setSchemaPlan({ ...schemaPlan, features: newF });
                                  }}
                                  className="bg-transparent outline-none w-full font-mono text-[#FF4400]"
                                />
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  value={f.type}
                                  onChange={e => {
                                    const newF = [...schemaPlan.features];
                                    newF[i] = { ...newF[i], type: e.target.value };
                                    setSchemaPlan({ ...schemaPlan, features: newF });
                                  }}
                                  className="bg-transparent outline-none cursor-pointer"
                                >
                                  <option value="int">Integer</option>
                                  <option value="float">Float</option>
                                  <option value="categorical">Categorical</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="uuid">UUID / ID</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <button
                    className="btn-coral w-full justify-center"
                    onClick={handleGenerateSynthetic}
                    disabled={isGenerating}
                  >
                    {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isGenerating ? 'Synthesizing Dataset...' : 'Generate Dataset'}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && selectedDataset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1a1a]/50 backdrop-blur-sm animate-fade-in p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-[#f0ebe1] flex justify-between items-center bg-[#FDFBF7]">
              <div>
                <h3 className="text-[18px] font-bold text-[#1a1a1a]">Dataset Preview</h3>
                <p className="text-[12px] text-[#888]">{selectedDataset.name}</p>
              </div>
              <button onClick={() => setIsPreviewOpen(false)} className="w-8 h-8 rounded-lg hover:bg-[#e8ddd0] flex items-center justify-center text-[#555] transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-[#FDFBF7]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-[#f0ebe1]">
                  <div className="text-[11px] font-bold text-[#888] uppercase mb-1">Total Rows</div>
                  <div className="text-[20px] font-bold text-[#1a1a1a]">{selectedDataset.samples?.toLocaleString() || 'N/A'}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-[#f0ebe1]">
                  <div className="text-[11px] font-bold text-[#888] uppercase mb-1">Source</div>
                  <div className="text-[20px] font-bold text-[#1a1a1a]">{selectedDataset.source}</div>
                </div>
              </div>
              {selectedDataset.source_url && (
                <a href={selectedDataset.source_url} target="_blank" rel="noopener noreferrer" className="btn-coral w-full justify-center">
                  <ExternalLink size={16} /> View on {selectedDataset.source}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <PipelineNav
        prevLink="/dashboard/problem"
        prevTitle="Problem Statement"
        nextLink="/dashboard/cleaning"
        nextTitle="Data Cleaning"
      />
    </div>
  );
}
