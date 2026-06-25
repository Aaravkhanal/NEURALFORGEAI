'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type StageStatus = 'not_started' | 'in_progress' | 'completed' | 'locked' | 'failed' | 'requires_attention';

export interface ValidationError {
  show: boolean;
  title: string;
  message: string;
  requiredPath: string;
  targetPath: string;
  requiredLabel: string;
}

interface PipelineContextType {
  stages: Record<string, StageStatus>;
  validationError: ValidationError | null;
  problemContext: any;
  problemDescription: string;
  selectedModel: string | null;
  trainedModelId: string | null;
  fileId: string | null;
  datasetProfile: any | null;
  targetColumn: string | null;
  setProblemContext: (context: any) => void;
  setProblemDescription: (desc: string) => void;
  setSelectedModel: (modelName: string | null) => void;
  setTrainedModelId: (id: string | null) => void;
  setFileId: (fileId: string | null) => void;
  setDatasetProfile: (profile: any) => void;
  setTargetColumn: (col: string | null) => void;
  markStageComplete: (path: string) => void;
  markStageInProgress: (path: string) => void;
  validateTransition: (targetPath: string) => boolean;
  closeValidationModal: () => void;
  navigateWithValidation: (targetPath: string) => void;
  getStageStatus: (path: string) => StageStatus;
}

const defaultContext: PipelineContextType = {
  stages: {},
  validationError: null,
  problemContext: null,
  problemDescription: '',
  selectedModel: null,
  trainedModelId: null,
  fileId: null,
  datasetProfile: null,
  targetColumn: null,
  setProblemContext: () => { },
  setProblemDescription: () => { },
  setSelectedModel: () => { },
  setTrainedModelId: () => { },
  setFileId: () => { },
  setDatasetProfile: () => { },
  setTargetColumn: () => { },
  markStageComplete: () => { },
  markStageInProgress: () => { },
  validateTransition: () => true,
  closeValidationModal: () => { },
  navigateWithValidation: () => { },
  getStageStatus: () => 'not_started'
};

const PipelineContext = createContext<PipelineContextType>(defaultContext);

export const usePipeline = () => useContext(PipelineContext);

const RULES: Record<string, { requires: string, label: string, errorTitle: string, errorMessage: string }> = {
  '/dashboard/datasets': {
    requires: '/dashboard/problem',
    label: 'Problem Statement',
    errorTitle: 'Please complete the Problem Statement first.',
    errorMessage: 'We need to understand your machine learning problem before searching for datasets.'
  },
  '/dashboard/cleaning': {
    requires: '/dashboard/datasets',
    label: 'Dataset Sourcing',
    errorTitle: "You haven't selected a dataset yet.",
    errorMessage: 'Please upload a dataset, search for one, or generate a synthetic dataset before proceeding to Data Cleaning.'
  },
  '/dashboard/models': {
    requires: '/dashboard/cleaning',
    label: 'Data Cleaning',
    errorTitle: 'Data Cleaning has not been completed yet.',
    errorMessage: 'Please run the cleaning pipeline before benchmarking models.'
  },
  '/dashboard/training': {
    requires: '/dashboard/models',
    label: 'Model Benchmark',
    errorTitle: 'Model Benchmarking is required before training.',
    errorMessage: 'Run benchmark tests so NeuralForge can recommend the best model for your dataset.'
  },
  '/dashboard/testing': {
    requires: '/dashboard/training',
    label: 'Model Training',
    errorTitle: 'Model Training is not complete.',
    errorMessage: 'Please train a model before testing it interactively.'
  },
  '/dashboard/codegen': {
    requires: '/dashboard/testing',
    label: 'Model Testing',
    errorTitle: 'Model Testing is not complete.',
    errorMessage: 'Please test your trained model before generating production code.'
  },
  '/dashboard/deployment': {
    requires: '/dashboard/training',
    label: 'Model Training',
    errorTitle: 'No trained model found.',
    errorMessage: 'Please train a model before attempting deployment.'
  },
  '/dashboard/monitoring': {
    requires: '/dashboard/deployment',
    label: 'Deployment',
    errorTitle: 'Monitoring becomes available after deployment.',
    errorMessage: 'Deploy your model first to access live monitoring and metrics.'
  }
};

export const PIPELINE_PATHS = [
  '/dashboard/problem',
  '/dashboard/datasets',
  '/dashboard/cleaning',
  '/dashboard/models',
  '/dashboard/training',
  '/dashboard/testing',
  '/dashboard/codegen',
  '/dashboard/deployment',
  '/dashboard/monitoring'
];

