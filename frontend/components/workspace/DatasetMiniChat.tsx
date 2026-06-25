'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DatasetInfo {
  name: string;
  quality_score: number;
  samples: number;
  description: string;
  recommendation_reason?: string;
  advantages?: string[];
  disadvantages?: string[];
  [key: string]: any;
}

interface Props {
  datasets: DatasetInfo[];
  problemStatement: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_QUESTIONS = [
  'Which dataset is best?',
  'Which is easiest for beginners?',
  'Which gives highest accuracy?',
  'Compare the top 2 datasets',
];

function generateAnswer(question: string, datasets: DatasetInfo[], problem: string): string {
  const q = question.toLowerCase();
  const sorted = [...datasets].sort((a, b) => (b.quality_score || 0) - (a.quality_score || 0));
  const best = sorted[0];
  const easiest = [...datasets].sort((a, b) => {
    const dA = (a as any).difficulty === 'Easy' ? 0 : (a as any).difficulty === 'Medium' ? 1 : 2;
    const dB = (b as any).difficulty === 'Easy' ? 0 : (b as any).difficulty === 'Medium' ? 1 : 2;
    return dA - dB;
  })[0];

  if (!best) return "I don't have any datasets to analyze right now. Try searching for datasets first!";

  if (q.includes('best') || q.includes('recommend') || q.includes('which dataset')) {
    return `Based on my analysis, **${best.name}** is the best choice with a quality score of ${best.quality_score}/100. ${best.recommendation_reason || ''} It has ${best.samples?.toLocaleString() || 'many'} samples which provides a solid foundation for training. ${best.advantages?.[0] ? `Key advantage: ${best.advantages[0]}.` : ''}`;
  }
  if (q.includes('beginner') || q.includes('easiest') || q.includes('easy')) {
    return `For beginners, I'd recommend **${easiest.name}**. ${(easiest as any).difficulty === 'Easy' ? 'It\'s rated as Easy difficulty' : 'It\'s the most approachable option available'}, with ${easiest.samples?.toLocaleString() || 'a good number of'} samples and clean data that requires minimal preprocessing. This makes it perfect for learning the ML workflow end-to-end.`;
  }
  if (q.includes('accuracy') || q.includes('highest') || q.includes('performance')) {
    const highSample = [...datasets].sort((a, b) => (b.samples || 0) - (a.samples || 0))[0];
    return `For maximum accuracy, go with **${highSample.name}** — it has the most samples (${highSample.samples?.toLocaleString()}) which typically leads to better model generalization. Combined with its quality score of ${highSample.quality_score}/100, you can expect strong benchmark performance. Consider pairing with ensemble methods like XGBoost or CatBoost.`;
  }
  if (q.includes('compare') || q.includes('difference') || q.includes('vs')) {
    if (sorted.length >= 2) {
      const a = sorted[0], b = sorted[1];
      return `**${a.name}** vs **${b.name}**:\n\n• Quality: ${a.quality_score}/100 vs ${b.quality_score}/100\n• Samples: ${a.samples?.toLocaleString() || '?'} vs ${b.samples?.toLocaleString() || '?'}\n• ${a.name} ${a.quality_score > b.quality_score ? 'has higher quality' : 'has comparable quality'}.\n• ${(a.samples || 0) > (b.samples || 0) ? a.name + ' has more data for better training.' : b.name + ' has more data for better training.'}\n\nMy recommendation: **${a.name}** for the best overall results.`;
    }
    return `I only have one dataset to show. Search for more to enable comparison!`;
  }
  if (q.includes('fast') || q.includes('quick') || q.includes('speed') || q.includes('training time')) {
    const fastest = [...datasets].sort((a, b) => (a.samples || 0) - (b.samples || 0))[0];
    return `For the fastest training, **${fastest.name}** would be quickest with ${fastest.samples?.toLocaleString() || 'fewer'} samples. Smaller datasets train faster but may sacrifice some accuracy. If speed is critical, pair this with LightGBM which has the fastest inference.`;
  }

  return `Great question! For "${problem}", I've analyzed ${datasets.length} datasets. **${best.name}** stands out with a quality score of ${best.quality_score}/100. ${best.description ? best.description.substring(0, 150) + '...' : ''} Would you like me to compare specific datasets or explain the tradeoffs?`;
}

function getRandomDelay(): number {
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return 800 + (array[0] / 4294967295) * 700;
  }
  return 1000;
}

export default function DatasetMiniChat({ datasets, problemStatement }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: `👋 Hi! I'm your AI Dataset Advisor. I can help you choose the best dataset for "${problemStatement}". Ask me anything about the ${datasets.length} datasets I found!` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setTimeout(() => {
      const answer = generateAnswer(text, datasets, problemStatement);
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
      setIsTyping(false);
    }, getRandomDelay());
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 200); }}
            style={{
              position: 'fixed', bottom: 24, right: 24, width: 56, height: 56,
              borderRadius: '50%', border: 'none', cursor: 'pointer', zIndex: 1000,
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 8px 30px rgba(124,58,237,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <MessageCircle size={24} color="white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', bottom: 24, right: 24, width: 380, height: 520,
              borderRadius: 'var(--radius-xl)', overflow: 'hidden', zIndex: 1000,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              color: 'white',
            }}>
              <Sparkles size={20} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>AI Dataset Advisor</p>
                <p style={{ fontSize: 11, opacity: 0.8, color: 'rgba(255,255,255,0.8)' }}>Ask about datasets</p>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', opacity: 0.8 }}>
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map((msg, i) => (
                <div key={i} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                }}>
                  <div style={{
                    padding: '10px 14px', borderRadius: 14,
                    background: msg.role === 'user' ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'var(--bg-surface)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    fontSize: 13, lineHeight: 1.6,
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 14,
                    borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 14,
                  }}>
                    {msg.content.split('\n').map((line, li) => (
                      <span key={li}>
                        {line.split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
                          part.startsWith('**') && part.endsWith('**')
                            ? <strong key={pi}>{part.slice(2, -2)}</strong>
                            : part
                        )}
                        {li < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 14, background: 'var(--bg-surface)' }}>
                  <Loader2 size={14} className="spin" style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Questions */}
            <div style={{ padding: '0 16px 8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_QUESTIONS.map(q => (
                <button key={q} onClick={() => sendMessage(q)} style={{
                  fontSize: 10, padding: '4px 10px', borderRadius: 20,
                  background: 'var(--color-primary-subtle)', border: '1px solid rgba(124,58,237,0.15)',
                  color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600,
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: '8px 16px 16px', display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                placeholder="Ask about datasets..."
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 12,
                  border: '1px solid var(--border)', background: 'var(--bg-input)',
                  fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                  fontFamily: 'var(--font-body)',
                }}
              />
              <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{
                width: 40, height: 40, borderRadius: 12, border: 'none',
                background: input.trim() ? 'linear-gradient(135deg, #7C3AED, #6D28D9)' : 'var(--border-light)',
                color: input.trim() ? 'white' : 'var(--text-muted)',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
