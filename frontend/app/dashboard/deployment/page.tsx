'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Cloud, Server, Database, Rocket, Shield, Activity, Box, Cpu, Copy } from 'lucide-react';
import { PipelineNav } from '@/components/PipelineNav';
import { usePipeline } from '@/contexts/PipelineContext';
import { api } from '@/lib/api';

const PROVIDERS = [
  { id: 'aws', name: 'AWS SageMaker', icon: Cloud, desc: 'Managed serverless endpoint' },
  { id: 'gcp', name: 'Google Cloud Vertex', icon: Cloud, desc: 'Scalable auto-managed endpoint' },
  { id: 'azure', name: 'Azure ML', icon: Cloud, desc: 'Enterprise managed deployment' },
  { id: 'docker', name: 'Docker Registry', icon: Box, desc: 'Push to your own registry' },
];

export default function DeploymentPage() {
  const [provider, setProvider] = useState('aws');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState(0);

  const { markStageComplete } = usePipeline();

  const isGuest = typeof window !== 'undefined' && api.getToken() === 'guest_token';

  const handleDeploy = () => {
    setIsDeploying(true);
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setDeployStep(step);
      if (step >= 4) {
        clearInterval(interval);
        markStageComplete('/dashboard/deployment');
      }
    }, 1500);
  };

  return (
    <div className="animate-fade-in">
      <div className="stage-badge mb-4">STAGE 07</div>
      <h1 className="font-mono-heading text-[32px] text-[#1a1a1a] mb-2">Deployment</h1>
      <p className="text-[15px] text-[#888] mb-8">
        Deploy your model to a production environment with one click.
      </p>

      <div className="flex gap-8">
        {/* ─── Left: Provider & Config ─── */}
        <div className="flex-1 space-y-6">
          {/* Provider Selection */}
          <div className="dashed-card">
            <span className="section-label block mb-4">TARGET ENVIRONMENT</span>
            <div className="grid grid-cols-2 gap-4">
              {PROVIDERS.map(p => (
                <div
                  key={p.id}
                  onClick={() => !isDeploying && setProvider(p.id)}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    provider === p.id 
                      ? 'border-[#FF4400] bg-[#FFF8F0]' 
                      : 'border-[#f0ebe1] bg-white hover:border-[#FF4400]'
                  } ${isDeploying ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#f0ebe1] flex items-center justify-center">
                      <p.icon size={16} className={provider === p.id ? 'text-[#FF4400]' : 'text-[#888]'} />
                    </div>
                    <span className="font-bold text-[14px] text-[#1a1a1a]">{p.name}</span>
                  </div>
                  <p className="text-[12px] text-[#888]">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Instance Config */}
          <div className="dashed-card">
            <span className="section-label block mb-4">INSTANCE CONFIGURATION</span>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Instance Type</label>
                  <select disabled={isDeploying} className="w-full h-10 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[13px] outline-none focus:border-[#FF4400]">
                    <option>ml.t3.medium (2 vCPU, 4 GiB)</option>
                    <option>ml.m5.large (2 vCPU, 8 GiB)</option>
                    <option>ml.g4dn.xlarge (4 vCPU, 16 GiB, 1 GPU)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-bold text-[#555] mb-1.5 block">Initial Instance Count</label>
                  <input type="number" disabled={isDeploying} defaultValue={1} className="w-full h-10 bg-white border border-[#f0ebe1] rounded-lg px-3 text-[13px] outline-none focus:border-[#FF4400]" />
                </div>
              </div>
              
              <div className="pt-4 border-t border-[#f0ebe1]">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a1a1a]">Auto-scaling</div>
                    <div className="text-[11px] text-[#888]">Scale up to 5 instances during high traffic</div>
                  </div>
                  <input type="checkbox" disabled={isDeploying} defaultChecked className="accent-[#FF4400] w-4 h-4 rounded" />
                </label>
              </div>
              
              <div className="pt-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-[13px] font-bold text-[#1a1a1a]">API Authentication</div>
                    <div className="text-[11px] text-[#888]">Require API key for inference endpoint</div>
                  </div>
                  <input type="checkbox" disabled={isDeploying} defaultChecked className="accent-[#FF4400] w-4 h-4 rounded" />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right: Deploy Actions ─── */}
        <div className="w-[320px] shrink-0 space-y-6">
          <div className="dashed-card-filled">
            <h3 className="text-[18px] font-bold text-[#1a1a1a] mb-2 text-center">Ready to Deploy</h3>
            <p className="text-[13px] text-[#888] text-center mb-6">
              Est. Cost: <strong className="text-[#1a1a1a]">$48.00</strong> / month
            </p>
            
            {!isDeploying && deployStep === 0 ? (
              <div className="space-y-4">
                {isGuest && (
                  <div className="text-center p-3 bg-[#FFF8F0] border border-[#FF4400]/20 rounded-xl">
                    <p className="text-[12px] text-[#888]">Simulated deployment. Sign in for real cloud deployment.</p>
                  </div>
                )}
                <button onClick={handleDeploy} className="btn-coral w-full py-3">
                  <Rocket size={18} /> Deploy to {PROVIDERS.find(p => p.id === provider)?.name}
                </button>
              </div>
            ) : deployStep < 4 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${deployStep >= 1 ? 'bg-[#10B981] text-white' : 'bg-[#e8ddd0] text-[#999]'}`}>
                    <Server size={12} />
                  </div>
                  <span className={`text-[13px] ${deployStep >= 1 ? 'text-[#1a1a1a] font-bold' : 'text-[#999]'}`}>Provisioning compute...</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${deployStep >= 2 ? 'bg-[#10B981] text-white' : 'bg-[#e8ddd0] text-[#999]'}`}>
                    <Box size={12} />
                  </div>
                  <span className={`text-[13px] ${deployStep >= 2 ? 'text-[#1a1a1a] font-bold' : 'text-[#999]'}`}>Building container image...</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${deployStep >= 3 ? 'bg-[#10B981] text-white' : 'bg-[#e8ddd0] text-[#999]'}`}>
                    <Cloud size={12} />
                  </div>
                  <span className={`text-[13px] ${deployStep >= 3 ? 'text-[#1a1a1a] font-bold' : 'text-[#999]'}`}>Pushing to registry...</span>
                </div>
                <div className="mt-4 text-center text-[12px] text-[#FF4400] font-bold animate-pulse">
                  Deploying... Please wait.
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-[#DCFCE7] rounded-full flex items-center justify-center mx-auto mb-2">
                  <Rocket size={32} className="text-[#16A34A]" />
                </div>
                <div className="text-[16px] font-bold text-[#16A34A]">Deployment Successful!</div>
                
                <div className="bg-white border border-[#f0ebe1] rounded-xl p-3 text-left">
                  <div className="text-[10px] text-[#999] font-bold uppercase mb-1">Endpoint URL</div>
                  <div className="flex items-center gap-2">
                    <input readOnly value="https://api.neuralforge.ai/v1/predict/xgb-781" className="bg-transparent text-[12px] w-full outline-none text-[#555] font-mono" />
                    <button className="text-[#FF4400]"><Copy size={14} /></button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <PipelineNav 
        prevLink="/dashboard/codegen" 
        prevTitle="Code Generation"
        nextLink="/dashboard/monitoring" 
        nextTitle="Monitoring" 
      />
    </div>
  );
}
