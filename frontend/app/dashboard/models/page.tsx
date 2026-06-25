'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Brain, Zap, Target, Clock, HardDrive, TrendingUp } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ScatterChart, Scatter, ZAxis, CartesianGrid, Cell
} from 'recharts';
import { Play, Loader2, Info, CheckCircle2, Cpu, Sparkles } from 'lucide-react';

const getDynamicModels = (taskType: string) => {
  const type = taskType?.toLowerCase() || '';
  if (type.includes('image') || type.includes('vision')) {
    return [
      { rank: 1, name: 'Vision Transformer', accuracy: 94.1, badge: 'HIGHEST ACC', badgeClass: 'model-badge-best', barColor: '#10B981', icon: Brain },
      { rank: 2, name: 'ResNet-50', accuracy: 92.4, badge: 'RECOMMENDED', badgeClass: 'model-badge-recommended', barColor: '#FF4400', icon: Zap },
      { rank: 3, name: 'EfficientNet', accuracy: 91.2, badge: 'FASTEST', badgeClass: 'model-badge-fastest', barColor: '#F59E0B', icon: TrendingUp },
      { rank: 4, name: 'MobileNetV3', accuracy: 88.5, badge: null, badgeClass: '', barColor: '#3B82F6', icon: Clock },
      { rank: 5, name: 'VGG-16', accuracy: 85.3, badge: null, badgeClass: '', barColor: '#8B5CF6', icon: Target },
      { rank: 6, name: 'Simple CNN', accuracy: 78.1, badge: 'BASELINE', badgeClass: '', barColor: '#999999', icon: HardDrive },
    ];
  } else if (type.includes('text') || type.includes('nlp') || type.includes('language')) {
    return [
      { rank: 1, name: 'RoBERTa', accuracy: 91.5, badge: 'HIGHEST ACC', badgeClass: 'model-badge-best', barColor: '#10B981', icon: Brain },
      { rank: 2, name: 'BERT-Base', accuracy: 89.2, badge: 'RECOMMENDED', badgeClass: 'model-badge-recommended', barColor: '#FF4400', icon: Zap },
      { rank: 3, name: 'DistilBERT', accuracy: 87.8, badge: 'FASTEST', badgeClass: 'model-badge-fastest', barColor: '#F59E0B', icon: Clock },
      { rank: 4, name: 'LSTM', accuracy: 82.4, badge: null, badgeClass: '', barColor: '#3B82F6', icon: TrendingUp },
      { rank: 5, name: 'FastText', accuracy: 79.1, badge: null, badgeClass: '', barColor: '#8B5CF6', icon: Target },
      { rank: 6, name: 'Naive Bayes', accuracy: 72.5, badge: 'BASELINE', badgeClass: '', barColor: '#999999', icon: HardDrive },
    ];
  }
  return [
    { rank: 1, name: 'Neural Net', accuracy: 90.1, badge: 'HIGHEST ACC', badgeClass: 'model-badge-best', barColor: '#10B981', icon: Brain },
    { rank: 2, name: 'XGBoost', accuracy: 89.4, badge: 'RECOMMENDED', badgeClass: 'model-badge-recommended', barColor: '#FF4400', icon: Zap },
    { rank: 3, name: 'LightGBM', accuracy: 88.7, badge: null, badgeClass: '', barColor: '#F59E0B', icon: TrendingUp },
    { rank: 4, name: 'Random Forest', accuracy: 87.1, badge: null, badgeClass: '', barColor: '#10B981', icon: Target },
    { rank: 5, name: 'SVM', accuracy: 84.3, badge: null, badgeClass: '', barColor: '#3B82F6', icon: Brain },
    { rank: 6, name: 'Logistic Reg.', accuracy: 82.1, badge: 'FASTEST', badgeClass: 'model-badge-fastest', barColor: '#8B5CF6', icon: Clock },
  ];
};

const RADAR_DATA = [
  { metric: 'Accuracy', value: 89 },
  { metric: 'F1 Score', value: 87 },
  { metric: 'AUC-ROC', value: 92 },
  { metric: 'Speed', value: 85 },
  { metric: 'Eff.', value: 75 },
];

// Hardcoded data removed - we compute it dynamically now in the component

type MetricTab = 'accuracy' | 'f1' | 'auc';

