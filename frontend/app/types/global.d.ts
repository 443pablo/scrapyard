// Global type declarations for Web Bluetooth API and Web Speech API
declare global {
  interface Navigator {
    bluetooth: {
      requestDevice(options: {
        filters?: Array<{
          services?: string[];
          name?: string;
          namePrefix?: string;
        }>;
        optionalServices?: string[];
      }): Promise<BluetoothDevice>;
    };
  }
  
  // Speech Recognition Types
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
    currentRecognition: SpeechRecognitionInstance | null;
  }
  
  // Custom types for Speech Recognition
  interface SpeechRecognitionConstructor {
    new(): SpeechRecognitionInstance;
  }
  
  interface SpeechRecognitionInstance {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: (event: SpeechRecognitionResultEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
  }
  
  interface SpeechRecognitionResultEvent {
    results: {
      readonly length: number;
      [index: number]: {
        readonly isFinal: boolean;
        readonly length: number;
        [index: number]: {
          readonly transcript: string;
          readonly confidence: number;
        };
      };
    };
  }
  
  interface SpeechRecognitionErrorEvent {
    error: string;
  }

  interface BluetoothDevice {
    id: string;
    name?: string;
    gatt?: {
      connect(): Promise<BluetoothRemoteGATTServer>;
    };
    addEventListener(
      type: 'gattserverdisconnected',
      listener: EventListenerOrEventListenerObject
    ): void;
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean;
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
    disconnect(): void;
  }

  interface BluetoothRemoteGATTService {
    uuid: string;
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    uuid: string;
    writeValue(value: BufferSource): Promise<void>;
    properties: {
      notify: boolean;
      read: boolean;
      write: boolean;
      writeWithoutResponse: boolean;
      indicate: boolean;
    };
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
    addEventListener(
      type: string,
      listener: (event: Event & { target: BluetoothRemoteGATTCharacteristic & { value: DataView } }) => void
    ): void;
  }
}

// This empty export makes TypeScript treat this file as a module
export {}; 