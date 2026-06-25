'use client';

import { usePipeline } from '@/contexts/PipelineContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ValidationModal() {
  const { validationError, closeValidationModal } = usePipeline();
  const router = useRouter();

  if (!validationError || !validationError.show) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeValidationModal}
          className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.1)] w-full max-w-[440px] overflow-hidden"
        >
          {/* Header Strip */}
          <div className="h-2 bg-[#FF4400]" />
          
          <div className="p-8">
            <button 
              onClick={closeValidationModal}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#FDFBF7] text-[#999] transition-colors"
            >
              <X size={18} />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-[#FFF8F0] flex items-center justify-center mb-6">
              <Lock size={28} className="text-[#FF4400]" />
            </div>

            <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2 font-mono-heading tracking-tight">
              Almost there!
            </h2>
            
            <p className="text-[15px] text-[#555] mb-8 leading-relaxed">
              You still need to complete <strong>{validationError.requiredLabel}</strong> before proceeding to <strong>{validationError.title.replace('Please complete the ', '').replace(' first.', '')}</strong>. {validationError.message}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  closeValidationModal();
                  router.push(validationError.requiredPath);
                }}
                className="btn-coral w-full justify-center text-[15px] py-3 shadow-[0_4px_14px_rgba(255,68,0,0.3)] hover:shadow-[0_6px_20px_rgba(255,68,0,0.4)]"
              >
                Go Back to {validationError.requiredLabel}
                <ArrowRight size={18} />
              </button>
              
              <button
                onClick={closeValidationModal}
                className="w-full py-3 text-[14px] font-bold text-[#888] hover:text-[#1a1a1a] transition-colors rounded-xl"
              >
                Continue Editing
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
