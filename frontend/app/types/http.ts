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
  toggleSmartlight: () => Promise<void>;
  turnOnSmartlight: () => Promise<void>;
  turnOffSmartlight: () => Promise<void>;
  blinkSmartlight: (intervalMs: number) => Promise<void>;
  getSmartlightStatus: () => Promise<void>;
}

export interface HttpResponse {
  status: 'success' | 'error';
  message: string;
  flashlight?: boolean;
  blink?: number;
  [key: string]: unknown;
} 