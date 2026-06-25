'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Props {
  fileId: string;
  healthScore?: any;
  advisorResults?: any;
}

const EXAMPLE_QUESTIONS = [
  'Why is my dataset unhealthy?',
  'Which model should I use?',
  'How can I improve accuracy?',
  'What features are most important?',
  'Is my data balanced?',
];

export default function DatasetChat({ fileId, healthScore, advisorResults }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Dataset Assistant. I've analyzed your dataset and I'm ready to answer any questions. Ask me about data quality, model recommendations, or how to improve your results!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('neuralforge_token');
      // Pass the history excluding the current 'assistant' default message if there's only 1
      const historyToSend = messages.filter(m => m.role === 'user' || (m.role === 'assistant' && messages.indexOf(m) > 0)).map(m => ({
        role: m.role,
        content: m.content
      }));

      // Project description fallback
      const pd = localStorage.getItem('neuralforge_project_description') || '';

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/api/dataset-chat/ask`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({
            question: q,
            file_id: fileId || null,
            project_description: pd,
            health_score: healthScore,
            advisor_results: advisorResults,
            history: historyToSend,
          }),
        }
      );

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || 'I couldn\'t generate a response. Try rephrasing your question.',
        timestamp: new Date(),
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${e.message}. Please try again.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        id="dataset-chat-toggle"
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: 16,
          background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 30px var(--color-primary-glow)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <MessageSquare size={24} color="white" />
        <div style={{
          position: 'absolute', top: -4, right: -4,
          width: 16, height: 16, borderRadius: 8,
          background: '#22C55E', border: '2px solid var(--bg-base)',
        }} />
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      width: 400, height: 560, borderRadius: 20,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow-xl)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.2)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={18} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>AI Dataset Assistant</h4>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Ask anything about your data</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            width: 28, height: 28, borderRadius: 8, border: 'none',
            background: 'rgba(255,255,255,0.15)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={14} color="white" />
        </button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8,
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--bg-surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {msg.role === 'user'
                ? <User size={14} color="white" />
                : <Bot size={14} color="var(--color-primary)" />}
            </div>
            <div style={{
              maxWidth: '80%', padding: '10px 14px', borderRadius: 14,
              background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--bg-surface)',
              color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
              fontSize: 13, lineHeight: 1.6,
              borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
              borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 14,
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--bg-surface)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={14} color="var(--color-primary)" />
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: 14, borderBottomLeftRadius: 4,
              background: 'var(--bg-surface)',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: 4,
                    background: 'var(--text-muted)', opacity: 0.5,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Example Questions */}
      {messages.length <= 1 && (
        <div style={{
          padding: '0 16px 12px',
          display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          {EXAMPLE_QUESTIONS.slice(0, 3).map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              style={{
                padding: '5px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-surface)',
                color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Ask about your dataset..."
          disabled={loading}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            border: '1px solid var(--border)', background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
          }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: input.trim() ? 'var(--color-primary)' : 'var(--border-light)',
            cursor: input.trim() ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Send size={16} color={input.trim() ? 'white' : 'var(--text-muted)'} />
        </button>
      </div>
    </div>
  );
}
