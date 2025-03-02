'use client';

import React from 'react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isConnecting: boolean;
  deviceName?: string;
  error: string | null;
  successMessage: string | null;
  isBluetoothSupported: boolean;
  isSpeechSupported: boolean;
  connectToDevice: () => Promise<void>;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isConnecting,
  deviceName,
  error,
  successMessage,
  isBluetoothSupported,
  isSpeechSupported,
  connectToDevice
}) => {
  return (
    <>
      {!isBluetoothSupported && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm">
          <p>Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or another compatible browser.</p>
        </div>
      )}

      {!isSpeechSupported && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm">
          <p>Speech recognition is not supported in this browser. Please use Chrome. Yes, only Chrome on desktop works.</p>
        </div>
      )}

      {/* Device Connection Status */}
      <div className="mb-6">
        {isConnected ? (
          <div className="p-4 bg-green-100  text-green-700  rounded-lg text-sm">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">Connected to {deviceName || 'device'}</span>
              <button 
                onClick={connectToDevice} 
                className="ml-2 text-xs text-blue-600 hover:underline"
                title="Try to reconnect if the connection seems broken"
              >
                Reconnect
              </button>
            </div>
            {successMessage && <p className="mt-2">{successMessage}</p>}
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>{error}</p>
          </div>
        ) : null}
      </div>

      {!isConnected && (
        <button
          onClick={connectToDevice}
          disabled={isConnecting || !isBluetoothSupported}
          className="w-full py-3 px-4 bg-[url(/no-hover.png)] hover:bg-[url(/hover.jpg)] bg-contain text-black font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? 'Pairing...' : 'Pair Smartlight'}
        </button>
      )}
    </>
  );
}; 