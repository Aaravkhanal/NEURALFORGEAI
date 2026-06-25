'use client';

import { useState } from 'react';
import { Microscope, Play, LayoutGrid } from 'lucide-react';

export default function ModelSandbox() {
  const [samples, setSamples] = useState<{ id: string; text: string; prediction?: string; confidence?: number }[]>([]);
  const [input, setInput] = useState('');

  const addSample = () => {
    if (input.trim()) {
      setSamples(prev => [...prev, { id: Math.random().toString(), text: input }]);
      setInput('');
    }
  };

  const runAll = async () => {
    // Simulate batch inference
    const updated = await Promise.all(samples.map(async (s) => {
      if (s.prediction) return s;
      await new Promise(r => setTimeout(r, 400));
      return {
        ...s,
        prediction: s.text.length % 2 === 0 ? 'Positive' : 'Negative',
        confidence: 75 + Math.random() * 20,
      };
    }));
    setSamples(updated);
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Microscope size={20} color="var(--color-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Model Sandbox</h3>
      </div>
      
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input 
            value={input} onChange={e => setInput(e.target.value)}
            placeholder="Add a test sample..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && addSample()}
          />
          <button className="btn-secondary" onClick={addSample}>Add</button>
          <button className="btn-primary" onClick={runAll} disabled={samples.length === 0} style={{ gap: 6 }}>
            <Play size={14} /> Run All
          </button>
        </div>

        {samples.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {samples.map((s, i) => (
              <div key={i} style={{ padding: 16, borderRadius: 10, background: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 12 }}>&quot;{s.text}&quot;</p>
                {s.prediction ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary)' }}>{s.prediction}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.confidence?.toFixed(1)}%</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending...</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <LayoutGrid size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
            <p style={{ fontSize: 13 }}>Add multiple samples to stress test your model.</p>
          </div>
        )}
      </div>
    </div>
  );
}
