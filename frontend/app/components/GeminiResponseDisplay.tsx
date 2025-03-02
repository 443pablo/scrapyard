'use client';

import React, { useMemo } from 'react';

interface GeminiResponseDisplayProps {
  geminiResponse: string;
}

export const GeminiResponseDisplay: React.FC<GeminiResponseDisplayProps> = ({
  geminiResponse
}) => {
  // Highlight JSON command patterns in the response
  const highlightedResponse = useMemo(() => {
    if (!geminiResponse) return null;
    
    // Regular expression to find JSON objects in the text
    const jsonRegex = /{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g;
    
    // Split the text by JSON objects and maintain the JSON objects
    const parts: Array<{ text: string; isJson: boolean }> = [];
    let lastIndex = 0;
    
    // Find all matches
    let match;
    while ((match = jsonRegex.exec(geminiResponse)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          text: geminiResponse.substring(lastIndex, match.index),
          isJson: false
        });
      }
      
      // Add the match
      parts.push({
        text: match[0],
        isJson: true
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text after the last match
    if (lastIndex < geminiResponse.length) {
      parts.push({
        text: geminiResponse.substring(lastIndex),
        isJson: false
      });
    }
    
    // Map parts to JSX elements
    return parts.map((part, index) => 
      part.isJson ? (
        <span key={index} className="bg-green-100 dark:bg-green-900 px-1 rounded font-mono text-sm">
          {part.text}
        </span>
      ) : (
        <span key={index}>{part.text}</span>
      )
    );
  }, [geminiResponse]);

  return (
    <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          Flashlight says:
        </h3>
      </div>
      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {highlightedResponse || "No response yet"}
      </p>
    </div>
  );
}; 