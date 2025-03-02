'use client';

import { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiState, GeminiServices, GeminiConfig } from '../types';
import { useDebug } from './useDebug';

export const useGemini = (config: GeminiConfig): GeminiState & GeminiServices => {
  const [geminiResponse, setGeminiResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Initialize debug
  const { addDebug } = useDebug();
  
  // Initialize Gemini API
  const genAI = new GoogleGenerativeAI(config.apiKey);

  // Send text to Gemini API
  const sendToGemini = async (text: string): Promise<void> => {
    try {
      setIsProcessing(true);
      addDebug(`Sending to Gemini API: ${text}`);
      
      // Make sure we have an API key
      if (!config.apiKey) {
        throw new Error('Gemini API key is not configured. Please add it to your .env.local file.');
      }
      
      // Get the model
      const model = genAI.getGenerativeModel({ model: config.model });
      
      // Generate content
      let result;
      
      // Use system prompt if available by creating a chat
      if (config.systemPrompt) {
        addDebug('Using system prompt for Gemini');
        const chat = model.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: text }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        });
        
        // Send the message with the system instructions prepended
        result = await chat.sendMessage(config.systemPrompt + "\n\n" + text);
      } else {
        result = await model.generateContent(text);
      }
      
      const response = result.response;
      const responseText = response.text();
      
      setGeminiResponse(responseText);
      addDebug(`Received response from Gemini`);
      
    } catch (error) {
      console.error('Error with Gemini API:', error);
      addDebug(`Gemini API error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    geminiResponse,
    isProcessing,
    sendToGemini
  };
}; 