export interface NvidiaModel {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
}

export const NVIDIA_MODELS: NvidiaModel[] = [
  {
    id: 'meta/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    description: 'High-performance, reasoning-focused model. Ideal for complex ML agent tasks.',
    bestFor: ['Reasoning', 'Code Generation', 'Agent Routing'],
  },
  {
    id: 'meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    description: 'Fast and lightweight model. Great for quick summaries and basic tasks.',
    bestFor: ['Summarization', 'Fast Inference'],
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct',
    description: 'Latest 70B model with improved reasoning and coding capabilities.',
    bestFor: ['Advanced Reasoning', 'Complex Code'],
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'Nemotron 70B Instruct',
    description: 'NVIDIA-tuned variant optimized for helpfulness and instruction following.',
    bestFor: ['Instruction Following', 'Chat'],
  },
  {
    id: 'mistralai/mixtral-8x7b-instruct-v0.1',
    name: 'Mixtral 8x7B',
    description: 'Sparse mixture of experts model offering great balance of speed and performance.',
    bestFor: ['Diverse Tasks', 'Creative Generation'],
  },
  {
    id: 'microsoft/phi-3-medium-128k-instruct',
    name: 'Phi-3 Medium',
    description: 'Powerful medium-sized model with massive 128k context window.',
    bestFor: ['Long Context', 'Document Analysis'],
  }
];

export const DEFAULT_MODEL_ID = 'meta/llama-3.1-70b-instruct';
