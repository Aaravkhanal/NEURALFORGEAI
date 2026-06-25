'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const quickActions = [
  'Start a Project',
  'Find Datasets',
  'Recommend Models',
  'Deployment Guide',
  'Train Model',
];

export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const accumulatedRef = useRef('');
  const isDragging = useRef(false);

  useEffect(() => {
    // Show chatbot after a short delay or when features section visible
    const timer = setTimeout(() => setIsVisible(true), 2000);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); }
        });
      },
      { threshold: 0.1 }
    );
    const featuresSection = document.getElementById('features');
    if (featuresSection) observer.observe(featuresSection);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok) throw new Error('Failed');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No reader');

      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      setMessages((prev) => [...prev, assistantMsg]);

      accumulatedRef.current = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content || '';
            accumulatedRef.current += token;
            const contentSnapshot = accumulatedRef.current;
            setMessages((prev) => {
              const n = [...prev];
              n[n.length - 1] = { role: 'assistant', content: contentSnapshot };
              return n;
            });
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div 
      drag
      dragMomentum={false}
      onDragStart={() => { isDragging.current = true; }}
      onDragEnd={() => { setTimeout(() => { isDragging.current = false; }, 150); }}
      className="fixed bottom-[80px] right-8 z-[1000] flex flex-col items-end"
    >
      {/* Trigger */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => { if (!isDragging.current) setIsOpen(true); }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer relative border-0"
            style={{ background: 'linear-gradient(135deg, #FF4400 0%, #E63D00 100%)', boxShadow: '0 8px 30px rgba(255, 68, 0, 0.35)' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.transform = 'scale(1.08)'; (e.target as HTMLElement).style.boxShadow = '0 12px 40px rgba(255, 68, 0, 0.5)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; (e.target as HTMLElement).style.boxShadow = '0 8px 30px rgba(255, 68, 0, 0.35)'; }}
          >
            {/* Robot/Sparkle Icon */}
            <Sparkles className="w-6 h-6 text-white" />
            {/* Red badge */}
            <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: '#1a1a1a', border: '2px solid white' }}>1</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="absolute bottom-16 right-0 flex flex-col overflow-hidden z-[1001]"
            style={{
              width: 400,
              maxHeight: 540,
              minHeight: 520,
              background: '#FFF8F0',
              border: '1px solid rgba(255, 68, 0, 0.2)',
              borderRadius: 20,
              boxShadow: '0 25px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(255, 68, 0, 0.08)',
              transformOrigin: 'bottom right'
            }}
          >
            <div className="flex items-center gap-3 shrink-0" style={{ background: 'linear-gradient(135deg, #FF4400 0%, #E63D00 100%)', padding: '18px 20px' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 text-white">
                <div className="font-bold text-[14px]">NeuralForge Assistant</div>
                <div className="flex items-center gap-1.5 text-[11px] opacity-80">
                  <span className="w-2 h-2 rounded-full bg-green-400" style={{ animation: 'pulse-dot 2s infinite' }} />
                  Online
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/15 transition-colors text-white cursor-pointer border-0 bg-transparent">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4" style={{ padding: 20, maxHeight: 340 }}>
              {messages.length === 0 && (
                <div style={{ animation: 'slideIn 0.3s ease' }}>
                  <div className="flex gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: '#fff' }}>
                      <Sparkles className="w-4 h-4" style={{ color: '#FF4400' }} />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] leading-relaxed" style={{ background: '#fff', color: '#1a1a1a', maxWidth: '85%' }}>
                      <p className="font-semibold mb-1">Hi 👋</p>
                      <p className="text-[#555]">I&apos;m NeuralForge. I already know what page you're on and your current ML context. How can I help you?</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 ml-10">
                    {quickActions.map((a) => (
                      <button key={a} onClick={() => sendMessage(a)} className="px-3.5 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-all hover:border-[#FF4400] hover:text-[#FF4400] hover:bg-[#FFF4E8] border" style={{ borderColor: 'rgba(255, 68, 0, 0.2)', color: '#555', background: '#fff' }}>{a}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: '#fff' }}>
                      <Sparkles className="w-4 h-4" style={{ color: '#FF4400' }} />
                    </div>
                  )}
                  <div
                    className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed max-w-[85%]"
                    style={{
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #FF4400, #E63D00)' : '#fff',
                      color: msg.role === 'user' ? 'white' : '#1a1a1a',
                      borderTopRightRadius: msg.role === 'user' ? 4 : undefined,
                      borderTopLeftRadius: msg.role === 'assistant' ? 4 : undefined,
                      boxShadow: msg.role === 'assistant' ? '0 2px 8px rgba(0,0,0,0.02)' : 'none'
                    }}
                  >
                    {msg.content ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      msg.role === 'assistant' && isLoading && (
                        <div className="flex gap-1.5 items-center h-5 px-1">
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#FF4400', animationDelay: '0ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#FF4400', animationDelay: '150ms' }} />
                          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#FF4400', animationDelay: '300ms' }} />
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 flex gap-2" style={{ padding: 16, borderTop: '1px solid rgba(255, 68, 0, 0.1)', background: '#fff' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Ask NeuralForge anything..."
                disabled={isLoading}
                className="flex-1 outline-none transition-all text-[14px] bg-[#FDFBF7]"
                style={{ padding: '12px 16px', border: '1px solid rgba(255, 68, 0, 0.2)', borderRadius: 12, color: '#1a1a1a' }}
                onFocus={e => (e.target.style.borderColor = '#FF4400')}
                onBlur={e => (e.target.style.borderColor = 'rgba(255, 68, 0, 0.2)')}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isLoading}
                className="w-11 h-11 flex items-center justify-center text-white cursor-pointer border-0 transition-all"
                style={{ borderRadius: 12, background: 'linear-gradient(135deg, #FF4400, #E63D00)', opacity: input.trim() && !isLoading ? 1 : 0.4 }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
