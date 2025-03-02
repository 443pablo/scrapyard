import React, { useState } from 'react';
import { WEBSOCKET_IP_ADDRESS, WEBSOCKET_PORT } from '../constants';

interface WebSocketConnectionProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  ipAddress: string | null;
  connectToWebSocket: (ipAddress: string) => Promise<void>;
  disconnectWebSocket: () => void;
}

export const WebSocketConnection: React.FC<WebSocketConnectionProps> = ({
  isConnected,
  isConnecting,
  error,
  ipAddress,
  connectToWebSocket,
  disconnectWebSocket,
}) => {
  const [inputIp, setInputIp] = useState(ipAddress || WEBSOCKET_IP_ADDRESS);
  const [port, setPort] = useState(WEBSOCKET_PORT.toString());
  
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputIp) return;
    
    // Format IP with port
    const formattedAddress = port && port !== '80' 
      ? `${inputIp}:${port}` 
      : inputIp;
      
    connectToWebSocket(formattedAddress);
  };
  
  return (
    <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
        WebSocket Connection
      </h2>
      
      {isConnected ? (
        <div className="mb-4">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-green-600 dark:text-green-400 font-medium">
              Connected to {ipAddress}
            </span>
          </div>
          
          <button
            onClick={disconnectWebSocket}
            className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3">
          <div>
            <label htmlFor="ip-address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ESP32 IP Address
            </label>
            <input
              id="ip-address"
              type="text"
              placeholder="192.168.1.10"
              value={inputIp}
              onChange={(e) => setInputIp(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
          
          <div>
            <label htmlFor="port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Port (optional)
            </label>
            <input
              id="port"
              type="text"
              placeholder="80"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          
          <button
            type="submit"
            disabled={isConnecting}
            className={`w-full py-2 px-4 ${
              isConnecting 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white rounded transition-colors`}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
          
          {error && (
            <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </form>
      )}
    </div>
  );
}; 