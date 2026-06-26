'use client';

import { useEffect, useState } from 'react';
import { Activity, Clock, ShieldAlert, TrendingUp, AlertTriangle, Zap, BarChart2, Info } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Cell,
} from 'recharts';

export default function MonitoringPage() {
  const { markStageComplete, trainedModelId, selectedModel, problemContext, targetColumn } = usePipeline();
  const [modelInfo, setModelInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { markStageComplete('/dashboard/monitoring'); }, [markStageComplete]);

  // Fetch real model features / metrics
  useEffect(() => {
    if (!trainedModelId) return;
    setLoading(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('neuralforge_token') : null;
    fetch(`/api/backend/playground/models/${trainedModelId}/features`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setModelInfo(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trainedModelId]);

  const modelName = selectedModel || modelInfo?.model_name || '—';
  const taskType = problemContext?.task_type || modelInfo?.task_type || '—';
  const target = targetColumn || problemContext?.prediction_target || modelInfo?.target_column || '—';
  const metrics: Record<string, number> = modelInfo?.metrics || {};
  const features: { name: string; importance?: number }[] = modelInfo?.features || [];

  // Build feature importance chart data from real model feature list
  const importanceData = features
    .filter(f => f.importance !== undefined && f.importance !== null)
    .sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0))
    .slice(0, 10)
    .map(f => ({ name: f.name, value: +(f.importance! * 100).toFixed(1) }));

  // Metric cards from real training results
  const isClassification = taskType.toLowerCase().includes('classif');
  const metricCards = isClassification
    ? [
        { label: 'ACCURACY', value: metrics.accuracy != null ? `${(metrics.accuracy * 100).toFixed(1)}%` : '—', icon: Activity, color: '#10B981' },
        { label: 'F1 SCORE', value: metrics.f1 != null ? metrics.f1.toFixed(3) : (metrics['f1_score'] != null ? metrics['f1_score'].toFixed(3) : '—'), icon: TrendingUp, color: '#3B82F6' },
        { label: 'PRECISION', value: metrics.precision != null ? metrics.precision.toFixed(3) : '—', icon: ShieldAlert, color: '#8B5CF6' },
        { label: 'RECALL', value: metrics.recall != null ? metrics.recall.toFixed(3) : '—', icon: Clock, color: '#F59E0B' },
      ]
    : [
        { label: 'R² SCORE', value: metrics.r2 != null ? metrics.r2.toFixed(4) : (metrics['r2_score'] != null ? metrics['r2_score'].toFixed(4) : '—'), icon: TrendingUp, color: '#10B981' },
        { label: 'RMSE', value: metrics.rmse != null ? metrics.rmse.toFixed(4) : '—', icon: Activity, color: '#FF4400' },
        { label: 'MAE', value: metrics.mae != null ? metrics.mae.toFixed(4) : '—', icon: BarChart2, color: '#3B82F6' },
        { label: 'VAL LOSS', value: metrics.val_loss != null ? metrics.val_loss.toFixed(4) : (metrics['validation_loss'] != null ? metrics['validation_loss'].toFixed(4) : '—'), icon: ShieldAlert, color: '#F59E0B' },
      ];

  const hasModel = !!trainedModelId;
  const hasMetrics = Object.keys(metrics).length > 0;

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 09</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-1">Model Monitoring</h1>
      <p className="text-[15px] text-[#888] mb-6">
        Training results and model performance for <strong className="text-[#1a1a1a]">{modelName}</strong>.
      </p>

      {!hasModel ? (
        <div className="dashed-card text-center py-16 space-y-3">
          <Info size={32} className="mx-auto text-[#aaa]" />
          <p className="font-bold text-[15px] text-[#555]">No trained model found</p>
          <p className="text-[13px] text-[#888]">
            Complete the Model Training stage to see real performance metrics here.
          </p>
        </div>
      ) : (
        <>
          {/* Model identity row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'MODEL', value: modelName },
              { label: 'TASK TYPE', value: taskType },
              { label: 'TARGET COLUMN', value: target },
            ].map(c => (
              <div key={c.label} className="metric-card">
                <p className="section-label mb-1">{c.label}</p>
                <p className="text-[15px] font-bold text-[#1a1a1a] truncate" title={c.value}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Metric KPI cards */}
          {loading ? (
            <div className="h-24 flex items-center justify-center text-[#aaa] text-[13px]">Loading metrics…</div>
          ) : hasMetrics ? (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {metricCards.map((kpi, i) => (
                <div key={i} className="metric-card">
                  <div className="flex items-center gap-2 mb-2">
                    <kpi.icon size={13} className="text-[#999]" />
                    <span className="section-label">{kpi.label}</span>
                  </div>
                  <span
                    className="text-[22px] font-bold"
                    style={{ fontFamily: "'Space Mono', monospace", color: kpi.value === '—' ? '#ccc' : kpi.color }}
                  >
                    {kpi.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashed-card text-center py-8 mb-6">
              <p className="text-[13px] text-[#888]">Metrics not available for this model.</p>
            </div>
          )}

          <div className="flex gap-6">
            <div className="flex-1 space-y-6">
              {/* Feature importance chart */}
              {importanceData.length > 0 ? (
                <div className="dashed-card">
                  <span className="section-label block mb-4">FEATURE IMPORTANCE (TOP {importanceData.length})</span>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={importanceData} layout="vertical" margin={{ left: 0, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0ebe1" />
                      <XAxis type="number" domain={[0, 'auto']} tick={{ fontSize: 11, fill: '#888' }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: '#555', fontFamily: "'Space Mono', monospace" }} />
                      <Tooltip
                        formatter={(v: number) => [`${v}%`, 'Importance']}
                        contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {importanceData.map((_, i) => (
                          <Cell key={i} fill={i === 0 ? '#FF4400' : i < 3 ? '#FF7A50' : '#f0ebe1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="dashed-card">
                  <span className="section-label block mb-3">FEATURE IMPORTANCE</span>
                  <p className="text-[13px] text-[#888]">Feature importance not available for this model type.</p>
                </div>
              )}

              {/* All metrics table */}
              {hasMetrics && (
                <div className="dashed-card">
                  <span className="section-label block mb-4">ALL TRAINING METRICS</span>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(metrics).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-[#fdfaf7] rounded-xl border border-[#f0ebe1]">
                        <span className="text-[11px] font-bold text-[#888] uppercase tracking-wider">{key.replace(/_/g, ' ')}</span>
                        <span className="text-[13px] font-bold text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>
                          {typeof val === 'number' ? val.toFixed(4) : String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right sidebar */}
            <div className="w-[270px] shrink-0 space-y-4">
              {/* Features list */}
              <div className="dashed-card">
                <span className="section-label block mb-3">TRAINED FEATURES ({features.length})</span>
                <div className="space-y-1 max-h-[320px] overflow-y-auto pr-1">
                  {features.length > 0 ? features.map((f, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#f8f4ee] last:border-0">
                      <span className="text-[11px] text-[#555] font-mono truncate" style={{ fontFamily: "'Space Mono', monospace" }}>{f.name}</span>
                      {f.importance != null && (
                        <span className="text-[10px] text-[#888] ml-2 shrink-0">{(f.importance * 100).toFixed(1)}%</span>
                      )}
                    </div>
                  )) : (
                    <p className="text-[12px] text-[#aaa]">No feature list available.</p>
                  )}
                </div>
              </div>

              {/* Status card */}
              <div className="bg-white border border-[#f0ebe1] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={16} className="text-[#10B981]" />
                  <h3 className="font-bold text-[13px] text-[#1a1a1a]">Model Trained</h3>
                </div>
                <p className="text-[11px] text-[#666]">
                  This model is ready for deployment. Go to the Deployment stage to generate
                  your production package.
                </p>
                <div className="mt-3 pt-3 border-t border-[#f0ebe1]">
                  <p className="text-[10px] text-[#aaa] font-mono">{trainedModelId?.slice(0, 16)}…</p>
                </div>
              </div>

              {/* Live monitoring callout */}
              <div className="bg-[#FFF8F0] border border-[#FF4400]/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} className="text-[#FF4400]" />
                  <h3 className="font-bold text-[13px] text-[#1a1a1a]">Live Monitoring</h3>
                </div>
                <p className="text-[11px] text-[#666]">
                  Deploy your model to start collecting live request logs, latency metrics,
                  and data drift alerts in production.
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <PipelineNav
        prevLink="/dashboard/deployment"
        prevTitle="Deployment"
      />
    </div>
  );
}
