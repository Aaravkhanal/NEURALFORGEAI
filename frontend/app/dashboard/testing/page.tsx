'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePipeline } from '@/contexts/PipelineContext';
import { PipelineNav } from '@/components/PipelineNav';
import {
  TestTube2, BrainCircuit, Activity, RefreshCw, UploadCloud,
  Image as ImageIcon, Database, MessageSquare, AlertCircle, Loader2
} from 'lucide-react';

export default function TestingPage() {
  const { markStageComplete, selectedModel, problemContext, datasetProfile, targetColumn, trainedModelId } = usePipeline();

  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<any>(null);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const [inputType, setInputType] = useState<'tabular' | 'text' | 'image'>(
    problemContext?.task_type?.toLowerCase().includes('image') || problemContext?.task_type?.toLowerCase().includes('vision')
      ? 'image' : 'tabular'
  );

  // Image state
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Text state
  const [textInput, setTextInput] = useState('');
  const [isParsingText, setIsParsingText] = useState(false);
  const [parsedFeatures, setParsedFeatures] = useState<Record<string, any> | null>(null);

  // Tabular fields — driven by actual dataset profile from pipeline
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [generatedFields, setGeneratedFields] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Load available trained model if trainedModelId not set
  const [resolvedModelId, setResolvedModelId] = useState<string | null>(trainedModelId);

  useEffect(() => {
    if (trainedModelId) {
      setResolvedModelId(trainedModelId);
      return;
    }
    // Try to load most recent trained model from backend
    const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
    fetch('/api/backend/playground/models', {
      headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.models?.length > 0) setResolvedModelId(data.models[0].id);
      })
      .catch(() => {});
  }, [trainedModelId]);

  // Build input fields from dataset profile or model features
  useEffect(() => {
    const buildFromProfile = () => {
      if (datasetProfile?.columns && datasetProfile.columns.length > 0) {
        return datasetProfile.columns
          .filter((col: any) => col.name !== targetColumn && col.name?.toLowerCase() !== 'id')
          .slice(0, 10)
          .map((col: any) => {
            const isNumeric = ['integer', 'float', 'numeric', 'int64', 'float64', 'number', 'int32', 'float32']
              .includes((col.type || '').toLowerCase());
            return {
              name: col.name,
              type: isNumeric ? 'number' : 'text',
              label: col.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
              default: isNumeric ? 0 : ''
            };
          });
      }
      return null;
    };

    const loadFromModelFeatures = async () => {
      if (!resolvedModelId) return null;
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      try {
        const res = await fetch(`/api/backend/playground/models/${resolvedModelId}/features`, {
          headers: { ...(token && { 'Authorization': `Bearer ${token}` }) }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.features || []).map((f: any) => ({
          name: f.name,
          type: f.dtype === 'object' || f.dtype === 'str' ? 'text' : 'number',
          label: f.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
          default: f.sample_value ?? (f.dtype === 'object' ? '' : 0)
        }));
      } catch { return null; }
    };

    const run = async () => {
      setIsAnalyzing(true);
      const profileFields = buildFromProfile();
      if (profileFields) {
        setGeneratedFields(profileFields);
        setIsAnalyzing(false);
        return;
      }
      const modelFields = await loadFromModelFeatures();
      if (modelFields) {
        setGeneratedFields(modelFields);
      }
      setIsAnalyzing(false);
    };

    run();
  }, [datasetProfile, targetColumn, resolvedModelId]);

  useEffect(() => {
    if (generatedFields.length > 0 && Object.keys(formData).length === 0) {
      const initial: Record<string, any> = {};
      generatedFields.forEach((f: any) => { initial[f.name] = f.default; });
      setFormData(initial);
    }
  }, [generatedFields]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const callPredict = useCallback(async (data: Record<string, any>[]) => {
    if (!resolvedModelId) throw new Error('No trained model found. Please complete the training stage first.');
    const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
    const res = await fetch('/api/backend/playground/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ model_id: resolvedModelId, data })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Prediction failed (${res.status})`);
    }
    return res.json();
  }, [resolvedModelId]);

  const handlePredict = async () => {
    setIsPredicting(true);
    setPredictionResult(null);
    setPredictionError(null);
    try {
      let result: any;

      if (inputType === 'text') {
        // Step 1: parse natural language → feature dict via LLM
        setIsParsingText(true);
        const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
        const parseRes = await fetch('/api/backend/playground/parse-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            text_input: textInput,
            feature_schema: generatedFields.map(f => ({ name: f.name, type: f.type, default: f.default })),
            problem_context: problemContext?.task_type
          })
        });
        setIsParsingText(false);
        if (!parseRes.ok) {
          const err = await parseRes.json().catch(() => ({ detail: parseRes.statusText }));
          throw new Error('Text parsing failed: ' + (err.detail || parseRes.statusText));
        }
        const parsed = await parseRes.json();
        setParsedFeatures(parsed.parsed_features);
        // Step 2: predict with parsed features
        result = await callPredict([parsed.parsed_features]);

      } else if (inputType === 'tabular') {
        result = await callPredict([formData]);

      } else {
        // Image: not yet supported via this API — show helpful message
        throw new Error('Image prediction requires a deployed image classification model. Please use the tabular or text input modes, or deploy your image model first.');
      }

      setPredictionResult({
        prediction: result.predictions?.[0] ?? 'N/A',
        confidence: result.confidence?.[0] != null
          ? `${(result.confidence[0] * 100).toFixed(1)}%`
          : result.probabilities?.[0]
            ? `${(Math.max(...result.probabilities[0]) * 100).toFixed(1)}%`
            : 'N/A',
        latency: result.latency_ms ? `${result.latency_ms}ms` : '—',
        explanation: result.explanation || `Model: ${selectedModel || 'Trained Model'}. Prediction computed from your input features.`,
        probabilities: result.probabilities?.[0] || null,
        model_name: result.model_name || selectedModel || 'Trained Model'
      });
      markStageComplete('/dashboard/testing');

    } catch (e: any) {
      setPredictionError(e.message);
    } finally {
      setIsPredicting(false);
      setIsParsingText(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 06</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Interactive Model Testing</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Test your trained <strong>{selectedModel || 'Model'}</strong> in real-time.
        {!resolvedModelId && <span className="text-amber-600 ml-2">⚠ No trained model detected — run a real training job first for live predictions.</span>}
      </p>

      <div className="flex gap-8">
        {/* Left: Input Form */}
        <div className="w-[400px] shrink-0 bg-white border border-[#f0ebe1] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-6 border-b border-[#f0ebe1] pb-4">
            <TestTube2 size={18} className="text-[#FF4400]" />
            <h3 className="font-bold text-[#1a1a1a]">Test Inference</h3>
          </div>

          <div className="flex gap-2 mb-6">
            {(['tabular', 'text', 'image'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => { setInputType(mode); setPredictionResult(null); setPredictionError(null); }}
                className={`flex-1 py-2 text-[13px] font-bold rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                  inputType === mode ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'bg-white text-[#555] border-[#f0ebe1] hover:bg-[#FDFBF7]'
                }`}
              >
                {mode === 'tabular' ? <Database size={14} /> : mode === 'text' ? <MessageSquare size={14} /> : <ImageIcon size={14} />}
                {mode === 'tabular' ? 'Tabular' : mode === 'text' ? 'Raw / Text' : 'Image'}
              </button>
            ))}
          </div>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {isAnalyzing ? (
              <div className="border-2 border-dashed border-[#f0ebe1] rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#FDFBF7] h-[200px]">
                <Activity size={32} className="text-[#FF4400] mb-4 animate-pulse" />
                <h3 className="text-[14px] font-bold text-[#1a1a1a] mb-1">Loading model features...</h3>
                <p className="text-[12px] text-[#888]">Reading feature schema from your trained model.</p>
              </div>
            ) : inputType === 'tabular' ? (
              generatedFields.length === 0 ? (
                <p className="text-[13px] text-[#888] text-center py-8">No feature schema found. Complete training first or upload a dataset.</p>
              ) : (
                generatedFields.map((field: any) => (
                  <div key={field.name}>
                    <label className="text-[12px] font-bold text-[#555] mb-1.5 block">{field.label}</label>
                    <input
                      type={field.type}
                      name={field.name}
                      value={formData[field.name] ?? ''}
                      onChange={handleChange}
                      className="w-full h-9 bg-[#FDFBF7] border border-[#f0ebe1] rounded-lg px-3 text-[13px] outline-none focus:border-[#FF4400] transition-colors"
                    />
                  </div>
                ))
              )
            ) : inputType === 'text' ? (
              <div>
                <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Natural Language Description</label>
                <textarea
                  rows={8}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g. 'A 45-year-old male patient with high blood pressure of 140/90, BMI 28.5, non-smoker, glucose level 105...'"
                  className="w-full bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl p-3 text-[13px] outline-none focus:border-[#FF4400] transition-colors resize-none"
                />
                <p className="text-[11px] text-[#888] mt-2 leading-relaxed">
                  The AI will parse your natural language input, extract feature values, and feed them into the model. Results may take 5–15 seconds.
                </p>
                {isParsingText && (
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-[#FF4400]">
                    <Loader2 size={12} className="animate-spin" /> Extracting features from your text via AI...
                  </div>
                )}
                {parsedFeatures && (
                  <div className="mt-3 bg-[#FDFBF7] border border-[#f0ebe1] rounded-lg p-3">
                    <p className="text-[11px] font-bold text-[#888] uppercase mb-2">Extracted Features</p>
                    {Object.entries(parsedFeatures).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-[12px] py-0.5">
                        <span className="text-[#555] font-mono">{k}</span>
                        <span className="font-bold text-[#1a1a1a]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#f0ebe1] rounded-xl p-8 flex flex-col items-center justify-center text-center bg-[#FDFBF7]">
                {imagePreview ? (
                  <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden border border-[#f0ebe1]">
                    <img src={imagePreview} alt="Preview" className="object-cover w-full h-full" />
                  </div>
                ) : (
                  <UploadCloud size={32} className="text-[#ccc] mb-3" />
                )}
                <label className="cursor-pointer text-[13px] font-bold text-[#FF4400] hover:underline">
                  {imagePreview ? 'Upload Different Image' : 'Browse Files'}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
                {!imagePreview && <p className="text-[12px] text-[#888] mt-2">JPG, PNG up to 5MB</p>}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#f0ebe1]">
            <button
              onClick={handlePredict}
              disabled={isPredicting || !resolvedModelId}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#1a1a1a] text-white font-bold text-[14px] hover:bg-[#333] transition-colors disabled:opacity-50"
            >
              {isPredicting ? <RefreshCw size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
              {isPredicting ? (isParsingText ? 'Parsing text with AI...' : 'Running Inference...') : 'Run Prediction'}
            </button>
            {!resolvedModelId && (
              <p className="text-[11px] text-amber-600 text-center mt-2">Complete training first to enable live predictions.</p>
            )}
          </div>
        </div>

        {/* Right: Result */}
        <div className="flex-1">
          {predictionError ? (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] font-bold text-red-700 mb-1">Prediction Failed</p>
                <p className="text-[13px] text-red-600 leading-relaxed">{predictionError}</p>
              </div>
            </div>
          ) : predictionResult ? (
            <div className="bg-[#FFF8F0] border-2 border-[#FF4400] rounded-2xl p-8 shadow-[0_8px_30px_rgba(255,68,0,0.08)] animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4400]/5 rounded-full blur-3xl -mr-20 -mt-20" />

              <div className="flex items-center gap-3 mb-8 relative z-10">
                <div className="w-10 h-10 rounded-full bg-[#FF4400] flex items-center justify-center text-white shadow-lg">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-[#1a1a1a]">{predictionResult.model_name} Prediction</h3>
                  <p className="text-[13px] text-[#FF4400] font-mono tracking-wide">
                    SUCCESS{predictionResult.latency !== '—' ? ` • LATENCY: ${predictionResult.latency}` : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 relative z-10 mb-8">
                <div className="bg-white rounded-xl p-5 border border-[#FF4400]/20 shadow-sm">
                  <span className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1">Predicted Value</span>
                  <span className="text-[28px] font-mono-heading text-[#1a1a1a] break-all">{String(predictionResult.prediction)}</span>
                </div>
                <div className="bg-white rounded-xl p-5 border border-[#FF4400]/20 shadow-sm">
                  <span className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-1">Confidence Score</span>
                  <span className="text-[28px] font-mono-heading text-[#10B981]">{predictionResult.confidence}</span>
                </div>
              </div>

              {predictionResult.probabilities && (
                <div className="relative z-10 mb-6">
                  <span className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2">Class Probabilities</span>
                  <div className="bg-white p-4 rounded-xl border border-[#f0ebe1] flex flex-wrap gap-3">
                    {predictionResult.probabilities.map((p: number, i: number) => (
                      <div key={i} className="text-[13px]">
                        <span className="font-bold text-[#1a1a1a]">Class {i}:</span>{' '}
                        <span className="text-[#FF4400]">{(p * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative z-10">
                <span className="block text-[11px] font-bold text-[#888] uppercase tracking-wider mb-2">Model Explanation</span>
                <p className="text-[14px] text-[#555] leading-relaxed bg-white p-4 rounded-xl border border-[#f0ebe1]">
                  {predictionResult.explanation}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full border-2 border-dashed border-[#f0ebe1] rounded-2xl flex flex-col items-center justify-center text-center p-10">
              <TestTube2 size={48} className="text-[#ccc] mb-4" />
              <h3 className="text-[18px] font-bold text-[#555] mb-2">Awaiting Input</h3>
              <p className="text-[14px] text-[#888] max-w-sm">
                Fill in the feature values on the left (or describe your data in natural language) and click "Run Prediction" to get a real model response.
              </p>
            </div>
          )}
        </div>
      </div>

      <PipelineNav
        prevLink="/dashboard/training"
        prevTitle="Model Training"
        nextLink="/dashboard/codegen"
        nextTitle="Code Generation"
      />
    </div>
  );
}
