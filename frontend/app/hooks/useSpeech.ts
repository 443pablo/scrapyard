'use client';

import { useState, useRef, useEffect } from 'react';
import { SpeechState, SpeechServices } from '../types';
import { useDebug } from './useDebug';

export const useSpeech = (
  onFinalTranscript: (text: string) => Promise<void>
): SpeechState & SpeechServices => {
  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  // Recognition instance reference
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  
  // Reference to track the last final transcript
  const lastTranscriptRef = useRef<string>('');
  
  // Debug functionality
  const { addDebug } = useDebug();

  // Check if Web Speech API is supported
  useEffect(() => {
    setIsSpeechSupported('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  }, []);

  // Function to toggle microphone recording
  const toggleMicrophone = async (): Promise<void> => {
    if (!isListening) {
      await startListening();
    } else {
      stopListening();
    }
  };

  // Function to start listening with microphone
  const startListening = async (): Promise<void> => {
    try {
      setIsListening(true);
      
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
          
          // Only process if this is a final result (not an interim)
          if (event.results[current].isFinal) {
            addDebug(`Final speech recognized: ${speechResult}`);
            
            // Save the latest final transcript
            lastTranscriptRef.current = speechResult;
            
            // Now send to handler function
            await onFinalTranscript(speechResult);
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
            addDebug(`Speech recognition network error. Make sure you're using Chrome and have a stable internet connection.`);
          } else {
            addDebug(`Speech recognition error: ${event.error}`);
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
        addDebug(`Started continuous speech recognition`);
      } else {
        // Fallback for browsers that don't support SpeechRecognition
        addDebug('Speech recognition is not supported in this browser');
        setIsListening(false);
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      addDebug(`Speech recognition error: ${error instanceof Error ? error.message : String(error)}`);
      setIsListening(false);
    }
  };

  // Function to stop listening
  const stopListening = (): void => {
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

  return {
    // State
    isListening,
    transcript,
    isSpeechSupported,
    
    // Methods
    toggleMicrophone,
    startListening,
    stopListening
  };
}; 