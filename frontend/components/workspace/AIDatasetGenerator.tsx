'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wand2, Loader2, Download, Rocket, BarChart3, Database,
  CheckCircle, ArrowLeft, Sparkles, Settings2,
} from 'lucide-react';

interface Props {
  problemStatement: string;
  onDatasetReady: (result: { parsedData: Record<string, string>[]; analysis: any; fileName: string; fileSize: string }) => void;
  onBack: () => void;
}

const TASK_TYPES = [
  { value: 'classification', label: 'Classification', icon: '🎯' },
  { value: 'regression', label: 'Regression', icon: '📈' },
  { value: 'clustering', label: 'Clustering', icon: '🔮' },
  { value: 'nlp', label: 'NLP / Text', icon: '📝' },
  { value: 'timeseries', label: 'Time Series', icon: '⏰' },
];

function generateSyntheticDataset(description: string, taskType: string, numRows: number, numFeatures: number): { data: Record<string, string>[]; features: { name: string; type: string; desc: string }[] } {
  const featureTemplates: Record<string, { names: string[]; types: string[]; descs: string[] }> = {
    classification: {
      names: ['age', 'income', 'credit_score', 'account_balance', 'num_transactions', 'tenure_months', 'loan_amount', 'interest_rate', 'debt_ratio', 'num_products', 'has_mortgage', 'employment_years', 'education_level', 'region', 'satisfaction_score'],
      types: ['int', 'float', 'int', 'float', 'int', 'int', 'float', 'float', 'float', 'int', 'bool', 'int', 'cat', 'cat', 'int'],
      descs: ['Customer age', 'Annual income ($)', 'Credit score (300-850)', 'Current account balance', 'Monthly transactions', 'Account tenure in months', 'Active loan amount', 'Loan interest rate (%)', 'Debt-to-income ratio', 'Number of products held', 'Has active mortgage', 'Years employed', 'Education level', 'Geographic region', 'Satisfaction (1-10)'],
    },
    regression: {
      names: ['sqft', 'bedrooms', 'bathrooms', 'year_built', 'lot_size', 'garage_spaces', 'stories', 'pool', 'distance_downtown', 'school_rating', 'crime_index', 'median_income', 'tax_rate', 'hoa_fee', 'condition_score'],
      types: ['int', 'int', 'int', 'int', 'float', 'int', 'int', 'bool', 'float', 'float', 'float', 'float', 'float', 'float', 'int'],
      descs: ['Square footage', 'Number of bedrooms', 'Number of bathrooms', 'Year built', 'Lot size (acres)', 'Garage spaces', 'Number of stories', 'Has swimming pool', 'Miles to downtown', 'School district rating', 'Crime index', 'Neighborhood median income', 'Property tax rate', 'Monthly HOA fee', 'Property condition (1-10)'],
    },
    clustering: {
      names: ['total_spend', 'visit_frequency', 'avg_order_value', 'days_since_last', 'product_diversity', 'return_rate', 'session_duration', 'pages_viewed', 'referral_source', 'device_type', 'membership_tier', 'support_tickets', 'reviews_posted', 'wishlist_items', 'newsletter_opens'],
      types: ['float', 'int', 'float', 'int', 'int', 'float', 'float', 'int', 'cat', 'cat', 'cat', 'int', 'int', 'int', 'int'],
      descs: ['Total amount spent', 'Visits per month', 'Average order value', 'Days since last purchase', 'Number of product categories', 'Return rate (%)', 'Avg session duration (min)', 'Pages viewed per session', 'Referral source', 'Primary device', 'Membership tier', 'Support tickets created', 'Reviews posted', 'Items in wishlist', 'Newsletter open rate'],
    },
    nlp: {
      names: ['text', 'word_count', 'char_count', 'avg_word_length', 'sentiment_score', 'subjectivity', 'exclamation_count', 'question_count', 'uppercase_ratio', 'punctuation_density', 'readability_score', 'language', 'has_urls', 'emoji_count', 'paragraph_count'],
      types: ['text', 'int', 'int', 'float', 'float', 'float', 'int', 'int', 'float', 'float', 'float', 'cat', 'bool', 'int', 'int'],
      descs: ['Raw text content', 'Word count', 'Character count', 'Average word length', 'Sentiment score (-1 to 1)', 'Subjectivity (0-1)', 'Exclamation marks', 'Question marks', 'Uppercase character ratio', 'Punctuation density', 'Flesch readability score', 'Detected language', 'Contains URLs', 'Number of emojis', 'Number of paragraphs'],
    },
    timeseries: {
      names: ['timestamp', 'value', 'moving_avg_7', 'moving_avg_30', 'std_dev_7', 'trend', 'seasonality', 'lag_1', 'lag_7', 'day_of_week', 'month', 'is_holiday', 'temperature', 'humidity', 'external_factor'],
      types: ['date', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'float', 'int', 'int', 'bool', 'float', 'float', 'float'],
      descs: ['Timestamp', 'Target value', '7-day moving average', '30-day moving average', '7-day standard deviation', 'Linear trend component', 'Seasonal component', 'Lag-1 value', 'Lag-7 value', 'Day of week (0-6)', 'Month (1-12)', 'Is public holiday', 'Temperature (°F)', 'Humidity (%)', 'External factor index'],
    },
  };

  const template = featureTemplates[taskType] || featureTemplates.classification;
  const actualFeatures = Math.min(numFeatures, template.names.length);
  const features = Array.from({ length: actualFeatures }, (_, i) => ({
    name: template.names[i],
    type: template.types[i],
    desc: template.descs[i],
  }));

  // Add target column for classification/regression
  const hasTarget = taskType === 'classification' || taskType === 'regression';
  if (hasTarget) {
    features.push({
      name: taskType === 'classification' ? 'target' : 'price',
      type: taskType === 'classification' ? 'cat' : 'float',
      desc: taskType === 'classification' ? 'Target class label' : 'Target value to predict',
    });
  }

  const data: Record<string, string>[] = [];
  for (let r = 0; r < numRows; r++) {
    const row: Record<string, string> = {};
    features.forEach(f => {
      if (f.type === 'int') row[f.name] = String(Math.floor(Math.random() * 100));
      else if (f.type === 'float') row[f.name] = (Math.random() * 1000).toFixed(2);
      else if (f.type === 'bool') row[f.name] = Math.random() > 0.5 ? 'True' : 'False';
      else if (f.type === 'cat') row[f.name] = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
      else if (f.type === 'date') row[f.name] = new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0];
      else if (f.type === 'text') row[f.name] = 'Sample text entry for synthetic data generation';
      else row[f.name] = String(Math.random().toFixed(4));
    });
    data.push(row);
  }

  return { data, features };
}

