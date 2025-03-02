'use client';

import React from 'react';

interface FlashlightControlProps {
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
  toggleFlashlight: () => Promise<void>;
}

export const FlashlightControl: React.FC<FlashlightControlProps> = ({
  flashlightStatus,
  toggleFlashlight
}) => {
  return (
    <div className="mb-6">
      <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <h3 className="font-medium mb-3 text-gray-900 dark:text-white">Flashlight Control</h3>
        
        {flashlightStatus.available ? (
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-full mb-3 flex items-center justify-center ${
              flashlightStatus.on 
                ? 'bg-yellow-300 shadow-lg shadow-yellow-200 dark:shadow-yellow-900/30' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}>
              <svg 
                className={`w-10 h-10 ${flashlightStatus.on ? 'text-yellow-600' : 'text-gray-500 dark:text-gray-400'}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                />
              </svg>
            </div>
            
            <button
              onClick={toggleFlashlight}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {flashlightStatus.on ? 'Turn Off Flashlight' : 'Turn On Flashlight'}
            </button>
            
            <p className="mt-3 text-sm text-center text-gray-600 dark:text-gray-400">
              Flashlight is currently {flashlightStatus.on ? 'ON' : 'OFF'}
            </p>
          </div>
        ) : (
          <p className="text-center text-gray-600 dark:text-gray-400">
            Flashlight feature is not available on this device.
          </p>
        )}
      </div>
    </div>
  );
}; 