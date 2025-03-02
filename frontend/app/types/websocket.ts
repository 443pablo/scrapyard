export interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
  ipAddress: string | null;
}

export interface WebSocketServices {
  connectToWebSocket: (ipAddress: string) => Promise<void>;
  disconnectWebSocket: () => void;
  toggleFlashlight: () => Promise<void>;
  turnOnFlashlight: () => Promise<void>;
  turnOffFlashlight: () => Promise<void>;
  blinkFlashlight: (intervalMs: number) => Promise<void>;
  getFlashlightStatus: () => Promise<void>;
  sendMessage: (message: string | Record<string, unknown>) => Promise<boolean>;
}

export interface WebSocketResponse {
  status: 'success' | 'error';
  message: string;
  flashlight?: boolean;
  blink?: number;
  [key: string]: unknown;
} 