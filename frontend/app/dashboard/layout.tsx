'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText, Database, Sparkles, BarChart3, Brain, Code2, Rocket, Activity,
  Settings, Bell, X, ChevronRight, Zap, User, Lock, CheckCircle2, Circle, TestTube2
} from 'lucide-react';
import ChatBot from '@/components/chat/ChatBot';
import { PipelineProvider, usePipeline } from '@/contexts/PipelineContext';
import { ValidationModal } from '@/components/ValidationModal';
import { PipelineDebugPanel } from '@/components/PipelineDebugPanel';

const PIPELINE_STAGES = [
  { path: '/dashboard', label: 'Problem Statement', icon: FileText, number: 1 },
  { path: '/dashboard/datasets', label: 'Dataset Sourcing', icon: Database, number: 2 },
  { path: '/dashboard/cleaning', label: 'Data Cleaning', icon: Sparkles, number: 3 },
  { path: '/dashboard/models', label: 'Model Benchmark', icon: BarChart3, number: 4 },
  { path: '/dashboard/training', label: 'Model Training', icon: Brain, number: 5 },
  { path: '/dashboard/testing', label: 'Model Testing', icon: TestTube2, number: 6 },
  { path: '/dashboard/codegen', label: 'Code Generation', icon: Code2, number: 7 },
  { path: '/dashboard/deployment', label: 'Deployment', icon: Rocket, number: 8 },
  { path: '/dashboard/monitoring', label: 'Monitoring', icon: Activity, number: 9 },
];

const MLOPS_STAGES = [
  { path: '/dashboard/experiments', label: 'Experiments', icon: BarChart3 },
  { path: '/dashboard/registry', label: 'Model Registry', icon: Database },
];

function getStageName(pathname: string) {
  const stage = PIPELINE_STAGES.find(s => s.path === pathname);
  return stage?.label.toUpperCase() || 'DASHBOARD';
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const { getStageStatus, navigateWithValidation } = usePipeline();

  useEffect(() => {
    setMounted(true);
    // Ensure every session has at least a guest token so backend endpoints work
    if (!localStorage.getItem('neuralforge_token')) {
      localStorage.setItem('neuralforge_token', 'guest_token');
    }
  }, []);
  if (!mounted) return null;

  return (
    <div className="flex h-screen bg-[#FDFBF7] overflow-hidden" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* ─── Sidebar ─── */}
      <aside className="w-[260px] bg-white border-r border-[#f0ebe1] shrink-0 flex flex-col">
        {/* Logo */}
        <Link href="/">
          <div className="px-6 pt-6 pb-5 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF4400] rounded-xl flex items-center justify-center">
                <Zap size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <div>
                <div className="font-bold text-[15px] text-[#1a1a1a] tracking-tight" style={{ fontFamily: "'Space Mono', monospace" }}>AUTOML</div>
                <div className="text-[10px] text-[#999] font-medium tracking-wider" style={{ fontFamily: "'Space Mono', monospace" }}>PIPELINE v2.1</div>
              </div>
            </div>
          </div>
        </Link>

        {/* Pipeline Stages Label */}
        <div className="px-6 pb-3">
          <span className="section-label">PIPELINE STAGES</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3">
          {PIPELINE_STAGES.map((stage) => {
            const isActive = pathname === stage.path;
            const status = getStageStatus(stage.path);
            const Icon = stage.icon;
            
            return (
              <div 
                key={stage.path}
                onClick={() => {
                  if (!isActive) navigateWithValidation(stage.path);
                }}
              >
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-150 cursor-pointer group ${
                    isActive
                      ? 'bg-[#FFF8F0]'
                      : 'hover:bg-[#FDFBF7]'
                  } ${status === 'locked' ? 'opacity-60 hover:opacity-100' : ''}`}
                >
                  {/* Status Indicator */}
                  <div className="flex items-center justify-center w-5 h-5 shrink-0">
                    {status === 'completed' && <CheckCircle2 size={16} className="text-[#10B981]" />}
                    {status === 'in_progress' && <div className="w-2.5 h-2.5 rounded-full bg-[#EAB308]" />}
                    {status === 'not_started' && <Circle size={14} className="text-[#ccc]" />}
                    {status === 'locked' && <Lock size={14} className="text-[#999]" />}
                  </div>

                  {/* Icon + Label */}
                  <Icon size={16} className={isActive ? 'text-[#FF4400]' : status === 'completed' ? 'text-[#FF4400]' : 'text-[#999]'} />
                  <span className={`text-[13px] flex-1 ${
                    isActive ? 'font-bold text-[#1a1a1a]' : status === 'completed' ? 'font-medium text-[#1a1a1a]' : 'font-medium text-[#999]'
                  }`}>{stage.label}</span>

                  {/* Active arrow */}
                  {isActive && <ChevronRight size={16} className="text-[#FF4400]" />}
                </div>
              </div>
            );
          })}
          
          <div className="px-3 pt-6 pb-2">
            <span className="section-label">MLOPS</span>
          </div>
          
          {MLOPS_STAGES.map((stage) => {
            const isActive = pathname === stage.path;
            const Icon = stage.icon;
            return (
              <Link key={stage.path} href={stage.path}>
                <div
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all cursor-pointer group ${
                    isActive
                      ? 'bg-[#FFF8F0] border border-[#FF4400]/20'
                      : 'hover:bg-[#FDFBF7] border border-transparent'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-[#FF4400]' : 'text-[#999]'} />
                  <span className={`text-[13px] flex-1 ${
                    isActive ? 'font-bold text-[#1a1a1a]' : 'font-medium text-[#999]'
                  }`}>{stage.label}</span>
                  {isActive && <ChevronRight size={16} className="text-[#FF4400]" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom section — User info */}
        <div className="p-4 border-t border-[#f0ebe1]">
          <Link href="/dashboard/settings">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#FDFBF7] transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#FF4400] flex items-center justify-center text-white text-xs font-bold">
                JD
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#1a1a1a]">John Dev</div>
                <div className="text-[10px] text-[#999] font-medium">Pro Plan</div>
              </div>
            </div>
          </Link>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* ─── Topbar ─── */}
        <header className="h-12 border-b border-[#f0ebe1] bg-white flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {/* Close button */}
            <button className="w-7 h-7 rounded-lg hover:bg-[#f5f0e8] flex items-center justify-center text-[#999] transition-colors">
              <X size={16} />
            </button>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[12px]" style={{ fontFamily: "'Space Mono', monospace" }}>
              <span className="text-[#999] font-bold">PIPELINE</span>
              <ChevronRight size={12} className="text-[#ccc]" />
              <span className="text-[#FF4400] font-bold">{getStageName(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification */}
            <button className="w-8 h-8 rounded-lg hover:bg-[#f5f0e8] flex items-center justify-center text-[#999] transition-colors">
              <Bell size={16} />
            </button>

            {/* GPU badge */}
            <div className="gpu-badge">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot" />
              GPU: A100 ● Online
            </div>
          </div>
        </header>

        {/* ─── Page Content ─── */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="max-w-[1200px] mx-auto px-8 py-8">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      <ChatBot />
      <ValidationModal />
      <PipelineDebugPanel />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <PipelineProvider>
      <DashboardLayoutInner>
        {children}
      </DashboardLayoutInner>
    </PipelineProvider>
  );
}
