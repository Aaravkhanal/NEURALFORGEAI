'use client';

import { BookOpen, XCircle } from 'lucide-react';

interface Props {
  concept: string;
  definition: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AILearningMode({ concept, definition, isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 320, zIndex: 100,
      background: 'var(--color-primary-subtle)', border: '1px solid var(--color-primary-glow)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
      animation: 'fadeSlideUp 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BookOpen size={14} /> AI Learning Mode
        </h4>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <XCircle size={14} color="var(--color-primary)" />
        </button>
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        What is {concept}?
      </p>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {definition}
      </p>
    </div>
  );
}
