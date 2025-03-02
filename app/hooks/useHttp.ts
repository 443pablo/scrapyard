import React, { useCallback } from 'react';

// Connect to the ESP32 HTTP server
const connectToDevice = useCallback(async (ip: string): Promise<void> => {
  try {
    setIsConnecting(true);
    setError(null);
    
    // Store the IP address
    setIpAddress(ip);
    
    // Consider connection established without checking status
    addDebug('HTTP connection established');
    setIsConnected(true);
    
  } catch (e) {
    setIsConnected(false);
    handleError('Failed to connect to device', e);
  } finally {
    setIsConnecting(false);
  }
}, [addDebug, handleError]); 