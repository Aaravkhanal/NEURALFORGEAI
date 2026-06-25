'use client';

import { useState, useEffect } from 'react';
import {
  BarChart3, PieChart, AlertTriangle, Copy, Eye, Hash, Type, Calendar,
  Layers, TrendingUp, Percent, Image, FileText, Table, Loader2, RefreshCw,
  CheckCircle, XCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface Props {
  fileId: string;
  datasetType: string;
  onProfileComplete?: (profile: any) => void;
}

export default function DatasetProfiler({ fileId, datasetType, onProfileComplete }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/api/files/${fileId}/profile`);
      setProfile(data);
      onProfileComplete?.(data);
    } catch (err: any) {
      setError(err.message || 'Failed to profile dataset');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fileId) {
      Promise.resolve().then(() => {
        fetchProfile();
      });
    }
  }, [fileId]);

  if (loading) {
    return (
      <div className="card-flat" style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner-lg" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Analyzing Dataset...</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Detecting quality issues, duplicates, and generating statistics
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-flat" style={{ padding: 32, textAlign: 'center' }}>
        <AlertTriangle size={32} color="var(--color-warning)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14, color: 'var(--color-error)', marginBottom: 12 }}>{error}</p>
        <button className="btn-secondary" onClick={fetchProfile}><RefreshCw size={14} /> Retry</button>
      </div>
    );
  }

  if (!profile) return null;

  const tabs = datasetType === 'image'
    ? ['overview', 'classes', 'quality', 'duplicates']
    : ['overview', 'columns', 'missing', 'distributions'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tabs */}
      <div className="tab-group">
        {tabs.map(tab => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Image Dataset Profiler */}
      {datasetType === 'image' && (
        <>
          {activeTab === 'overview' && <ImageOverview profile={profile} />}
          {activeTab === 'classes' && <ClassDistribution profile={profile} />}
          {activeTab === 'quality' && <QualityReport profile={profile} />}
          {activeTab === 'duplicates' && <DuplicateReport profile={profile} />}
        </>
      )}

      {/* Tabular/Text Dataset Profiler */}
      {datasetType !== 'image' && (
        <>
          {activeTab === 'overview' && <TabularOverview profile={profile} datasetType={datasetType} />}
          {activeTab === 'columns' && <ColumnDetails profile={profile} />}
          {activeTab === 'missing' && <MissingValues profile={profile} />}
          {activeTab === 'distributions' && <Distributions profile={profile} />}
        </>
      )}
    </div>
  );
}

/* ── Image Profiler Panels ──────────────────────────────── */

function ImageOverview({ profile }: { profile: any }) {
  const meta = profile.image_metadata || {};
  const metrics = [
    { label: 'Total Images', value: meta.total_images?.toLocaleString() || '0', icon: Image, color: '#8B5CF6' },
    { label: 'Classes', value: meta.num_classes || '0', icon: Layers, color: '#3B82F6' },
    { label: 'Dataset Size', value: `${meta.dataset_size_mb?.toFixed(1) || '0'} MB`, icon: BarChart3, color: '#22C55E' },
    { label: 'Corrupt Files', value: meta.corrupt_images?.length || '0', icon: XCircle, color: meta.corrupt_images?.length > 0 ? '#EF4444' : '#22C55E' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {metrics.map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-icon" style={{ background: `${m.color}15` }}>
              <m.icon size={18} color={m.color} />
            </div>
            <span className="metric-value">{m.value}</span>
            <span className="metric-label">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Resolution distribution */}
      {meta.resolution_distribution && Object.keys(meta.resolution_distribution).length > 0 && (
        <div className="card-flat">
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Resolution Distribution</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(meta.resolution_distribution).slice(0, 8).map(([res, count]: [string, any]) => {
              const maxCount = Math.max(...(Object.values(meta.resolution_distribution) as number[]));
              const pct = (count / maxCount) * 100;
              return (
                <div key={res} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{res}</span>
                  <div style={{ flex: 1, height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', width: 40, fontFamily: 'var(--font-mono)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Format distribution */}
      {meta.format_distribution && Object.keys(meta.format_distribution).length > 0 && (
        <div className="card-flat">
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Format Distribution</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(meta.format_distribution).map(([fmt, count]: [string, any]) => (
              <span key={fmt} className="badge badge-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
                .{fmt}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClassDistribution({ profile }: { profile: any }) {
  const meta = profile.image_metadata || {};
  const classes = meta.classes || {};
  const totalImages = meta.total_images || 1;
  const sorted = Object.entries(classes).sort(([, a]: any, [, b]: any) => b - a);
  const maxCount = sorted.length > 0 ? (sorted[0][1] as number) : 1;
  const avgCount = totalImages / (Object.keys(classes).length || 1);
  const imbalanceReport = meta.class_imbalance_report || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {Object.keys(imbalanceReport).length > 0 && (
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <AlertTriangle size={14} /> Class Imbalance Detected
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {Object.keys(imbalanceReport).length} classes are significantly imbalanced. Consider data augmentation or sampling.
          </p>
        </div>
      )}

      <div className="card-flat">
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
          Class Distribution ({sorted.length} classes)
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map(([cls, count]: [string, any]) => {
            const pct = ((count / totalImages) * 100).toFixed(1);
            const barPct = (count / maxCount) * 100;
            const isImbalanced = imbalanceReport[cls];
            return (
              <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cls}</span>
                <div style={{ flex: 1, height: 10, background: 'var(--border-light)', borderRadius: 5, overflow: 'hidden' }}>
                  <div style={{
                    width: `${barPct}%`, height: '100%', borderRadius: 5,
                    background: isImbalanced
                      ? (isImbalanced.status === 'underrepresented' ? '#F59E0B' : '#EF4444')
                      : 'var(--color-primary)',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', width: 70, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {count} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function QualityReport({ profile }: { profile: any }) {
  const meta = profile.image_metadata || {};
  const quality = meta.quality_report || {};
  const categories = [
    { key: 'blurry', label: 'Blurry Images', icon: Eye, color: '#F59E0B', desc: 'Low sharpness score (Laplacian variance < 100)' },
    { key: 'overexposed', label: 'Overexposed', icon: TrendingUp, color: '#EF4444', desc: 'Average brightness > 240' },
    { key: 'underexposed', label: 'Underexposed', icon: TrendingUp, color: '#6366F1', desc: 'Average brightness < 15' },
    { key: 'low_resolution', label: 'Low Resolution', icon: Image, color: '#8B5CF6', desc: 'Width or height < 64px' },
    { key: 'noisy', label: 'Noisy Images', icon: Hash, color: '#EC4899', desc: 'High noise estimation score' },
  ];

  const totalIssues = categories.reduce((sum, c) => sum + (quality[c.key]?.length || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card-flat" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px' }}>
        {totalIssues === 0 ? (
          <>
            <CheckCircle size={20} color="#22C55E" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#22C55E' }}>All images pass quality checks</span>
          </>
        ) : (
          <>
            <AlertTriangle size={20} color="#F59E0B" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#F59E0B' }}>{totalIssues} quality issues found</span>
          </>
        )}
      </div>

      {categories.map(cat => {
        const count = quality[cat.key]?.length || 0;
        return (
          <div key={cat.key} className="card-flat" style={{
            display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
            opacity: count === 0 ? 0.5 : 1,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: `${cat.color}15`, display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <cat.icon size={18} color={cat.color} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{cat.label}</span>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{cat.desc}</p>
            </div>
            <span style={{
              fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-heading)',
              color: count > 0 ? cat.color : 'var(--text-muted)',
            }}>
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DuplicateReport({ profile }: { profile: any }) {
  const dupInfo = profile.duplicate_info || {};
  const groups = dupInfo.groups || 0;
  const totalDuplicates = dupInfo.total_duplicates || 0;

  return (
    <div className="card-flat" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
        background: totalDuplicates > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Copy size={28} color={totalDuplicates > 0 ? '#F59E0B' : '#22C55E'} />
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
        {totalDuplicates > 0 ? `${totalDuplicates} Duplicates Found` : 'No Duplicates Found'}
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {totalDuplicates > 0
          ? `${groups} groups of near-duplicate images detected using perceptual hashing`
          : 'All images are unique based on perceptual hash comparison'
        }
      </p>
    </div>
  );
}

/* ── Tabular/Text Profiler Panels ───────────────────────── */

function TabularOverview({ profile, datasetType }: { profile: any; datasetType: string }) {
  const metrics = [
    { label: 'Rows', value: profile.row_count?.toLocaleString() || '0', icon: Hash, color: '#8B5CF6' },
    { label: 'Columns', value: profile.column_count || '0', icon: Layers, color: '#3B82F6' },
    { label: 'Missing Values', value: Object.keys(profile.missing_values || {}).length, icon: AlertTriangle, color: Object.keys(profile.missing_values || {}).length > 0 ? '#F59E0B' : '#22C55E' },
    { label: 'Duplicates', value: profile.duplicate_info?.count || '0', icon: Copy, color: (profile.duplicate_info?.count || 0) > 0 ? '#F59E0B' : '#22C55E' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {metrics.map((m, i) => (
          <div key={i} className="metric-card">
            <div className="metric-icon" style={{ background: `${m.color}15` }}>
              <m.icon size={18} color={m.color} />
            </div>
            <span className="metric-value">{m.value}</span>
            <span className="metric-label">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Data types */}
      {profile.data_types && Object.keys(profile.data_types).length > 0 && (
        <div className="card-flat">
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Column Types</h4>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(profile.data_types).map(([dtype, count]: [string, any]) => (
              <span key={dtype} className="badge badge-primary" style={{ fontSize: 13, padding: '6px 14px' }}>
                {dtype}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sample data preview */}
      {profile.sample_data && profile.sample_data.length > 0 && (
        <div className="card-flat" style={{ overflow: 'auto' }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Sample Data</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(profile.sample_data[0]).map(col => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {profile.sample_data.slice(0, 5).map((row: any, i: number) => (
                  <tr key={i}>
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(val)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ColumnDetails({ profile }: { profile: any }) {
  const columns = profile.columns || [];

  return (
    <div className="card-flat" style={{ overflow: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Non-Null</th>
            <th>Null %</th>
            <th>Unique</th>
            <th>Mean</th>
            <th>Std</th>
            <th>Min</th>
            <th>Max</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col: any) => (
            <tr key={col.name}>
              <td style={{ fontWeight: 600 }}>{col.name}</td>
              <td><span className="badge badge-primary">{col.dtype}</span></td>
              <td>{col.non_null_count}</td>
              <td>
                <span style={{ color: col.null_percentage > 5 ? 'var(--color-warning)' : 'var(--text-muted)' }}>
                  {col.null_percentage || 0}%
                </span>
              </td>
              <td>{col.unique_count}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col.mean ?? '—'}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col.std ?? '—'}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col.min ?? '—'}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{col.max ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingValues({ profile }: { profile: any }) {
  const missing = profile.missing_values || {};
  const totalCols = Object.keys(missing).length;

  if (totalCols === 0) {
    return (
      <div className="card-flat" style={{ textAlign: 'center', padding: 32 }}>
        <CheckCircle size={32} color="#22C55E" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: 15, fontWeight: 600, color: '#22C55E' }}>No Missing Values</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>All columns have complete data</p>
      </div>
    );
  }

  const sorted = Object.entries(missing).sort(([, a]: any, [, b]: any) => b.percentage - a.percentage);

  return (
    <div className="card-flat">
      <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
        Missing Values ({totalCols} columns affected)
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(([col, info]: [string, any]) => (
          <div key={col} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col}</span>
            <div style={{ flex: 1, height: 8, background: 'var(--border-light)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(info.percentage, 100)}%`, height: '100%', borderRadius: 4,
                background: info.percentage > 30 ? '#EF4444' : info.percentage > 10 ? '#F59E0B' : '#3B82F6',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', width: 80, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
              {info.count} ({info.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Distributions({ profile }: { profile: any }) {
  const distributions = profile.feature_distributions || {};
  const outliers = profile.outliers || {};

  if (Object.keys(distributions).length === 0 && Object.keys(outliers).length === 0) {
    return (
      <div className="card-flat" style={{ textAlign: 'center', padding: 32 }}>
        <BarChart3 size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No numeric distributions to display</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Outlier summary */}
      {Object.keys(outliers).length > 0 && (
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)',
        }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#F59E0B', marginBottom: 8 }}>
            <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
            Outliers Detected in {Object.keys(outliers).length} columns
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(outliers).map(([col, info]: [string, any]) => (
              <span key={col} className="badge badge-warning">
                {col}: {info.count} ({info.percentage}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Feature histograms */}
      {Object.entries(distributions).slice(0, 8).map(([col, dist]: [string, any]) => (
        <div key={col} className="card-flat">
          <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
            {col}
            {outliers[col] && (
              <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                {outliers[col].count} outliers
              </span>
            )}
          </h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 60 }}>
            {dist.counts?.map((count: number, i: number) => {
              const maxCount = Math.max(...dist.counts);
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <div key={i} style={{
                  flex: 1, height: `${heightPct}%`, minHeight: 2,
                  background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-light))',
                  borderRadius: '2px 2px 0 0', transition: 'height 0.3s ease',
                }} title={`${dist.bins?.[i]?.toFixed(2)} – ${dist.bins?.[i + 1]?.toFixed(2)}: ${count}`} />
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{dist.bins?.[0]?.toFixed(2)}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{dist.bins?.[dist.bins.length - 1]?.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
