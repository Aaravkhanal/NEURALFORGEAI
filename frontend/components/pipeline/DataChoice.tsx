import { motion } from 'framer-motion';
import { UploadCloud, Search, Wand2, Database, Sparkles, BrainCircuit } from 'lucide-react';

interface DataChoiceProps {
  onSelectChoice: (choice: 'upload' | 'discovery' | 'generate') => void;
}

export default function DataChoice({ onSelectChoice }: DataChoiceProps) {
  const choices = [
    {
      id: 'upload',
      title: 'Upload My Dataset',
      description: 'I already have a CSV, Excel, or Image dataset ready to use on my computer.',
      icon: <UploadCloud size={32} className="text-[#3B82F6]" />,
      bgColor: 'bg-blue-500/10',
      borderColor: 'hover:border-blue-500/50',
      shadowColor: 'hover:shadow-blue-500/20'
    },
    {
      id: 'discovery',
      title: 'Find Dataset Using AI',
      description: 'Search Kaggle, HuggingFace, and OpenML to find the perfect dataset for your goal.',
      icon: <Search size={32} className="text-[#8B5CF6]" />,
      bgColor: 'bg-purple-500/10',
      borderColor: 'hover:border-purple-500/50',
      shadowColor: 'hover:shadow-purple-500/20'
    },
    {
      id: 'generate',
      title: 'Generate Dataset',
      description: 'Use our AI to synthesize a highly realistic, custom dataset completely from scratch.',
      icon: <Wand2 size={32} className="text-[#F59E0B]" />,
      bgColor: 'bg-amber-500/10',
      borderColor: 'hover:border-amber-500/50',
      shadowColor: 'hover:shadow-amber-500/20'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full max-w-5xl mx-auto py-8">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--bg-surface)] text-[var(--color-primary)] text-xs font-bold mb-4 border border-[var(--color-primary-glow)]">
          <Database size={12} /> Step 1: Data
        </span>
        <h2 className="text-3xl font-extrabold text-[var(--text-primary)] mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
          How would you like to provide your data?
        </h2>
        <p className="text-[var(--text-secondary)] max-w-2xl mx-auto">
          NeuralForge needs data to train your model. You can upload your own, let our AI search the web for the best match, or generate a synthetic dataset from scratch.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {choices.map((choice, i) => (
          <motion.div
            key={choice.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            whileHover={{ scale: 1.03, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectChoice(choice.id as any)}
            className={`cursor-pointer rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-8 transition-all duration-300 flex flex-col items-center text-center ${choice.borderColor} ${choice.shadowColor} hover:shadow-xl relative overflow-hidden group`}
          >
            {/* Background glow effect on hover */}
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${choice.bgColor} -z-10`} />
            
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-[var(--bg-surface)] shadow-sm group-hover:scale-110 transition-transform duration-300`}>
              {choice.icon}
            </div>
            
            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-3">{choice.title}</h3>
            
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed">
              {choice.description}
            </p>

            <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
              Select Option <span className="group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