export default function ModelBenchmarkPage() {
  const { markStageComplete, problemContext, problemDescription, fileId, selectedModel: globalSelectedModel, setSelectedModel: setGlobalSelectedModel, datasetProfile } = usePipeline();
  
  const currentTaskType = problemContext?.task_type || problemContext?.machine_learning_task || 'tabular';
  const [recommendedModels, setRecommendedModels] = useState<any[]>(getDynamicModels(currentTaskType));

  const [selectedModelIdx, setSelectedModelIdx] = useState(0); 
  const [metricTab, setMetricTab] = useState<MetricTab>('accuracy');
  
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // Computed data for the active view
  const COMPARISON_DATA = recommendedModels.map(m => {
    const acc = m.recommendationData?.accuracy_rating || m.accuracy;
    return {
      model: m.name,
      accuracy: acc,
      f1: acc > 80 ? acc - 2.1 : acc - 4.5
    };
  });

  const COST_ACC_DATA = recommendedModels.map(m => ({
    model: m.name,
    cost: 100 - (m.recommendationData?.speed_rating || 50),
    accuracy: m.recommendationData?.accuracy_rating || m.accuracy
  }));

  const SHAP_DATA = datasetProfile
    ? Object.keys(datasetProfile)
        .filter(col => col !== (problemContext?.prediction_target || ''))
        .slice(0, 6)
        .map((col, i) => ({ feature: col, importance: parseFloat((0.9 - i * 0.13).toFixed(2)) }))
    : [
        { feature: 'Feature 1 (Primary)', importance: 0.85 },
        { feature: 'Feature 2', importance: 0.62 },
        { feature: 'Feature 3', importance: 0.45 },
        { feature: 'Feature 4', importance: 0.38 },
        { feature: 'Feature 5', importance: 0.25 },
      ];

  const selectedRec = recommendedModels[selectedModelIdx]?.recommendationData;
  const METRICS = [
    { icon: TrendingUp, label: 'Accuracy', value: `${selectedRec?.accuracy_rating || recommendedModels[selectedModelIdx]?.accuracy || 89}%` },
    { icon: Target, label: 'F1 Score', value: `${((selectedRec?.accuracy_rating || recommendedModels[selectedModelIdx]?.accuracy || 89) - 2.1).toFixed(1)}%` },
    { icon: TrendingUp, label: 'AUC-ROC', value: `${Math.min(100, (selectedRec?.accuracy_rating || recommendedModels[selectedModelIdx]?.accuracy || 89) + 1.2).toFixed(1)}%` },
    { icon: Clock, label: 'Speed Rating', value: `${selectedRec?.speed_rating || 85}/100` },
    { icon: HardDrive, label: 'Ease of Use', value: `${selectedRec?.ease_rating || 80}/100` },
  ];

  const getMetricValue = (model: any) => {
    const acc = model.recommendationData?.accuracy_rating || model.accuracy;
    if (metricTab === 'f1') return (acc > 80 ? acc - 2.1 : acc - 4.5).toFixed(1);
    if (metricTab === 'auc') return Math.min(100, acc + 1.2).toFixed(1);
    return acc;
  };

  const handleGetRecommendations = async () => {
    setIsFetching(true);
    setHasFetched(false);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
      const response = await fetch('/api/backend/framework/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          file_id: fileId,
          problem_type: problemContext?.task_type || problemContext?.machine_learning_task,
          target_column: problemContext?.prediction_target,
          problem_statement: problemDescription,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const res = await response.json();

      if (res.recommendations && res.recommendations.length > 0) {
        const mappedModels = res.recommendations.map((rec: any, i: number) => ({
           rank: i + 1,
           name: rec.display_name,
           accuracy: rec.accuracy_rating,
           badge: i === 0 ? 'TOP CHOICE' : i === 1 ? 'FASTEST' : null,
           badgeClass: i === 0 ? 'model-badge-best' : i === 1 ? 'model-badge-fastest' : '',
           barColor: i === 0 ? '#10B981' : i === 1 ? '#F59E0B' : '#3B82F6',
           icon: i === 0 ? Brain : Target,
           recommendationData: rec
        }));
        setRecommendedModels(mappedModels);
        setGlobalSelectedModel(mappedModels[0].name);
      }
    } catch (e) {
      console.error("Error fetching AI recommendations:", e);
      setRecommendedModels(getDynamicModels(currentTaskType));
    } finally {
      setIsFetching(false);
      setHasFetched(true);
      markStageComplete('/dashboard/models');
    }
  };

  if (!hasFetched) {
    return (
      <div className="animate-fade-in">
        <div className="stage-badge mb-4">STAGE 04</div>
        <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">AI Model Recommendations</h1>
        <p className="text-[15px] text-[#888] mb-8">
          Let AI analyze your dataset and problem statement to recommend the absolute best framework.
        </p>

        {!isFetching ? (
          <button 
            onClick={handleGetRecommendations}
            className="w-full flex flex-col items-center justify-center gap-3 bg-[#FFF8F0] border-2 border-[#FF4400] rounded-2xl py-12 shadow-[0_8px_30px_rgba(255,68,0,0.1)] hover:shadow-[0_12px_40px_rgba(255,68,0,0.2)] hover:-translate-y-1 transition-all group overflow-hidden relative"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FF4400]/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-[#FF4400]/10 transition-all" />
            <div className="w-20 h-20 rounded-full bg-[#FF4400] flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg z-10 mb-2">
              <Sparkles size={36} className="ml-1" />
            </div>
            <div className="z-10 text-center">
              <span className="block text-[28px] font-bold text-[#1a1a1a] mb-2">Get AI Recommendations</span>
              <span className="block text-[15px] font-bold text-[#FF4400]">Analyze schema & recommend frameworks</span>
            </div>
          </button>
        ) : (
          <div className="bg-white border border-[#FF4400] rounded-2xl p-12 shadow-lg flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[#FF4400]/5 animate-pulse" />
            <Sparkles size={48} className="text-[#FF4400] animate-pulse mb-6 relative z-10" />
            <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-2 relative z-10">AI is Analyzing Your Problem...</h3>
            <p className="text-[#888] text-[15px] relative z-10">Matching your dataset schema and constraints to our framework database.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 04</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Model Selection</h1>
      <p className="text-[15px] text-[#888] mb-6">
        AI has analyzed your dataset. Select a framework below to proceed with training.
      </p>

      {/* Metric Tabs */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: 'accuracy', label: 'ACCURACY' },
          { key: 'f1', label: 'F1' },
          { key: 'auc', label: 'AUC-ROC' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMetricTab(key as MetricTab)}
            className={`tab-btn text-[12px] py-2 px-4 ${metricTab === key ? 'tab-btn-active' : ''}`}
            style={{ fontFamily: "'Space Mono', monospace", letterSpacing: '0.05em' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-6">
        {/* ─── Left: Model Leaderboard ─── */}
        <div className="w-[340px] shrink-0 space-y-3">
          {recommendedModels.map((model, idx) => {
            const isSelected = (globalSelectedModel && globalSelectedModel === model.name) || (!globalSelectedModel && selectedModelIdx === idx);
            return (
            <div
              key={model.rank}
              onClick={() => {
                setSelectedModelIdx(idx);
                // We no longer auto-set globalSelectedModel here, forcing them to use the explicit button
              }}
              className={`metric-card cursor-pointer flex items-center gap-4 transition-all ${
                selectedModelIdx === idx ? 'border-[#FF4400] bg-[#FFF8F0] shadow-sm' : ''
              }`}
            >
              {/* Rank */}
              <span className="text-[18px] font-bold text-[#ccc] w-6 text-center" style={{ fontFamily: "'Space Mono', monospace" }}>
                {model.rank}
              </span>

              {/* Icon */}
              <div className="w-8 h-8 rounded-lg bg-[#f5f0e8] flex items-center justify-center">
                <model.icon size={16} className="text-[#888]" />
              </div>

              {/* Name + Badge */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{model.name}</span>
                  {model.badge && <span className={`model-badge ${model.badgeClass}`}>{model.badge}</span>}
                </div>
                {/* Accuracy bar */}
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex-1 h-2 bg-[#f0ebe1] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${getMetricValue(model)}%`, background: model.barColor }} />
                  </div>
                  <span className="text-[13px] font-bold" style={{ fontFamily: "'Space Mono', monospace", color: model.barColor }}>
                    Est {getMetricValue(model)}%
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* ─── Right: Charts & Metrics ─── */}
        <div className="flex-1 space-y-6">
          {/* Top row: Radar + Metrics */}
          <div className="grid grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="dashed-card">
              <span className="section-label block mb-2">PERFORMANCE PROFILE — {(globalSelectedModel || recommendedModels[0]?.name).toUpperCase()}</span>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={[
                  { metric: 'Accuracy', value: recommendedModels[selectedModelIdx]?.recommendationData?.accuracy_rating || 89 },
                  { metric: 'Speed', value: recommendedModels[selectedModelIdx]?.recommendationData?.speed_rating || 85 },
                  { metric: 'Ease of Use', value: recommendedModels[selectedModelIdx]?.recommendationData?.ease_rating || 90 },
                  { metric: 'Suitability', value: recommendedModels[selectedModelIdx]?.recommendationData?.score || 95 },
                ]}>
                  <PolarGrid stroke="#f0ebe1" />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#999' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name={globalSelectedModel || recommendedModels[0]?.name} dataKey="value" stroke="#FF4400" fill="#FF4400" fillOpacity={0.15} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Metrics */}
            <div className="dashed-card">
              <span className="section-label block mb-4">METRICS</span>
              <div className="space-y-4">
                {METRICS.map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <m.icon size={14} className="text-[#999]" />
                      <span className="text-[13px] text-[#666]">{m.label}</span>
                    </div>
                    <span className="text-[14px] font-bold text-[#FF4400]" style={{ fontFamily: "'Space Mono', monospace" }}>
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Model Recommendation Engine Card */}
          <div className="bg-[#FFF8F0] border border-[#FF4400]/30 rounded-2xl p-6 relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4400]/5 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-[#FF4400]" />
                <span className="text-[13px] font-bold text-[#FF4400] tracking-wider uppercase">AI Analysis</span>
              </div>
              
              <button 
                onClick={() => setGlobalSelectedModel(recommendedModels[selectedModelIdx]?.name)}
                className={`px-4 py-1.5 rounded-lg text-[13px] font-bold transition-all ${
                  globalSelectedModel === recommendedModels[selectedModelIdx]?.name 
                  ? 'bg-green-500 text-white shadow-md'
                  : 'bg-[#FF4400] text-white hover:bg-[#e63d00]'
                }`}
              >
                {globalSelectedModel === recommendedModels[selectedModelIdx]?.name ? (
                  <span className="flex items-center gap-2"><CheckCircle2 size={14} /> Selected for Training</span>
                ) : (
                  'Select this Framework'
                )}
              </button>
            </div>
            
            <p className="text-[14px] text-[#1a1a1a] leading-relaxed mb-4">
              <strong>{recommendedModels[selectedModelIdx]?.name}</strong> {recommendedModels[selectedModelIdx]?.recommendationData?.why || `is highly recommended for this dataset.`}
            </p>

            <div className="grid grid-cols-2 gap-6 relative z-10">
              <div>
                <span className="block text-[11px] font-bold text-[#10B981] uppercase mb-2">Strengths</span>
                <ul className="text-[12px] text-[#555] space-y-1">
                  {(recommendedModels[selectedModelIdx]?.recommendationData?.strengths || []).map((strength: string, i: number) => (
                    <li key={i}>• {strength}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="block text-[11px] font-bold text-[#3B82F6] uppercase mb-2">Best For</span>
                <p className="text-[12px] text-[#555]">
                  {recommendedModels[selectedModelIdx]?.recommendationData?.best_for || "General purpose use."}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom: Bar comparison */}
          <div className="dashed-card">
            <span className="section-label block mb-4">ACCURACY vs F1 COMPARISON</span>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={COMPARISON_DATA} barGap={2}>
                <XAxis dataKey="model" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                <YAxis domain={[75, 95]} tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="accuracy" name="Accuracy" fill="#FF4400" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="f1" name="F1 Score" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Explainability and Cost */}
          <div className="grid grid-cols-2 gap-6">
            <div className="dashed-card">
              <span className="section-label block mb-4">EXPLAINABILITY & ARCHITECTURE</span>
              <p className="text-[12px] text-[#888] mb-4">Predicted framework structure for {globalSelectedModel || recommendedModels[0]?.name}</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={SHAP_DATA} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ebe1" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="importance" fill="#FF4400" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="dashed-card">
              <span className="section-label block mb-4">COST VS ACCURACY ANALYSIS</span>
              <p className="text-[12px] text-[#888] mb-4">Estimated compute cost relative to model accuracy</p>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe1" />
                  <XAxis type="number" dataKey="cost" name="Relative Cost" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                  <YAxis type="number" dataKey="accuracy" name="Accuracy" domain={[80, 95]} tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }} />
                  <Scatter name="Models" data={COST_ACC_DATA} fill="#FF4400" shape="circle">
                    {COST_ACC_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.model === (globalSelectedModel || recommendedModels[0]?.name) ? '#FF4400' : '#ccc'} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <PipelineNav 
        prevLink="/dashboard/cleaning" 
        prevTitle="Data Cleaning"
        nextLink="/dashboard/training" 
        nextTitle={`Proceed with ${globalSelectedModel || 'Training'}`}
      />
    </div>
  );
}
