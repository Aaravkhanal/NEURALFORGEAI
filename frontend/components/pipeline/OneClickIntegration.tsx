'use client';

import { useState } from 'react';
import { Code, Terminal, Copy, Check } from 'lucide-react';

interface Props {
  modelName: string;
}

export default function OneClickIntegration({ modelName }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState<'python' | 'js' | 'curl'>('python');

  const snippets = {
    python: `import requests\n\nurl = "https://api.neuralforge.com/v1/predict/${modelName}"\ndata = {"inputs": [...]}\n\nresponse = requests.post(url, json=data)\nprint(response.json())`,
    js: `const response = await fetch("https://api.neuralforge.com/v1/predict/${modelName}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ inputs: [...] })\n});\nconst data = await response.json();\nconsole.log(data);`,
    curl: `curl -X POST "https://api.neuralforge.com/v1/predict/${modelName}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"inputs": [...] }'`,
  };

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)' }}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Code size={20} color="var(--color-primary)" />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>One-Click Integration</h3>
      </div>
      
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['python', 'js', 'curl'].map(t => (
            <button key={t} onClick={() => setTab(t as any)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === t ? 'var(--color-primary-subtle)' : 'transparent',
              color: tab === t ? 'var(--color-primary)' : 'var(--text-secondary)',
              border: `1px solid ${tab === t ? 'var(--color-primary)' : 'var(--border)'}`,
              cursor: 'pointer'
            }}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        
        <div style={{ position: 'relative', background: '#1e1e1e', padding: 20, borderRadius: 12 }}>
          <button onClick={() => copy(snippets[tab], tab)} style={{
            position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.1)', border: 'none',
            color: 'white', padding: '6px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', display: 'flex', gap: 4
          }}>
            {copied === tab ? <Check size={12} color="#22C55E"/> : <Copy size={12} />}
            {copied === tab ? 'Copied' : 'Copy'}
          </button>
          <pre style={{ margin: 0, color: '#d4d4d4', fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            {snippets[tab]}
          </pre>
        </div>
      </div>
    </div>
  );
}
