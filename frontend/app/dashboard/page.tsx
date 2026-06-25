'use client';

import Link from 'next/link';
import { Plus, Folder, Clock, ChevronRight, Activity, Database, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

const RECENT_PROJECTS = [
  { id: '1', name: 'Battery Health Prediction', updated: '2 hours ago', status: 'Training', metric: 'Epoch 45/100', progress: 45 },
  { id: '2', name: 'Customer Churn Analysis', updated: 'Yesterday', status: 'Completed', metric: '92% Accuracy', progress: 100 },
  { id: '3', name: 'Fraud Detection Model', updated: '3 days ago', status: 'Data Cleaning', metric: 'Imputing missing values', progress: 30 },
];

export default function ProjectDashboard() {
  return (
    <div className="animate-fade-in">
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Projects</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Manage your machine learning workspaces and model pipelines.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {/* Create New Project Card */}
        <Link href="/dashboard/problem">
          <div className="h-full bg-white border border-dashed border-[#ccc] rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-[#FDFBF7] hover:border-[#FF4400] transition-colors group cursor-pointer shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#FFF8F0] text-[#FF4400] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <h3 className="text-[16px] font-bold text-[#1a1a1a] mb-2">Create New Project</h3>
            <p className="text-[13px] text-[#888] max-w-[200px]">
              Start a new AutoML pipeline from scratch or generate a dataset.
            </p>
          </div>
        </Link>

        {/* Stats Cards */}
        <div className="bg-[#FFF8F0] border border-[#FF4400]/20 rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#FF4400]/10 rounded-full blur-xl" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#FF4400]/10 flex items-center justify-center">
              <Activity size={16} className="text-[#FF4400]" />
            </div>
            <span className="text-[13px] font-bold text-[#FF4400] tracking-wider uppercase">Active Models</span>
          </div>
          <div className="text-[36px] font-bold text-[#1a1a1a] mb-1 font-mono-heading">12</div>
          <p className="text-[13px] text-[#888]">Currently deployed endpoints</p>
        </div>

        <div className="bg-white border border-[#f0ebe1] rounded-2xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center">
              <Database size={16} className="text-[#6B7280]" />
            </div>
            <span className="text-[13px] font-bold text-[#6B7280] tracking-wider uppercase">Storage Used</span>
          </div>
          <div className="text-[36px] font-bold text-[#1a1a1a] mb-1 font-mono-heading">4.2 <span className="text-[20px] text-[#888]">GB</span></div>
          <div className="w-full bg-[#f0ebe1] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#10B981] h-full" style={{ width: '42%' }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[18px] font-bold text-[#1a1a1a] flex items-center gap-2">
          <Clock size={18} className="text-[#FF4400]" /> Recent Projects
        </h2>
        <button className="text-[13px] font-bold text-[#888] hover:text-[#1a1a1a] transition-colors">
          View All
        </button>
      </div>

      <div className="bg-white border border-[#f0ebe1] rounded-2xl shadow-sm overflow-hidden">
        {RECENT_PROJECTS.map((project, i) => (
          <Link key={project.id} href={`/dashboard/problem`}>
            <div className={`p-5 flex items-center justify-between hover:bg-[#FDFBF7] transition-colors cursor-pointer ${i !== RECENT_PROJECTS.length - 1 ? 'border-b border-[#f0ebe1]' : ''}`}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#FFF8F0] border border-[#FF4400]/10 flex items-center justify-center shrink-0">
                  <Folder size={18} className="text-[#FF4400]" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold text-[#1a1a1a] mb-1">{project.name}</h3>
                  <div className="flex items-center gap-3 text-[12px] text-[#888]">
                    <span>Updated {project.updated}</span>
                    <span className="w-1 h-1 rounded-full bg-[#ccc]" />
                    <span className={project.status === 'Completed' ? 'text-[#10B981] font-medium flex items-center gap-1' : 'text-[#F59E0B] font-medium'}>
                      {project.status === 'Completed' && <CheckCircle2 size={12} />}
                      {project.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-8 w-[300px]">
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] font-bold mb-1.5">
                    <span className="text-[#888] uppercase tracking-wider">Progress</span>
                    <span className="text-[#1a1a1a]">{project.metric}</span>
                  </div>
                  <div className="w-full bg-[#f0ebe1] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${project.progress === 100 ? 'bg-[#10B981]' : 'bg-[#FF4400]'}`} 
                      style={{ width: `${project.progress}%` }} 
                    />
                  </div>
                </div>
                <ChevronRight size={18} className="text-[#ccc]" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