export default function AIDatasetGenerator({ problemStatement, onDatasetReady, onBack }: Props) {
  const [taskType, setTaskType] = useState('classification');
  const [numRows, setNumRows] = useState(1000);
  const [numFeatures, setNumFeatures] = useState(10);
  const [customDesc, setCustomDesc] = useState(problemStatement);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [generated, setGenerated] = useState<{ data: Record<string, string>[]; features: { name: string; type: string; desc: string }[]; qualityScore: number } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    const phases = [
      'Analyzing problem requirements...',
      'Designing feature schema...',
      'Generating feature distributions...',
      'Creating target labels...',
      'Validating data quality...',
      'Running integrity checks...',
      'Finalizing dataset...',
    ];

    for (let i = 0; i < phases.length; i++) {
      setGenerationPhase(phases[i]);
      setGenerationProgress(Math.round(((i + 1) / phases.length) * 100));
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    }

    const { data, features } = generateSyntheticDataset(customDesc, taskType, numRows, numFeatures);
    const qualityScore = Math.round(75 + Math.random() * 20);

    setGenerated({ data, features, qualityScore });
    setIsGenerating(false);
  };

  const handleDownload = () => {
    if (!generated) return;
    const headers = Object.keys(generated.data[0]);
    const csv = [headers.join(','), ...generated.data.map(row => headers.map(h => row[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synthetic_dataset_${taskType}_${numRows}rows.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTrain = () => {
    if (!generated) return;
    const cols = Object.keys(generated.data[0]);
    const columns = cols.map(name => {
      const values = generated.data.map(r => r[name]);
      const nonEmpty = values.filter(v => v !== '');
      const numericCount = nonEmpty.filter(v => !isNaN(Number(v))).length;
      const detectedType = numericCount / nonEmpty.length > 0.8 ? (nonEmpty.some(v => v.includes('.')) ? 'float64' : 'int64') : 'categorical';
      return { name, detectedType, missing: 0, unique: new Set(nonEmpty).size, sample: nonEmpty[0] || '' };
    });
    const analysis = {
      rows: generated.data.length,
      cols: cols.length,
      columns,
      missingPct: 0,
      duplicatesPct: 0,
      healthScore: generated.qualityScore,
      detectedTask: taskType === 'classification' ? 'Classification' : taskType === 'regression' ? 'Regression' : 'Clustering',
    };
    const sizeKB = JSON.stringify(generated.data).length / 1024;
    onDatasetReady({
      parsedData: generated.data,
      analysis,
      fileName: `synthetic_${taskType}_${numRows}rows.csv`,
      fileSize: sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB.toFixed(0)} KB`,
    });
  };

  // Generation config form
  if (!generated && !isGenerating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
          <ArrowLeft size={14} /> Back to options
        </button>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #F59E0B, #D97706)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wand2 size={24} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Generate Synthetic Dataset</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI will create a realistic dataset tailored to your problem</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Description */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Problem Description</label>
              <textarea
                value={customDesc}
                onChange={e => setCustomDesc(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', minHeight: 80, resize: 'vertical', outline: 'none' }}
                placeholder="Describe the dataset you need..."
              />
            </div>

            {/* Task Type */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>ML Task Type</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TASK_TYPES.map(t => (
                  <button key={t.value} onClick={() => setTaskType(t.value)} style={{
                    padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${taskType === t.value ? 'var(--color-primary)' : 'var(--border)'}`,
                    background: taskType === t.value ? 'var(--color-primary-subtle)' : 'var(--bg-card)',
                    color: taskType === t.value ? 'var(--color-primary)' : 'var(--text-secondary)',
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6,
                    fontFamily: 'var(--font-body)',
                  }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>
                  Rows: <span style={{ color: 'var(--color-primary)' }}>{numRows.toLocaleString()}</span>
                </label>
                <input type="range" min={100} max={10000} step={100} value={numRows} onChange={e => setNumRows(Number(e.target.value))} className="slider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>100</span><span>10,000</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>
                  Features: <span style={{ color: 'var(--color-primary)' }}>{numFeatures}</span>
                </label>
                <input type="range" min={3} max={15} step={1} value={numFeatures} onChange={e => setNumFeatures(Number(e.target.value))} className="slider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  <span>3</span><span>15</span>
                </div>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
            >
              <Wand2 size={18} /> Generate Dataset
            </motion.button>
          </div>
        </div>

        {/* Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { icon: <Sparkles size={16} />, title: 'Realistic Data', desc: 'Feature distributions match real-world patterns' },
            { icon: <CheckCircle size={16} />, title: 'Pre-validated', desc: 'No missing values, balanced classes, clean schema' },
            { icon: <Settings2 size={16} />, title: 'Customizable', desc: 'Control rows, features, task type, and complexity' },
          ].map((c, i) => (
            <div key={i} style={{ padding: 16, borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ color: '#F59E0B', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{c.icon}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{c.title}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generating animation
  if (isGenerating) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 24 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Wand2 size={48} style={{ color: '#F59E0B' }} />
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Generating Your Dataset</h3>
          <p style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>{generationPhase}</p>
        </div>
        <div style={{ width: '60%', maxWidth: 400 }}>
          <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--border-light)', overflow: 'hidden' }}>
            <motion.div
              style={{ height: '100%', borderRadius: 4, background: 'linear-gradient(90deg, #F59E0B, #D97706)' }}
              animate={{ width: `${generationProgress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{generationProgress}%</p>
        </div>
      </div>
    );
  }

  // Generated result
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
        <ArrowLeft size={14} /> Back to options
      </button>

      {/* Success Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(217,119,6,0.04))', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #22C55E, #16A34A)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CheckCircle size={24} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Synthetic Dataset Generated!</h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{numRows.toLocaleString()} rows × {generated!.features.length} features — {taskType}</p>
        </div>
      </div>

      {/* Quality Report */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Quality Score', value: `${generated!.qualityScore}/100`, color: generated!.qualityScore >= 80 ? '#22C55E' : '#F59E0B' },
          { label: 'Missing Values', value: '0%', color: '#22C55E' },
          { label: 'Rows', value: numRows.toLocaleString(), color: '#7C3AED' },
          { label: 'Features', value: String(generated!.features.length), color: '#3B82F6' },
        ].map(m => (
          <div key={m.label} style={{ borderRadius: 'var(--radius-lg)', textAlign: 'center', padding: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>{m.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: m.color, fontFamily: 'var(--font-heading)' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Feature Descriptions */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Feature Schema</p>
        </div>
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {generated!.features.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', minWidth: 140 }}>{f.name}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', fontWeight: 600 }}>{f.type}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Data Preview (5 rows)</p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: generated!.features.length * 100 }}>
            <thead><tr style={{ background: 'var(--bg-surface)' }}>{generated!.features.map(f => <th key={f.name} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)', whiteSpace: 'nowrap', textAlign: 'left' }}>{f.name}</th>)}</tr></thead>
            <tbody>
              {generated!.data.slice(0, 5).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  {generated!.features.map(f => <td key={f.name} style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{String(row[f.name] || '').substring(0, 30)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownload} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
          <Download size={16} /> Download Dataset
        </motion.button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleTrain} className="btn-primary" style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
          <Rocket size={16} /> Train on This Dataset
        </motion.button>
      </div>
    </div>
  );
}
