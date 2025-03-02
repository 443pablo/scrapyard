'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { WebSocketState, WebSocketServices, WebSocketResponse } from '../types/websocket';
import { 
  WEBSOCKET_PATH, 
  WEBSOCKET_RECONNECT_INTERVAL, 
  WEBSOCKET_MAX_RECONNECT_ATTEMPTS,
  WEBSOCKET_IP_ADDRESS,
  WEBSOCKET_PORT
} from '../constants';
import { useDebug } from './useDebug';

export const useWebSocket = (): WebSocketState & WebSocketServices => {
  // WebSocket state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ipAddress, setIpAddress] = useState<string | null>(null);
  const [flashlightStatus, setFlashlightStatus] = useState<{
    on: boolean;
    available: boolean;
  }>({ on: false, available: true });

  // WebSocket reference
  const webSocketRef = useRef<WebSocket | null>(null);
  
  // Reconnection attempts tracking
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get debug functionality
  const { addDebug } = useDebug();

  // Cleanup function for websocket connection
  const cleanupWebSocket = useCallback(() => {
    if (webSocketRef.current) {
      addDebug('Closing WebSocket connection');
      
      // Remove all event listeners to avoid memory leaks
      webSocketRef.current.onopen = null;
      webSocketRef.current.onclose = null;
      webSocketRef.current.onerror = null;
      webSocketRef.current.onmessage = null;
      
      // Close the connection
      if (webSocketRef.current.readyState === WebSocket.OPEN || 
          webSocketRef.current.readyState === WebSocket.CONNECTING) {
        webSocketRef.current.close();
      }
      
      webSocketRef.current = null;
    }
    
    // Clear any reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, [addDebug]);

  // Disconnect WebSocket when component unmounts
  useEffect(() => {
    return () => {
      cleanupWebSocket();
    };
  }, [cleanupWebSocket]);

  // Function to handle WebSocket messages
  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as WebSocketResponse;
      addDebug(`WebSocket message received: ${JSON.stringify(data)}`);
      
      // Update flashlight status if included in the response
      if (data.flashlight !== undefined) {
        setFlashlightStatus(prev => ({
          ...prev,
          on: Boolean(data.flashlight)
        }));
      }
      
      // Handle any errors
      if (data.status === 'error') {
        setError(data.message);
        addDebug(`WebSocket error: ${data.message}`);
      } else {
        // Clear any previous errors on success
        setError(null);
      }
    } catch (e) {
      addDebug(`Error parsing WebSocket message: ${e}`);
      console.error('Failed to parse WebSocket message:', e);
    }
  }, [addDebug]);

  // Function to send messages to the WebSocket server
  const sendMessage = async (message: string | Record<string, unknown>): Promise<boolean> => {
    try {
      if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) {
        const errorMsg = "WebSocket not connected. Please connect first.";
        addDebug(errorMsg);
        setError(errorMsg);
        return false;
      }
      
      // Prepare the message
      const messageString = typeof message === 'string' ? message : JSON.stringify(message);
      
      addDebug(`Sending WebSocket message: ${messageString}`);
      
      // Send the message
      webSocketRef.current.send(messageString);
      return true;
    } catch (e) {
      const errorMsg = `Error sending WebSocket message: ${e}`;
      addDebug(errorMsg);
      setError(errorMsg);
      return false;
    }
  };

  // Connect to the WebSocket server
  const connectToWebSocket = async (ip: string = `${WEBSOCKET_IP_ADDRESS}:${WEBSOCKET_PORT !== 80 ? WEBSOCKET_PORT : ''}`): Promise<void> => {
    try {
      // Clean up any existing connection
      cleanupWebSocket();
      
      // Reset connection state
      setIsConnecting(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
      
      // Store the IP address
      setIpAddress(ip);
      
      // Initiate WebSocket connection
      const wsUrl = `ws://${ip}${WEBSOCKET_PATH}`;
      addDebug(`Connecting to WebSocket at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl);
      webSocketRef.current = ws;
      
      // Set up WebSocket event handlers
      ws.onopen = () => {
        addDebug('WebSocket connection established');
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttemptsRef.current = 0;
        
        // Request initial flashlight status after connection
        getFlashlightStatus();
      };
      
      ws.onclose = (event) => {
        if (isConnected) {
          addDebug(`WebSocket connection closed: ${event.code} ${event.reason}`);
          setIsConnected(false);
          
          // Attempt to reconnect if not intentionally closed
          if (!event.wasClean && reconnectAttemptsRef.current < WEBSOCKET_MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current += 1;
            addDebug(`Attempting to reconnect (${reconnectAttemptsRef.current}/${WEBSOCKET_MAX_RECONNECT_ATTEMPTS})...`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (ipAddress) {
                connectToWebSocket(ipAddress);
              }
            }, WEBSOCKET_RECONNECT_INTERVAL);
          } else if (reconnectAttemptsRef.current >= WEBSOCKET_MAX_RECONNECT_ATTEMPTS) {
            setError(`Failed to reconnect after ${WEBSOCKET_MAX_RECONNECT_ATTEMPTS} attempts`);
          }
        }
      };
      
      ws.onerror = (event) => {
        addDebug(`WebSocket error: ${JSON.stringify(event)}`);
        setError('WebSocket connection error');
        setIsConnecting(false);
      };
      
      ws.onmessage = handleWebSocketMessage;
      
    } catch (e) {
      addDebug(`Error connecting to WebSocket: ${e}`);
      setError(`Failed to connect: ${e}`);
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  // Disconnect from the WebSocket server
  const disconnectWebSocket = () => {
    addDebug('Disconnecting from WebSocket...');
    setIsConnected(false);
    cleanupWebSocket();
  };

  // Function to toggle the flashlight
  const toggleFlashlight = async (): Promise<void> => {
    const success = await sendMessage({ command: 'toggle_flashlight' });
    if (!success) {
      addDebug('Failed to toggle flashlight');
    }
  };

  // Function to turn on the flashlight
  const turnOnFlashlight = async (): Promise<void> => {
    const success = await sendMessage({ command: 'on' });
    if (!success) {
      addDebug('Failed to turn on flashlight');
    }
  };

  // Function to turn off the flashlight
  const turnOffFlashlight = async (): Promise<void> => {
    const success = await sendMessage({ command: 'off' });
    if (!success) {
      addDebug('Failed to turn off flashlight');
    }
  };

  // Function to make the flashlight blink
  const blinkFlashlight = async (intervalMs: number): Promise<void> => {
    const success = await sendMessage({ blink: intervalMs.toString() });
    if (!success) {
      addDebug('Failed to start flashlight blinking');
    }
  };

  // Function to get the flashlight status
  const getFlashlightStatus = async (): Promise<void> => {
    const success = await sendMessage({ command: 'flashlight_status' });
    if (!success) {
      addDebug('Failed to get flashlight status');
    }
  };

  return {
    isConnected,
    isConnecting,
    error,
    flashlightStatus,
    ipAddress,
    connectToWebSocket,
    disconnectWebSocket,
    toggleFlashlight,
    turnOnFlashlight,
    turnOffFlashlight,
    blinkFlashlight,
    getFlashlightStatus,
    sendMessage,
  };
};