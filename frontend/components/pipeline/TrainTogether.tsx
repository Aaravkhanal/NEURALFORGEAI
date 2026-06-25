'use client';

import { useState, useEffect } from 'react';
import { Brain, Lightbulb, BookOpen, AlertTriangle, CheckCircle } from 'lucide-react';

interface EpochData {
  epoch: number;
  total_epochs: number;
  train_loss: number;
  val_loss: number;
  train_acc: number;
  val_acc: number;
}

interface CoachMessage {
  status: string;
  status_emoji: string;
  explanation: string;
  teaching: { title: string; content: string; concept: string; definition: string };
  alerts: { type: string; severity: string; title: string; message: string; actions: string[] }[];
}

interface Props {
  modelName: string;
}

// Demo training simulation
const DEMO_EPOCHS: EpochData[] = [
  { epoch: 1, total_epochs: 10, train_loss: 2.45, val_loss: 2.38, train_acc: 32.1, val_acc: 34.5 },
  { epoch: 2, total_epochs: 10, train_loss: 1.82, val_loss: 1.76, train_acc: 48.3, val_acc: 51.2 },
  { epoch: 3, total_epochs: 10, train_loss: 1.34, val_loss: 1.41, train_acc: 61.7, val_acc: 59.8 },
  { epoch: 4, total_epochs: 10, train_loss: 0.98, val_loss: 1.12, train_acc: 72.4, val_acc: 68.3 },
  { epoch: 5, total_epochs: 10, train_loss: 0.72, val_loss: 0.89, train_acc: 79.6, val_acc: 75.1 },
  { epoch: 6, total_epochs: 10, train_loss: 0.54, val_loss: 0.78, train_acc: 84.2, val_acc: 79.7 },
  { epoch: 7, total_epochs: 10, train_loss: 0.41, val_loss: 0.71, train_acc: 87.8, val_acc: 82.4 },
  { epoch: 8, total_epochs: 10, train_loss: 0.32, val_loss: 0.68, train_acc: 90.1, val_acc: 84.6 },
  { epoch: 9, total_epochs: 10, train_loss: 0.25, val_loss: 0.66, train_acc: 92.3, val_acc: 85.8 },
  { epoch: 10, total_epochs: 10, train_loss: 0.20, val_loss: 0.65, train_acc: 93.7, val_acc: 86.2 },
];

function generateCoachMessage(epoch: EpochData, history: EpochData[]): CoachMessage {
  const prev = history.length > 0 ? history[history.length - 1] : null;
  const gap = epoch.train_acc - epoch.val_acc;
  const accDelta = prev ? epoch.val_acc - prev.val_acc : 0;
  const phase = epoch.epoch <= 3 ? 'early' : epoch.epoch <= 7 ? 'middle' : 'late';

  let status = 'healthy';
  const alerts: CoachMessage['alerts'] = [];

  if (gap > 15 && epoch.epoch > 3) {
    status = 'danger';
    alerts.push({
      type: 'overfitting', severity: 'high',
      title: '⚠️ Overfitting Detected',
      message: `Training accuracy (${epoch.train_acc.toFixed(1)}%) is significantly higher than validation (${epoch.val_acc.toFixed(1)}%). The model is memorizing instead of learning.`,
      actions: ['Stop Training', 'Add Dropout', 'Increase Augmentation'],
    });
  } else if (gap > 8) {
    status = 'warning';
    alerts.push({
      type: 'gap_growing', severity: 'medium',
      title: '🟡 Watch the Gap',
      message: `Gap between training and validation is ${gap.toFixed(1)}%. Keep monitoring.`,
      actions: ['Monitor Next Epochs'],
    });
  }

  const explanations = [];
  if (phase === 'early') {
    explanations.push(`**Epoch ${epoch.epoch}/${epoch.total_epochs}** — The model is discovering patterns in your dataset for the first time.`);
  } else if (phase === 'middle') {
    explanations.push(`**Epoch ${epoch.epoch}/${epoch.total_epochs}** — Refining understanding. The model is learning subtler patterns now.`);
  } else {
    explanations.push(`**Epoch ${epoch.epoch}/${epoch.total_epochs}** — Final optimization phase. Making precise adjustments.`);
  }

  if (prev && epoch.train_loss < prev.train_loss) {
    const imp = ((prev.train_loss - epoch.train_loss) / prev.train_loss * 100).toFixed(1);
    explanations.push(`Training loss decreased by ${imp}% — the model is learning effectively! ✅`);
  }

  if (accDelta > 0) {
    explanations.push(`Validation accuracy improved by ${accDelta.toFixed(1)}% to ${epoch.val_acc.toFixed(1)}%. The model is generalizing better! 🎉`);
  } else if (accDelta < -1) {
    explanations.push(`Validation accuracy dropped by ${Math.abs(accDelta).toFixed(1)}%. This could indicate early overfitting.`);
  }

  const teachings: Record<string, CoachMessage['teaching']> = {
    early: {
      title: '💡 What is happening?',
      content: 'The model is reading through your data for the first time, like a student scanning a textbook. It\'s identifying the most obvious patterns first.',
      concept: 'Training Loss',
      definition: 'Loss measures how wrong the model\'s predictions are. Lower = better. Early training shows rapid loss reduction.',
    },
    middle: {
      title: '💡 Why is progress slowing?',
      content: 'The easy patterns are learned. Now the model is working on subtle differences — this is normal and expected!',
      concept: 'Generalization',
      definition: 'Generalization is the model\'s ability to make correct predictions on data it has never seen before.',
    },
    late: {
      title: '💡 Are we done yet?',
      content: 'The model is making tiny adjustments. Like an artist adding finishing touches — small changes can make a big difference.',
      concept: 'Convergence',
      definition: 'When metrics stop changing significantly, the model has converged — it has learned what it can from this data.',
    },
  };

  return {
    status,
    status_emoji: status === 'healthy' ? '🟢' : status === 'warning' ? '🟡' : '🔴',
    explanation: explanations.join('\n\n'),
    teaching: teachings[phase],
    alerts,
  };
}

