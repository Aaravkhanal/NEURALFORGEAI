'use client';

import { motion } from 'framer-motion';

export default function DashboardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative w-full max-w-[700px]"
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
        {/* Title bar */}
        <div className="h-10 bg-muted/50 border-b border-border flex items-center px-4 gap-2">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <span className="ml-4 text-xs text-muted-foreground font-mono">NeuralForge Dashboard</span>
        </div>

        {/* Content mock */}
        <div className="p-6 space-y-4">
          <div className="flex gap-3">
            <div className="w-16 h-full bg-muted rounded-lg p-2 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`w-full h-2 rounded ${i === 0 ? 'bg-primary' : 'bg-border'}`} />
              ))}
            </div>
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {['94.2%', '48ms', '0.02'].map((val, i) => (
                  <div key={i} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                      {['Accuracy', 'Latency', 'Drift'][i]}
                    </div>
                    <div className="text-lg font-bold text-foreground">{val}</div>
                  </div>
                ))}
              </div>
              <div className="bg-muted/30 border border-border rounded-lg p-4 h-32 flex items-end gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-primary/60 rounded-t"
                    style={{ height: `${20 + Math.random() * 80}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div className="absolute -inset-4 bg-primary/5 rounded-3xl blur-3xl -z-10" />
    </motion.div>
  );
}
