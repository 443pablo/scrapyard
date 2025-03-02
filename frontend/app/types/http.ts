export interface HttpState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
  ipAddress: string | null;
}

export interface HttpServices {
  connectToDevice: (ipAddress: string) => Promise<void>;
  disconnectDevice: () => void;
  toggleFlashlight: () => Promise<void>;
  turnOnFlashlight: () => Promise<void>;
  turnOffFlashlight: () => Promise<void>;
  blinkFlashlight: (intervalMs: number) => Promise<void>;
  getFlashlightStatus: () => Promise<void>;
}

export interface HttpResponse {
  status: 'success' | 'error';
  message: string;
  flashlight?: boolean;
  blink?: number;
  [key: string]: unknown;
} 