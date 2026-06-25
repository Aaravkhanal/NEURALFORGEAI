'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  ArrowRight, 
  Bot, 
  Search, 
  Database, 
  Cpu, 
  Code2, 
  Wrench, 
  FlaskConical, 
  Settings, 
  Rocket, 
  LineChart, 
  CheckCircle2 
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';

const AGENTS = [
  { id: 'problem_definition', icon: Bot, name: 'Problem Definition Agent', desc: 'Translates vague business requirements into concrete mathematical and algorithmic formulation.', capabilities: ['Problem classification', 'Input/output design', 'Metrics specification'], tag: 'text-blue-500' },
  { id: 'dataset_assessment', icon: Database, name: 'Dataset Assessment Agent', desc: 'Analyzes files to evaluate null rates, cardinality, correlations, and recommend data transformations.', capabilities: ['Data profiling summaries', 'Missingness diagnostics', 'Outlier detection suggestions'], tag: 'text-cyan-500' },
  { id: 'model_recommendation', icon: Cpu, name: 'Model Recommendation Agent', desc: 'Suggests standard architectures or custom modeling pipelines matching the problem and data characteristics.', capabilities: ['Scikit-learn mapping', 'Deep learning structures', 'Model trade-offs explanation'], tag: 'text-teal-500' },
  { id: 'researcher', icon: Search, name: 'Research Agent', desc: 'Queries academic databases to retrieve State-of-the-Art papers, abstracts, summaries, and compiled bibliographies.', capabilities: ['arXiv database querying', 'SOTA synthesis', 'Citation formatting'], tag: 'text-indigo-500' },
  { id: 'code_generation', icon: Code2, name: 'Code Generation Agent', desc: 'Constructs production-grade Python pipelines with proper train-test splits, data loader definitions, training loops, and validation metrics.', capabilities: ['PyTorch & TensorFlow networks', 'Scikit-learn pipelines', 'Clean self-contained scripts'], tag: 'text-blue-600' },
  { id: 'feature_engineering', icon: Wrench, name: 'Feature Engineering Agent', desc: 'Formulates strategies for imputing, encoding, scaling, and engineering high-impact predictors.', capabilities: ['Categorical encoders design', 'Log/scaling mappings', 'Dimensionality reductions suggestion'], tag: 'text-amber-500' },
  { id: 'experiment_planning', icon: FlaskConical, name: 'Experiment Planning Agent', desc: 'Designs cross-validation structures, hyperparameter optimization spaces, and ablation studies.', capabilities: ['K-Fold designs', 'Optuna/GridSearch setups', 'Ablation structures'], tag: 'text-amber-600' },
  { id: 'mlops', icon: Settings, name: 'MLOps Agent', desc: 'Draws up pipeline structures, validation triggers, model registries setup, and continuous integration flows.', capabilities: ['MLflow integrations', 'Validation schemas', 'CI/CD pipeline advice'], tag: 'text-rose-500' },
  { id: 'deployment', icon: Rocket, name: 'Deployment Strategy Agent', desc: 'Recommends serving frameworks, auto-scaling configurations, container formats, and hardware platforms.', capabilities: ['FastAPI wrappers design', 'Docker configurations', 'Kubernetes scaling tips'], tag: 'text-cyan-500' },
  { id: 'evaluation', icon: LineChart, name: 'Model Evaluation Agent', desc: 'Formulates diagnostics including confusion matrices, ROC charts, bias auditing, and feature importances.', capabilities: ['ROC/AUC diagnostics', 'Bias/Fairness auditing', 'SHAP/LIME interpretation design'], tag: 'text-emerald-500' },
];

