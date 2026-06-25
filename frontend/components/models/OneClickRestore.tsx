'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight, Check, Loader2 } from 'lucide-react';
import api from '@/lib/api';

interface Recommendation {
  recommended_version: number;
  recommended_id: string;
  reason: string;
}

interface Props {
  recommendation: Recommendation | null;
  onRestoreSuccess: () => void;
}

export default function OneClickRestore({ recommendation, onRestoreSuccess }: Props) {
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(false);

  if (!recommendation || !recommendation.recommended_version) return null;

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await api.post(`/api/models/${recommendation.recommended_id}/restore`);
      setDone(true);
      setTimeout(() => {
        setDone(false);
        onRestoreSuccess();
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="pipeline-step-enter" style={{
      background: 'linear-gradient(135deg, rgba(34,197,94,0.1), var(--bg-surface))',
      border: '1px solid var(--color-success)',
      borderRadius: 'var(--radius-xl)', padding: '20px 24px',
      display: 'flex', alignItems: 'flex-start', gap: 16,
    }}>
      <div style={{ marginTop: 2 }}>
        <Sparkles size={24} color="var(--color-success)" />
      </div>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-success)', marginBottom: 6 }}>
          AI Recommended Version: v{recommendation.recommended_version}
        </h4>
        <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 16 }}>
          {recommendation.reason}
        </p>
        
        <button
          className="btn-success"
          onClick={handleRestore}
          disabled={restoring || done}
          style={{ gap: 8 }}
        >
          {restoring ? <><Loader2 size={16} className="spin" /> Restoring...</> : 
           done ? <><Check size={16} /> Restored!</> : 
           <><ArrowRight size={16} /> Restore Version {recommendation.recommended_version}</>}
        </button>
      </div>
    </div>
  );
}
