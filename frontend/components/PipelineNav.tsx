'use client';

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { usePipeline } from '@/contexts/PipelineContext';

interface PipelineNavProps {
  prevLink?: string;
  prevTitle?: string;
  nextLink?: string;
  nextTitle?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
}

export function PipelineNav({
  prevLink,
  prevTitle,
  nextLink,
  nextTitle,
  onNext,
  nextDisabled = false,
}: PipelineNavProps) {
  const { navigateWithValidation, getStageStatus, validateTransition } = usePipeline();

  const handleNext = () => {
    if (nextDisabled) return;
    if (onNext) {
      onNext();
    } else if (nextLink) {
      navigateWithValidation(nextLink);
    }
  };

  const handlePrev = () => {
    if (prevLink) {
      navigateWithValidation(prevLink);
    }
  };

  return (
    <div className="w-full mt-8 border-t border-[#f0ebe1] bg-white/50 px-8 py-4 flex justify-between items-center min-h-[70px] rounded-b-3xl">
      {/* Previous Step */}
      <div>
        {prevLink && prevTitle && (
          <button 
            onClick={handlePrev}
            className="flex items-center gap-3 text-[#888] hover:text-[#1a1a1a] transition-colors group cursor-pointer border-0 bg-transparent"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-bold tracking-wider uppercase mb-0.5">Previous</span>
              <span className="text-[13px] font-bold text-[#555] group-hover:text-[#1a1a1a] transition-colors">{prevTitle}</span>
            </div>
          </button>
        )}
      </div>

      {/* Next Step */}
      <div className="flex items-center gap-4">
        {nextLink && getStageStatus(nextLink) === 'locked' && (
          <button
            onClick={() => validateTransition(nextLink)}
            className="text-[12px] font-bold text-[#888] hover:text-[#FF4400] underline transition-colors"
          >
            Why can't I continue?
          </button>
        )}
        
        {(nextLink || onNext) && nextTitle && (
          <button 
            onClick={handleNext} 
            className={`flex items-center gap-3 text-[#FF4400] hover:text-[#E63D00] transition-colors group text-right border-0 bg-transparent ${nextDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold tracking-wider uppercase mb-0.5 opacity-80">Next Step</span>
              <span className="text-[13px] font-bold">{nextTitle}</span>
            </div>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
}
