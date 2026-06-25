'use client';

import { motion } from 'framer-motion';
import {
  Database,
  Sparkles,
  Cpu,
  Code2,
  Rocket,
  LineChart,
  Bot,
  Search,
} from 'lucide-react';

const FEATURES = [
  { icon: Bot, title: 'Problem Formulation', desc: 'Describe your goal in plain English. Our AI architect agent figures out the rest.' },
  { icon: Search, title: 'Dataset Discovery', desc: 'Automated crawling of Kaggle, Hugging Face, and UCI to find the perfect dataset.' },
  { icon: Database, title: 'Smart Cleaning', desc: 'Missing values, outliers, and encoding handled automatically with full transparency.' },
  { icon: Cpu, title: 'Model Benchmarking', desc: 'Run 15+ algorithms simultaneously and pick the best performing model.' },
  { icon: Code2, title: 'Code Generation', desc: 'Download production-ready FastAPI servers, Dockerfiles, and model weights.' },
  { icon: Rocket, title: 'One-Click Deploy', desc: 'Ship to AWS, GCP, or your own cluster with zero manual infrastructure work.' },
];

export default function FeatureCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {FEATURES.map((feature, i) => {
        const Icon = feature.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="group p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
              <Icon className="text-primary" size={22} />
            </div>
            <h3 className="font-bold text-foreground mb-2">{feature.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
