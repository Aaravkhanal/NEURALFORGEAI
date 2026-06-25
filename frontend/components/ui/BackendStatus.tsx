'use client';

import { useState, useEffect } from 'react';
import { ServerCrash } from 'lucide-react';
import { api } from '@/lib/api';

export default function BackendStatus() {
  const [isBackendDown, setIsBackendDown] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkBackend = async () => {
      try {
        await api.get('/health');
        if (mounted) setIsBackendDown(false);
      } catch (error) {
        console.error('Backend health check failed:', error);
        if (mounted) setIsBackendDown(true);
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 30000); // Check every 30s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!isBackendDown) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-red-500 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md">
      <ServerCrash className="w-4 h-4" />
      Warning: Cannot connect to NeuralForge backend. Some features may be unavailable.
    </div>
  );
}
