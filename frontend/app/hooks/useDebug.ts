'use client';

import { useState, useCallback } from 'react';
import { DebugState } from '../types';

export const useDebug = (): DebugState => {
  const [debug, setDebug] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);

  // Add debug message
  const addDebug = useCallback((message: string) => {
    console.log(message);
    setDebug(prev => [...prev, message]);
  }, []);

  // Toggle debug visibility
  const toggleDebugVisibility = useCallback(() => {
    setIsDebugVisible(prev => !prev);
  }, []);

  return {
    debug,
    isDebugVisible,
    addDebug,
    toggleDebugVisibility
  };
}; 