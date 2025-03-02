export interface SpeechSynthesisState {
  isSpeaking: boolean;
  isSupported: boolean;
}

export interface SpeechSynthesisServices {
  speak: (text: string) => void;
  stop: () => void;
} 