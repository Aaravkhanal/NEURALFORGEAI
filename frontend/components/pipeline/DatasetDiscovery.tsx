'use client';

import { useState, useEffect } from 'react';
import {
  Search, Star, Database, Clock, Cpu, HardDrive,
  ExternalLink, Loader2, ArrowRight, BarChart3,
  CheckCircle, GitCompare, AlertTriangle, Wand2, Merge
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DatasetResult {
  name: string;
  source: string;
  source_url: string;
  dataset_type: string;
  size: string;
  samples: number;
  classes: number;
  labels: string[];
  quality_score: number;
  popularity: string;
  difficulty: string;
  recommended_models: string[];
  estimated_training_time: string;
  hardware_requirements: string;
  license: string;
  description: string;
  advantages: string[];
  disadvantages: string[];
  recommendation_tier?: string;
  recommendation_reason?: string;
}

interface Props {
  projectType: string;
  projectDescription: string;
  defaultMode?: 'discovery' | 'generate';
  onDatasetSelected: (dataset: DatasetResult) => void;
  onCompareRequest: (datasets: DatasetResult[]) => void;
  onSkipToUpload: () => void;
}

const SOURCE_ICONS: Record<string, string> = {
  'Kaggle': '🏆',
  'HuggingFace': '🤗',
  'UCI': '🎓',
  'COCO Dataset': '📸',
  'Academic': '📚',
  'OpenML': '🔬',
  'Roboflow': '🤖',
  'GitHub': '🐙',
};

const DIFFICULTY_COLOR: Record<string, string> = {
  'Easy': '#22C55E',
  'Medium': '#F59E0B',
  'Hard': '#EF4444',
};

export default function DatasetDiscovery({
  projectType, projectDescription, defaultMode = 'discovery', onDatasetSelected, onCompareRequest, onSkipToUpload,
}: Props) {
  const [results, setResults] = useState<DatasetResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhase, setSearchPhase] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState<Set<number>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const handleGenerateSynthetic = async () => {
    setIsGenerating(true);
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/generate-synthetic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          project_description: projectDescription,
          project_type: projectType,
          num_rows: 100
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onDatasetSelected({ name: data.filename, dataset_type: 'tabular', id: data.file_id } as any);
      }
    } catch (e) {
      console.error('Synthetic generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const searchDatasets = async () => {
    setLoading(true);
    const phases = [
      'Searching Kaggle datasets...',
      'Scanning HuggingFace Hub...',
      'Analyzing UCI Repository...',
      'Ranking and scoring results...',
    ];

    for (let i = 0; i < phases.length; i++) {
      setSearchPhase(phases[i]);
      await new Promise(r => setTimeout(r, 600));
    }

    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            description: projectDescription,
            project_type: projectType,
            max_results: 5,
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const foundResults = data.results || [];
        setResults(foundResults);
        
        // Auto-fallback to custom synthetic generation if no datasets found
        if (foundResults.length === 0) {
          setTimeout(() => {
            handleGenerateSynthetic();
          }, 500);
        }
      } else {
        // Fallback on error
        setTimeout(() => {
          handleGenerateSynthetic();
        }, 500);
      }
    } catch (e) {
      console.error('Dataset search failed:', e);
      // Auto-fallback on network error
      handleGenerateSynthetic();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (defaultMode === 'generate') {
      setTimeout(() => {
        handleGenerateSynthetic();
      }, 100);
    } else {
      Promise.resolve().then(() => {
        searchDatasets();
      });
    }
  }, [defaultMode]);

  const toggleCompare = (idx: number) => {
    setSelectedForCompare(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      return next;
    });
  };

  const handleCompare = () => {
    const selected = Array.from(selectedForCompare).map(i => results[i]);
    if (selected.length === 2) onCompareRequest(selected);
  };

  const handleImport = async (dataset: DatasetResult) => {
    setIsGenerating(true); // Reuse loading state
    setSearchPhase(`Importing proxy dataset for: ${dataset.name}...`);
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          project_description: projectDescription,
          dataset: dataset,
          num_rows: 100
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onDatasetSelected({ name: dataset.name, dataset_type: dataset.dataset_type, id: data.file_id } as any);
      }
    } catch (e) {
      console.error('Dataset import failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHybridMerge = async () => {
    setIsMerging(true);
    const selectedDatasets = Array.from(selectedForCompare).map(i => results[i]);
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/merge-datasets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          project_description: projectDescription,
          datasets: selectedDatasets
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onDatasetSelected({ name: data.filename, dataset_type: 'tabular', id: data.file_id } as any);
      }
    } catch (e) {
      console.error('Hybrid merge failed', e);
    } finally {
      setIsMerging(false);
    }
  };

  const getQualityStars = (score: number): number => {
    if (score >= 90) return 5;
    if (score >= 75) return 4;
    if (score >= 60) return 3;
    if (score >= 40) return 2;
    return 1;
  };

  if (loading || isGenerating || isMerging) {
    return (
      <div className="pipeline-step-enter" style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '60px 40px', textAlign: 'center',
      }}>
        <Loader2 size={36} className="spin" style={{ color: 'var(--color-primary)', margin: '0 auto 20px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          {isGenerating ? 'AI is generating/importing the dataset...' : isMerging ? 'AI is harmonizing and merging datasets...' : 'AI is searching for datasets...'}
        </h3>
        <p style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>
          {isGenerating ? searchPhase || 'Synthesizing realistic rows and features...' : isMerging ? 'Combining schemas and resolving conflicts...' : searchPhase}
        </p>
        {!isGenerating && !isMerging && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {['Kaggle', 'HuggingFace', 'UCI', 'OpenML'].map((src, i) => (
              <div key={i} style={{
                padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: 'var(--bg-surface)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite`,
              }}>
                {SOURCE_ICONS[src]} {src}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Group by recommendation tiers
  const recommended = results.filter(r => r.recommendation_tier === 'Recommended');
  const acceptable = results.filter(r => r.recommendation_tier === 'Acceptable' || !r.recommendation_tier);
  const notRecommended = results.filter(r => r.recommendation_tier === 'Not Recommended');

  return (
    <div className="pipeline-step-enter" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--color-primary-subtle), var(--bg-surface))',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--color-primary)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Database size={20} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
              Dataset Discovery Results
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Found {results.length} datasets for &quot;{projectDescription}&quot;
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {selectedForCompare.size === 2 && (
              <button className="btn-primary" onClick={handleCompare} style={{ fontSize: 12, gap: 6, padding: '8px 14px' }}>
                <GitCompare size={14} /> Compare Selected
              </button>
            )}
            {selectedForCompare.size > 1 && (
              <button className="btn-success" onClick={handleHybridMerge} disabled={isMerging} style={{ fontSize: 12, gap: 6, padding: '8px 14px' }}>
                <Merge size={14} /> Hybrid Merge
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
        <button className="btn-secondary" onClick={handleGenerateSynthetic} disabled={isGenerating} style={{ flex: '1', justifyContent: 'center', padding: '16px' }}>
          <Wand2 size={18} /> Generate Custom Synthetic Dataset
        </button>
      </div>

      {/* Dataset Tiers */}
      {[
        { title: 'Top Recommendations', data: recommended, color: 'var(--color-success)', icon: <Star size={18} fill="#22C55E" /> },
        { title: 'Acceptable Alternatives', data: acceptable, color: 'var(--text-primary)', icon: <CheckCircle size={18} /> },
        { title: 'Not Recommended', data: notRecommended, color: 'var(--color-error)', icon: <AlertTriangle size={18} /> },
      ].map((tier, t_idx) => {
        if (tier.data.length === 0) return null;
        
        return (
          <div key={t_idx}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ color: tier.color }}>{tier.icon}</div>
              <h4 style={{ fontSize: 16, fontWeight: 700, color: tier.color }}>{tier.title}</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {tier.data.map((ds, i) => {
                const globalIdx = results.indexOf(ds);
                const isSelected = selectedForCompare.has(globalIdx);
                const stars = getQualityStars(ds.quality_score);

                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={globalIdx} 
                    className="discovery-card" 
                    style={{
                      borderColor: isSelected ? 'var(--color-primary)' : undefined,
                      boxShadow: isSelected ? 'var(--shadow-purple)' : undefined,
                      opacity: ds.recommendation_tier === 'Not Recommended' ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16 }}>
                      {/* Left: Main Info */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontSize: 22 }}>{SOURCE_ICONS[ds.source] || '📊'}</span>
                          <div>
                            <h4 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{ds.name}</h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ds.source}</span>
                              <span style={{ color: 'var(--border)' }}>·</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ds.dataset_type}</span>
                              <span style={{ color: 'var(--border)' }}>·</span>
                              <span style={{ fontSize: 11, color: DIFFICULTY_COLOR[ds.difficulty] || 'var(--text-muted)', fontWeight: 600 }}>{ds.difficulty}</span>
                            </div>
                          </div>
                        </div>

                        {ds.recommendation_reason && (
                          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', borderLeft: `3px solid ${tier.color}`, marginBottom: 12 }}>
                            <p style={{ fontSize: 12, color: 'var(--text-primary)' }}><strong>AI Reason:</strong> {ds.recommendation_reason}</p>
                          </div>
                        )}

                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                          {ds.description}
                        </p>

                        {/* Metric Chips */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          <MetricChip icon={<Database size={11} />} label={`${ds.samples?.toLocaleString() || '?'} samples`} />
                          <MetricChip icon={<BarChart3 size={11} />} label={`${ds.classes} classes`} />
                          <MetricChip icon={<HardDrive size={11} />} label={ds.size} />
                          <MetricChip icon={<Clock size={11} />} label={ds.estimated_training_time} />
                        </div>

                        {/* Quality Stars */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Quality:</span>
                          {Array.from({ length: 5 }).map((_, s) => (
                            <Star key={s} size={14} fill={s < stars ? '#F59E0B' : 'none'} color={s < stars ? '#F59E0B' : 'var(--border)'} />
                          ))}
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginLeft: 4 }}>{ds.quality_score}/100</span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', minWidth: 120 }}>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="btn-primary"
                          onClick={() => handleImport(ds)}
                          disabled={isGenerating || isMerging}
                          style={{ fontSize: 12, padding: '8px 16px', gap: 6, width: '100%', justifyContent: 'center' }}
                        >
                          Import <ArrowRight size={14} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleCompare(globalIdx)}
                          style={{
                            fontSize: 11, padding: '6px 12px', borderRadius: 8, width: '100%',
                            border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                            color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)',
                            cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s',
                          }}
                        >
                          {isSelected ? '✓ Selected' : 'Select'}
                        </motion.button>
                        {ds.source_url && (
                          <a href={ds.source_url} target="_blank" rel="noreferrer" style={{
                            fontSize: 11, color: 'var(--text-muted)', display: 'flex',
                            alignItems: 'center', gap: 4, textDecoration: 'none',
                          }}>
                            <ExternalLink size={10} /> View Source
                          </a>
                        )}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>📜 {ds.license}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
      borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
      fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
    }}>
      {icon} {label}
    </div>
  );
}
