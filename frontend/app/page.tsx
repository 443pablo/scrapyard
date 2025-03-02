"use client";

import { useState, useEffect } from "react";
import { 
  ConnectionStatus, 
  FlashlightControl, 
  GeminiChat, 
  DebugLog,
  WifiStatus
} from "./components";
import { 
  useBluetooth, 
  useSpeech, 
  useGemini, 
  useDebug 
} from "./hooks";
import { DEFAULT_DEVICE_NAME_PREFIX, DEFAULT_SYSTEM_PROMPT } from "./constants";

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
  
  // Add keyboard event listeners for debug toggle (Ctrl+K) and AI interface toggle (Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K to toggle debug
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        toggleDebugVisibility(); // Toggle debug visibility
      }
      
      // Removed Ctrl+L keyboard shortcut for toggling autoclear behavior
      
      // Check for Ctrl+Y to toggle AI interface visibility
      if (event.ctrlKey && event.key === 'y') {
        event.preventDefault(); // Prevent default browser behavior
        setIsAiInterfaceVisible(prev => !prev); // Toggle AI interface visibility
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

        {/* Flashlight Controls - Only show when connected */}
        {bluetooth.isConnected && (
          <FlashlightControl 
            flashlightStatus={bluetooth.flashlightStatus}
            toggleFlashlight={bluetooth.toggleFlashlight}
          />
        )}

        {/* Gemini Chat Interface - Show when connected OR when explicitly toggled */}
        {(bluetooth.isConnected || isAiInterfaceVisible) && (
          <div className="mb-4">
            {!bluetooth.isConnected && (
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
        {!isAiInterfaceVisible && !bluetooth.isConnected && (
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Press Ctrl+Y to access the AI interface without connecting
            </p>
          </div>
        )}

        {/* WiFi Status Display - Kept for informational purposes */}
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