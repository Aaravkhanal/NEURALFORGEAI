'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap, ChevronRight, BarChart3, Cloud, Code2, Sparkles, Shield, Rocket,
  FileText, Database, Brain, Activity, Download, CheckCircle2, XCircle
} from 'lucide-react';
import ChatBot from '@/components/chat/ChatBot';

const WORKFLOW_STAGES = [
  { id: 'problem', title: 'Problem Statement', desc: 'Define your machine learning objective and constraints.', icon: FileText },
  { id: 'dataset', title: 'Dataset Discovery', desc: 'Find real datasets from Kaggle, HuggingFace, or generate synthetic data.', icon: Database },
  { id: 'cleaning', title: 'Data Cleaning', desc: 'Automatically handle missing values, outliers, and encoding.', icon: Sparkles },
  { id: 'benchmark', title: 'Model Benchmarking', desc: 'Test against XGBoost, Random Forests, Neural Nets instantly.', icon: BarChart3 },
  { id: 'training', title: 'Training', desc: 'Hyperparameter tuning, loss tracking, and optimization.', icon: Brain },
  { id: 'codegen', title: 'Code Generation', desc: 'Export production-ready FastAPI inference code automatically.', icon: Code2 },
  { id: 'deploy', title: 'Deployment', desc: 'Push models directly to AWS, GCP, Azure, or Docker.', icon: Rocket },
  { id: 'monitor', title: 'Monitoring', desc: 'Track live inference metrics, data drift, and performance.', icon: Activity },
];

