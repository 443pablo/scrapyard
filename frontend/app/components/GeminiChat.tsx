'use client';

import React, { useEffect, useRef } from 'react';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface GeminiChatProps {
  isListening: boolean;
  transcript: string;
  geminiResponse: string;
  isProcessing: boolean;
  isSpeechSupported: boolean;
  toggleMicrophone: () => Promise<void>; // Keep for backward compatibility
  startPushToTalk: () => Promise<void>;
  endPushToTalk: () => Promise<void>;
}

export const GeminiChat: React.FC<GeminiChatProps> = ({
  isListening,
  transcript,
  geminiResponse,
  isProcessing,
  isSpeechSupported,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  toggleMicrophone,
  startPushToTalk,
  endPushToTalk
}) => {
  // Initialize speech synthesis
  const { speak, stop, isSpeaking, isSupported: isSpeechSynthesisSupported } = useSpeechSynthesis();
  
  // Track the response we've already tried to speak
  const spokenResponseRef = useRef<string | null>(null);
  
  // Automatically speak Gemini responses when they arrive
  useEffect(() => {
    if (geminiResponse && !isProcessing && isSpeechSynthesisSupported) {
      // Only attempt to speak if this is a new response or we haven't tried to speak it yet
      if (spokenResponseRef.current !== geminiResponse) {
        console.log("Speaking AI response");
        spokenResponseRef.current = geminiResponse;
        speak(geminiResponse);
      }
    }
    
    // Stop speaking when processing new requests
    if (isProcessing && isSpeaking) {
      stop();
      // Reset the spoken response ref when processing starts
      spokenResponseRef.current = null;
    }
  }, [geminiResponse, isProcessing, isSpeechSynthesisSupported, speak, stop, isSpeaking]);

  return (
    <div className="mb-6">
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
      
      {/* Only show processing indicator when AI is processing, but hide actual response */}
      {geminiResponse && isProcessing && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Smartlight is thinking...
            </h3>
          </div>
        </div>
      )}
      
      {/* Push-to-talk button */}
      <button
        onMouseDown={startPushToTalk}
        onMouseUp={endPushToTalk}
        onTouchStart={startPushToTalk}
        onTouchEnd={endPushToTalk}
        disabled={isProcessing || !isSpeechSupported}
        className={`w-full py-4 px-4 flex items-center justify-center text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors ${
          isListening 
            ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 active:bg-red-800' 
            : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800'
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
            Recording...
          </span>
        ) : (
          <span className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Push to Talk
          </span>
        )}
      </button>
    </div>
  );
};