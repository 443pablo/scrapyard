// Debug Types
export interface DebugState {
  debug: string[];
  isDebugVisible: boolean;
  addDebug: (message: string) => void;
  toggleDebugVisibility: () => void;
} 