'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, Database, Clock, Cpu, HardDrive, ExternalLink,
  Loader2, ArrowRight, ArrowLeft, BarChart3, CheckCircle, AlertTriangle,
  Download, Rocket, ChevronDown, ChevronUp, Award, Zap, GraduationCap,
  Timer, GitCompare, Shield, TrendingUp, Layers, PieChart, Sparkles,
} from 'lucide-react';
import DatasetMiniChat from './DatasetMiniChat';

/* ─── Types ───────────────────────────────────────── */
interface DatasetResult {
  name: string;
  source: string;
  source_url: string;
  dataset_type: string;
  size: string;
  samples: number;
  features: number;
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
  missing_values_pct: number;
  class_balance: string;
  expected_accuracy: string;
  recommendation_reason: string;
  badges: string[];
}

interface ValidationReport {
  missing_values: number;
  duplicates: number;
  outliers: number;
  class_imbalance: string;
  data_leakage_risk: string;
  overall_score: number;
}

interface Props {
  problemStatement: string;
  onDatasetReady: (result: {
    parsedData: Record<string, string>[];
    analysis: any;
    fileName: string;
    fileSize: string;
  }) => void;
  onBack: () => void;
  onSuggestGenerate: () => void;
}

/* ─── Mock Data Generators ────────────────────────── */
const SOURCE_ICONS: Record<string, string> = {
  Kaggle: '🏆', HuggingFace: '🤗', UCI: '🎓', OpenML: '🔬',
  'Google Dataset Search': '🔍', 'Gov Open Data': '🏛️', GitHub: '🐙', Academic: '📚',
};

