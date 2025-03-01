"use client";

import { useState, useEffect, useRef } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Add type declarations for Web Bluetooth API and Web Speech API
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: {
        filters?: Array<{
          services?: string[];
          name?: string;
          namePrefix?: string;
        }>;
        optionalServices?: string[];
      }): Promise<BluetoothDevice>;
    };
  }
  
  // Simplified Speech Recognition Types
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    currentRecognition: SpeechRecognitionInstance | null;
  }
  
  // Custom types for Speech Recognition
  interface SpeechRecognitionConstructor {
    new(): SpeechRecognitionInstance;
  }
  
  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: (event: SpeechRecognitionResultEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
  }
  
  interface SpeechRecognitionResultEvent {
    results: {
      readonly length: number;
      [index: number]: {
        readonly isFinal: boolean;
        readonly length: number;
        [index: number]: {
          readonly transcript: string;
          readonly confidence: number;
        };
      };
    };
  }
  
  interface SpeechRecognitionErrorEvent {
    error: string;
  }

  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: {
      connect(): Promise<BluetoothRemoteGATTServer>;
    };
    addEventListener(
      type: 'gattserverdisconnected',
      listener: EventListenerOrEventListenerObject
    ): void;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
    disconnect(): void;
  }

  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    writeValue(value: BufferSource): Promise<void>;
    properties: {
      notify: boolean;
      read: boolean;
      write: boolean;
      writeWithoutResponse: boolean;
      indicate: boolean;
    };
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: string,
      listener: (event: Event & { target: BluetoothRemoteGATTCharacteristic & { value: DataView } }) => void
    ): void;
  }
}

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<{
    connected: boolean;
    ip?: string;
    message?: string;
  } | null>(null);
  
  // New states for Gemini integration
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // New state for controlling transcript clearing behavior
  const [autoClearTranscript, setAutoClearTranscript] = useState(false);

  // Get environment variables
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Device Setup';
  const deviceNamePrefix = process.env.NEXT_PUBLIC_DEVICE_NAME_PREFIX || 'ESP32';
  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
  const geminiModel = process.env.NEXT_PUBLIC_GEMINI_MODEL || 'gemini-1.5-pro';
  
  // Nordic UART Service UUID constants - these are the standard UUIDs used by Adafruit BLE
  const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // RX from the device's perspective (write from central)
  const UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // TX from the device's perspective (read from central)
  
  // Initialize Gemini API
  const genAI = new GoogleGenerativeAI(geminiApiKey);
  
  // Check if Web Bluetooth is supported
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  // Check if Web Speech API is supported
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Reference to store the recognition instance
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  
  // Reference to track the last final transcript
  const lastTranscriptRef = useRef<string>('');

  useEffect(() => {
    setIsBluetoothSupported('bluetooth' in navigator);
    setIsSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  // Add keyboard event listeners for debug toggle (Ctrl+K) and autoclear toggle (Ctrl+L)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K to toggle debug
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        setIsDebugVisible(prev => !prev); // Toggle debug visibility
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
  }, [autoClearTranscript]); // Include autoClearTranscript in dependencies for the debug message

  // Helper function to add debug messages
  const addDebug = (message: string) => {
    console.log(message);
    setDebug(prev => [...prev, message]);
  };

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Disconnect any active connections when component unmounts
      if (gattServer && gattServer.connected) {
        try {
          gattServer.disconnect();
          addDebug('Component unmounting, connection closed');
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      }
    };
  }, [gattServer]);

  const connectToDevice = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setDebug([]);
      
      addDebug('Requesting Bluetooth device...');
      
      // Request the device with the exact UART service UUID
      try {
        const bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: deviceNamePrefix }
          ],
          // Only include the exact UART service UUID we know is used by Adafruit BLE
          optionalServices: [UART_SERVICE_UUID]
        });
        
        setDevice(bluetoothDevice);
        
        addDebug(`Device selected: ${bluetoothDevice.name || 'unnamed device'}`);
        
        // Immediately try to connect to the GATT server
        addDebug('Connecting to GATT server...');
        const server = await bluetoothDevice.gatt?.connect();
        
        if (!server) {
          throw new Error('Failed to connect to GATT server');
        }
        
        setGattServer(server);
        setIsConnected(true);
        
        // Now try to get the UART service
        addDebug(`Getting UART service with UUID: ${UART_SERVICE_UUID}`);
        try {
          const uartService = await server.getPrimaryService(UART_SERVICE_UUID);
          addDebug('UART service found!');
          
          // Test getting the TX and RX characteristics to make sure they exist
          const rxChar = await uartService.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
          addDebug(`RX characteristic found: ${rxChar.uuid}`);
          
          const txChar = await uartService.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
          addDebug(`TX characteristic found: ${txChar.uuid}`);
          
          // Set up notification handler for incoming messages
          if (txChar.properties.notify) {
            addDebug('Setting up notification listener on TX characteristic...');
            await txChar.startNotifications();
            txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
              // Type-cast event.target with a safer approach
              const target = event.target as unknown;
              // Now it's safe to cast to our expected type
              const characteristic = target as BluetoothRemoteGATTCharacteristic & { value: DataView };
              const value = characteristic.value;
              const decoder = new TextDecoder('utf-8');
              const response = decoder.decode(value);
              addDebug(`Received response: ${response}`);
              
              try {
                const responseData = JSON.parse(response);
                if (responseData.status === 'success') {
                  setSuccessMessage(responseData.message || 'Operation successful!');
                  if (responseData.ip) {
                    setWifiStatus({
                      connected: true,
                      ip: responseData.ip,
                      message: responseData.message
                    });
                  }
                } else {
                  setError(responseData.message || 'Operation failed');
                  if (responseData.hasOwnProperty('connected')) {
                    setWifiStatus({
                      connected: responseData.connected,
                      message: responseData.message
                    });
                  }
                }
              } catch (e) {
                addDebug(`Error parsing JSON response: ${e}`);
                // Still show the raw response
                setSuccessMessage(`Received: ${response}`);
              }
            });
            
            setSuccessMessage('Connected and ready!');
          } else {
            addDebug('TX characteristic does not support notifications!');
          }
          
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          addDebug(`Error getting UART service: ${errorMessage}`);
          
          // Try to list all available services for debugging
          try {
            const services = await server.getPrimaryServices();
            addDebug(`Found ${services.length} services:`);
            for (const service of services) {
              addDebug(`Service UUID: ${service.uuid}`);
            }
          } catch (e) {
            addDebug(`Error listing services: ${e instanceof Error ? e.message : String(e)}`);
          }
          
          throw new Error(`Failed to get UART service: ${errorMessage}`);
        }
      } catch (err) {
        throw new Error(`Bluetooth connection error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      console.error('Error connecting to device:', err);
      setError(`${err instanceof Error ? err.message : String(err)}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to toggle microphone recording
  const toggleMicrophone = async () => {
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  };

  // Function to start listening with microphone
  const startListening = async () => {
    try {
      setIsListening(true);
      
      // Only clear transcript if auto-clearing is enabled
      if (autoClearTranscript) {
        setTranscript('');
        lastTranscriptRef.current = '';
      }
      
      setGeminiResponse('');
      
      // Use Web Speech API directly
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = true; // Set to continuous so it doesn't stop after first utterance
        recognition.interimResults = true; // Enable interim results for real-time updates
        
        recognition.onresult = async (event: SpeechRecognitionResultEvent) => {
          // Get the latest result
          const current = event.results.length - 1;
          const speechResult = event.results[current][0].transcript;
          
          // Update the transcript in real-time
          setTranscript(speechResult);
          
          // Only process with Gemini if this is a final result (not an interim)
          if (event.results[current].isFinal) {
            addDebug(`Final speech recognized: ${speechResult}`);
            
            // Save the latest final transcript
            lastTranscriptRef.current = speechResult;
            
            // Now send to Gemini API
            await sendToGemini(speechResult);
          }
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          
          // Don't stop listening on "no-speech" errors, just log them
          if (event.error === 'no-speech') {
            addDebug('No speech detected, continuing to listen...');
            return;
          }
          
          // For network errors, provide more helpful message
          if (event.error === 'network') {
            setError(`Speech recognition network error. Make sure you're using Chrome and have a stable internet connection.`);
          } else {
            setError(`Speech recognition error: ${event.error}`);
          }
          
          // Stop listening on error (except no-speech)
          setIsListening(false);
        };
        
        // When recognition ends for any reason other than us stopping it manually,
        // restart it if we're still in listening mode
        recognition.onend = () => {
          // If we're still supposed to be listening, restart recognition
          if (isListening) {
            try {
              // If auto-clear is enabled, clear the transcript between recognition sessions
              if (autoClearTranscript) {
                setTranscript('');
              }
              
              recognition.start();
              addDebug('Restarted speech recognition');
            } catch (error) {
              console.error('Error restarting recognition:', error);
              setIsListening(false);
            }
          }
        };
        
        // Store recognition instance in ref to access in stopListening
        recognitionRef.current = recognition;
        
        // Start recognition
        recognition.start();
        addDebug(`Started continuous speech recognition with ${autoClearTranscript ? 'auto-clear enabled' : 'auto-clear disabled'}`);
      } else {
        // Fallback for browsers that don't support SpeechRecognition
        setError('Speech recognition is not supported in this browser');
        setIsListening(false);
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      setError(`Speech recognition error: ${error instanceof Error ? error.message : String(error)}`);
      setIsListening(false);
    }
  };

  // Function to stop listening
  const stopListening = () => {
    setIsListening(false);
    
    // Access and stop the recognition instance if it exists
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        addDebug('Stopped speech recognition');
      } catch (e) {
        console.error('Error stopping recognition:', e);
      }
      
      // Clean up the reference
      recognitionRef.current = null;
    }
  };

  // Send transcript to Gemini API
  const sendToGemini = async (text: string) => {
    try {
      setIsProcessing(true);
      addDebug(`Sending to Gemini API: ${text}`);
      
      // Make sure we have an API key
      if (!geminiApiKey) {
        throw new Error('Gemini API key is not configured. Please add it to your .env.local file.');
      }
      
      // Get the model
      const model = genAI.getGenerativeModel({ model: geminiModel });
      
      // Generate content
      const result = await model.generateContent(text);
      const response = result.response;
      const responseText = response.text();
      
      setGeminiResponse(responseText);
      addDebug(`Received response from Gemini`);
      
      // You could also implement text-to-speech here to read the response
      
    } catch (error) {
      console.error('Error with Gemini API:', error);
      setError(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{appName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Connect to your device and chat with Gemini AI
          </p>
        </div>

        {!isBluetoothSupported && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or another compatible browser.</p>
          </div>
        )}

        {!isSpeechSupported && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>Speech recognition is not supported in this browser. Please use Chrome, Edge, or another compatible browser.</p>
          </div>
        )}

        {/* Device Connection Status */}
        <div className="mb-6">
          {isConnected ? (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Connected to {device?.name || 'device'}</span>
              </div>
              {successMessage && <p className="mt-2">{successMessage}</p>}
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <p>{error}</p>
            </div>
          ) : null}
        </div>

        {/* Gemini Chat Interface */}
        {isConnected && (
          <div className="mb-6">
            {/* Settings indicator */}
            <div className="mb-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <span className={`inline-block w-2 h-2 rounded-full ${autoClearTranscript ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span>Auto-clear on pause {autoClearTranscript ? 'ON' : 'OFF'}</span>
              </div>
              <span className="text-xs">(Ctrl+L to toggle)</span>
            </div>
            
            {/* Live transcript with typing indicator if listening */}
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h3 className="text-sm font-semibold mb-1">
                {isListening ? "Listening..." : "You said:"}
              </h3>
              <p className="text-sm text-gray-800 dark:text-gray-200 min-h-8">
                {transcript}
                {isListening && !isProcessing && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-600 dark:bg-gray-400 animate-pulse"></span>
                )}
              </p>
            </div>
            
            {geminiResponse && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-sm font-semibold mb-1 text-blue-700 dark:text-blue-300">
                  {isProcessing ? "Gemini is thinking..." : "Gemini says:"}
                </h3>
                <p className="text-sm text-gray-800 dark:text-gray-200">{geminiResponse}</p>
              </div>
            )}
            
            <button
              onClick={toggleMicrophone}
              disabled={isProcessing || !isSpeechSupported}
              className={`w-full py-4 px-4 flex items-center justify-center text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${
                isListening 
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              }`}
            >
              {isProcessing ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : isListening ? (
                <span className="flex items-center">
                  <span className="relative flex h-3 w-3 mr-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Stop Listening
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Listening
                </span>
              )}
            </button>
          </div>
        )}

        {/* WiFi Status Display - Kept for informational purposes */}
        {wifiStatus && (
          <div className={`mb-6 p-4 ${wifiStatus.connected ? 
            'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'} rounded-lg`}>
            <h3 className="font-medium mb-2">WiFi Status</h3>
            <p>{wifiStatus.connected ? 'Connected' : 'Disconnected'}</p>
            {wifiStatus.message && <p className="text-sm mt-1">{wifiStatus.message}</p>}
            {wifiStatus.ip && <p className="font-mono text-sm mt-1">IP: {wifiStatus.ip}</p>}
          </div>
        )}

        {/* Add debug information section with toggle indicator */}
        {debug.length > 0 && (
          <div className="relative">
            {isDebugVisible && (
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-mono overflow-auto max-h-60">
                <h3 className="text-sm font-semibold mb-2">Debug Log:</h3>
                <ul className="space-y-1">
                  {debug.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={connectToDevice}
            disabled={isConnecting || !isBluetoothSupported}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect to Device'}
          </button>
        ) : null}
      </main>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Powered by Gemini AI</p>
        {debug.length > 0 && (
          <div className="mt-1 space-y-1">
            <p className="cursor-pointer hover:underline" onClick={() => setIsDebugVisible(prev => !prev)}>
              {isDebugVisible ? 'Hide' : 'Show'} Debug Log (Ctrl+K)
            </p>
            <p className="cursor-pointer hover:underline" onClick={() => setAutoClearTranscript(prev => !prev)}>
              Auto-clear on pause: {autoClearTranscript ? 'ON' : 'OFF'} (Ctrl+L)
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}
