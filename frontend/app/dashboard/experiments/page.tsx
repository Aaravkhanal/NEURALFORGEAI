'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Filter, History, ChevronRight, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

const EXPERIMENTS = [
  { id: 'exp_783', name: 'XGBoost Baseline', date: 'Oct 12, 14:20', duration: '1m 12s', metrics: { acc: 0.894, f1: 0.871 }, status: 'Completed', user: 'John D.' },
  { id: 'exp_782', name: 'Neural Net Tuned', date: 'Oct 12, 13:05', duration: '4m 30s', metrics: { acc: 0.901, f1: 0.884 }, status: 'Completed', user: 'John D.' },
  { id: 'exp_781', name: 'Random Forest (depth 10)', date: 'Oct 11, 10:15', duration: '0m 45s', metrics: { acc: 0.871, f1: 0.852 }, status: 'Completed', user: 'Jane S.' },
  { id: 'exp_780', name: 'Logistic Reg (L1)', date: 'Oct 11, 09:30', duration: '0m 10s', metrics: { acc: 0.821, f1: 0.803 }, status: 'Completed', user: 'System' },
  { id: 'exp_779', name: 'SVM Trial', date: 'Oct 10, 16:45', duration: '1m 20s', metrics: { acc: 0.843, f1: 0.830 }, status: 'Completed', user: 'John D.' },
];

const METRIC_HISTORY = EXPERIMENTS.map(e => ({ name: e.id, acc: e.metrics.acc, f1: e.metrics.f1 })).reverse();

export default function ExperimentsPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#FF4400] flex items-center justify-center">
          <History size={16} className="text-white" />
        </div>
        <h1 className="font-mono-heading text-[28px] text-[#1a1a1a]">Experiment Tracking</h1>
      </div>
      <p className="text-[15px] text-[#888] mb-8">
        Compare runs, track hyperparameters, and reproduce past results (MLflow equivalent).
      </p>

      <div className="flex gap-6">
        {/* Main Table */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 w-1/2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#bbb]" />
                <input 
                  type="text" 
                  placeholder="Search experiments..." 
                  className="w-full h-9 pl-9 pr-4 bg-white border border-[#f0ebe1] rounded-lg text-[13px] outline-none focus:border-[#FF4400]"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button className="btn-outline px-3 h-9 text-[#555] border-[#f0ebe1] hover:border-[#FF4400]">
                <Filter size={14} /> Filter
              </button>
            </div>
            
            {selected.length > 0 && (
              <button className="btn-coral h-9 px-4 text-[13px]">
                Compare {selected.length} Runs
              </button>
            )}
          </div>

          <div className="dashed-card p-0 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FDFBF7] border-b border-[#f0ebe1] text-[11px] font-bold text-[#999] tracking-wider uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
                  <th className="px-4 py-3 w-10"></th>
                  <th className="px-4 py-3">Run Name</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3 text-right">Accuracy</th>
                  <th className="px-4 py-3 text-right">F1 Score</th>
                </tr>
              </thead>
              <tbody>
                {EXPERIMENTS.map((exp, i) => (
                  <tr key={exp.id} className="border-b border-[#f8f4ee] hover:bg-[#FFF8F0] transition-colors group cursor-pointer" onClick={() => toggleSelect(exp.id)}>
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox" 
                        checked={selected.includes(exp.id)}
                        onChange={() => {}}
                        className="accent-[#FF4400] w-4 h-4 rounded cursor-pointer" 
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1a1a1a] text-[13px]">{exp.name}</div>
                      <div className="text-[11px] text-[#999] font-mono">{exp.id}</div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#666]">{exp.date}</td>
                    <td className="px-4 py-3 text-[12px] text-[#666]">{exp.duration}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#FF4400] text-right font-mono">{(exp.metrics.acc * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-[#10B981] text-right font-mono">{(exp.metrics.f1 * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar: Metric Trend */}
        <div className="w-[300px] shrink-0">
          <div className="dashed-card">
            <span className="section-label block mb-4">ACCURACY TREND</span>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={METRIC_HISTORY}>
                <XAxis dataKey="name" hide />
                <YAxis domain={[0.8, 0.95]} hide />
                <Tooltip contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }} />
                <Line type="stepAfter" dataKey="acc" stroke="#FF4400" strokeWidth={2} dot={{ r: 4, fill: '#FF4400' }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-[#f0ebe1] text-[12px] text-[#888] leading-relaxed">
              Accuracy has improved by <strong>+7.3%</strong> over the last 5 experiments.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
