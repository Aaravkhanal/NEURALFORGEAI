'use client';

import { Cpu, Code, Clock, HardDrive, Zap, ArrowRight } from 'lucide-react';

interface Props {
  modelName: string;
  datasetSize: number;
  onChooseTrain: () => void;
  onChooseCode: () => void;
}

export default function TrainOrCodeChoice({ modelName, datasetSize, onChooseTrain, onChooseCode }: Props) {
  // Estimate training time based on dataset size
  const estMinutes = Math.max(1, Math.round(datasetSize / 2000));
  const estGPU = datasetSize > 10000 ? '6-8 GB' : datasetSize > 2000 ? '2-4 GB' : 'CPU sufficient';
  const estStorage = datasetSize > 50000 ? '500 MB+' : '50-200 MB';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Training Cost Estimator */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)', padding: '20px 24px',
      }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color="var(--color-info)" />
          Training Cost Estimator — {modelName}
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <EstimateCard icon={<Clock size={16} />} label="Est. Training Time" value={`~${estMinutes} min`} color="var(--color-info)" />
          <EstimateCard icon={<Cpu size={16} />} label="GPU Memory" value={estGPU} color="var(--color-warning)" />
          <EstimateCard icon={<HardDrive size={16} />} label="Storage" value={estStorage} color="var(--color-success)" />
          <EstimateCard icon={<Zap size={16} />} label="Dataset Size" value={`${datasetSize.toLocaleString()} samples`} color="var(--color-primary)" />
        </div>
      </div>

      {/* Two Choice Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Train For Me */}
        <div
          onClick={onChooseTrain}
          style={{
            background: 'var(--bg-card)', border: '2px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: '32px 24px',
            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-primary)';
            e.currentTarget.style.boxShadow = 'var(--shadow-purple)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Cpu size={28} color="white" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>
            Train For Me
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            NeuralForge handles everything automatically — training, evaluation, hyperparameter tuning, and optimization.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20 }}>
            {['Automatic hyperparameter tuning', 'Cross-validation & evaluation', 'Model optimization', 'Download trained model'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--color-primary)' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f}</span>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
            Start Training <ArrowRight size={16} />
          </button>
        </div>

        {/* Generate Code */}
        <div
          onClick={onChooseCode}
          style={{
            background: 'var(--bg-card)', border: '2px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: '32px 24px',
            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-success)';
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(34, 197, 94, 0.15)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Code size={28} color="white" />
          </div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)', marginBottom: 8 }}>
            Generate Code
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 20 }}>
            Get production-ready training code you can run in VS Code, Google Colab, or Kaggle — zero modifications needed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 20 }}>
            {['PyTorch / TensorFlow / Scikit-Learn', 'Complete training pipeline', 'Requirements & README included', 'Paste & run anywhere'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: '#22C55E' }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{f}</span>
              </div>
            ))}
          </div>
          <button className="btn-success" style={{ width: '100%', justifyContent: 'center', gap: 8 }}>
            Generate Code <Code size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EstimateCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}
