// Gemini AI Types
export interface GeminiState {
  geminiResponse: string;
  isProcessing: boolean;
}

export interface GeminiServices {
  sendToGemini: (text: string) => Promise<void>;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  systemPrompt?: string;
} 