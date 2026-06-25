'use client';

import { useState, useRef, useEffect } from 'react';
import { NVIDIA_MODELS, NvidiaModel } from '@/lib/nvidia-models';
import { ChevronDown, Cpu, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModelSelectorProps {
  selectedModelId: string;
  onModelSelect: (modelId: string) => void;
  className?: string;
}

export default function ModelSelector({ selectedModelId, onModelSelect, className = '' }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = NVIDIA_MODELS.find(m => m.id === selectedModelId) || NVIDIA_MODELS[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium transition-all bg-white border border-slate-200 rounded-xl hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          <Cpu className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="truncate text-slate-700">{selectedModel.name}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-64 md:w-80 p-2 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl top-full right-0 lg:left-0"
            role="listbox"
          >
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              <div className="px-2 py-1 mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">
                NVIDIA NIM Models
              </div>
              {NVIDIA_MODELS.map((model) => {
                const isSelected = model.id === selectedModelId;
                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelSelect(model.id);
                      setIsOpen(false);
                    }}
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left flex flex-col p-2 rounded-lg transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                        {model.name}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                    </div>
                    <span className="text-[11px] leading-tight text-slate-500 mb-1.5">
                      {model.description}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {model.bestFor.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[9px] font-medium bg-slate-100 text-slate-600 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
