'use client';

import { useEffect, useRef, useState } from 'react';
import { useDebug } from './useDebug';
import { SpeechSynthesisState, SpeechSynthesisServices } from '../types';

export const useSpeechSynthesis = (): SpeechSynthesisState & SpeechSynthesisServices => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasErrorRef = useRef(false);
  const { addDebug } = useDebug();

  // Check if Web Speech API synthesis is supported
  useEffect(() => {
    setIsSupported('speechSynthesis' in window);
    if (!('speechSynthesis' in window)) {
      addDebug('Speech synthesis is not supported in this browser');
    } else {
      addDebug('Speech synthesis is supported');
    }
    
    // If speechSynthesis is available, ensure voices are loaded
    if ('speechSynthesis' in window) {
      // Chrome needs an initial call to get voices
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        // If voices aren't loaded yet, set up the onvoiceschanged event
        window.speechSynthesis.onvoiceschanged = () => {
          addDebug(`Voices loaded: ${window.speechSynthesis.getVoices().length} voices available`);
        };
      } else {
        addDebug(`Voices already loaded: ${voices.length} voices available`);
      }
    }
  }, [addDebug]);

  // Clean up speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      if (utteranceRef.current && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = (text: string) => {
    if (!text || !isSupported) {
      addDebug(`Speech synthesis skipped: ${!text ? 'Empty text' : 'Not supported'}`);
      return;
    }

    // If we've had a recent error, don't try again immediately
    if (hasErrorRef.current) {
      addDebug('Speech synthesis skipped: Previous attempt failed, waiting for reset');
      return;
    }

    // Clean text - remove any JSON-like code blocks that might be in the response
    const cleanText = text.replace(/\{.*?\}/g, '').trim();
    addDebug(`Preparing to speak (text length: ${cleanText.length} chars)`);
    
    if (!cleanText) {
      addDebug('Speech synthesis skipped: Text was empty after cleaning');
      return;
    }

    // Stop any current speech
    if (utteranceRef.current && window.speechSynthesis.speaking) {
      addDebug('Stopping current speech before starting new speech');
      stop();
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utteranceRef.current = utterance;

      // Set voice preferences (optional)
      const voices = window.speechSynthesis.getVoices();
      addDebug(`Available voices: ${voices.length}`);
      
      const preferredVoice = voices.find(voice => 
        voice.lang === 'en-US' && !voice.localService
      );
      
      if (preferredVoice) {
        utterance.voice = preferredVoice;
        addDebug(`Using voice: ${preferredVoice.name}`);
      } else if (voices.length > 0) {
        // If no preferred voice is found, use the first available one
        utterance.voice = voices[0];
        addDebug(`Using default voice: ${voices[0].name}`);
      } else {
        addDebug('No voices available, using system default');
      }

      // Set speech properties
      utterance.rate = 1.0; // Normal speed
      utterance.pitch = 1.0; // Normal pitch
      utterance.volume = 1.0; // Full volume

      // Event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
        hasErrorRef.current = false;
        addDebug('Started speaking AI response');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        hasErrorRef.current = false;
        addDebug('Finished speaking AI response');
      };

      utterance.onerror = (event) => {
        setIsSpeaking(false);
        hasErrorRef.current = true;
        addDebug(`Speech synthesis error: ${event.error}`);
        
        // After a delay, clear the error state
        setTimeout(() => {
          hasErrorRef.current = false;
          addDebug('Speech synthesis error state reset');
        }, 2000);
      };

      // Speak the text
      addDebug('Attempting to start speech synthesis...');
      window.speechSynthesis.speak(utterance);
      addDebug('Speech synthesis request sent');
    } catch (error) {
      console.error('Error with speech synthesis:', error);
      addDebug(`Speech synthesis error: ${error instanceof Error ? error.message : String(error)}`);
      setIsSpeaking(false);
      hasErrorRef.current = true;
      
      // After a delay, clear the error state
      setTimeout(() => {
        hasErrorRef.current = false;
        addDebug('Speech synthesis error state reset');
      }, 2000);
    }
  };

  const stop = () => {
    if (isSupported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      addDebug('Stopped speech synthesis');
    }
  };

  return {
    isSpeaking,
    isSupported,
    speak,
    stop
  };
}; 