"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { 
  ConnectionStatus, 
  GeminiChat, 
  DebugLog,
  HttpFlashlightControl,
  GeminiResponseDisplay
} from "./components";
import { 
  useBluetooth, 
  useSpeech, 
  useGemini, 
  useDebug,
  useHttp,
  useGeminiCommandDetector
} from "./hooks";
import { 
  DEFAULT_DEVICE_NAME_PREFIX, 
  DEFAULT_SYSTEM_PROMPT,
  HTTP_PORT 
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
  
  // Initialize HTTP hook
  const http = useHttp();
  
  // Initialize Gemini hook
  const gemini = useGemini({
    apiKey: geminiApiKey,
    model: geminiModel,
    systemPrompt: systemPrompt
  });
  
  // Initialize Speech hook with callback to send to Gemini
  const speech = useSpeech(gemini.sendToGemini);
  
  // Add command detector hook to process Gemini responses for commands
  useGeminiCommandDetector(
    gemini.geminiResponse,
    {
      turnOnFlashlight: http.turnOnFlashlight,
      turnOffFlashlight: http.turnOffFlashlight,
      blinkFlashlight: http.blinkFlashlight,
      connectToDevice: http.connectToDevice
    },
    http.isConnected
  );
  
  // State for controlling AI interface visibility regardless of connection status
  const [isAiInterfaceVisible, setIsAiInterfaceVisible] = useState(false);
  
  // State for HTTP connection retries
  const [httpRetryCount, setHttpRetryCount] = useState(0);
  const MAX_RETRY_COUNT = 3;
  const RETRY_DELAY_MS = 3000;
  
  // Track processed responses to prevent duplicates
  const processedResponseRef = useRef<string | null>(null);
  
  // Function to attempt HTTP connection
  const attemptHttpConnection = useCallback(() => {
    if (bluetooth.isConnected && 
        !http.isConnected && 
        !http.isConnecting) {
      
      // Use a default IP or get it from environment
      const deviceIp = process.env.NEXT_PUBLIC_DEVICE_IP || '10.10.16.80';
      // Format with port if needed
      const httpAddress = HTTP_PORT !== 80 ? `${deviceIp}:${HTTP_PORT}` : deviceIp;
      
      addDebug(`Connecting to HTTP at ${httpAddress} (Attempt ${httpRetryCount + 1}/${MAX_RETRY_COUNT})`);
      http.connectToDevice(httpAddress);
    }
  }, [bluetooth.isConnected, http.isConnected, http.isConnecting, httpRetryCount, addDebug, http, HTTP_PORT]);
  
  // Auto-connect to HTTP when Bluetooth is connected
  useEffect(() => {
    if (bluetooth.isConnected && 
        !http.isConnected && 
        !http.isConnecting) {
      
      attemptHttpConnection();
    }
  }, [bluetooth.isConnected, http.isConnected, http.isConnecting, attemptHttpConnection]);
  
  // Retry HTTP connection if it fails
  useEffect(() => {
    // If there was an error and we haven't exceeded max retries
    if (http.error && httpRetryCount < MAX_RETRY_COUNT && !http.isConnected && !http.isConnecting) {
      const timer = setTimeout(() => {
        setHttpRetryCount(prev => prev + 1);
        addDebug(`Retrying HTTP connection (${httpRetryCount + 1}/${MAX_RETRY_COUNT})`);
        attemptHttpConnection();
      }, RETRY_DELAY_MS);
      
      return () => clearTimeout(timer);
    }
    
    // Reset retry count when successfully connected
    if (http.isConnected && httpRetryCount !== 0) {
      setHttpRetryCount(0);
    }
  }, [http.error, http.isConnected, http.isConnecting, httpRetryCount, MAX_RETRY_COUNT, addDebug, attemptHttpConnection]);
  
  // Hook to handle Gemini responses for controlling the flashlight
  useEffect(() => {
    if (!gemini.geminiResponse) return;
    
    // Check if we've already processed this exact response
    if (processedResponseRef.current === gemini.geminiResponse) {
      return;
    }
    
    // Mark this response as processed
    processedResponseRef.current = gemini.geminiResponse;
    
    try {
      // Check if there's a JSON command in the response
      const commandMatch = gemini.geminiResponse.match(/\{.*"command".*\}/);
      const blinkMatch = gemini.geminiResponse.match(/\{.*"blink".*\}/);
      
      if (commandMatch) {
        const commandData = JSON.parse(commandMatch[0]);
        
        if (commandData.command === "on") {
          addDebug("AI requested to turn flashlight ON");
          
          // Use HTTP for flashlight control if connected
          if (http.isConnected) {
            http.turnOnFlashlight();
          } else {
            addDebug("Cannot turn on flashlight: HTTP not connected");
          }
        } 
        else if (commandData.command === "off") {
          addDebug("AI requested to turn flashlight OFF");
          
          // Use HTTP for flashlight control if connected
          if (http.isConnected) {
            http.turnOffFlashlight();
          } else {
            addDebug("Cannot turn off flashlight: HTTP not connected");
          }
        }
      }
      
      if (blinkMatch) {
        const blinkData = JSON.parse(blinkMatch[0]);
        const blinkInterval = parseInt(blinkData.blink);
        
        if (!isNaN(blinkInterval)) {
          addDebug(`AI requested to blink flashlight every ${blinkInterval}ms`);
          
          if (http.isConnected) {
            http.blinkFlashlight(blinkInterval);
          } else {
            addDebug("Cannot blink flashlight: HTTP not connected");
          }
        }
      }
    } catch (e) {
      console.error("Error parsing AI command:", e);
    }
  }, [gemini.geminiResponse, http, addDebug]);
  
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
        
        {/* HTTP Connection Status - Minimal */}
        {bluetooth.isConnected && (
          <div className="mt-4 mb-6 flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              http.isConnected 
                ? 'bg-green-500' 
                : http.isConnecting 
                  ? 'bg-yellow-500' 
                  : 'bg-red-500'
            }`}></div>
            <span className="text-sm">
              {http.isConnected 
                ? 'HTTP Connected' 
                : http.isConnecting 
                  ? 'Connecting...' 
                  : 'Connection failed'}
            </span>
            {httpRetryCount > 0 && !http.isConnected && (
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                (Retry {httpRetryCount}/{MAX_RETRY_COUNT})
              </span>
            )}
          </div>
        )}

        {/* Show HTTP flashlight controls when HTTP is connected */}
        {http.isConnected && (
          <HttpFlashlightControl 
            flashlightStatus={http.flashlightStatus}
            toggleFlashlight={http.toggleFlashlight}
            turnOnFlashlight={http.turnOnFlashlight}
            turnOffFlashlight={http.turnOffFlashlight}
            blinkFlashlight={http.blinkFlashlight}
          />
        )}
        
        {/* Gemini Chat Interface */}
        {(isAiInterfaceVisible || http.isConnected) && (
          <div className="mb-6">
            {/* Gemini Response Display */}
            {gemini.geminiResponse && !gemini.isProcessing && (
              <GeminiResponseDisplay geminiResponse={gemini.geminiResponse} />
            )}
            
            <GeminiChat
              isListening={speech.isListening}
              transcript={speech.transcript}
              geminiResponse={gemini.geminiResponse}
              isProcessing={gemini.isProcessing}
              isSpeechSupported={speech.isSpeechSupported}
              toggleMicrophone={speech.toggleMicrophone}
              startPushToTalk={speech.startPushToTalk}
              endPushToTalk={speech.endPushToTalk}
            />
          </div>
        )}
      </main>
      
      {/* Debug Log with always-visible footer */}
      <DebugLog 
        debug={debug} 
        isDebugVisible={isDebugVisible}
        toggleDebugVisibility={toggleDebugVisibility}
      />
    </div>
  );
} 