export default function TrainTogether({ modelName }: Props) {
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [isTraining, setIsTraining] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [showTeaching, setShowTeaching] = useState(true);

  const startTraining = () => {
    setIsTraining(true);
    setCurrentEpoch(0);
    setMessages([]);
  };

  useEffect(() => {
    if (!isTraining || currentEpoch >= DEMO_EPOCHS.length) {
      if (currentEpoch >= DEMO_EPOCHS.length) {
        Promise.resolve().then(() => {
          setIsTraining(false);
        });
      }
      return;
    }

    const timer = setTimeout(() => {
      const epoch = DEMO_EPOCHS[currentEpoch];
      const history = DEMO_EPOCHS.slice(0, currentEpoch);
      const msg = generateCoachMessage(epoch, history);
      setMessages(prev => [...prev, msg]);
      setCurrentEpoch(prev => prev + 1);
    }, 2500);

    return () => clearTimeout(timer);
  }, [isTraining, currentEpoch]);

  const latestEpoch = currentEpoch > 0 ? DEMO_EPOCHS[currentEpoch - 1] : null;
  const latestMsg = messages[messages.length - 1];
  const progress = (currentEpoch / DEMO_EPOCHS.length) * 100;

  // Chart data
  const chartMetrics = DEMO_EPOCHS.slice(0, currentEpoch);
  const maxLoss = chartMetrics.length > 0 ? Math.max(...chartMetrics.map(m => Math.max(m.train_loss, m.val_loss))) : 3;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08), var(--bg-surface))',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Brain size={20} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
            Train Together — {modelName}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Learn what your AI model is doing at every step
          </p>
        </div>
        {!isTraining && currentEpoch === 0 && (
          <button className="btn-primary" onClick={startTraining} style={{ gap: 6 }}>
            <Brain size={16} /> Start Training
          </button>
        )}
        <button
          onClick={() => setShowTeaching(!showTeaching)}
          style={{
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: showTeaching ? 'var(--color-primary-subtle)' : 'transparent',
            color: showTeaching ? 'var(--color-primary)' : 'var(--text-muted)',
            fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          <BookOpen size={12} /> {showTeaching ? 'Learning ON' : 'Learning OFF'}
        </button>
      </div>

      {/* Split Screen: Left=Charts, Right=Coach */}
      <div style={{ display: 'grid', gridTemplateColumns: showTeaching ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Left: Training Progress */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        }}>
          {/* Progress Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                Epoch {currentEpoch}/{DEMO_EPOCHS.length}
              </span>
              <span style={{ fontSize: 12, color: latestMsg?.status === 'danger' ? '#EF4444' : latestMsg?.status === 'warning' ? '#F59E0B' : '#22C55E', fontWeight: 700 }}>
                {latestMsg?.status_emoji} {latestMsg?.status || 'ready'}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3, width: `${progress}%`,
                background: isTraining ? 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))' : 'linear-gradient(90deg, #22C55E, #34D399)',
                transition: 'width 0.5s ease-out',
              }} />
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, padding: '14px 20px' }}>
            <MiniMetric label="Train Loss" value={latestEpoch?.train_loss.toFixed(3) || '—'} color="var(--color-error)" />
            <MiniMetric label="Val Loss" value={latestEpoch?.val_loss.toFixed(3) || '—'} color="var(--color-warning)" />
            <MiniMetric label="Train Acc" value={latestEpoch ? `${latestEpoch.train_acc.toFixed(1)}%` : '—'} color="var(--color-info)" />
            <MiniMetric label="Val Acc" value={latestEpoch ? `${latestEpoch.val_acc.toFixed(1)}%` : '—'} color="var(--color-success)" />
          </div>

          {/* Loss Chart */}
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{
              height: 130, background: 'var(--bg-surface)', borderRadius: 12,
              border: '1px solid var(--border-light)', padding: '10px 16px',
              position: 'relative',
            }}>
              {chartMetrics.length > 1 ? (
                <svg width="100%" height="110" viewBox="0 0 100 110" preserveAspectRatio="none">
                  <polyline fill="none" stroke="var(--color-error)" strokeWidth="2" strokeLinecap="round"
                    points={chartMetrics.map((m, i) => `${(i / (DEMO_EPOCHS.length - 1)) * 100},${110 - (m.train_loss / maxLoss) * 100}`).join(' ')} />
                  <polyline fill="none" stroke="var(--color-warning)" strokeWidth="2" strokeDasharray="4,3"
                    points={chartMetrics.map((m, i) => `${(i / (DEMO_EPOCHS.length - 1)) * 100},${110 - (m.val_loss / maxLoss) * 100}`).join(' ')} />
                </svg>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 12 }}>
                  Training chart will appear here...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Coach */}
        {showTeaching && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)', padding: 20,
            display: 'flex', flexDirection: 'column', gap: 12,
            maxHeight: 500, overflowY: 'auto',
          }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Brain size={16} color="#F59E0B" /> AI Training Coach
            </h4>

            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)' }}>
                <BookOpen size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
                <p style={{ fontSize: 13 }}>Start training to receive AI explanations</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className="coach-bubble" style={{ animationDelay: `${i * 0.1}s` }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: msg.status === 'healthy' ? '#22C55E' : msg.status === 'warning' ? '#F59E0B' : '#EF4444' }}>
                    {msg.status_emoji} Epoch {i + 1}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {msg.explanation}
                </p>

                {/* Alerts */}
                {msg.alerts.map((alert, ai) => (
                  <div key={ai} style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    background: alert.severity === 'high' ? 'var(--color-error-subtle)' : 'var(--color-warning-subtle)',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <AlertTriangle size={14} color={alert.severity === 'high' ? 'var(--color-error)' : 'var(--color-warning)'} style={{ marginTop: 1, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{alert.title}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{alert.message}</p>
                    </div>
                  </div>
                ))}

                {/* Teaching Moment */}
                {showTeaching && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 8,
                    background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', marginBottom: 2 }}>
                      {msg.teaching.title}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {msg.teaching.content}
                    </p>
                    <div style={{ marginTop: 6, padding: '4px 8px', borderRadius: 4, background: 'var(--color-primary-subtle)', display: 'inline-block' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-primary)' }}>
                        📖 {msg.teaching.concept}: </span>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                        {msg.teaching.definition}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isTraining && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: 3, background: '#F59E0B',
                      animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Coach is analyzing...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: 'var(--bg-surface)' }}>
      <p style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'var(--font-heading)' }}>{value}</p>
    </div>
  );
}
