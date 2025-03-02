import React, { useState } from 'react';

interface HttpSmartlightControlProps {
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
  toggleSmartlight: () => Promise<void>;
  turnOnSmartlight: () => Promise<void>;
  turnOffSmartlight: () => Promise<void>;
  blinkSmartlight: (intervalMs: number) => Promise<void>;
}

export const HttpSmartlightControl: React.FC<HttpSmartlightControlProps> = ({
  flashlightStatus,
  toggleSmartlight,
  turnOnSmartlight,
  turnOffSmartlight,
  blinkSmartlight,
}) => {
  const [blinkInterval, setBlinkInterval] = useState('1000');
  const [isBlinking, setIsBlinking] = useState(false);
  
  const handleBlinkStart = () => {
    const interval = parseInt(blinkInterval);
    if (!isNaN(interval) && interval > 0) {
      setIsBlinking(true);
      blinkSmartlight(interval).then(() => {
        setTimeout(() => setIsBlinking(false), 2000);
      });
    }
  };
  
  // If flashlight isn't available, show a message
  if (!flashlightStatus.available) {
    return (
      <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Smartlight Control</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Smartlight is not available on this device.
        </p>
      </div>
    );
  }
  
  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Smartlight Control</h2>
      
      <div className="flex flex-col space-y-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded">
          <span className="text-gray-700 dark:text-gray-300">Status</span>
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${flashlightStatus.on ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <span className={`font-medium ${flashlightStatus.on ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {flashlightStatus.on ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
        
        {/* Control buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={turnOnSmartlight}
            disabled={flashlightStatus.on}
            className={`py-2 rounded-lg font-medium transition-colors ${
              flashlightStatus.on 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                : 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800'
            }`}
          >
            Turn On
          </button>
          
          <button
            onClick={turnOffSmartlight}
            disabled={!flashlightStatus.on}
            className={`py-2 rounded-lg font-medium transition-colors ${
              !flashlightStatus.on 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500' 
                : 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800'
            }`}
          >
            Turn Off
          </button>
        </div>
        
        <button
          onClick={toggleSmartlight}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Toggle Smartlight
        </button>
        
        {/* Blink control */}
        <div className="mt-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h3 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Blink Control</h3>
          
          <div className="flex space-x-2">
            <input
              type="text"
              value={blinkInterval}
              onChange={(e) => setBlinkInterval(e.target.value)}
              placeholder="Interval (ms)"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            
            <button
              onClick={handleBlinkStart}
              disabled={isBlinking}
              className={`px-3 rounded-lg transition-colors ${
                isBlinking
                  ? 'bg-purple-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white`}
            >
              Blink
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Enter interval in milliseconds (e.g., 1000 = 1 second)
          </p>
        </div>
      </div>
    </div>
  );
}; 