'use client';

import { usePipeline, PIPELINE_PATHS } from '@/contexts/PipelineContext';
import { useState, useEffect } from 'react';
import { Terminal, X, Minimize2, Maximize2 } from 'lucide-react';

export function PipelineDebugPanel() {
  const { stages, getStageStatus, validationError } = usePipeline();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 z-[9999] bg-[#1a1a1a] text-white px-3 py-1.5 rounded-lg text-[11px] font-mono shadow-xl border border-[#333] hover:bg-[#333] flex items-center gap-2 transition-colors"
      >
        <Terminal size={12} />
        Debug Pipeline
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 left-4 z-[9999] bg-[#1a1a1a] text-white rounded-xl shadow-2xl border border-[#333] overflow-hidden flex flex-col transition-all duration-200 ${isMinimized ? 'w-[320px] h-[40px]' : 'w-[400px] max-h-[600px]'}`}>
      {/* Header */}
      <div className="bg-[#222] px-4 py-2 flex items-center justify-between border-b border-[#333] shrink-0 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-[#FF4400]" />
          <span className="text-[11px] font-mono font-bold">PIPELINE DEBUG</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[#888] hover:text-white" onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}>
            {isMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
          </button>
          <button className="text-[#888] hover:text-[#EF4444]" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px]">
          <div className="mb-4 pb-4 border-b border-[#333]">
            <h3 className="text-[#FF4400] font-bold mb-2 uppercase text-[10px]">Current Stage Statuses</h3>
            <div className="space-y-1.5">
              {PIPELINE_PATHS.map((path) => {
                const status = getStageStatus(path);
                let colorClass = 'text-[#888]';
                if (status === 'completed') colorClass = 'text-[#10B981]';
                else if (status === 'in_progress') colorClass = 'text-[#F59E0B]';
                else if (status === 'not_started') colorClass = 'text-[#3B82F6]';
                else if (status === 'locked') colorClass = 'text-[#EF4444]';

                return (
                  <div key={path} className="flex items-center justify-between">
                    <span className="text-[#ccc] truncate pr-4">{path.replace('/dashboard', '') || '/'}</span>
                    <span className={`${colorClass} font-bold`}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div>
            <h3 className="text-[#FF4400] font-bold mb-2 uppercase text-[10px]">Raw State Object</h3>
            <pre className="bg-[#0a0a0a] p-3 rounded-lg overflow-x-auto text-[#aaa] leading-relaxed mb-4">
              {JSON.stringify(stages, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="text-[#FF4400] font-bold mb-2 uppercase text-[10px]">Last Validation Error</h3>
            {validationError ? (
              <div className="bg-[#451a1a] border border-[#EF4444]/30 p-3 rounded-lg text-[#EF4444]">
                <div className="font-bold mb-1">{validationError.title}</div>
                <div className="text-[10px]">{validationError.message}</div>
                <div className="mt-2 text-[9px] text-[#aaa]">Required: {validationError.requiredPath}</div>
              </div>
            ) : (
              <div className="text-[#888] italic">No validation errors recorded.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
