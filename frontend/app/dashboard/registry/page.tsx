'use client';

import { useState } from 'react';
import { Package, Download, Server, Archive, Tag, PlayCircle, MoreHorizontal } from 'lucide-react';

const MODELS = [
  { id: 'mdl_xg_102', name: 'Churn Predictor XGB', version: 'v2.1.0', stage: 'Production', acc: '89.4%', created: '2 hours ago', size: '48 MB' },
  { id: 'mdl_nn_089', name: 'Churn Predictor NN', version: 'v1.0.0', stage: 'Archived', acc: '90.1%', created: '1 week ago', size: '124 MB' },
  { id: 'mdl_rf_012', name: 'Churn Predictor RF', version: 'v1.5.0', stage: 'Staging', acc: '87.1%', created: '3 days ago', size: '85 MB' },
];

export default function RegistryPage() {
  const [downloadDropdown, setDownloadDropdown] = useState<string | null>(null);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-[#FF4400] flex items-center justify-center">
          <Package size={16} className="text-white" />
        </div>
        <h1 className="font-mono-heading text-[28px] text-[#1a1a1a]">Model Registry</h1>
      </div>
      <p className="text-[15px] text-[#888] mb-8">
        Manage model versions, lifecycle stages, and download artifacts.
      </p>

      <div className="dashed-card p-0 overflow-hidden mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#FDFBF7] border-b border-[#f0ebe1] text-[11px] font-bold text-[#999] tracking-wider uppercase" style={{ fontFamily: "'Space Mono', monospace" }}>
              <th className="px-6 py-3">Model Name</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Accuracy</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {MODELS.map((model) => (
              <tr key={model.id} className="border-b border-[#f8f4ee] hover:bg-[#FDFBF7] transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-[#1a1a1a] text-[14px] flex items-center gap-2">
                    {model.name}
                  </div>
                  <div className="text-[11px] text-[#999] font-mono mt-1">{model.id}</div>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#f0ebe1] text-[#555] text-[11px] font-bold font-mono">
                    <Tag size={10} /> {model.version}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className={`tag-pill text-[11px] px-2.5 py-1 ${
                    model.stage === 'Production' ? 'bg-[#DCFCE7] text-[#16A34A] border-transparent' :
                    model.stage === 'Staging' ? 'bg-[#FEF3C7] text-[#D97706] border-transparent' :
                    'bg-[#f0ebe1] text-[#888] border-transparent'
                  }`}>
                    {model.stage}
                  </span>
                </td>
                <td className="px-4 py-4 text-[13px] font-bold text-[#1a1a1a] font-mono">{model.acc}</td>
                <td className="px-4 py-4 text-[13px] text-[#888] font-mono">{model.size}</td>
                <td className="px-6 py-4 text-right relative">
                  <div className="flex items-center justify-end gap-2">
                    <div className="relative">
                      <button 
                        onClick={() => setDownloadDropdown(downloadDropdown === model.id ? null : model.id)}
                        className="btn-coral px-4 py-2 text-[12px] h-8 flex items-center gap-2"
                      >
                        <Download size={14} /> Download
                      </button>
                      
                      {downloadDropdown === model.id && (
                        <div className="absolute right-0 top-10 w-40 bg-white border border-[#f0ebe1] rounded-xl shadow-lg z-10 overflow-hidden text-left animate-slide-up">
                          {['PKL', 'ONNX', 'JOBLIB', 'PT'].map(ext => (
                            <div key={ext} className="px-4 py-2 text-[12px] font-bold text-[#555] hover:bg-[#FFF8F0] hover:text-[#FF4400] cursor-pointer transition-colors border-b border-[#f0ebe1] last:border-0 font-mono">
                              model.{ext.toLowerCase()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#f0ebe1] text-[#888] hover:border-[#FF4400] hover:text-[#FF4400] transition-colors">
                      <Server size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
