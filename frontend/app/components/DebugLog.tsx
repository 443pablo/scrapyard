'use client';

import React from 'react';

interface DebugLogProps {
  debug: string[];
  isDebugVisible: boolean;
  toggleDebugVisibility: () => void;
  autoClearTranscript: boolean;
  toggleAutoClearTranscript: () => void;
}

export const DebugLog: React.FC<DebugLogProps> = ({
  debug,
  isDebugVisible,
  toggleDebugVisibility,
  autoClearTranscript,
  toggleAutoClearTranscript
}) => {
  if (debug.length === 0) {
    return null;
  }

  return (
    <>
      <div className="relative">
        {isDebugVisible && (
          <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-mono overflow-auto max-h-60">
            <h3 className="text-sm font-semibold mb-2">Debug Log:</h3>
            <ul className="space-y-1">
              {debug.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Powered by Gemini AI</p>
        <div className="mt-1 space-y-1">
          <p className="cursor-pointer hover:underline" onClick={toggleDebugVisibility}>
            {isDebugVisible ? 'Hide' : 'Show'} Debug Log (Ctrl+K)
          </p>
          <p className="cursor-pointer hover:underline" onClick={toggleAutoClearTranscript}>
            Auto-clear on pause: {autoClearTranscript ? 'ON' : 'OFF'} (Ctrl+L)
          </p>
        </div>
      </footer>
    </>
  );
}; 