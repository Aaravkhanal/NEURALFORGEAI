'use client';

import { CheckCircle, AlertTriangle, TrendingUp, Target, BarChart3, Brain } from 'lucide-react';

interface Props {
  modelName: string;
  metrics?: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    training_time?: number;
    total_epochs?: number;
  };
}

export default function TrainingAnalysis({ modelName, metrics }: Props) {
  // Use provided metrics or demo defaults
  const m = metrics || {
    accuracy: 86.2,
    precision: 84.5,
    recall: 87.8,
    f1_score: 86.1,
    training_time: 45,
    total_epochs: 10,
  };

  const overallRating = (m.accuracy || 0) >= 90 ? 'Excellent' :
                        (m.accuracy || 0) >= 80 ? 'Good' :
                        (m.accuracy || 0) >= 70 ? 'Fair' : 'Needs Improvement';

  const ratingColor = overallRating === 'Excellent' ? '#22C55E' :
                      overallRating === 'Good' ? '#3B82F6' :
                      overallRating === 'Fair' ? '#F59E0B' : '#EF4444';

  const insights = generateInsights(m);

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${ratingColor}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={18} color={ratingColor} />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Training Analysis — {modelName}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            AI-generated performance report
          </p>
        </div>
        <div style={{
          padding: '6px 14px', borderRadius: 20,
          background: `${ratingColor}15`, color: ratingColor,
          fontSize: 13, fontWeight: 700,
        }}>
          {overallRating}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 12, padding: '24px',
      }}>
        <LargeMetricCard label="Accuracy" value={`${(m.accuracy || 0).toFixed(1)}%`} icon={<Target size={16} />} color="#3B82F6" />
        <LargeMetricCard label="Precision" value={`${(m.precision || 0).toFixed(1)}%`} icon={<CheckCircle size={16} />} color="#22C55E" />
        <LargeMetricCard label="Recall" value={`${(m.recall || 0).toFixed(1)}%`} icon={<TrendingUp size={16} />} color="#F59E0B" />
        <LargeMetricCard label="F1 Score" value={`${(m.f1_score || 0).toFixed(1)}%`} icon={<BarChart3 size={16} />} color="#8B5CF6" />
      </div>

      {/* AI Insights */}
      <div style={{ padding: '0 24px 24px' }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={14} color="var(--color-primary)" />
          AI Insights & Recommendations
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {insights.map((insight, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: 12,
              background: insight.type === 'success' ? 'var(--color-success-subtle)' :
                         insight.type === 'warning' ? 'var(--color-warning-subtle)' :
                         insight.type === 'error' ? 'var(--color-error-subtle)' : 'var(--color-primary-subtle)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              {insight.type === 'success' ? <CheckCircle size={16} color="var(--color-success)" style={{ marginTop: 1, flexShrink: 0 }} /> :
               insight.type === 'warning' ? <AlertTriangle size={16} color="var(--color-warning)" style={{ marginTop: 1, flexShrink: 0 }} /> :
               <TrendingUp size={16} color="var(--color-primary)" style={{ marginTop: 1, flexShrink: 0 }} />}
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {insight.title}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {insight.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Training Stats Footer */}
      <div style={{
        padding: '14px 24px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 24, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          ⏱️ Training Time: <strong style={{ color: 'var(--text-primary)' }}>{m.training_time}s</strong>
        </span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          🔄 Epochs: <strong style={{ color: 'var(--text-primary)' }}>{m.total_epochs}</strong>
        </span>
      </div>
    </div>
  );
}

function LargeMetricCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      padding: '16px', borderRadius: 14,
      background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8, color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color, fontFamily: 'var(--font-heading)' }}>
        {value}
      </p>
    </div>
  );
}

function generateInsights(m: any): { title: string; message: string; type: string }[] {
  const insights = [];
  const acc = m.accuracy || 0;
  const prec = m.precision || 0;
  const rec = m.recall || 0;

  if (acc >= 90) {
    insights.push({
      title: 'Excellent Accuracy',
      message: `Your model achieved ${acc.toFixed(1)}% accuracy, which is outstanding. Ensure you validate on unseen data to confirm generalization.`,
      type: 'success',
    });
  } else if (acc >= 80) {
    insights.push({
      title: 'Good Accuracy',
      message: `${acc.toFixed(1)}% accuracy is solid. To push beyond 90%, consider: more training data, data augmentation, or a more complex model architecture.`,
      type: 'info',
    });
  } else {
    insights.push({
      title: 'Accuracy Needs Improvement',
      message: `${acc.toFixed(1)}% accuracy may be insufficient for production. Try: cleaning your data further, feature engineering, or using ensemble methods.`,
      type: 'warning',
    });
  }

  if (Math.abs(prec - rec) > 10) {
    insights.push({
      title: 'Precision-Recall Imbalance',
      message: `Precision (${prec.toFixed(1)}%) and Recall (${rec.toFixed(1)}%) differ significantly. This suggests class imbalance. Try SMOTE, class weights, or threshold adjustment.`,
      type: 'warning',
    });
  } else {
    insights.push({
      title: 'Balanced Precision & Recall',
      message: `Good balance between Precision (${prec.toFixed(1)}%) and Recall (${rec.toFixed(1)}%). Your model isn't heavily biased toward false positives or false negatives.`,
      type: 'success',
    });
  }

  insights.push({
    title: 'Next Steps',
    message: 'Download your model and deploy it using the Deployment Generator, or go back and compare with other architectures to find the best one.',
    type: 'info',
  });

  return insights;
}
