'use client';

import { History, GitCommit, Box, Rocket } from 'lucide-react';

export default function ProjectLifecycle() {
  const events = [
    { type: 'deploy', icon: Rocket, title: 'Model Deployed', date: 'Just now', desc: 'Deployed to Vercel' },
    { type: 'train', icon: Box, title: 'Training Complete', date: '2 hrs ago', desc: 'Accuracy: 92.4%' },
    { type: 'data', icon: GitCommit, title: 'Dataset Cleaned', date: '3 hrs ago', desc: 'Removed 140 invalid rows' },
  ];

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <History size={20} color="var(--color-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Project Timeline</h3>
      </div>
      
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {events.map((e, i) => {
          const Icon = e.icon;
          return (
            <div key={i} style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color="var(--color-primary)" />
                </div>
                {i < events.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--border-light)' }} />}
              </div>
              <div style={{ paddingBottom: i < events.length - 1 ? 16 : 0 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{e.title}</h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{e.desc}</p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>{e.date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
