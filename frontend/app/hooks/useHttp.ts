'use client';

import { useState, useCallback } from 'react';
import { 
  HttpState, 
  HttpServices,
  HttpResponse 
} from '../types/http';
import { useDebug } from './useDebug';

export const useHttp = (): HttpState & HttpServices => {
  // HTTP state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [flashlightStatus, setFlashlightStatus] = useState<{
    on: boolean;
    available: boolean;
  }>({ on: false, available: true });

  // Get debug functionality
  const { addDebug } = useDebug();

  // Helper function to handle errors
  const handleError = useCallback((message: string, error: Error | unknown) => {
    const errorMsg = `${message}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    addDebug(errorMsg);
    setError(errorMsg);
    return false;
  }, [addDebug]);

  // Helper function to make HTTP requests
  const makeRequest = useCallback(async <T>(endpoint: string, method: 'GET' = 'GET'): Promise<T | null> => {
    if (!ipAddress) {
      addDebug('No IP address set. Please connect first.');
      return null;
    }

    try {
      const url = `http://${ipAddress}${endpoint}`;
      addDebug(`Making ${method} request to ${url}`);
      
      setIsConnecting(true);
      const response = await fetch(url, { method });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json() as T;
      setIsConnecting(false);
      setIsConnected(true);
      setError(null);
      return data;
    } catch (e) {
      setIsConnecting(false);
      handleError(`Failed to ${method} ${endpoint}`, e);
      return null;
    }
  }, [ipAddress, addDebug, handleError]);

  // Connect to the ESP32 HTTP server
  const connectToDevice = useCallback(async (ip: string): Promise<void> => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Store the IP address
      setIpAddress(ip);
      
      // Test the connection by getting flashlight status
      const status = await makeRequest<HttpResponse>('/flashlight/status');
      
      if (status) {
        addDebug('HTTP connection established');
        setIsConnected(true);
        
        // Update flashlight status
        if (status.flashlight !== undefined) {
          setFlashlightStatus(prev => ({
            ...prev,
            on: Boolean(status.flashlight)
          }));
        }
      } else {
        throw new Error('Failed to get flashlight status');
      }
    } catch (e) {
      setIsConnected(false);
      handleError('Failed to connect to device', e);
    } finally {
      setIsConnecting(false);
    }
  }, [addDebug, makeRequest, handleError]);

  // Function to toggle the flashlight
  const toggleFlashlight = useCallback(async (): Promise<void> => {
    const response = await makeRequest<HttpResponse>('/flashlight/toggle');
    
    if (response && response.flashlight !== undefined) {
      setFlashlightStatus(prev => ({
        ...prev,
        on: Boolean(response.flashlight)
      }));
      addDebug(`Toggled flashlight: ${response.flashlight ? 'ON' : 'OFF'}`);
    }
  }, [makeRequest, addDebug]);

  // Function to turn on the flashlight
  const turnOnFlashlight = useCallback(async (): Promise<void> => {
    const response = await makeRequest<HttpResponse>('/flashlight/on');
    
    if (response && response.flashlight !== undefined) {
      setFlashlightStatus(prev => ({
        ...prev,
        on: Boolean(response.flashlight)
      }));
      addDebug(`Turned flashlight ON`);
    }
  }, [makeRequest, addDebug]);

  // Function to turn off the flashlight
  const turnOffFlashlight = useCallback(async (): Promise<void> => {
    const response = await makeRequest<HttpResponse>('/flashlight/off');
    
    if (response && response.flashlight !== undefined) {
      setFlashlightStatus(prev => ({
        ...prev,
        on: Boolean(response.flashlight)
      }));
      addDebug(`Turned flashlight OFF`);
    }
  }, [makeRequest, addDebug]);

  // Function to make the flashlight blink
  const blinkFlashlight = useCallback(async (intervalMs: number): Promise<void> => {
    const response = await makeRequest<HttpResponse>(`/flashlight/blink?interval=${intervalMs}`);
    
    if (response) {
      addDebug(`Started flashlight blinking (interval: ${intervalMs}ms)`);
    }
  }, [makeRequest, addDebug]);

  // Function to get the flashlight status
  const getFlashlightStatus = useCallback(async (): Promise<void> => {
    const response = await makeRequest<HttpResponse>('/flashlight/status');
    
    if (response && response.flashlight !== undefined) {
      setFlashlightStatus(prev => ({
        ...prev,
        on: Boolean(response.flashlight)
      }));
      addDebug(`Flashlight status: ${response.flashlight ? 'ON' : 'OFF'}`);
    }
  }, [makeRequest, addDebug]);

  // Disconnect (simply reset state since HTTP is stateless)
  const disconnectDevice = useCallback(() => {
    addDebug('Disconnecting HTTP client');
    setIsConnected(false);
    setIpAddress(null);
  }, [addDebug]);

  return {
    isConnected,
    isConnecting,
    error,
    flashlightStatus,
    ipAddress,
    connectToDevice,
    disconnectDevice,
    toggleFlashlight,
    turnOnFlashlight,
    turnOffFlashlight,
    blinkFlashlight,
    getFlashlightStatus
  };
}; 