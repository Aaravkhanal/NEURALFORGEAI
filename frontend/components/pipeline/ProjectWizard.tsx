'use client';

import { useState, useEffect } from 'react';
import {
  Lightbulb, Search, Upload, ArrowRight, ArrowLeft,
  Sparkles, CheckCircle, Loader2, Brain,
} from 'lucide-react';

interface Category {
  id: string;
  label: string;
  icon: string;
  description: string;
  examples: string[];
}

interface Props {
  onComplete: (result: {
    projectType: string;
    projectDescription: string;
    hasDataset: boolean;
    trainingApproach: 'train' | 'code' | 'together';
  }) => void;
}

const WIZARD_STEPS = [
  { label: 'Project Type', desc: 'What are you building?' },
  { label: 'Dataset', desc: 'Do you have data?' },
  { label: 'Approach', desc: 'Choose your path' },
];

export default function ProjectWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [projectDescription, setProjectDescription] = useState('');
  const [hasDataset, setHasDataset] = useState<boolean | null>(null);
  const [trainingApproach, setTrainingApproach] = useState<'train' | 'code' | 'together' | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('neuralforge_token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/discovery/categories`,
        { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
      );
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (e) {
      // Fallback categories
      setCategories([
        { id: 'medical', label: 'Medical AI', icon: '🏥', description: 'Disease detection, medical imaging', examples: ['Skin cancer detector'] },
        { id: 'vehicle', label: 'Vehicle Detection', icon: '🚗', description: 'Car detection, traffic analysis', examples: ['Vehicle counter'] },
        { id: 'face', label: 'Face Recognition', icon: '👤', description: 'Facial recognition, verification', examples: ['Face verification'] },
        { id: 'object_detection', label: 'Object Detection', icon: '📦', description: 'Detect objects in images', examples: ['Product detection'] },
        { id: 'text_classification', label: 'Document Classification', icon: '📄', description: 'Classify text or documents', examples: ['Sentiment analysis'] },
        { id: 'chatbot', label: 'Chatbot / NLP', icon: '💬', description: 'Conversational AI', examples: ['Support bot'] },
        { id: 'crop_disease', label: 'Agriculture AI', icon: '🌱', description: 'Crop disease detection', examples: ['Leaf disease'] },
        { id: 'tabular', label: 'Custom AI Project', icon: '🧠', description: 'Tabular data, predictions', examples: ['Price prediction'] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchCategories();
    });
  }, []);

  const handleFinish = () => {
    if (selectedCategory && hasDataset !== null && trainingApproach) {
      onComplete({
        projectType: selectedCategory,
        projectDescription: projectDescription || categories.find(c => c.id === selectedCategory)?.label || '',
        hasDataset: hasDataset,
        trainingApproach,
      });
    }
  };

  const canProceed = () => {
    if (step === 0) return !!selectedCategory;
    if (step === 1) return hasDataset !== null;
    if (step === 2) return !!trainingApproach;
    return false;
  };

  return (
    <div className="pipeline-step-enter" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)', overflow: 'hidden',
    }}>
      {/* Hero Header */}
      <div style={{
        padding: '40px 32px 32px', textAlign: 'center',
        background: 'linear-gradient(135deg, var(--color-primary-subtle), var(--bg-surface))',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 30px var(--color-primary-glow)',
        }}>
          <Lightbulb size={28} color="white" />
        </div>
        <h2 style={{
          fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)', marginBottom: 8,
        }}>
          Start Your <span className="gradient-text">AI Project</span>
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
          We&apos;ll find the right dataset, recommend the best models, and guide you to a deployed AI.
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 0, padding: '20px 32px',
      }}>
        {WIZARD_STEPS.map((ws, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: i < step ? 'linear-gradient(135deg, #22C55E, #16A34A)' :
                           i === step ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' :
                           'var(--border-light)',
                color: i <= step ? 'white' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                boxShadow: i === step ? '0 3px 10px var(--color-primary-glow)' : 'none',
                transition: 'all 0.3s',
              }}>
                {i < step ? <CheckCircle size={14} /> : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: i === step ? 700 : 500,
                color: i === step ? 'var(--color-primary)' : 'var(--text-muted)',
              }}>
                {ws.label}
              </span>
            </div>
            {i < WIZARD_STEPS.length - 1 && (
              <div style={{
                width: 60, height: 2, margin: '0 8px',
                background: i < step ? 'var(--color-success)' : 'var(--border-light)',
                borderRadius: 1, marginBottom: 16,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={{ padding: '0 32px 32px' }}>
        {/* Step 0: Project Type */}
        {step === 0 && (
          <div className="pipeline-step-enter">
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
              marginBottom: 8, textAlign: 'center',
            }}>
              What are you trying to build?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, textAlign: 'center' }}>
              Select a category or describe your project below
            </p>

            {/* Category Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 12, marginBottom: 20,
            }}>
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className={`wizard-card ${selectedCategory === cat.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat.id);
                    setProjectDescription(cat.description);
                  }}
                >
                  <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>{cat.icon}</span>
                  <h4 style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                    marginBottom: 4,
                  }}>
                    {cat.label}
                  </h4>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {cat.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Free-text Description */}
            <div>
              <label style={{
                fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
                display: 'block', marginBottom: 6,
              }}>
                Or describe your project in your own words:
              </label>
              <textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="e.g., I want to build a skin cancer detector that classifies dermoscopic images into multiple disease categories..."
                rows={3}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', fontSize: 13, resize: 'vertical',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
                }}
              />
            </div>
          </div>
        )}

        {/* Step 1: Dataset */}
        {step === 1 && (
          <div className="pipeline-step-enter">
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
              marginBottom: 8, textAlign: 'center',
            }}>
              Do you have a dataset?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
              Don&apos;t worry if you don&apos;t — our AI will find the perfect dataset for you
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
              maxWidth: 600, margin: '0 auto',
            }}>
              {/* Yes, I have a dataset */}
              <div
                className={`wizard-card ${hasDataset === true ? 'selected' : ''}`}
                onClick={() => setHasDataset(true)}
                style={{ padding: '36px 24px' }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Upload size={24} color="white" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
                  Yes, I&apos;ll Upload
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  I already have a dataset ready to upload (CSV, images, ZIP, etc.)
                </p>
              </div>

              {/* No, find one for me */}
              <div
                className={`wizard-card ${hasDataset === false ? 'selected' : ''}`}
                onClick={() => setHasDataset(false)}
                style={{ padding: '36px 24px' }}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: '0 auto 14px',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Search size={24} color="white" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6, fontFamily: 'var(--font-heading)' }}>
                  No, Find One For Me
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  AI will search Kaggle, HuggingFace, UCI, and more to find the best dataset
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Training Approach */}
        {step === 2 && (
          <div className="pipeline-step-enter">
            <h3 style={{
              fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
              marginBottom: 8, textAlign: 'center',
            }}>
              Choose Your Training Approach
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
              How would you like to train your AI model?
            </p>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
              maxWidth: 720, margin: '0 auto',
            }}>
              {/* Train For Me */}
              <div
                className={`wizard-card ${trainingApproach === 'train' ? 'selected' : ''}`}
                onClick={() => setTrainingApproach('train')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={22} color="white" />
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Train For Me
                </h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Fully automatic. NeuralForge handles everything — training, tuning, and optimization.
                </p>
                <div style={{
                  marginTop: 10, padding: '3px 8px', borderRadius: 6,
                  background: 'var(--color-primary-subtle)', fontSize: 10,
                  fontWeight: 700, color: 'var(--color-primary)',
                }}>
                  Best for beginners
                </div>
              </div>

              {/* Train Together (NEW) */}
              <div
                className={`wizard-card ${trainingApproach === 'together' ? 'selected' : ''}`}
                onClick={() => setTrainingApproach('together')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Brain size={22} color="white" />
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Train Together
                </h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Learn while training! AI explains every step, teaches you ML concepts in real-time.
                </p>
                <div style={{
                  marginTop: 10, padding: '3px 8px', borderRadius: 6,
                  background: 'rgba(245, 158, 11, 0.1)', fontSize: 10,
                  fontWeight: 700, color: '#D97706',
                }}>
                  ⭐ For learners & students
                </div>
              </div>

              {/* Generate Code */}
              <div
                className={`wizard-card ${trainingApproach === 'code' ? 'selected' : ''}`}
                onClick={() => setTrainingApproach('code')}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px',
                  background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 22, color: 'white' }}>{'</>'}</span>
                </div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Generate Code
                </h4>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Get production-ready code to run in VS Code, Colab, or Kaggle. Full control.
                </p>
                <div style={{
                  marginTop: 10, padding: '3px 8px', borderRadius: 6,
                  background: 'var(--color-success-subtle)', fontSize: 10,
                  fontWeight: 700, color: 'var(--color-success)',
                }}>
                  For experienced devs
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        padding: '16px 32px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        {step > 0 ? (
          <button className="btn-secondary" onClick={() => setStep(step - 1)} style={{ gap: 6 }}>
            <ArrowLeft size={16} /> Back
          </button>
        ) : <div />}

        {step < 2 ? (
          <button
            className="btn-primary"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            style={{ gap: 6 }}
          >
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={!canProceed()}
            style={{ gap: 6, background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))' }}
          >
            <Sparkles size={16} /> Launch Project
          </button>
        )}
      </div>
    </div>
  );
}
