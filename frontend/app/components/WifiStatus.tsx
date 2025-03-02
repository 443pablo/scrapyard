'use client';

import React from 'react';

interface WifiStatusProps {
  wifiStatus: {
    connected: boolean;
    ip?: string;
    message?: string;
  } | null;
}

export const WifiStatus: React.FC<WifiStatusProps> = ({ wifiStatus }) => {
  if (!wifiStatus) {
    return null;
  }

  return (
    <div className={`mb-6 p-4 ${wifiStatus.connected ? 
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'} rounded-lg`}>
      <h3 className="font-medium mb-2">WiFi Status</h3>
      <p>{wifiStatus.connected ? 'Connected' : 'Disconnected'}</p>
      {wifiStatus.message && <p className="text-sm mt-1">{wifiStatus.message}</p>}
      {wifiStatus.ip && <p className="font-mono text-sm mt-1">IP: {wifiStatus.ip}</p>}
    </div>
  );
}; 