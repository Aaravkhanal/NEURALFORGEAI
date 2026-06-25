'use client';

import { Activity, Clock, ShieldAlert, Zap, TrendingUp, AlertTriangle, PlayCircle } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

const LATENCY_DATA = Array.from({ length: 24 }, (_, i) => ({
  time: `${i}:00`,
  value: 12 + Math.random() * 8 + (i === 14 ? 25 : 0) // spike at 14:00
}));

const DRIFT_DATA = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  value: 0.02 + (i * 0.003) + (Math.random() * 0.01) // gradual increase
}));

const LOGS = [
  { time: '14:23:01', id: 'req_8f72a', status: '200 OK', latency: '14ms', risk: 'Low' },
  { time: '14:23:05', id: 'req_9b11c', status: '200 OK', latency: '12ms', risk: 'Low' },
  { time: '14:23:12', id: 'req_4d33f', status: '200 OK', latency: '18ms', risk: 'Medium' },
  { time: '14:23:18', id: 'req_2a99e', status: '500 ERR', latency: '120ms', risk: 'High' },
  { time: '14:23:22', id: 'req_7c44b', status: '200 OK', latency: '13ms', risk: 'Low' },
];

export default function MonitoringPage() {
  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 08</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Production Monitoring</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Live telemetry, data drift detection, and automated retraining triggers.
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'AVG LATENCY', value: '14 ms', icon: Clock, trend: '+2ms', color: '#FF4400' },
          { label: 'REQUESTS/MIN', value: '1,248', icon: Activity, trend: '+12%', color: '#10B981' },
          { label: 'DATA DRIFT', value: '0.11', icon: TrendingUp, trend: 'Warning', color: '#F59E0B' },
          { label: 'ERROR RATE', value: '0.02%', icon: ShieldAlert, trend: 'Stable', color: '#3B82F6' },
        ].map((kpi, i) => (
          <div key={i} className="metric-card">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon size={14} className="text-[#999]" />
              <span className="section-label">{kpi.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-[24px] font-bold" style={{ fontFamily: "'Space Mono', monospace", color: kpi.color }}>
                {kpi.value}
              </span>
              <span className={`text-[11px] font-bold ${kpi.trend.includes('+') ? 'text-[#FF4400]' : 'text-[#999]'}`}>
                {kpi.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="flex-1 flex flex-col gap-6">
          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            <div className="dashed-card">
              <span className="section-label block mb-4">ENDPOINT LATENCY (24H)</span>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={LATENCY_DATA}>
                  <defs>
                    <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4400" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#FF4400" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ebe1" />
                  <XAxis dataKey="time" hide />
                  <YAxis hide domain={[0, 40]} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#FF4400" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="dashed-card">
              <span className="section-label block mb-4">FEATURE DRIFT (30D)</span>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={DRIFT_DATA}>
                  <defs>
                    <linearGradient id="colorDrift" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0ebe1" />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 0.15]} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #f0ebe1', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorDrift)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Traffic Table */}
          <div className="dashed-card flex-1">
            <span className="section-label block mb-4">LIVE TRAFFIC LOGS</span>
            <div className="grid grid-cols-5 text-[11px] text-[#999] font-bold border-b border-[#f0ebe1] pb-2 mb-2" style={{ fontFamily: "'Space Mono', monospace" }}>
              <span>TIME</span>
              <span>REQUEST ID</span>
              <span>STATUS</span>
              <span>LATENCY</span>
              <span>RISK SCORE</span>
            </div>
            <div className="space-y-1">
              {LOGS.map((log, i) => (
                <div key={i} className="grid grid-cols-5 text-[13px] items-center py-2 border-b border-[#f8f4ee] hover:bg-[#FDFBF7] transition-colors">
                  <span className="text-[#888] font-mono">{log.time}</span>
                  <span className="font-bold text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>{log.id}</span>
                  <span className={log.status.includes('OK') ? 'text-[#10B981]' : 'text-red-500 font-bold'}>{log.status}</span>
                  <span className="text-[#555] font-mono">{log.latency}</span>
                  <span className={`tag-pill text-[10px] px-2 py-0.5 border-transparent ${
                    log.risk === 'Low' ? 'bg-[#DCFCE7] text-[#16A34A]' : 
                    log.risk === 'Medium' ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#FEE2E2] text-red-600'
                  }`}>{log.risk}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Sidebar: Alerts */}
        <div className="w-[280px] shrink-0 space-y-4">
          <div className="bg-[#FFF8F0] border border-[#FF4400] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={18} className="text-[#FF4400]" />
              <h3 className="font-bold text-[14px] text-[#1a1a1a]">Drift Detected</h3>
            </div>
            <p className="text-[12px] text-[#666] mb-4">
              Feature <code className="bg-white px-1 rounded text-[#FF4400]">monthly_charges</code> distribution has shifted by 11% compared to training baseline.
            </p>
            <button className="btn-coral w-full py-2.5">
              <PlayCircle size={16} /> Trigger Retraining
            </button>
          </div>

          <div className="bg-white border border-[#f0ebe1] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={18} className="text-[#10B981]" />
              <h3 className="font-bold text-[14px] text-[#1a1a1a]">System Healthy</h3>
            </div>
            <p className="text-[12px] text-[#666]">
              All inference endpoints are running nominally. Auto-scaling is active.
            </p>
          </div>
        </div>
      </div>

      <PipelineNav 
        prevLink="/dashboard/deployment" 
        prevTitle="Deployment"
      />
    </div>
  );
}
