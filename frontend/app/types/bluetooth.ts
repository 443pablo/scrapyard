// Bluetooth Types
export interface BluetoothState {
  isConnecting: boolean;
  isConnected: boolean;
  device: BluetoothDevice | null;
  gattServer: BluetoothRemoteGATTServer | null;
  error: string | null;
  successMessage: string | null;
  isBluetoothSupported: boolean;
  wifiStatus: {
    connected: boolean;
    ip?: string;
    message?: string;
  } | null;
  flashlightStatus: {
    on: boolean;
    available: boolean;
  };
}

export interface BluetoothServices {
  connectToDevice: () => Promise<void>;
  sendCommand: (command: string, params?: Record<string, unknown>) => Promise<boolean>;
  toggleFlashlight: () => Promise<void>;
}

// Note: BluetoothDevice and other types are globally defined in types/global.d.ts 