const SHOWCASE_PROJECTS = [
  { title: 'Battery Health Prediction', problem: 'Predict remaining useful life', dataset: 'NASA Li-ion Battery (50k rows)', model: 'Random Forest Regressor', acc: '98.2% R²' },
  { title: 'Customer Churn Prediction', problem: 'Identify users likely to cancel', dataset: 'Telco Churn Data (7k rows)', model: 'XGBoost Classifier', acc: '92.4% Accuracy' },
  { title: 'Medical Diagnosis', problem: 'Classify tumor malignancy', dataset: 'Breast Cancer Wisconsin (569 rows)', model: 'Logistic Regression', acc: '97.6% AUC' },
  { title: 'Fraud Detection', problem: 'Detect anomalous transactions', dataset: 'Credit Card Fraud (284k rows)', model: 'Isolation Forest', acc: '99.9% Precision' },
  { title: 'Computer Vision', problem: 'Detect defects in manufacturing', dataset: 'Casting Product Image Data', model: 'ResNet-50', acc: '95.8% Accuracy' },
  { title: 'Time-Series Forecasting', problem: 'Predict weekly retail sales', dataset: 'Walmart Sales Data', model: 'Prophet', acc: '5.2% MAPE' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans selection:bg-[#FF4400]/20 selection:text-[#1a1a1a]">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 w-full bg-[#FDFBF7]/80 backdrop-blur-md z-50 border-b border-[#f0ebe1]">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#FF4400] rounded-xl flex items-center justify-center">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[16px] tracking-tight text-[#1a1a1a]" style={{ fontFamily: "'Space Mono', monospace" }}>
              NEURALFORGE
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-[#555]">
            <Link href="#workflow" className="hover:text-[#FF4400] transition-colors">Workflow</Link>
            <Link href="#how-it-works" className="hover:text-[#FF4400] transition-colors">How it Works</Link>
            <Link href="#showcase" className="hover:text-[#FF4400] transition-colors">Showcase</Link>
            <Link href="#copilot" className="hover:text-[#FF4400] transition-colors">AI Copilot</Link>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-[13px] font-bold text-[#1a1a1a] hover:text-[#FF4400] transition-colors">
              Sign In
            </Link>
            <Link href="/dashboard">
              <button className="bg-[#1a1a1a] hover:bg-[#FF4400] text-white text-[13px] font-bold px-5 py-2.5 rounded-full transition-all">
                Start Building
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="pt-40 pb-20 px-6 hero-gradient relative overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#FF4400]/5 rounded-[100%] blur-[80px] -z-10" />
        
        <div className="max-w-[1000px] mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-[56px] md:text-[72px] font-extrabold text-[#1a1a1a] leading-[1.05] tracking-tight mb-6">
              Build Production-Ready <br />
              <span className="text-[#FF4400]">Machine Learning</span> Models<br />
              Without Writing Code.
            </h1>
            
            <p className="text-[18px] md:text-[20px] text-[#555] max-w-[700px] mx-auto mb-10 leading-relaxed">
              Describe your problem, discover datasets, benchmark models, train, deploy, and monitor your AI systems from a single guided platform.
            </p>
            
            <div className="flex items-center justify-center gap-4">
              <Link href="/dashboard">
                <button className="btn-coral px-8 py-4 text-[16px] rounded-full shadow-[0_8px_32px_rgba(255,68,0,0.25)] hover:shadow-[0_12px_40px_rgba(255,68,0,0.35)]">
                  Start Building <ChevronRight size={18} />
                </button>
              </Link>
              <button className="bg-white hover:bg-[#f5f0e8] text-[#1a1a1a] border border-[#e8ddd0] px-8 py-4 text-[16px] font-bold rounded-full transition-all flex items-center gap-2">
                Watch Demo
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Interactive Workflow Visualization ─── */}
      <section id="workflow" className="py-24 bg-white border-y border-[#f0ebe1] overflow-hidden">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="section-label text-[#FF4400]">THE PIPELINE</span>
            <h2 className="text-[36px] font-bold text-[#1a1a1a] mt-2">The Entire ML Lifecycle, Unified.</h2>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {WORKFLOW_STAGES.map((stage, i) => (
              <div key={i} className="group relative">
                <div className="flex items-center gap-3 bg-[#FDFBF7] border border-[#f0ebe1] px-5 py-3 rounded-full hover:border-[#FF4400] transition-colors cursor-default">
                  <stage.icon size={18} className="text-[#999] group-hover:text-[#FF4400] transition-colors" />
                  <span className="text-[14px] font-bold text-[#1a1a1a]">{stage.title}</span>
                  {i < WORKFLOW_STAGES.length - 1 && <ChevronRight size={14} className="text-[#ccc] ml-2 absolute -right-6 top-1/2 -translate-y-1/2 hidden md:block" />}
                </div>
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 w-[240px] p-4 bg-[#1a1a1a] text-white rounded-xl text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-2xl">
                  <span className="block text-[12px] font-bold text-[#FF4400] mb-1">{stage.title}</span>
                  <span className="text-[13px] leading-relaxed opacity-90">{stage.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How NeuralForge Works ─── */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="section-label text-[#FF4400]">HOW IT WORKS</span>
            <h2 className="text-[36px] font-bold text-[#1a1a1a] mt-2">From Idea to Endpoint in 6 Steps.</h2>
          </div>

          <div className="space-y-12">
            {[
              { title: 'Describe Your Problem', items: ['Predict EV battery health', 'Detect road accidents', 'Classify medical images', 'Forecast stock prices'] },
              { title: 'Find or Generate Datasets', items: ['Upload your own dataset', 'Search public datasets (Kaggle, HF)', 'Generate synthetic datasets'] },
              { title: 'Prepare Data', items: ['Missing values imputation', 'Outlier detection', 'Categorical encoding', 'Feature engineering'] },
              { title: 'Benchmark Models', items: ['Logistic Regression', 'Random Forest', 'XGBoost', 'LightGBM', 'CatBoost'] },
              { title: 'Train & Optimize', items: ['Hyperparameter tuning', 'Loss tracking', 'Performance monitoring'] },
              { title: 'Deploy Anywhere', items: ['FastAPI Inference', 'Docker Containers', 'AWS, Azure, GCP', 'HuggingFace Spaces'] },
            ].map((step, i) => (
              <div key={i} className="flex gap-8 items-start">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF8F0] border border-[#FF4400]/20 flex items-center justify-center font-mono-heading text-[20px] text-[#FF4400] shrink-0 mt-1">
                  {i + 1}
                </div>
                <div className="flex-1 bg-white border border-[#f0ebe1] rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-4">{step.title}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {step.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-2 text-[14px] text-[#666]">
                        <CheckCircle2 size={16} className="text-[#10B981]" />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Showcase Section ─── */}
      <section id="showcase" className="py-24 bg-white border-y border-[#f0ebe1]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="section-label text-[#FF4400]">SHOWCASE</span>
            <h2 className="text-[36px] font-bold text-[#1a1a1a] mt-2">What you can build.</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {SHOWCASE_PROJECTS.map((proj, i) => (
              <div key={i} className="border border-[#f0ebe1] rounded-2xl p-6 bg-[#FDFBF7] hover:border-[#FF4400]/50 transition-colors">
                <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-4">{proj.title}</h3>
                <div className="space-y-3">
                  <div>
                    <span className="block text-[11px] font-bold text-[#888] uppercase mb-0.5">Problem</span>
                    <span className="text-[14px] text-[#444]">{proj.problem}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-[#888] uppercase mb-0.5">Dataset</span>
                    <span className="text-[14px] text-[#444]">{proj.dataset}</span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-[#888] uppercase mb-0.5">Model Used</span>
                    <span className="text-[14px] font-bold text-[#1a1a1a]">{proj.model}</span>
                  </div>
                  <div className="pt-3 border-t border-[#f0ebe1]">
                    <span className="block text-[11px] font-bold text-[#888] uppercase mb-0.5">Expected Accuracy</span>
                    <span className="text-[18px] font-bold text-[#10B981]">{proj.acc}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Why NeuralForge (Comparison) ─── */}
      <section className="py-24">
        <div className="max-w-[1000px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="section-label text-[#FF4400]">WHY NEURALFORGE</span>
            <h2 className="text-[36px] font-bold text-[#1a1a1a] mt-2">A paradigm shift in ML workflows.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-[#f0ebe1] rounded-3xl p-8">
              <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-6 flex items-center gap-2">
                <XCircle className="text-[#EF4444]" /> Traditional ML Workflow
              </h3>
              <ul className="space-y-4">
                {['Find datasets manually', 'Write tedious cleaning scripts', 'Train and tune models manually', 'Struggle with deployment infrastructure'].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-[15px] text-[#666]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="bg-[#FFF8F0] border-2 border-[#FF4400] rounded-3xl p-8 shadow-[0_8px_30px_rgba(255,68,0,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4400]/10 rounded-full blur-2xl -mr-10 -mt-10" />
              <h3 className="text-[20px] font-bold text-[#1a1a1a] mb-6 flex items-center gap-2 relative z-10">
                <CheckCircle2 className="text-[#10B981]" /> NeuralForge Workflow
              </h3>
              <ul className="space-y-4 relative z-10">
                {['AI-assisted dataset discovery', 'Automated data cleaning & benchmarking', 'One-click deployment endpoints', 'Built-in inference monitoring & code generation'].map((t, i) => (
                  <li key={i} className="flex items-center gap-3 text-[15px] text-[#1a1a1a] font-medium">
                    <div className="w-2 h-2 rounded-full bg-[#FF4400]" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI Copilot ─── */}
      <section id="copilot" className="py-24 bg-[#1a1a1a] text-white">
        <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-white text-[12px] font-bold mb-6">
              <Sparkles size={14} className="text-[#FF4400]" /> Context-Aware AI
            </div>
            <h2 className="text-[40px] font-bold mb-6 leading-tight">Your Personal <br/><span className="text-[#FF4400]">AI ML Engineer</span>.</h2>
            <p className="text-[18px] text-[#bbb] mb-8 leading-relaxed">
              NeuralForge isn't just a UI—it's an active participant in your workflow. The built-in Copilot understands your exact pipeline state.
            </p>
            <ul className="space-y-4 mb-8">
              {['Explains complex ML concepts', 'Suggests relevant public datasets', 'Recommends optimal model architectures', 'Helps debug training issues', 'Assists with deployment code'].map((t, i) => (
                <li key={i} className="flex items-center gap-3 text-[15px] text-[#ddd]">
                  <CheckCircle2 size={18} className="text-[#FF4400]" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-[#FF4400]/20 blur-[100px] rounded-full" />
            <div className="relative bg-[#222] border border-[#333] rounded-2xl p-6 shadow-2xl">
              <div className="flex gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#FF4400] flex items-center justify-center shrink-0">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div className="bg-[#333] rounded-2xl rounded-tl-sm p-4 text-[13px] text-[#eee] leading-relaxed">
                  Based on your dataset containing 569 rows of Breast Cancer diagnostics, I strongly recommend starting with a Logistic Regression baseline, then benchmarking against XGBoost for maximum recall.
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-gradient-to-br from-[#FF4400] to-[#E63D00] rounded-2xl rounded-tr-sm p-4 text-[13px] text-white leading-relaxed">
                  Can you generate the FastAPI deployment code for the XGBoost model?
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Model Export ─── */}
      <section className="py-24 bg-white border-b border-[#f0ebe1]">
        <div className="max-w-[1000px] mx-auto px-6 text-center">
          <div className="w-20 h-20 mx-auto bg-[#FFF8F0] border border-[#FF4400]/20 rounded-3xl flex items-center justify-center mb-8">
            <Download size={32} className="text-[#FF4400]" />
          </div>
          <h2 className="text-[40px] font-bold text-[#1a1a1a] mb-4">You own your models.</h2>
          <p className="text-[18px] text-[#666] max-w-[600px] mx-auto mb-10">
            Download and use your trained models anywhere. No vendor lock-in. NeuralForge exports production-ready artifacts in standard formats.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {['.pkl (Scikit-Learn)', '.joblib (Standard)', '.onnx (Universal)', '.pt (PyTorch)', '.h5 (TensorFlow)'].map((fmt, i) => (
              <div key={i} className="px-5 py-3 bg-[#FDFBF7] border border-[#f0ebe1] rounded-xl text-[15px] font-mono text-[#FF4400] font-bold shadow-sm">
                {fmt}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-32 hero-gradient relative overflow-hidden text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[#FF4400]/5 rounded-[100%] blur-[80px] -z-10" />
        <div className="max-w-[800px] mx-auto px-6">
          <h2 className="text-[48px] md:text-[56px] font-extrabold text-[#1a1a1a] mb-6 tracking-tight">
            Ready to Build Your Next ML Model?
          </h2>
          <p className="text-[20px] text-[#555] mb-12">
            Experience the guided pipeline. Go from problem statement to deployed API in minutes.
          </p>
          <Link href="/dashboard">
            <button className="btn-coral px-10 py-5 text-[18px] rounded-full shadow-[0_8px_32px_rgba(255,68,0,0.3)] hover:shadow-[0_12px_40px_rgba(255,68,0,0.4)] hover:-translate-y-1 transition-all">
              Start Building Now
            </button>
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-12 bg-[#1a1a1a]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 opacity-50">
            <div className="w-8 h-8 bg-[#FF4400] rounded-xl flex items-center justify-center grayscale">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-[16px] tracking-tight text-white" style={{ fontFamily: "'Space Mono', monospace" }}>
              NEURALFORGE
            </span>
          </div>
          <div className="text-[13px] text-[#888]">
            © {new Date().getFullYear()} NeuralForge AI. All rights reserved.
          </div>
        </div>
      </footer>
      
      <ChatBot />
    </div>
  );
}
