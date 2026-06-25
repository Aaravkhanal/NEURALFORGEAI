'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, PlayCircle } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoModal({ isOpen, onClose }: VideoModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-black rounded-3xl shadow-2xl w-full max-w-5xl aspect-video overflow-hidden border border-slate-700/50 flex flex-col items-center justify-center"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors z-10 bg-black/40 rounded-full p-2"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="flex flex-col items-center text-white/50 space-y-4">
              <PlayCircle className="w-16 h-16 animate-pulse" />
              <p className="font-medium text-lg">Product demo video coming soon...</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
