'use client';

import { useState, useEffect } from 'react';
import { Upload, Lightbulb, Diamond, AlertCircle, Sparkles, Loader2, BrainCircuit } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';

const TASK_TYPES = [
  'Binary Classification',
  'Multi-class Classification',
  'Regression',
  'Time-series Forecasting',
  'NLP / Text',
  'Computer Vision',
  'Anomaly Detection',
  'Clustering',
];

const EXAMPLES = [
  {
    type: 'Classification',
    desc: 'Predict whether a customer will churn in the next 30 days based on their usage...',
  },
  {
    type: 'Regression',
    desc: 'Estimate the market value of residential properties in Mumbai using features like...',
  },
  {
    type: 'NLP',
    desc: 'Classify customer support tickets into categories (billing, technical, general) a...',
  },
];

const TIPS = [
  'Be specific about the prediction target',
  'Mention data volume if known',
  'Include business constraints (latency, cost)',
  'State success metrics',
];

export default function ProblemStatementPage() {
  const { markStageComplete, markStageInProgress, setProblemContext, setProblemDescription } = usePipeline();
  
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [targetColumn, setTargetColumn] = useState('');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Auto-validate stage
  useEffect(() => {
    if (analysisResult) {
      markStageComplete('/dashboard/problem');
      setProblemContext(analysisResult);
      setProblemDescription(description);
    } else if (description.length > 0) {
      markStageInProgress('/dashboard/problem');
      setProblemDescription(description);
    }
  }, [description, analysisResult, markStageComplete, markStageInProgress, setProblemContext, setProblemDescription]);

  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!description || description.length < 10) return;
    setIsAnalyzing(true);
    setAnalyzeProgress(0);
    setAnalyzeError(null);

    const progressInterval = setInterval(() => {
      setAnalyzeProgress(prev => {
        if (prev >= 88) return prev;
        return prev + Math.floor(Math.random() * 5 + 1);
      });
    }, 600);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const res = await fetch('/api/backend/discovery/analyze-problem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({ description, max_results: 5 })
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Server error ${res.status}: ${err}`);
      }
      const data = await res.json();
      if (!data.task_type || data.task_type === 'Unknown') {
        throw new Error('AI analysis returned incomplete results. Please ensure your NVIDIA/LLM API key is configured and try again.');
      }
      const enrichedData = {
        ...data,
        recommended_dataset_sources: Array.isArray(data.recommended_dataset_sources) ? data.recommended_dataset_sources : ['Kaggle', 'HuggingFace Datasets', 'OpenML'],
        recommended_model: data.recommended_model || 'XGBoost',
        training_strategy: data.training_strategy || 'Gradient Boosting Baseline',
        estimated_size: data.estimated_size || '10k - 100k rows',
        difficulty: data.difficulty || 'Intermediate',
        required_features: Array.isArray(data.required_features) ? data.required_features : [],
      };
      clearInterval(progressInterval);
      setAnalyzeProgress(100);
      setTimeout(() => {
        setAnalysisResult(enrichedData);
        if (enrichedData.task_type) setSelectedType(enrichedData.task_type);
        if (enrichedData.prediction_target) setTargetColumn(enrichedData.prediction_target);
        setIsAnalyzing(false);
      }, 400);
    } catch (error: any) {
      clearInterval(progressInterval);
      setAnalyzeProgress(0);
      setIsAnalyzing(false);
      setAnalyzeError(error.message || 'AI analysis failed. Please check that the backend server is running and your LLM API key (NVIDIA_API_KEY) is configured in the .env file.');
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Stage badge */}
      <div className="stage-badge mb-4">STAGE 01</div>

      {/* Title */}
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Problem Statement</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Define what you want to solve. The clearer your problem, the better the model recommendations.
      </p>

      <div className="flex gap-8">
        {/* ─── Left Column (Main Form) ─── */}
        <div className="flex-1 space-y-6">
          {/* Problem Description */}
          <div className="dashed-card">
            <label className="section-label block mb-4">PROBLEM DESCRIPTION *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your machine learning problem in detail. Include the business context, what you're trying to predict or classify, and any constraints..."
              className="w-full h-40 bg-transparent text-[14px] text-[#1a1a1a] placeholder:text-[#bbb] resize-none outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#f0ebe1]">
              <span className="text-[12px] text-[#bbb]" style={{ fontFamily: "'Space Mono', monospace" }}>
                {description.length} chars (min 20)
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setDescription('')}
                  className="text-[12px] text-[#999] hover:text-[#FF4400] font-medium transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || description.length < 10}
                  className="flex items-center gap-2 bg-[#FF4400] text-white px-4 py-1.5 rounded-lg text-[13px] font-bold hover:bg-[#E63D00] disabled:opacity-50 transition-all"
                >
                  {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze Problem'}
                </button>
              </div>
            </div>
          </div>

          {analyzeError && (
            <div className="p-4 border border-red-300 rounded-xl bg-red-50 animate-fade-in flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[13px] font-bold text-red-700 mb-1">Analysis Failed</p>
                <p className="text-[12px] text-red-600 leading-relaxed">{analyzeError}</p>
              </div>
              <button
                onClick={handleAnalyze}
                className="text-[12px] font-bold text-[#FF4400] hover:underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="p-4 border border-[#FF4400]/20 rounded-xl bg-[#FFF8F0] animate-fade-in">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-bold text-[#FF4400] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Analyzing Problem Context...
                </span>
                <span className="text-[13px] font-bold text-[#FF4400]">{analyzeProgress}%</span>
              </div>
              <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden border border-[#FF4400]/10">
                <div 
                  className="h-full bg-gradient-to-r from-[#FF4400] to-[#E63D00] transition-all duration-300 ease-out relative"
                  style={{ width: `${analyzeProgress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1s_infinite_linear]" style={{ transform: 'skewX(-20deg)' }} />
                </div>
              </div>
            </div>
          )}

          {/* AI Analysis Result Card */}
          {analysisResult && (
            <div className="bg-[#FFF8F0] border border-[#FF4400]/30 rounded-2xl p-6 relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4400]/5 rounded-full blur-2xl -mr-10 -mt-10" />
              <div className="flex items-center gap-2 mb-4">
                <BrainCircuit size={18} className="text-[#FF4400]" />
                <span className="text-[13px] font-bold text-[#FF4400] tracking-wider uppercase">AI Problem Analysis</span>
              </div>
              
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 relative z-10">
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Task Type</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.task_type}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Industry</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.industry}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Domain</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.domain}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Target Variable</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.prediction_target}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Recommended AI Model</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.recommended_model}</span>
                    <span className="text-[10px] bg-[#10B981]/10 text-[#10B981] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">[Recommended]</span>
                  </div>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Estimated Dataset Size</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.estimated_size}</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Difficulty Level</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.difficulty}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Recommended Training Strategy</span>
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{analysisResult.training_strategy}</span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[11px] font-bold text-[#888] uppercase mb-1">Recommended Dataset Sources</span>
                  <ul className="list-disc list-inside text-[14px] font-medium text-[#FF4400]">
                    {(analysisResult.recommended_dataset_sources || []).map((src: string, i: number) => (
                      <li key={i}>{src}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#FF4400]/20 relative z-10">
                <span className="block text-[11px] font-bold text-[#888] uppercase mb-2">Recommended Features</span>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.required_features?.map((f: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-white border border-[#FF4400]/20 text-[#FF4400] text-[12px] font-mono rounded-md">
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Task Type + Target Column */}
          <div className="grid grid-cols-2 gap-6">
            {/* Task Type */}
            <div className="dashed-card">
              <label className="section-label block mb-4">TASK TYPE *</label>
              <div className="flex flex-wrap gap-2">
                {TASK_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`tag-pill ${selectedType === type ? 'tag-pill-active' : ''}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Column */}
            <div className="dashed-card">
              <label className="section-label block mb-4">TARGET COLUMN (optional)</label>
              <input
                type="text"
                value={targetColumn}
                onChange={(e) => setTargetColumn(e.target.value)}
                placeholder="e.g. churn, price, label"
                className="w-full h-10 bg-transparent text-[14px] text-[#1a1a1a] placeholder:text-[#bbb] outline-none border-b border-[#f0ebe1] focus:border-[#FF4400] transition-colors"
              />
              <p className="text-[11px] text-[#bbb] mt-3 flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#f0ebe1] inline-block" />
                Column in your dataset that represents the value you want to predict.
              </p>
            </div>
          </div>

          {/* Upload Problem Brief */}
          <div className="dashed-card">
            <label className="section-label block mb-4">UPLOAD PROBLEM BRIEF (optional)</label>
            <div className="dashed-card-filled text-center py-8">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[#FFF0E0] flex items-center justify-center">
                <Upload size={20} className="text-[#FF4400]" />
              </div>
              <p className="text-[13px] text-[#888] mb-3">Drop PDF or TXT here</p>
              <button className="btn-outline text-[12px] py-2 px-4">Browse Files</button>
            </div>
          </div>
        </div>

        {/* ─── Right Column (Examples + Tips) ─── */}
        <div className="w-[280px] shrink-0 space-y-6">
          {/* Examples */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={16} className="text-[#FF4400]" />
              <span className="section-label">EXAMPLES</span>
            </div>
            <div className="space-y-3">
              {EXAMPLES.map((ex, i) => (
                <div
                  key={i}
                  className="example-card cursor-pointer"
                  onClick={() => setDescription(ex.desc)}
                >
                  <h4 className="text-[13px] font-bold text-[#FF4400] mb-1">{ex.type}</h4>
                  <p className="text-[12px] text-[#888] leading-relaxed">{ex.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div className="dashed-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-4 h-4 rounded-full border border-[#3B82F6] flex items-center justify-center">
                <span className="text-[8px] text-[#3B82F6] font-bold">i</span>
              </div>
              <span className="section-label">TIPS</span>
            </div>
            <div className="space-y-2.5">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Diamond size={10} className="text-[#FF4400] mt-1 shrink-0" />
                  <span className="text-[12px] text-[#888] leading-relaxed">{tip}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Phase 5: AI Model Selection System */}
          <div className="dashed-card">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit size={16} className="text-[#888]" />
              <label className="section-label">AI MODEL SELECTION</label>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#555] font-bold">Dataset Discovery Model</span>
                <select className="bg-transparent border border-[#ccc] rounded-lg px-2 py-1 text-[12px] font-bold text-[#1a1a1a] outline-none">
                  <option>Claude 3.5 Sonnet (Recommended)</option>
                  <option>GPT-4o</option>
                  <option>Llama-3-70B</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#555] font-bold">Code Generation Model</span>
                <select className="bg-transparent border border-[#ccc] rounded-lg px-2 py-1 text-[12px] font-bold text-[#1a1a1a] outline-none">
                  <option>Claude 3.5 Sonnet (Recommended)</option>
                  <option>GPT-4o</option>
                  <option>Codestral</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-[#555] font-bold">AI Assistant Model</span>
                <select className="bg-transparent border border-[#ccc] rounded-lg px-2 py-1 text-[12px] font-bold text-[#1a1a1a] outline-none">
                  <option>GPT-4o</option>
                  <option>Claude 3.5 Sonnet</option>
                  <option>Mistral Large</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>

      <PipelineNav 
        nextLink="/dashboard/datasets" 
        nextTitle="Dataset Sourcing" 
      />
    </div>
  );
}