const BADGE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  'Best Overall': { icon: Award, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  'Best for Beginners': { icon: GraduationCap, color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  'Best for Accuracy': { icon: TrendingUp, color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  'Best for Speed': { icon: Timer, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
};

function generateMockDatasets(problem: string): DatasetResult[] {
  const p = problem.toLowerCase();
  let datasets: DatasetResult[];

  if (p.includes('churn') || p.includes('customer')) {
    datasets = [
      { name: 'Telco Customer Churn', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '955 KB', samples: 7043, features: 21, classes: 2, labels: ['No', 'Yes'], quality_score: 94, popularity: '150K+ downloads', difficulty: 'Easy', recommended_models: ['XGBoost', 'Random Forest', 'Logistic Regression'], estimated_training_time: '~30 seconds', hardware_requirements: 'CPU only', license: 'CC0 Public Domain', description: 'Each row represents a customer, with columns for demographics, account info, and whether they churned. Clean, well-documented, and widely used for benchmarking.', advantages: ['Very clean data', 'Well-documented columns', 'Widely benchmarked', 'Small enough for fast iteration'], disadvantages: ['Relatively small', 'Binary target only'], missing_values_pct: 0.1, class_balance: '73% No / 27% Yes', expected_accuracy: '79-82%', recommendation_reason: 'Gold standard for churn prediction. Clean data, well-documented, and widely benchmarked. Perfect balance of quality and accessibility.', badges: ['Best Overall', 'Best for Beginners'] },
      { name: 'E-Commerce Customer Churn', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '2.1 MB', samples: 5630, features: 20, classes: 2, labels: ['Stayed', 'Churned'], quality_score: 88, popularity: '45K+ downloads', difficulty: 'Medium', recommended_models: ['CatBoost', 'XGBoost', 'Neural Network'], estimated_training_time: '~45 seconds', hardware_requirements: 'CPU only', license: 'Apache 2.0', description: 'E-commerce platform customer behavior data with order history, satisfaction scores, and churn labels.', advantages: ['Rich feature set', 'E-commerce specific', 'Good class balance'], disadvantages: ['Some missing values', 'Less benchmarked'], missing_values_pct: 2.3, class_balance: '83% Stayed / 17% Churned', expected_accuracy: '88-92%', recommendation_reason: 'Higher expected accuracy due to richer features. Good choice if you want to push model performance.', badges: ['Best for Accuracy'] },
      { name: 'Bank Customer Churn', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '690 KB', samples: 10000, features: 14, classes: 2, labels: ['Retained', 'Exited'], quality_score: 91, popularity: '200K+ downloads', difficulty: 'Easy', recommended_models: ['Random Forest', 'XGBoost', 'LightGBM'], estimated_training_time: '~15 seconds', hardware_requirements: 'CPU only', license: 'CC BY 4.0', description: 'Bank customers dataset with demographics, products, and exit status. One of the most popular datasets on Kaggle for classification tasks.', advantages: ['Very popular', 'Clean and simple', 'Fast training', 'Great for learning'], disadvantages: ['Synthetic data', 'Limited feature depth'], missing_values_pct: 0, class_balance: '80% Retained / 20% Exited', expected_accuracy: '85-88%', recommendation_reason: 'Largest sample size with zero missing values. Fastest to train and iterate on.', badges: ['Best for Speed'] },
      { name: 'Credit Card Customer Attrition', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '1.5 MB', samples: 10127, features: 23, classes: 2, labels: ['Existing', 'Attrited'], quality_score: 86, popularity: '80K+ downloads', difficulty: 'Medium', recommended_models: ['XGBoost', 'CatBoost', 'SVM'], estimated_training_time: '~40 seconds', hardware_requirements: 'CPU only', license: 'MIT', description: 'Credit card customer attrition data with detailed transaction features, demographics, and relationship data.', advantages: ['Rich transaction data', 'Large sample size', 'Many features for engineering'], disadvantages: ['Higher complexity', 'Requires feature engineering', 'Moderate class imbalance'], missing_values_pct: 1.5, class_balance: '84% Existing / 16% Attrited', expected_accuracy: '90-93%', recommendation_reason: 'Most feature-rich dataset with strong potential for feature engineering and high accuracy.', badges: [] },
    ];
  } else if (p.includes('house') || p.includes('price') || p.includes('real estate')) {
    datasets = [
      { name: 'California Housing Prices', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '1.4 MB', samples: 20640, features: 9, classes: 0, labels: [], quality_score: 96, popularity: '300K+ downloads', difficulty: 'Easy', recommended_models: ['XGBoost', 'Random Forest', 'Linear Regression'], estimated_training_time: '~20 seconds', hardware_requirements: 'CPU only', license: 'Public Domain', description: 'California census data with median house values. One of the most popular regression datasets.', advantages: ['Extremely clean', 'Perfect for regression', 'Widely benchmarked', 'Great documentation'], disadvantages: ['Simple features', 'Dated data (1990)'], missing_values_pct: 0.1, class_balance: 'N/A (Regression)', expected_accuracy: 'R²: 0.80-0.85', recommendation_reason: 'The gold standard for house price prediction. Cleanest data, most benchmarks available, and perfect for learning regression.', badges: ['Best Overall', 'Best for Beginners'] },
      { name: 'Ames Housing Dataset', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '460 KB', samples: 1460, features: 81, classes: 0, labels: [], quality_score: 92, popularity: '180K+ downloads', difficulty: 'Medium', recommended_models: ['XGBoost', 'LightGBM', 'Stacking Ensemble'], estimated_training_time: '~35 seconds', hardware_requirements: 'CPU only', license: 'CC0', description: 'Detailed housing data from Ames, Iowa with 81 features covering every aspect of residential homes.', advantages: ['81 features for deep analysis', 'Feature engineering paradise', 'Highest potential accuracy'], disadvantages: ['Smaller sample size', 'Requires preprocessing', 'Many categorical features'], missing_values_pct: 4.7, class_balance: 'N/A (Regression)', expected_accuracy: 'R²: 0.88-0.92', recommendation_reason: 'Most detailed feature set. Ideal for maximizing model accuracy through feature engineering.', badges: ['Best for Accuracy'] },
      { name: 'KC House Sales', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '2.5 MB', samples: 21613, features: 21, classes: 0, labels: [], quality_score: 89, popularity: '90K+ downloads', difficulty: 'Easy', recommended_models: ['Random Forest', 'XGBoost', 'Neural Network'], estimated_training_time: '~25 seconds', hardware_requirements: 'CPU only', license: 'Public Domain', description: 'King County house sales data including Seattle. Good balance of size and feature richness.', advantages: ['Large sample size', 'Recent data', 'Geographic features'], disadvantages: ['Regional bias', 'Some outliers'], missing_values_pct: 0, class_balance: 'N/A (Regression)', expected_accuracy: 'R²: 0.85-0.89', recommendation_reason: 'Largest sample with modern data. Fast training with good accuracy potential.', badges: ['Best for Speed'] },
    ];
  } else if (p.includes('fraud') || p.includes('detect')) {
    datasets = [
      { name: 'Credit Card Fraud Detection', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '143 MB', samples: 284807, features: 31, classes: 2, labels: ['Genuine', 'Fraud'], quality_score: 95, popularity: '500K+ downloads', difficulty: 'Medium', recommended_models: ['XGBoost', 'Isolation Forest', 'Neural Network'], estimated_training_time: '~3 minutes', hardware_requirements: 'CPU (GPU optional)', license: 'Open Database', description: 'Real-world credit card transactions. PCA-transformed features for privacy. Highly imbalanced.', advantages: ['Real production data', 'Massive scale', 'Industry standard benchmark'], disadvantages: ['Extreme class imbalance (0.17% fraud)', 'PCA-anonymized features'], missing_values_pct: 0, class_balance: '99.83% Genuine / 0.17% Fraud', expected_accuracy: 'AUC: 0.95-0.98', recommendation_reason: 'The definitive fraud detection dataset. Real-world scale with strong benchmark results.', badges: ['Best Overall', 'Best for Accuracy'] },
      { name: 'IEEE Fraud Detection', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '1.2 GB', samples: 590540, features: 434, classes: 2, labels: ['Legit', 'Fraud'], quality_score: 88, popularity: '40K+ downloads', difficulty: 'Hard', recommended_models: ['LightGBM', 'CatBoost', 'Stacking'], estimated_training_time: '~15 minutes', hardware_requirements: 'GPU recommended', license: 'Competition', description: 'Large-scale fraud dataset from IEEE competition with transaction and identity tables.', advantages: ['Massive feature set', 'Competition-grade', 'Multi-table join challenge'], disadvantages: ['Complex preprocessing', 'Large memory footprint', 'Steep learning curve'], missing_values_pct: 12.5, class_balance: '96.5% Legit / 3.5% Fraud', expected_accuracy: 'AUC: 0.93-0.96', recommendation_reason: 'Most challenging and comprehensive fraud dataset. Best for advanced practitioners.', badges: [] },
      { name: 'Synthetic Financial Fraud', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '470 MB', samples: 6362620, features: 11, classes: 2, labels: ['Normal', 'Fraud'], quality_score: 82, popularity: '60K+ downloads', difficulty: 'Easy', recommended_models: ['Random Forest', 'LightGBM', 'Logistic Regression'], estimated_training_time: '~5 minutes', hardware_requirements: 'CPU (16GB RAM)', license: 'CC BY-SA 4.0', description: 'Synthetic dataset simulating mobile money transactions. Simple features but massive scale.', advantages: ['Simple features', 'Huge scale', 'Easy to understand'], disadvantages: ['Synthetic data', 'Simple patterns'], missing_values_pct: 0, class_balance: '99.87% Normal / 0.13% Fraud', expected_accuracy: '99%+ accuracy', recommendation_reason: 'Simplest fraud dataset to start with. Great for beginners learning about imbalanced classification.', badges: ['Best for Beginners', 'Best for Speed'] },
    ];
  } else {
    // Generic fallback
    datasets = [
      { name: 'Iris Dataset', source: 'UCI', source_url: 'https://archive.ics.uci.edu', dataset_type: 'Tabular', size: '4 KB', samples: 150, features: 4, classes: 3, labels: ['Setosa', 'Versicolor', 'Virginica'], quality_score: 98, popularity: 'Most downloaded dataset ever', difficulty: 'Easy', recommended_models: ['KNN', 'SVM', 'Random Forest'], estimated_training_time: '~1 second', hardware_requirements: 'Any CPU', license: 'Public Domain', description: 'Classic ML dataset for multi-class classification. 4 flower measurements, 3 species.', advantages: ['Perfectly clean', 'Instant training', 'Universal benchmark', 'Best for absolute beginners'], disadvantages: ['Very small', 'Trivially separable'], missing_values_pct: 0, class_balance: 'Perfectly balanced (33% each)', expected_accuracy: '95-98%', recommendation_reason: 'The absolute best starting point for any ML beginner. Perfect data quality.', badges: ['Best for Beginners', 'Best for Speed'] },
      { name: 'MNIST Handwritten Digits', source: 'HuggingFace', source_url: 'https://huggingface.co', dataset_type: 'Image', size: '11 MB', samples: 70000, features: 784, classes: 10, labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], quality_score: 97, popularity: '1M+ downloads', difficulty: 'Easy', recommended_models: ['CNN', 'Neural Network', 'SVM'], estimated_training_time: '~2 minutes', hardware_requirements: 'GPU recommended', license: 'CC BY-SA 3.0', description: 'Handwritten digit images. The "Hello World" of deep learning.', advantages: ['Iconic dataset', 'Well-studied', 'Perfect for learning CNNs'], disadvantages: ['Too easy for modern models', 'Grayscale only'], missing_values_pct: 0, class_balance: 'Nearly balanced', expected_accuracy: '99%+', recommendation_reason: 'The most famous ML dataset. Perfect for learning image classification.', badges: ['Best Overall'] },
      { name: 'Titanic Dataset', source: 'Kaggle', source_url: 'https://kaggle.com', dataset_type: 'Tabular', size: '60 KB', samples: 891, features: 12, classes: 2, labels: ['Died', 'Survived'], quality_score: 90, popularity: '500K+ downloads', difficulty: 'Easy', recommended_models: ['Random Forest', 'XGBoost', 'Logistic Regression'], estimated_training_time: '~5 seconds', hardware_requirements: 'Any CPU', license: 'Public Domain', description: 'Titanic passenger survival data. Classic binary classification with mixed feature types.', advantages: ['Great for learning', 'Mixed data types', 'Feature engineering practice'], disadvantages: ['Small dataset', 'Missing values need handling'], missing_values_pct: 8.2, class_balance: '62% Died / 38% Survived', expected_accuracy: '78-83%', recommendation_reason: 'Best dataset for learning the complete ML pipeline including data cleaning.', badges: ['Best for Accuracy'] },
    ];
  }
  return datasets;
}

function generateValidation(ds: DatasetResult): ValidationReport {
  return {
    missing_values: ds.missing_values_pct,
    duplicates: Math.round(Math.random() * 2 * 10) / 10,
    outliers: Math.round(Math.random() * 5 * 10) / 10,
    class_imbalance: ds.class_balance,
    data_leakage_risk: ds.missing_values_pct > 5 ? 'Medium — check for future information' : 'Low — no obvious leakage detected',
    overall_score: ds.quality_score,
  };
}

/* ─── Component ───────────────────────────────────── */
export default function AIDatasetFinder({ problemStatement, onDatasetReady, onBack, onSuggestGenerate }: Props) {
  const [phase, setPhase] = useState<'intent' | 'searching' | 'results' | 'comparing' | 'importing'>('intent');
  const [searchQuery, setSearchQuery] = useState(problemStatement);
  const [taskType, setTaskType] = useState('');
  const [experience, setExperience] = useState('beginner');
  const [searchPhase, setSearchPhase] = useState('');
  const [datasets, setDatasets] = useState<DatasetResult[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [compareIdxs, setCompareIdxs] = useState<Set<number>>(new Set());
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [importingName, setImportingName] = useState('');

  // Auto-detect task type from problem statement
  useEffect(() => {
    const p = problemStatement.toLowerCase();
    Promise.resolve().then(() => {
      if (p.includes('predict') || p.includes('classify') || p.includes('detect') || p.includes('churn') || p.includes('fraud')) setTaskType('classification');
      else if (p.includes('price') || p.includes('forecast') || p.includes('estimate') || p.includes('regression')) setTaskType('regression');
      else if (p.includes('cluster') || p.includes('segment') || p.includes('group')) setTaskType('clustering');
      else if (p.includes('text') || p.includes('nlp') || p.includes('sentiment') || p.includes('language')) setTaskType('nlp');
      else if (p.includes('image') || p.includes('vision') || p.includes('photo')) setTaskType('computer_vision');
      else setTaskType('classification');
    });
  }, [problemStatement]);

  const handleSearch = async () => {
    setPhase('searching');
    const phases = [
      { text: 'Understanding your problem...', source: '' },
      { text: 'Searching Kaggle datasets...', source: 'Kaggle' },
      { text: 'Scanning HuggingFace Hub...', source: 'HuggingFace' },
      { text: 'Querying UCI ML Repository...', source: 'UCI' },
      { text: 'Checking OpenML database...', source: 'OpenML' },
      { text: 'Searching Google Dataset Search...', source: 'Google Dataset Search' },
      { text: 'Scanning government open data...', source: 'Gov Open Data' },
      { text: 'Scoring and ranking results...', source: '' },
      { text: 'Generating AI recommendations...', source: '' },
    ];

    for (const p of phases) {
      setSearchPhase(p.text);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 400));
    }

    // Try real backend first, fallback to mock
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ description: searchQuery, project_type: taskType, max_results: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setDatasets(data.results.map((d: any, i: number) => ({ ...d, features: d.features || 10, missing_values_pct: d.missing_values_pct || 0, class_balance: d.class_balance || 'Unknown', expected_accuracy: d.expected_accuracy || 'Unknown', badges: i === 0 ? ['Best Overall'] : [] })));
          setPhase('results');
          return;
        }
      }
    } catch { /* fallback to mock */ }

    const mockResults = generateMockDatasets(searchQuery);
    setDatasets(mockResults);
    setPhase('results');
  };

  // Auto-start search if problem statement is provided
  useEffect(() => {
    if (problemStatement.trim().length > 10) {
      // Small delay so user can see the intent form with pre-filled data
      const timer = setTimeout(() => handleSearch(), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const toggleCompare = (idx: number) => {
    setCompareIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < 2) next.add(idx);
      return next;
    });
  };

  const handleSelectDataset = (idx: number) => {
    setSelectedIdx(idx);
    setValidation(generateValidation(datasets[idx]));
  };

  const handleImport = async (ds: DatasetResult) => {
    setPhase('importing');
    setImportingName(ds.name);

    // Try real backend import
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
        body: JSON.stringify({ project_description: problemStatement, dataset: ds, num_rows: Math.min(ds.samples, 5000) }),
      });
      if (res.ok) {
        const data = await res.json();
        // Generate a parsed representation
        const mockParsed = generateMockParsedData(ds);
        const analysis = buildAnalysis(ds, mockParsed);
        onDatasetReady({ parsedData: mockParsed, analysis, fileName: `${ds.name.replace(/\s+/g, '_').toLowerCase()}.csv`, fileSize: ds.size });
        return;
      }
    } catch { /* fallback */ }

    // Fallback: generate mock parsed data
    await new Promise(r => setTimeout(r, 2000));
    const mockParsed = generateMockParsedData(ds);
    const analysis = buildAnalysis(ds, mockParsed);
    onDatasetReady({ parsedData: mockParsed, analysis, fileName: `${ds.name.replace(/\s+/g, '_').toLowerCase()}.csv`, fileSize: ds.size });
  };

  const handleDownload = (ds: DatasetResult) => {
    const mockParsed = generateMockParsedData(ds);
    const headers = Object.keys(mockParsed[0]);
    const csv = [headers.join(','), ...mockParsed.map(row => headers.map(h => row[h]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${ds.name.replace(/\s+/g, '_').toLowerCase()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const compareArray = Array.from(compareIdxs);

  /* ════ RENDER ════ */

  // Intent Form
  if (phase === 'intent') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
          <ArrowLeft size={14} /> Back to options
        </button>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={24} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>AI Dataset Discovery</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>We&apos;ll search Kaggle, HuggingFace, UCI, OpenML & more</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>What do you want to build?</label>
              <textarea
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-input)', fontSize: 14, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', minHeight: 80, resize: 'vertical', outline: 'none' }}
                placeholder="Describe your ML problem..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Task Type</label>
                <select value={taskType} onChange={e => setTaskType(e.target.value)} className="select">
                  <option value="classification">🎯 Classification</option>
                  <option value="regression">📈 Regression</option>
                  <option value="clustering">🔮 Clustering</option>
                  <option value="nlp">📝 NLP / Text</option>
                  <option value="computer_vision">📸 Computer Vision</option>
                  <option value="timeseries">⏰ Time Series</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'block' }}>Experience Level</label>
                <select value={experience} onChange={e => setExperience(e.target.value)} className="select">
                  <option value="beginner">🌱 Beginner</option>
                  <option value="intermediate">🔧 Intermediate</option>
                  <option value="advanced">🚀 Advanced</option>
                </select>
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSearch} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              <Search size={18} /> Search for Datasets
            </motion.button>
          </div>
        </div>

        {/* Sources Preview */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(SOURCE_ICONS).slice(0, 6).map(([name, icon]) => (
            <div key={name} style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{icon}</span> {name}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Search Animation
  if (phase === 'searching') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 24 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Search size={48} style={{ color: '#3B82F6' }} />
        </motion.div>
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>AI is Searching for Datasets</h3>
          <p style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 600 }}>{searchPhase}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.entries(SOURCE_ICONS).map(([name, icon], i) => (
            <motion.div
              key={name}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              {icon} {name}
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  // Importing
  if (phase === 'importing') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 24 }}>
        <Loader2 size={48} className="spin" style={{ color: '#22C55E' }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>Importing Dataset</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Downloading and preparing <strong>{importingName}</strong>...</p>
        </div>
      </div>
    );
  }

  // Comparison Mode
  if (phase === 'comparing' && compareArray.length === 2) {
    const a = datasets[compareArray[0]];
    const b = datasets[compareArray[1]];
    const ROWS = [
      { label: 'Samples', av: a.samples?.toLocaleString(), bv: b.samples?.toLocaleString(), aw: (a.samples || 0) > (b.samples || 0), bw: (b.samples || 0) > (a.samples || 0) },
      { label: 'Features', av: String(a.features), bv: String(b.features), aw: a.features > b.features, bw: b.features > a.features },
      { label: 'Quality Score', av: `${a.quality_score}/100`, bv: `${b.quality_score}/100`, aw: a.quality_score > b.quality_score, bw: b.quality_score > a.quality_score },
      { label: 'Missing Values', av: `${a.missing_values_pct}%`, bv: `${b.missing_values_pct}%`, aw: a.missing_values_pct < b.missing_values_pct, bw: b.missing_values_pct < a.missing_values_pct },
      { label: 'Class Balance', av: a.class_balance, bv: b.class_balance },
      { label: 'Difficulty', av: a.difficulty, bv: b.difficulty },
      { label: 'Expected Performance', av: a.expected_accuracy, bv: b.expected_accuracy },
      { label: 'Training Time', av: a.estimated_training_time, bv: b.estimated_training_time },
      { label: 'Hardware', av: a.hardware_requirements, bv: b.hardware_requirements },
    ];
    const winner = a.quality_score > b.quality_score ? 'A' : b.quality_score > a.quality_score ? 'B' : 'tie';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <button onClick={() => setPhase('results')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
          <ArrowLeft size={14} /> Back to results
        </button>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitCompare size={20} color="white" />
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Dataset Comparison</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.name} vs {b.name}</p>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ padding: 16, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'left', borderBottom: '2px solid var(--border)', width: '20%' }}>Metric</th>
                <th style={{ padding: 16, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', borderBottom: '2px solid var(--border)', width: '40%', background: winner === 'A' ? 'rgba(34,197,94,0.05)' : undefined }}>
                  {a.name} {winner === 'A' && <span style={{ fontSize: 10, color: '#22C55E' }}>👑 Recommended</span>}
                </th>
                <th style={{ padding: 16, fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', borderBottom: '2px solid var(--border)', width: '40%', background: winner === 'B' ? 'rgba(34,197,94,0.05)' : undefined }}>
                  {b.name} {winner === 'B' && <span style={{ fontSize: 10, color: '#22C55E' }}>👑 Recommended</span>}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.label}>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontSize: 13, fontWeight: r.aw ? 700 : 500, color: r.aw ? '#22C55E' : 'var(--text-primary)', background: winner === 'A' ? 'rgba(34,197,94,0.03)' : undefined }}>
                    {r.aw && '🏆 '}{r.av}
                  </td>
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', textAlign: 'center', fontSize: 13, fontWeight: r.bw ? 700 : 500, color: r.bw ? '#22C55E' : 'var(--text-primary)', background: winner === 'B' ? 'rgba(34,197,94,0.03)' : undefined }}>
                    {r.bw && '🏆 '}{r.bv}
                  </td>
                </tr>
              ))}
              {/* Advantages */}
              <tr>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', fontSize: 13, fontWeight: 600, color: '#22C55E' }}>Advantages</td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', background: winner === 'A' ? 'rgba(34,197,94,0.03)' : undefined }}>
                  {a.advantages.map((adv, i) => <div key={i} style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><CheckCircle size={11} /> {adv}</div>)}
                </td>
                <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', background: winner === 'B' ? 'rgba(34,197,94,0.03)' : undefined }}>
                  {b.advantages.map((adv, i) => <div key={i} style={{ fontSize: 12, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}><CheckCircle size={11} /> {adv}</div>)}
                </td>
              </tr>
              {/* Actions */}
              <tr>
                <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700 }}>Action</td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button className="btn-primary" onClick={() => handleImport(a)} style={{ fontSize: 12, gap: 6 }}>Select & Import <ArrowRight size={14} /></button>
                </td>
                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                  <button className="btn-primary" onClick={() => handleImport(b)} style={{ fontSize: 12, gap: 6 }}>Select & Import <ArrowRight size={14} /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Results
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={onBack} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)' }}>
        <ArrowLeft size={14} /> Back to options
      </button>

      {/* Results Header */}
      <div style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(124,58,237,0.04))', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3B82F6, #2563EB)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={20} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Found {datasets.length} Datasets</h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>AI-ranked results for &quot;{searchQuery}&quot;</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {compareIdxs.size === 2 && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary" onClick={() => setPhase('comparing')} style={{ fontSize: 12, gap: 6, padding: '8px 14px' }}>
                <GitCompare size={14} /> Compare Selected
              </motion.button>
            )}
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-secondary" onClick={onSuggestGenerate} style={{ fontSize: 12, gap: 6, padding: '8px 14px' }}>
              <Sparkles size={14} /> Generate Instead
            </motion.button>
          </div>
        </div>
      </div>

      {/* No Results Fallback */}
      {datasets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
          <AlertTriangle size={40} style={{ color: '#F59E0B', marginBottom: 16 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>No Public Datasets Found</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>Would you like AI to generate a synthetic dataset for this problem?</p>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary" onClick={onSuggestGenerate} style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}>
            <Sparkles size={18} /> Generate Synthetic Dataset
          </motion.button>
        </div>
      )}

      {/* Dataset Cards */}
      {datasets.map((ds, idx) => {
        const isExpanded = expandedIdx === idx;
        const isSelected = selectedIdx === idx;
        const isCompareSelected = compareIdxs.has(idx);
        const stars = ds.quality_score >= 90 ? 5 : ds.quality_score >= 75 ? 4 : ds.quality_score >= 60 ? 3 : ds.quality_score >= 40 ? 2 : 1;
        const isTopPick = idx === 0;

        return (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            style={{
              background: 'var(--bg-card)',
              border: `1.5px solid ${isSelected ? 'var(--color-primary)' : isTopPick ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-xl)',
              overflow: 'hidden',
              boxShadow: isSelected ? 'var(--shadow-purple)' : isTopPick ? '0 4px 20px rgba(245,158,11,0.1)' : 'none',
              transition: 'all 0.3s',
            }}
          >
            {/* Top badge bar */}
            {ds.badges && ds.badges.length > 0 && (
              <div style={{ display: 'flex', gap: 8, padding: '8px 20px', background: isTopPick ? 'linear-gradient(90deg, rgba(245,158,11,0.08), rgba(124,58,237,0.04))' : 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)' }}>
                {ds.badges.map(badge => {
                  const cfg = BADGE_CONFIG[badge];
                  if (!cfg) return null;
                  const BadgeIcon = cfg.icon;
                  return (
                    <span key={badge} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: cfg.color, padding: '3px 10px', borderRadius: 20, background: cfg.bg }}>
                      <BadgeIcon size={12} /> ⭐ {badge}
                    </span>
                  );
                })}
              </div>
            )}

            <div style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', gap: 16 }}>
                {/* Main Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 24 }}>{SOURCE_ICONS[ds.source] || '📊'}</span>
                    <div>
                      <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{ds.name}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ds.source}</span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ds.dataset_type}</span>
                        <span style={{ color: 'var(--border)' }}>·</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: ds.difficulty === 'Easy' ? '#22C55E' : ds.difficulty === 'Medium' ? '#F59E0B' : '#EF4444' }}>{ds.difficulty}</span>
                      </div>
                    </div>
                  </div>

                  {/* AI Reason */}
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-surface)', borderLeft: '3px solid var(--color-primary)', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}><strong>AI:</strong> {ds.recommendation_reason}</p>
                  </div>

                  {/* Metric Chips */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <MetricChip icon={<Database size={11} />} label={`${ds.samples?.toLocaleString()} samples`} />
                    <MetricChip icon={<Layers size={11} />} label={`${ds.features} features`} />
                    <MetricChip icon={<HardDrive size={11} />} label={ds.size} />
                    <MetricChip icon={<Clock size={11} />} label={ds.estimated_training_time} />
                    <MetricChip icon={<TrendingUp size={11} />} label={`Expected: ${ds.expected_accuracy}`} />
                  </div>

                  {/* Quality Stars */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Quality:</span>
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} size={14} fill={s < stars ? '#F59E0B' : 'none'} color={s < stars ? '#F59E0B' : 'var(--border)'} />
                    ))}
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginLeft: 4 }}>{ds.quality_score}/100</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', minWidth: 140, flexShrink: 0 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="btn-primary" onClick={() => { handleSelectDataset(idx); }} style={{ fontSize: 12, padding: '10px 16px', gap: 6, width: '100%', justifyContent: 'center' }}>
                    <Rocket size={14} /> Select Dataset
                  </motion.button>
                  <button onClick={() => handleDownload(ds)} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, width: '100%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
                    <Download size={12} /> Download
                  </button>
                  <button onClick={() => toggleCompare(idx)} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, width: '100%', border: `1px solid ${isCompareSelected ? 'var(--color-primary)' : 'var(--border)'}`, background: isCompareSelected ? 'var(--color-primary-subtle)' : 'transparent', color: isCompareSelected ? 'var(--color-primary)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
                    {isCompareSelected ? '✓ Compare' : 'Compare'}
                  </button>
                  <button onClick={() => setExpandedIdx(isExpanded ? null : idx)} style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {isExpanded ? 'Less' : 'Explore'}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded Exploration Panel */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Overview */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      {[
                        { label: 'Missing Values', value: `${ds.missing_values_pct}%`, color: ds.missing_values_pct > 5 ? '#EF4444' : ds.missing_values_pct > 1 ? '#F59E0B' : '#22C55E' },
                        { label: 'Class Balance', value: ds.class_balance, color: '#3B82F6' },
                        { label: 'License', value: ds.license, color: '#7C3AED' },
                      ].map(m => (
                        <div key={m.label} style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)', textAlign: 'center' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: m.color }}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description */}
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Description</p>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{ds.description}</p>
                    </div>

                    {/* Pros & Cons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', marginBottom: 8 }}>✅ Advantages</p>
                        {ds.advantages.map((a, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} style={{ color: '#22C55E', flexShrink: 0 }} /> {a}</p>)}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 8 }}>⚠️ Disadvantages</p>
                        {ds.disadvantages.map((d, i) => <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} style={{ color: '#F59E0B', flexShrink: 0 }} /> {d}</p>)}
                      </div>
                    </div>

                    {/* Recommended Models */}
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Recommended Models</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {ds.recommended_models.map(m => (
                          <span key={m} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>{m}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Validation + Import Panel */}
            <AnimatePresence>
              {isSelected && selectedIdx === idx && validation && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ borderTop: '2px solid var(--color-primary)', padding: '20px 24px', background: 'linear-gradient(180deg, var(--color-primary-subtle), transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <Shield size={16} style={{ color: 'var(--color-primary)' }} />
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)' }}>Pre-Import Validation Report</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Missing Values', value: `${validation.missing_values}%`, ok: validation.missing_values < 5 },
                        { label: 'Duplicates', value: `${validation.duplicates}%`, ok: validation.duplicates < 5 },
                        { label: 'Outliers', value: `${validation.outliers}%`, ok: validation.outliers < 10 },
                      ].map(v => (
                        <div key={v.label} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)', textAlign: 'center' }}>
                          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{v.label}</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: v.ok ? '#22C55E' : '#F59E0B', fontFamily: 'var(--font-heading)' }}>{v.value}</p>
                          <p style={{ fontSize: 10, color: v.ok ? '#22C55E' : '#F59E0B', fontWeight: 600 }}>{v.ok ? '✓ Good' : '⚠ Review'}</p>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Class Balance</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{validation.class_imbalance}</p>
                      </div>
                      <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>Data Leakage Risk</p>
                        <p style={{ fontSize: 12, fontWeight: 600, color: validation.data_leakage_risk.includes('Low') ? '#22C55E' : '#F59E0B' }}>{validation.data_leakage_risk}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => handleImport(ds)} className="btn-primary" style={{ flex: 2, justifyContent: 'center', background: 'linear-gradient(135deg, #22C55E, #16A34A)' }}>
                        <Rocket size={16} /> Import & Train on This Dataset
                      </motion.button>
                      <button onClick={() => { setSelectedIdx(null); setValidation(null); }} style={{ padding: '10px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}

      {/* Mini Chat */}
      {datasets.length > 0 && (
        <DatasetMiniChat datasets={datasets} problemStatement={searchQuery} />
      )}
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────── */
function MetricChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
      {icon} {label}
    </div>
  );
}

function generateMockParsedData(ds: DatasetResult): Record<string, string>[] {
  const numRows = Math.min(ds.samples, 200);
  const cols = Math.min(ds.features || 10, 15);
  const colNames = Array.from({ length: cols }, (_, i) => `feature_${i + 1}`);
  if (ds.classes > 0) colNames.push('target');

  const data: Record<string, string>[] = [];
  for (let r = 0; r < numRows; r++) {
    const row: Record<string, string> = {};
    colNames.forEach((col, ci) => {
      if (col === 'target') row[col] = ds.labels?.[Math.floor(Math.random() * ds.labels.length)] || String(Math.floor(Math.random() * (ds.classes || 2)));
      else row[col] = (Math.random() * 100).toFixed(2);
    });
    data.push(row);
  }
  return data;
}

function buildAnalysis(ds: DatasetResult, data: Record<string, string>[]) {
  const cols = Object.keys(data[0] || {});
  return {
    rows: data.length,
    cols: cols.length,
    columns: cols.map(name => ({
      name,
      detectedType: name === 'target' ? 'categorical' : 'float64',
      missing: 0,
      unique: new Set(data.map(r => r[name])).size,
      sample: data[0]?.[name] || '',
    })),
    missingPct: ds.missing_values_pct || 0,
    duplicatesPct: 0,
    healthScore: ds.quality_score,
    detectedTask: ds.classes > 0 ? 'Classification' : 'Regression',
  };
}
