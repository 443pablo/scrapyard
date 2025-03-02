'use client';

import { useEffect, useRef } from 'react';
import { useDebug } from './useDebug';
import { HttpServices } from '../types';
import { HTTP_IP_ADDRESS } from '../constants';

interface GeminiCommand {
  command?: 'on' | 'off';
  blink?: string;
}

export const useGeminiCommandDetector = (
  geminiResponse: string,
  httpServices: Pick<HttpServices, 'turnOnSmartlight' | 'disableSmartlight' | 'turnOffSmartlight' | 'blinkSmartlight' | 'connectToDevice'>,
  isHttpConnected: boolean
) => {
  const { addDebug } = useDebug();
  const hasConnectedRef = useRef(false);
  // Add a ref to track the last processed response
  const lastProcessedResponseRef = useRef<string | null>(null);

  useEffect(() => {
    // Parse commands from Gemini response
    const detectAndExecuteCommands = async () => {
      try {
        // First, ensure we have a response to process
        if (!geminiResponse) return;

        // Check if we've already processed this exact response to prevent infinite loops
        if (lastProcessedResponseRef.current === geminiResponse) {
          return;
        }
        
        // Mark this response as processed
        lastProcessedResponseRef.current = geminiResponse;

        // Try to connect to HTTP server if not already connected
        if (!isHttpConnected && !hasConnectedRef.current) {
          addDebug('Attempting to connect to HTTP server automatically');
          try {
            await httpServices.connectToDevice(HTTP_IP_ADDRESS);
            hasConnectedRef.current = true;
          } catch (error) {
            addDebug(`Failed to auto-connect to HTTP server: ${error}`);
          }
        }

        // Regular expression to find JSON objects in the text
        const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
        const matches = geminiResponse.match(jsonRegex);

        if (!matches) return;

        for (const jsonString of matches) {
          try {
            const parsedCommand = JSON.parse(jsonString) as GeminiCommand;
            
            // Process "command" for on/off
            if (parsedCommand.command) {
              if (parsedCommand.command === 'on') {
                addDebug('Detected command: ON - Turning flashlight on');
                await httpServices.turnOnSmartlight();
              } else if (parsedCommand.command === 'off') {
                addDebug('Detected command: OFF - Turning flashlight off');
                await httpServices.turnOffSmartlight();
              } else if (parsedCommand.command === 'disabled') {
                addDebug('Detected command: DISABLED - Turning flashlight off');
                await httpServices.disableSmartlight();
              }
            }
            
            // Process "blink" command with interval
            if (parsedCommand.blink) {
              // blink value should be a string representing milliseconds
              const blinkInterval = parseInt(parsedCommand.blink, 10);
              if (!isNaN(blinkInterval)) {
                addDebug(`Detected command: BLINK (${blinkInterval}ms) - Making flashlight blink`);
                await httpServices.blinkSmartlight(blinkInterval);
              }
            }
          } catch (error) {
            // Invalid JSON or error executing command
            addDebug(`Error processing command: ${error}`);
          }
        }
      } catch (error) {
        addDebug(`Error in detectAndExecuteCommands: ${error}`);
      }
    };

    detectAndExecuteCommands();
  }, [geminiResponse, httpServices, isHttpConnected, addDebug]);

  // This hook doesn't need to return anything as it works via side effects
  return null;
}; 