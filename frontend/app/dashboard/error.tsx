'use client'; // Error boundaries must be Client Components

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-fade-in bg-white border border-red-100 rounded-2xl m-6">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <AlertCircle size={32} className="text-red-500" />
      </div>
      
      <h2 className="text-[24px] font-mono-heading text-[#1a1a1a] mb-2">Module Error Detected</h2>
      <p className="text-[15px] text-[#555] mb-8 max-w-md">
        An error occurred while loading this part of the application. The rest of the dashboard remains fully functional.
      </p>

      <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-8 max-w-lg w-full overflow-hidden text-left">
        <p className="text-[13px] font-mono text-red-800 break-all">
          {error.message || "Unknown rendering error occurred"}
        </p>
      </div>

      <button
        onClick={() => reset()}
        className="btn-coral flex items-center gap-2"
      >
        <RefreshCw size={16} /> Attempt Recovery
      </button>
    </div>
  );
}
