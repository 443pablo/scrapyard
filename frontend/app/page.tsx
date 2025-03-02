"use client";

import { useState, useEffect, useCallback } from "react";
import { 
  ConnectionStatus, 
  GeminiChat, 
  DebugLog,
  WifiStatus,
  WebSocketFlashlightControl
} from "./components";
import { 
  useBluetooth, 
  useSpeech, 
  useGemini, 
  useDebug,
  useWebSocket
} from "./hooks";
import { 
  DEFAULT_DEVICE_NAME_PREFIX, 
  DEFAULT_SYSTEM_PROMPT,
  WEBSOCKET_PORT 
} from "./constants";

export default function Home() {
  // Get environment variables
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Device Setup';
  const deviceNamePrefix = process.env.NEXT_PUBLIC_DEVICE_NAME_PREFIX || DEFAULT_DEVICE_NAME_PREFIX;
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const geminiModel = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-pro';
  const systemPrompt = process.env.NEXT_PUBLIC_GEMINI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
  
  // Initialize debug hook
  const { debug, isDebugVisible, addDebug, toggleDebugVisibility } = useDebug();
  
  // Initialize Bluetooth hook
  const bluetooth = useBluetooth(deviceNamePrefix);
  
  // Initialize WebSocket hook
  const websocket = useWebSocket();
  
  // Initialize Gemini hook
  const gemini = useGemini({
    apiKey: geminiApiKey,
    model: geminiModel,
    systemPrompt: systemPrompt
  });
  
  // Initialize Speech hook with callback to send to Gemini
  const speech = useSpeech(gemini.sendToGemini);
  
  // State for controlling AI interface visibility regardless of connection status
  const [isAiInterfaceVisible, setIsAiInterfaceVisible] = useState(false);
  
  // State for WebSocket connection retries
  const [wsRetryCount, setWsRetryCount] = useState(0);
  const MAX_RETRY_COUNT = 3;
  const RETRY_DELAY_MS = 3000;
  
  // Helper to determine if we're connected using either method
  const isConnectedAny = bluetooth.isConnected || websocket.isConnected;
  
  // Function to attempt WebSocket connection
  const attemptWebSocketConnection = useCallback(() => {
    if (bluetooth.wifiStatus?.ip && 
        bluetooth.isConnected && 
        !websocket.isConnected && 
        !websocket.isConnecting) {
      
      const deviceIp = bluetooth.wifiStatus.ip;
      const wsAddress = `${deviceIp}:${WEBSOCKET_PORT !== 80 ? WEBSOCKET_PORT : ''}`;
      
      addDebug(`Connecting to WebSocket at ${wsAddress} (Attempt ${wsRetryCount + 1}/${MAX_RETRY_COUNT})`);
      websocket.connectToWebSocket(wsAddress);
    }
  }, [bluetooth.wifiStatus, bluetooth.isConnected, websocket.isConnected, websocket.isConnecting, wsRetryCount, addDebug, websocket, WEBSOCKET_PORT]);
  
  // Auto-connect to WebSocket when Bluetooth is connected and WiFi status is available
  useEffect(() => {
    if (bluetooth.isConnected && 
        !websocket.isConnected && 
        !websocket.isConnecting &&
        bluetooth.wifiStatus?.ip) {
      
      attemptWebSocketConnection();
    }
  }, [bluetooth.isConnected, bluetooth.wifiStatus, websocket.isConnected, websocket.isConnecting, attemptWebSocketConnection]);
  
  // Watch for WiFi status changes to connect immediately when IP becomes available
  useEffect(() => {
    if (bluetooth.wifiStatus?.ip && 
        bluetooth.isConnected && 
        !websocket.isConnected && 
        !websocket.isConnecting) {
      
      attemptWebSocketConnection();
    }
  }, [bluetooth.wifiStatus, bluetooth.isConnected, websocket.isConnected, websocket.isConnecting, attemptWebSocketConnection]);
  
  // Retry WebSocket connection if it fails
  useEffect(() => {
    // If there was an error and we haven't exceeded max retries
    if (websocket.error && wsRetryCount < MAX_RETRY_COUNT && !websocket.isConnected && !websocket.isConnecting) {
      const timer = setTimeout(() => {
        setWsRetryCount(prev => prev + 1);
        addDebug(`Retrying WebSocket connection (${wsRetryCount + 1}/${MAX_RETRY_COUNT})`);
        attemptWebSocketConnection();
      }, RETRY_DELAY_MS);
      
      return () => clearTimeout(timer);
    }
    
    // Reset retry count when successfully connected
    if (websocket.isConnected && wsRetryCount !== 0) {
      setWsRetryCount(0);
    }
  }, [websocket.error, websocket.isConnected, websocket.isConnecting, wsRetryCount, MAX_RETRY_COUNT, addDebug, attemptWebSocketConnection]);
  
  // Hook to handle Gemini responses for controlling the flashlight
  useEffect(() => {
    if (!gemini.geminiResponse) return;
    
    try {
      // Check if there's a JSON command in the response
      const commandMatch = gemini.geminiResponse.match(/\{.*"command".*\}/);
      const blinkMatch = gemini.geminiResponse.match(/\{.*"blink".*\}/);
      
      if (commandMatch) {
        const commandData = JSON.parse(commandMatch[0]);
        
        if (commandData.command === "on") {
          addDebug("AI requested to turn flashlight ON");
          
          // Use WebSocket for flashlight control if connected
          if (websocket.isConnected) {
            websocket.turnOnFlashlight();
          } else {
            addDebug("Cannot turn on flashlight: WebSocket not connected");
          }
        } 
        else if (commandData.command === "off") {
          addDebug("AI requested to turn flashlight OFF");
          
          // Use WebSocket for flashlight control if connected
          if (websocket.isConnected) {
            websocket.turnOffFlashlight();
          } else {
            addDebug("Cannot turn off flashlight: WebSocket not connected");
          }
        }
      }
      
      if (blinkMatch) {
        const blinkData = JSON.parse(blinkMatch[0]);
        const blinkInterval = parseInt(blinkData.blink);
        
        if (!isNaN(blinkInterval)) {
          addDebug(`AI requested to blink flashlight every ${blinkInterval}ms`);
          
          if (websocket.isConnected) {
            websocket.blinkFlashlight(blinkInterval);
          } else {
            addDebug("Cannot blink flashlight: WebSocket not connected");
          }
        }
      }
    } catch (e) {
      console.error("Error parsing AI command:", e);
    }
  }, [gemini.geminiResponse, websocket, addDebug]);
  
  // Add keyboard event listeners for debug toggle (Ctrl+K) and AI interface toggle (Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K to toggle debug
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        toggleDebugVisibility(); // Toggle debug visibility
      }
      
      // Check for Ctrl+Y to toggle AI interface visibility
      if (event.ctrlKey && event.key === 'y') {
        event.preventDefault(); // Prevent default browser behavior
        setIsAiInterfaceVisible((prev: boolean) => !prev); // Toggle AI interface visibility
        addDebug(`Toggled AI interface visibility: ${!isAiInterfaceVisible ? 'ON' : 'OFF'}`);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAiInterfaceVisible, addDebug, toggleDebugVisibility]);

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{appName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Connect to your next-generation flashlight and interact with it using your voice.
          </p>
        </div>

        {/* Bluetooth Connection */}
        <ConnectionStatus 
          isConnected={bluetooth.isConnected}
          isConnecting={bluetooth.isConnecting}
          deviceName={bluetooth.device?.name}
          error={bluetooth.error}
          successMessage={bluetooth.successMessage}
          isBluetoothSupported={bluetooth.isBluetoothSupported}
          isSpeechSupported={speech.isSpeechSupported}
          connectToDevice={bluetooth.connectToDevice}
        />
        
        {/* WebSocket Connection Status (only visible when Bluetooth is connected) */}
        {bluetooth.isConnected && (
          <div className="mt-4 mb-6 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-sm font-medium mb-2 text-gray-800 dark:text-gray-200">WebSocket Connection</h3>
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                websocket.isConnected 
                  ? 'bg-green-500' 
                  : websocket.isConnecting 
                    ? 'bg-yellow-500' 
                    : websocket.error 
                      ? 'bg-red-500' 
                      : 'bg-gray-500'
              }`}></div>
              <span className={`text-sm ${
                websocket.isConnected 
                  ? 'text-green-600 dark:text-green-400' 
                  : websocket.isConnecting 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : websocket.error
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
              }`}>
                {websocket.isConnected 
                  ? `Connected to ${websocket.ipAddress}` 
                  : websocket.isConnecting 
                    ? 'Connecting...' 
                    : websocket.error
                      ? `Connection failed: ${websocket.error}`
                      : bluetooth.wifiStatus?.ip
                        ? 'Preparing to connect...'
                        : 'Waiting for WiFi info...'}
              </span>
            </div>
            {wsRetryCount > 0 && !websocket.isConnected && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Retry attempt {wsRetryCount}/{MAX_RETRY_COUNT}
              </div>
            )}
          </div>
        )}

        {/* Show WebSocket flashlight controls when WebSocket is connected */}
        {websocket.isConnected && (
          <WebSocketFlashlightControl 
            flashlightStatus={websocket.flashlightStatus}
            toggleFlashlight={websocket.toggleFlashlight}
            turnOnFlashlight={websocket.turnOnFlashlight}
            turnOffFlashlight={websocket.turnOffFlashlight}
            blinkFlashlight={websocket.blinkFlashlight}
          />
        )}
        
        {/* Show connecting status when WebSocket is connecting but not yet connected */}
        {bluetooth.isConnected && !websocket.isConnected && (
          <div className="mb-6">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center">
                {websocket.isConnecting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting to WebSocket...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Waiting for WebSocket connection...
                  </>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Gemini Chat Interface - Show when connected OR when explicitly toggled */}
        {(isConnectedAny || isAiInterfaceVisible) && (
          <div className="mb-4">
            {!isConnectedAny && (
              <div className="mb-3 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded text-sm text-yellow-700 dark:text-yellow-300">
                <p className="flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Not connected to device. Some features may be limited.
                </p>
              </div>
            )}
            <GeminiChat 
              isListening={speech.isListening}
              transcript={speech.transcript}
              geminiResponse={gemini.geminiResponse}
              isProcessing={gemini.isProcessing}
              isSpeechSupported={speech.isSpeechSupported}
              toggleMicrophone={speech.toggleMicrophone}
            />
          </div>
        )}

        {/* AI Interface Shortcut Info */}
        {!isAiInterfaceVisible && !isConnectedAny && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Press Ctrl+Y to access the AI interface without connecting
            </p>
          </div>
        )}

        {/* WiFi Status Display */}
        <WifiStatus wifiStatus={bluetooth.wifiStatus} />

        {/* Debug Log */}
        <DebugLog 
          debug={debug}
          isDebugVisible={isDebugVisible}
          toggleDebugVisibility={toggleDebugVisibility}
        />
      </main>
    </div>
  );
} 