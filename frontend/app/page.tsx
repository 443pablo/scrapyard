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
import { DEFAULT_DEVICE_NAME_PREFIX } from "./constants";

export default function Home() {
  // Get environment variables
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Device Setup';
  const deviceNamePrefix = process.env.NEXT_PUBLIC_DEVICE_NAME_PREFIX || DEFAULT_DEVICE_NAME_PREFIX;
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const geminiModel = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-pro';
  
  // Initialize debug hook
  const { debug, isDebugVisible, addDebug, toggleDebugVisibility } = useDebug();
  
  // Initialize Bluetooth hook
  const bluetooth = useBluetooth(deviceNamePrefix);
  
  // Initialize Gemini hook
  const gemini = useGemini({
    apiKey: geminiApiKey,
    model: geminiModel
  });
  
  // Initialize Speech hook with callback to send to Gemini
  const speech = useSpeech(gemini.sendToGemini);
  
  // State for toggling auto-clear transcript
  const [autoClearTranscript, setAutoClearTranscript] = useState(false);
  
  // Add keyboard event listeners for debug toggle (Ctrl+K) and autoclear toggle (Ctrl+L)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K to toggle debug
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        toggleDebugVisibility(); // Toggle debug visibility
      }
      
      // Check for Ctrl+L to toggle autoclear behavior
      if (event.ctrlKey && event.key === 'l') {
        event.preventDefault(); // Prevent default browser behavior
        setAutoClearTranscript(prev => !prev); // Toggle autoclear setting
        addDebug(`Toggled auto-clear transcript: ${!autoClearTranscript ? 'ON' : 'OFF'}`);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [autoClearTranscript, addDebug, toggleDebugVisibility]);

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

        {/* Gemini Chat Interface - Only show when connected */}
        {bluetooth.isConnected && (
          <GeminiChat 
            isListening={speech.isListening}
            transcript={speech.transcript}
            geminiResponse={gemini.geminiResponse}
            isProcessing={gemini.isProcessing}
            autoClearTranscript={autoClearTranscript}
            isSpeechSupported={speech.isSpeechSupported}
            toggleMicrophone={speech.toggleMicrophone}
          />
        )}

        {/* WiFi Status Display - Kept for informational purposes */}
        <WifiStatus wifiStatus={bluetooth.wifiStatus} />

        {/* Debug Log */}
        <DebugLog 
          debug={debug}
          isDebugVisible={isDebugVisible}
          toggleDebugVisibility={toggleDebugVisibility}
          autoClearTranscript={autoClearTranscript}
          toggleAutoClearTranscript={() => setAutoClearTranscript(prev => !prev)}
        />
      </main>
    </div>
  );
} 