'use client';

import { useState } from 'react';
import {
  Upload, Type, Table2, Image, BarChart3, Loader2,
  CheckCircle, AlertTriangle, Zap, ArrowRight,
} from 'lucide-react';

interface Props {
  modelName: string;
  taskType: string;
}

interface PredictionResult {
  prediction: string;
  confidence: number;
  allPredictions: { label: string; probability: number }[];
  inferenceTime: number;
  explanation: string;
}

export default function ModelTestingLab({ modelName, taskType }: Props) {
  const [inputType, setInputType] = useState<'image' | 'text' | 'tabular'>(() => {
    if (taskType.includes('image')) return 'image';
    if (taskType.includes('text') || taskType.includes('nlp') || taskType.includes('sentiment')) return 'text';
    return 'tabular';
  });
  const [textInput, setTextInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [tabularInput, setTabularInput] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const runPrediction = async () => {
    setLoading(true);
    // Simulate prediction (replace with real API call when model is trained)
    await new Promise(r => setTimeout(r, 1500));

    const demoResults: Record<string, PredictionResult> = {
      image: {
        prediction: 'Melanoma (Malignant)',
        confidence: 87.3,
        allPredictions: [
          { label: 'Melanoma', probability: 87.3 },
          { label: 'Benign Keratosis', probability: 8.2 },
          { label: 'Dermatofibroma', probability: 2.8 },
          { label: 'Basal Cell Carcinoma', probability: 1.7 },
        ],
        inferenceTime: 23,
        explanation: 'The model detected irregular border patterns and asymmetric pigmentation consistent with melanoma. Confidence is high at 87.3%. The dark, uneven coloring and irregular edges are key features the model identified.',
      },
      text: {
        prediction: 'Positive Sentiment',
        confidence: 92.1,
        allPredictions: [
          { label: 'Positive', probability: 92.1 },
          { label: 'Neutral', probability: 5.6 },
          { label: 'Negative', probability: 2.3 },
        ],
        inferenceTime: 8,
        explanation: 'The model identified strong positive language markers including "excellent", "love", and "amazing". The overall tone and word choices strongly indicate positive sentiment.',
      },
      tabular: {
        prediction: 'Survived',
        confidence: 78.5,
        allPredictions: [
          { label: 'Survived', probability: 78.5 },
          { label: 'Not Survived', probability: 21.5 },
        ],
        inferenceTime: 2,
        explanation: 'Key factors: Female passenger (higher survival rate), 1st class ticket, young age. The combination of these features strongly predicts survival based on historical patterns.',
      },
    };

    setResult(demoResults[inputType]);
    setLoading(false);
  };

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
          background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={18} color="white" />
        </div>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            Model Testing Lab — {modelName}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Test your model with real data before deploying
          </p>
        </div>
      </div>

      {/* Input Type Selector */}
      <div style={{ display: 'flex', gap: 8, padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'image' as const, label: 'Image', icon: Image },
          { id: 'text' as const, label: 'Text', icon: Type },
          { id: 'tabular' as const, label: 'Tabular', icon: Table2 },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setInputType(t.id); setResult(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                borderRadius: 10, border: `2px solid ${inputType === t.id ? 'var(--color-primary)' : 'var(--border)'}`,
                background: inputType === t.id ? 'var(--color-primary-subtle)' : 'transparent',
                color: inputType === t.id ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
              }}>
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 0 }}>
        {/* Input Panel */}
        <div style={{ padding: '24px', borderRight: result ? '1px solid var(--border)' : 'none' }}>
          {inputType === 'image' && (
            <div>
              <div style={{
                border: '2px dashed var(--border)', borderRadius: 14, padding: 40,
                textAlign: 'center', cursor: 'pointer', background: 'var(--bg-surface)',
                transition: 'border-color 0.2s',
              }}
                onClick={() => document.getElementById('test-image-input')?.click()}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Test" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
                ) : (
                  <>
                    <Image size={36} color="var(--text-muted)" style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      Click or drop an image to test
                    </p>
                  </>
                )}
              </div>
              <input type="file" id="test-image-input" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </div>
          )}

          {inputType === 'text' && (
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text to classify... e.g., 'This movie was absolutely fantastic, I loved every minute of it!'"
              rows={6}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: '1px solid var(--border)',
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13,
                resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.6,
              }}
            />
          )}

          {inputType === 'tabular' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {['Age', 'Sex', 'Class', 'Fare', 'Siblings'].map(field => (
                <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: 80 }}>{field}</label>
                  <input
                    value={tabularInput[field] || ''}
                    onChange={(e) => setTabularInput(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`Enter ${field.toLowerCase()}`}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)',
                      background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={runPrediction}
            disabled={loading}
            style={{ marginTop: 16, width: '100%', justifyContent: 'center', gap: 8 }}
          >
            {loading ? <><Loader2 size={16} className="spin" /> Running Inference...</> : <><Zap size={16} /> Run Prediction</>}
          </button>
        </div>

        {/* Result Panel */}
        {result && (
          <div className="pipeline-step-enter" style={{ padding: '24px' }}>
            {/* Main Prediction */}
            <div style={{
              padding: '20px', borderRadius: 14, marginBottom: 16,
              background: 'linear-gradient(135deg, var(--color-primary-subtle), var(--bg-surface))',
              border: '1px solid var(--color-primary-glow)', textAlign: 'center',
            }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: 4 }}>
                Prediction
              </p>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                {result.prediction}
              </h3>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>
                {result.confidence.toFixed(1)}% confidence
              </p>
            </div>

            {/* Confidence Bars */}
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                All Predictions
              </h4>
              {result.allPredictions.map((pred, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? 'var(--color-primary)' : 'var(--text-secondary)' }}>
                      {pred.label}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--color-primary)' : 'var(--text-muted)' }}>
                      {pred.probability.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 3,
                      width: `${pred.probability}%`,
                      background: i === 0 ? 'var(--color-primary)' : 'var(--border)',
                      transition: 'width 0.5s ease-out',
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Explanation */}
            <div style={{
              padding: '12px 16px', borderRadius: 12,
              background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
            }}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                🧠 Model Reasoning
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.explanation}</p>
            </div>

            {/* Inference Time */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap size={12} color="var(--color-warning)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Inference time: <strong style={{ color: 'var(--text-primary)' }}>{result.inferenceTime}ms</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
