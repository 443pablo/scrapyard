import React, { useState } from 'react';

interface HttpSmartlightControlProps {
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
  toggleSmartlight: () => Promise<void>;
  turnOnSmartlight: () => Promise<void>;
  turnOffSmartlight: () => Promise<void>;
  disableSmartlight: () => Promise<void>;
  blinkSmartlight: (intervalMs: number) => Promise<void>;
}

export const HttpSmartlightControl: React.FC<HttpSmartlightControlProps> = ({
  flashlightStatus,
  toggleSmartlight,
  turnOnSmartlight,
  turnOffSmartlight,
  disableSmartlight,
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
    ""
  );
}; 