export function PipelineProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const [stages, setStages] = useState<Record<string, StageStatus>>(() => {
    // Attempt to load from localStorage first for Project Autosave
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neuralforge_pipeline_stages');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse saved pipeline stages", e);
        }
      }
    }

    // Initial state: first stage is 'not_started', all others are 'locked' by default
    const initial: Record<string, StageStatus> = {};
    PIPELINE_PATHS.forEach((path, i) => {
      initial[path] = i === 0 ? 'not_started' : 'locked';
    });
    return initial;
  });

  const [validationError, setValidationError] = useState<ValidationError | null>(null);

  const [problemContext, setProblemContextState] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neuralforge_problem_context');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return null;
  });

  const [problemDescription, setProblemDescriptionState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neuralforge_problem_description') || '';
    }
    return '';
  });

  const [selectedModel, setSelectedModelState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neuralforge_selected_model') || null;
    }
    return null;
  });

  const [trainedModelId, setTrainedModelIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neuralforge_trained_model_id') || null;
    }
    return null;
  });

  const [fileId, setFileIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neuralforge_file_id') || null;
    }
    return null;
  });

  const [datasetProfile, setDatasetProfileState] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neuralforge_dataset_profile');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return null;
  });

  const [targetColumn, setTargetColumnState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('neuralforge_target_column') || null;
    }
    return null;
  });

  const setProblemContext = React.useCallback((context: any) => {
    setProblemContextState(context);
    if (typeof window !== 'undefined') {
      localStorage.setItem('neuralforge_problem_context', JSON.stringify(context));
    }
  }, []);

  const setProblemDescription = React.useCallback((desc: string) => {
    setProblemDescriptionState(desc);
    if (typeof window !== 'undefined') {
      localStorage.setItem('neuralforge_problem_description', desc);
    }
  }, []);

  const setSelectedModel = React.useCallback((modelName: string | null) => {
    setSelectedModelState(modelName);
    if (typeof window !== 'undefined') {
      if (modelName) localStorage.setItem('neuralforge_selected_model', modelName);
      else localStorage.removeItem('neuralforge_selected_model');
    }
  }, []);

  const setTrainedModelId = React.useCallback((id: string | null) => {
    setTrainedModelIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('neuralforge_trained_model_id', id);
      else localStorage.removeItem('neuralforge_trained_model_id');
    }
  }, []);

  const setFileId = React.useCallback((id: string | null) => {
    setFileIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem('neuralforge_file_id', id);
      else localStorage.removeItem('neuralforge_file_id');
    }
  }, []);

  const setDatasetProfile = React.useCallback((profile: any) => {
    setDatasetProfileState(profile);
    if (typeof window !== 'undefined') {
      if (profile) localStorage.setItem('neuralforge_dataset_profile', JSON.stringify(profile));
      else localStorage.removeItem('neuralforge_dataset_profile');
    }
  }, []);

  const setTargetColumn = React.useCallback((col: string | null) => {
    setTargetColumnState(col);
    if (typeof window !== 'undefined') {
      if (col) localStorage.setItem('neuralforge_target_column', col);
      else localStorage.removeItem('neuralforge_target_column');
    }
  }, []);

  // Helper to recalculate stage locks purely
  const recalculateLocks = (currentStages: Record<string, StageStatus>) => {
    const next = { ...currentStages };
    let changed = false;

    PIPELINE_PATHS.forEach((path) => {
      const rule = RULES[path];
      if (rule) {
        const reqStatus = currentStages[rule.requires];
        const isCurrentlyLocked = currentStages[path] === 'locked';
        const shouldBeLocked = reqStatus !== 'completed';

        if (isCurrentlyLocked && !shouldBeLocked) {
          next[path] = 'not_started';
          changed = true;
        } else if (!isCurrentlyLocked && shouldBeLocked) {
          next[path] = 'locked';
          changed = true;
        }
      }
    });

    return changed ? next : currentStages;
  };

  // Initial recalculation once on mount
  useEffect(() => {
    setStages(prev => recalculateLocks(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave hook
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('neuralforge_pipeline_stages', JSON.stringify(stages));
    }
  }, [stages]);

  const markStageComplete = React.useCallback((path: string) => {
    setStages(prev => recalculateLocks({ ...prev, [path]: 'completed' }));
  }, []);

  const markStageInProgress = React.useCallback((path: string) => {
    setStages(prev => {
      if (prev[path] === 'completed') return prev; // Don't downgrade
      return { ...prev, [path]: 'in_progress' };
    });
  }, []);

  const getStageStatus = React.useCallback((path: string): StageStatus => {
    return stages[path] || 'not_started';
  }, [stages]);

  const validateTransition = React.useCallback((targetPath: string): boolean => {
    const rule = RULES[targetPath];
    if (!rule) return true; // No prerequisites

    if (stages[rule.requires] !== 'completed') {
      setValidationError({
        show: true,
        title: rule.errorTitle,
        message: rule.errorMessage,
        requiredPath: rule.requires,
        targetPath,
        requiredLabel: rule.label
      });
      return false;
    }

    return true;
  }, [stages]);

  const closeValidationModal = React.useCallback(() => {
    setValidationError(null);
  }, []);

  const navigateWithValidation = React.useCallback((targetPath: string) => {
    if (validateTransition(targetPath)) {
      router.push(targetPath);
    }
  }, [validateTransition, router]);

  const contextValue = React.useMemo(() => ({
    stages,
    validationError,
    problemContext,
    problemDescription,
    selectedModel,
    trainedModelId,
    fileId,
    datasetProfile,
    targetColumn,
    setProblemContext,
    setProblemDescription,
    setSelectedModel,
    setTrainedModelId,
    setFileId,
    setDatasetProfile,
    setTargetColumn,
    markStageComplete,
    markStageInProgress,
    validateTransition,
    closeValidationModal,
    navigateWithValidation,
    getStageStatus
  }), [
    stages,
    validationError,
    problemContext,
    problemDescription,
    selectedModel,
    trainedModelId,
    fileId,
    datasetProfile,
    targetColumn,
    setProblemContext,
    setProblemDescription,
    setSelectedModel,
    setTrainedModelId,
    setFileId,
    setDatasetProfile,
    setTargetColumn,
    markStageComplete,
    markStageInProgress,
    validateTransition,
    closeValidationModal,
    navigateWithValidation,
    getStageStatus
  ]);

  return (
    <PipelineContext.Provider value={contextValue}>
      {children}
    </PipelineContext.Provider>
  );
}
