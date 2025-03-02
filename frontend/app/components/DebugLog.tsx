'use client';

import React from 'react';

interface DebugLogProps {
  debug: string[];
  isDebugVisible: boolean;
  toggleDebugVisibility: () => void;
}

export const DebugLog: React.FC<DebugLogProps> = ({
  debug,
  isDebugVisible,
  toggleDebugVisibility
}) => {
  return (
    <>
      <div className="relative">
        {isDebugVisible && debug.length > 0 && (
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
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 pt-4 pb-8">
        <p>Built for Scrapyard Flagship</p>
        <div className="mt-1 space-y-1">
          <p className="cursor-pointer hover:underline" onClick={toggleDebugVisibility}>
            {isDebugVisible ? 'Hide' : 'Show'} Debug Log (Ctrl+K)
          </p>
        </div>
      </footer>
    </>
  );
}; 