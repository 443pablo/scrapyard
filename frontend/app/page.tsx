"use client";

import { useState, useEffect } from "react";
import { 
  ConnectionStatus, 
  FlashlightControl, 
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
  
  // Helper to determine if we're connected using either method
  const isConnectedAny = bluetooth.isConnected || websocket.isConnected;
  
  // Auto-connect to WebSocket when Bluetooth is connected and WiFi status is available
  useEffect(() => {
    if (bluetooth.isConnected && 
        !websocket.isConnected && 
        !websocket.isConnecting &&
        bluetooth.wifiStatus?.connected && 
        bluetooth.wifiStatus?.ip) {
      
      // Use the IP address obtained from Bluetooth's WiFi status
      const deviceIp = bluetooth.wifiStatus.ip;
      const wsAddress = `${deviceIp}:${WEBSOCKET_PORT !== 80 ? WEBSOCKET_PORT : ''}`;
      
      addDebug(`Auto-connecting to WebSocket at ${wsAddress} (IP from Bluetooth)`);
      websocket.connectToWebSocket(wsAddress);
    } else if (bluetooth.isConnected && 
               !websocket.isConnected && 
               !websocket.isConnecting && 
               (!bluetooth.wifiStatus?.connected || !bluetooth.wifiStatus?.ip)) {
      
      // If WiFi status isn't available yet, request it
      addDebug('Waiting for WiFi status from Bluetooth before connecting to WebSocket');
      bluetooth.requestWifiStatus();
    }
  }, [
    bluetooth.isConnected, 
    bluetooth.wifiStatus, 
    websocket.isConnected, 
    websocket.isConnecting, 
    addDebug, 
    websocket,
    bluetooth
  ]);
  
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
          
          // Prefer WebSocket if connected, fallback to Bluetooth
          if (websocket.isConnected) {
            websocket.turnOnFlashlight();
          } else if (bluetooth.isConnected) {
            bluetooth.toggleFlashlight();
          }
        } 
        else if (commandData.command === "off") {
          addDebug("AI requested to turn flashlight OFF");
          
          // Prefer WebSocket if connected, fallback to Bluetooth
          if (websocket.isConnected) {
            websocket.turnOffFlashlight();
          } else if (bluetooth.isConnected) {
            bluetooth.toggleFlashlight();
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
          }
        }
      }
    } catch (e) {
      console.error("Error parsing AI command:", e);
    }
  }, [gemini.geminiResponse, bluetooth, websocket, addDebug]);
  
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
              <div className={`w-3 h-3 rounded-full mr-2 ${websocket.isConnected ? 'bg-green-500' : websocket.isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm ${
                websocket.isConnected 
                  ? 'text-green-600 dark:text-green-400' 
                  : websocket.isConnecting 
                    ? 'text-yellow-600 dark:text-yellow-400' 
                    : 'text-red-600 dark:text-red-400'
              }`}>
                {websocket.isConnected 
                  ? `Connected to ${websocket.ipAddress}` 
                  : websocket.isConnecting 
                    ? 'Connecting...' 
                    : bluetooth.wifiStatus?.connected
                      ? 'Waiting to connect...'
                      : 'Waiting for WiFi info...'}
              </span>
            </div>
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
        
        {/* Fallback to Bluetooth flashlight controls when only Bluetooth is connected */}
        {bluetooth.isConnected && !websocket.isConnected && (
          <FlashlightControl 
            flashlightStatus={bluetooth.flashlightStatus}
            toggleFlashlight={bluetooth.toggleFlashlight}
          />
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