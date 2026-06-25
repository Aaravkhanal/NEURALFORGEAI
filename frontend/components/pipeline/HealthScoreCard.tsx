'use client';

import { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface BreakdownItem {
  score: number;
  label: string;
  detail: string;
  color: string;
}

interface HealthScoreData {
  overall_score: number;
  grade: string;
  color: string;
  breakdown: BreakdownItem[];
  suggestions: { area: string; severity: string; message: string }[];
  total_metrics: number;
}

interface Props {
  fileId: string;
  onScoreLoaded?: (data: HealthScoreData) => void;
}

export default function HealthScoreCard({ fileId, onScoreLoaded }: Props) {
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  const fetchHealthScore = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/advisor/health-score/${fileId}`,
        { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
      );
      if (!res.ok) throw new Error('Failed to compute health score');
      const result = await res.json();
      setData(result);
      onScoreLoaded?.(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchHealthScore();
    });
  }, [fileId]);

  useEffect(() => {
    if (data) {
      let current = 0;
      const target = data.overall_score;
      const step = Math.max(1, Math.floor(target / 40));
      const interval = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(interval);
        }
        setAnimatedScore(current);
      }, 20);
      return () => clearInterval(interval);
    }
  }, [data]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#F59E0B';
    if (score >= 40) return '#F97316';
    return '#EF4444';
  };

  const getColorVar = (color: string) => {
    const map: Record<string, string> = {
      green: '#22C55E', yellow: '#F59E0B', orange: '#F97316', red: '#EF4444',
    };
    return map[color] || '#6B7280';
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: 40, textAlign: 'center',
      }}>
        <div className="spinner-lg" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Computing dataset health score...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--color-error)',
        borderRadius: 'var(--radius-xl)', padding: 32, textAlign: 'center',
      }}>
        <AlertTriangle size={24} color="var(--color-error)" />
        <p style={{ color: 'var(--color-error)', fontSize: 14, marginTop: 8 }}>{error || 'Failed to load'}</p>
      </div>
    );
  }

  const scoreColor = getScoreColor(data.overall_score);
  const circumference = 2 * Math.PI * 70;
  const progress = (animatedScore / 100) * circumference;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 28px 20px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${scoreColor}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Activity size={18} color={scoreColor} />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Dataset Health Score
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            {data.total_metrics} metrics analyzed
          </p>
        </div>
        <div style={{
          marginLeft: 'auto', padding: '4px 12px', borderRadius: 20,
          background: `${scoreColor}15`, color: scoreColor,
          fontSize: 13, fontWeight: 700,
        }}>
          Grade {data.grade}
        </div>
      </div>

      {/* Score Ring + Breakdown */}
      <div style={{ padding: '28px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Circular Score */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 180 }}>
          <div style={{ position: 'relative', width: 160, height: 160 }}>
            <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="80" cy="80" r="70" fill="none" stroke="var(--border-light)" strokeWidth="10" />
              <circle
                cx="80" cy="80" r="70" fill="none"
                stroke={scoreColor} strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 42, fontWeight: 800, color: scoreColor, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>
                {animatedScore}
              </span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>out of 100</span>
            </div>
          </div>
        </div>

        {/* Breakdown Bars */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.breakdown.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: getColorVar(item.color) }}>{item.score}/100</span>
                </div>
                <div style={{
                  height: 8, borderRadius: 4, background: 'var(--border-light)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4, width: `${item.score}%`,
                    background: getColorVar(item.color),
                    transition: 'width 0.8s ease-out',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Suggestions (expandable) */}
      {data.suggestions.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: '100%', padding: '14px 28px', display: 'flex',
              alignItems: 'center', gap: 8, background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
            }}
          >
            <TrendingUp size={16} color="var(--color-warning)" />
            {data.suggestions.length} Improvement Suggestion{data.suggestions.length > 1 ? 's' : ''}
            {expanded ? <ChevronUp size={14} style={{ marginLeft: 'auto' }} /> : <ChevronDown size={14} style={{ marginLeft: 'auto' }} />}
          </button>
          {expanded && (
            <div style={{ padding: '0 28px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.suggestions.map((s, i) => (
                <div key={i} style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: s.severity === 'high' ? 'var(--color-error-subtle)' : s.severity === 'medium' ? 'var(--color-warning-subtle)' : 'var(--color-primary-subtle)',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  {s.severity === 'high' ? <AlertTriangle size={14} color="var(--color-error)" style={{ marginTop: 2, flexShrink: 0 }} />
                    : <CheckCircle size={14} color="var(--color-warning)" style={{ marginTop: 2, flexShrink: 0 }} />}
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.area}</span>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
