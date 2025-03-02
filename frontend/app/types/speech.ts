// Speech Recognition Types
export interface SpeechState {
  isListening: boolean;
  transcript: string;
  isSpeechSupported: boolean;
  autoClearTranscript: boolean;
}

export interface SpeechServices {
  toggleMicrophone: () => Promise<void>;
  startListening: () => Promise<void>;
  stopListening: () => void;
}

// Note: SpeechRecognition and related types are globally defined in types/global.d.ts 