export default function FeaturesPage() {
  return (
    <div 
      className="min-h-screen selection:bg-blue-500/30 selection:text-white font-sans overflow-x-hidden antialiased"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      <Navbar />

      {/* Hero */}
      <section 
        className="relative pt-32 pb-20 px-4 overflow-hidden border-b"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] blur-[120px] rounded-full pointer-events-none" 
          style={{ background: 'color-mix(in srgb, var(--accent) 3%, transparent)' }}
        />
        <div className="max-w-[1200px] mx-auto text-center space-y-6">
          <span className="badge-label">
            AGENT ECOSYSTEM
          </span>
          
          <h1 
            className="text-3xl sm:text-5xl lg:text-[48px] font-extrabold leading-tight tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Specialized Intelligence,<br />
            <span className="gradient-text">Coordinated to Perform</span>
          </h1>
          
          <p 
            className="text-[18px] max-w-2xl mx-auto leading-relaxed font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            NeuralForge replaces generic single-prompt assistants with a stateful graph of 10 domain experts. They collaborate, call tools, review research papers, and assemble fully executable code pipelines.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {AGENTS.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div 
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="p-6 rounded-2xl border flex flex-col justify-between group shadow-sm transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                }}
              >
                <div className="space-y-4">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm"
                    style={{
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <Icon className={`w-6 h-6 ${agent.tag}`} />
                  </div>
                  <h3 
                    className="font-extrabold text-[18px] transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {agent.name}
                  </h3>
                  <p 
                    className="text-[14px] leading-relaxed font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {agent.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
                  {agent.capabilities.map((cap) => (
                    <div 
                      key={cap} 
                      className="flex items-center gap-2 text-[14px] font-semibold"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      <span>{cap}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* State Graph Abstractions */}
      <section 
        className="py-20 border-t"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <span className="badge-label">
                THE STATE GRAPH
              </span>
              <h2 
                className="text-2xl sm:text-3xl lg:text-[36px] font-extrabold tracking-tight leading-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Stateful Abstraction Loop
              </h2>
              <p 
                className="text-[18px] leading-relaxed font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Using state-of-the-art LangGraph cyclical graphs, NeuralForge coordinates a single centralized project context state. As prompt vectors change, routers delegate nodes, update checkpoint matrices in PostgreSQL, and stream WebSocket output channels dynamically.
              </p>
              
              <div className="space-y-4 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="flex gap-4 text-[14px] leading-relaxed font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-extrabold" style={{ color: 'var(--text-primary)' }}>Cyclical Handoffs</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>The Evaluator can trigger automatic Code Regeneration if performance matrices fall below limits.</span>
                  </div>
                </div>
                <div className="flex gap-4 text-[14px] leading-relaxed font-medium">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-extrabold" style={{ color: 'var(--text-primary)' }}>PostgreSQL Checkpointing</strong>
                    <span style={{ color: 'var(--text-secondary)' }}>Entire swarm memories are persisted, enabling users to pause execution pipelines and resume.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Graphical schematic mockup */}
            <div className="lg:col-span-6 flex justify-center">
              <div 
                className="w-full p-8 rounded-3xl flex flex-col items-center justify-center space-y-4 min-h-[320px] relative overflow-hidden shadow-sm border"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border)',
                }}
              >
                
                <div 
                  className="px-5 py-3 rounded-2xl flex items-center gap-2.5 text-[14px] font-extrabold shadow-md border"
                  style={{
                    background: 'var(--accent-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)',
                  }}
                >
                  <Bot className="w-5 h-5" /> Swarm Orchestrator Node
                </div>

                <div className="w-0.5 h-8 bg-blue-500/30" />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <div 
                    className="px-4 py-2.5 rounded-xl text-[12px] font-bold border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Problem Definition
                  </div>
                  <div 
                    className="px-4 py-2.5 rounded-xl text-[12px] font-extrabold border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  >
                    Dataset Assessment
                  </div>
                  <div 
                    className="px-4 py-2.5 rounded-xl text-[12px] font-bold border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  >
                    Model Selection
                  </div>
                </div>

                <div className="w-0.5 h-8 bg-blue-500/30" />

                <div 
                  className="px-5 py-3 rounded-2xl flex items-center gap-2.5 text-[14px] font-extrabold shadow-md border"
                  style={{
                    background: 'var(--accent-bg)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent)',
                  }}
                >
                  <Code2 className="w-5 h-5" /> Code Generation Node
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section className="py-20 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <div 
            className="relative rounded-3xl overflow-hidden p-8 sm:p-16 text-center space-y-6 shadow-sm border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border)',
            }}
          >
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 blur-[80px] rounded-full pointer-events-none"
              style={{ background: 'color-mix(in srgb, var(--accent) 3%, transparent)' }}
            />
            
            <h2 
              className="font-extrabold text-2xl sm:text-4xl tracking-tight leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              Launch an Agent Swarm
            </h2>
            <p 
              className="text-[18px] max-w-xl mx-auto leading-relaxed font-medium"
              style={{ color: 'var(--text-secondary)' }}
            >
              Deploy our modular, stateful Graph agent models for automated credit-scoring pipelines, churn forecasting, and timeseries energy load planners.
            </p>
            <div className="pt-4">
              <Link 
                href="/login" 
                className="btn btn-primary inline-flex items-center gap-2 px-6 h-12 text-[14px] font-bold rounded-xl cursor-pointer"
              >
                Start Automated Swarm <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="border-t py-16 px-6 text-xs"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          color: 'var(--text-muted)'
        }}
      >
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center sm:text-left">
            <span className="font-bold text-sm block" style={{ color: 'var(--text-primary)' }}>⚡ NeuralForge</span>
            <p style={{ color: 'var(--text-muted)' }}>Your AI-powered Machine Learning Consulting Swarm.</p>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/" className="transition-colors" style={{ color: 'var(--text-muted)' }}>Home</Link>
            <Link href="/docs" className="transition-colors" style={{ color: 'var(--text-muted)' }}>Docs</Link>
            <a href="#" target="_blank" rel="noreferrer" className="transition-colors" style={{ color: 'var(--text-muted)' }}>GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

