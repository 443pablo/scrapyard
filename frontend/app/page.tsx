"use client";

import { useState, useEffect } from "react";

// Add type declarations for Web Bluetooth API
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
    }
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

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [serviceUUID, setServiceUUID] = useState<string | null>(null);
  const [debug, setDebug] = useState<string[]>([]);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<{
    connected: boolean;
    ip?: string;
    message?: string;
  } | null>(null);

  // Get environment variables
  const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Device Setup';
  const deviceNamePrefix = process.env.NEXT_PUBLIC_DEVICE_NAME_PREFIX || 'ESP32';
  
  // Nordic UART Service UUID constants - these are the standard UUIDs used by Adafruit BLE
  const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // RX from the device's perspective (write from central)
  const UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // TX from the device's perspective (read from central)
  
  // Check if Web Bluetooth is supported
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);

  useEffect(() => {
    setIsBluetoothSupported('bluetooth' in navigator);
  }, []);

  // Add keyboard event listener for Ctrl+K to toggle debug log
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+K
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault(); // Prevent default browser behavior
        setIsDebugVisible(prev => !prev); // Toggle debug visibility
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener when component unmounts
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Helper function to add debug messages
  const addDebug = (message: string) => {
    console.log(message);
    setDebug(prev => [...prev, message]);
  };

  // Cleanup function for when component unmounts
  useEffect(() => {
    return () => {
      // Disconnect any active connections when component unmounts
      if (gattServer && gattServer.connected) {
        try {
          gattServer.disconnect();
          addDebug('Component unmounting, connection closed');
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
      }
    };
  }, [gattServer]);

  const connectToDevice = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setDebug([]);
      
      addDebug('Requesting Bluetooth device...');
      
      // Request the device with the exact UART service UUID
      try {
        const bluetoothDevice = await navigator.bluetooth.requestDevice({
          filters: [
            { namePrefix: deviceNamePrefix }
          ],
          // Only include the exact UART service UUID we know is used by Adafruit BLE
          optionalServices: [UART_SERVICE_UUID]
        });
        
        setDevice(bluetoothDevice);
        
        addDebug(`Device selected: ${bluetoothDevice.name || 'unnamed device'}`);
        
        // Immediately try to connect to the GATT server
        addDebug('Connecting to GATT server...');
        const server = await bluetoothDevice.gatt?.connect();
        
        if (!server) {
          throw new Error('Failed to connect to GATT server');
        }
        
        setGattServer(server);
        setIsConnected(true);
        
        // Now try to get the UART service
        addDebug(`Getting UART service with UUID: ${UART_SERVICE_UUID}`);
        try {
          const uartService = await server.getPrimaryService(UART_SERVICE_UUID);
          setServiceUUID(UART_SERVICE_UUID);
          addDebug('UART service found!');
          
          // Test getting the TX and RX characteristics to make sure they exist
          const rxChar = await uartService.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
          addDebug(`RX characteristic found: ${rxChar.uuid}`);
          
          const txChar = await uartService.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
          addDebug(`TX characteristic found: ${txChar.uuid}`);
          
          // Set up notification handler for incoming messages
          if (txChar.properties.notify) {
            addDebug('Setting up notification listener on TX characteristic...');
            await txChar.startNotifications();
            txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
              // Type-cast event.target with a safer approach
              const target = event.target as unknown;
              // Now it's safe to cast to our expected type
              const characteristic = target as BluetoothRemoteGATTCharacteristic & { value: DataView };
              const value = characteristic.value;
              const decoder = new TextDecoder('utf-8');
              const response = decoder.decode(value);
              addDebug(`Received response: ${response}`);
              
              try {
                const responseData = JSON.parse(response);
                if (responseData.status === 'success') {
                  setSuccessMessage(responseData.message || 'Operation successful!');
                  if (responseData.ip) {
                    setWifiStatus({
                      connected: true,
                      ip: responseData.ip,
                      message: responseData.message
                    });
                  }
                } else if (responseData.status === 'error') {
                  setError(responseData.message || 'Operation failed');
                  setWifiStatus({
                    connected: false,
                    message: responseData.message
                  });
                }
              } catch {
                // No parameter needed when not using it
                addDebug(`Response was not JSON: ${response}`);
              }
            });
          } else {
            addDebug('TX characteristic does not support notifications');
          }
          
          // Request initial WiFi status
          await requestWifiStatus();
          
          setSuccessMessage('Ready to monitor device!');
        } catch (err) {
          addDebug(`Error accessing UART service: ${err instanceof Error ? err.message : String(err)}`);
        }

        // Setup disconnect listener
        bluetoothDevice.addEventListener('gattserverdisconnected', () => {
          addDebug('GATT Server disconnected');
          setIsConnected(false);
          setGattServer(null);
          setServiceUUID(null);
          setWifiStatus(null);
          setSuccessMessage(null);
          setError("Device disconnected. Please reconnect and try again.");
        });

      } catch (err) {
        addDebug(`Error with specific connection attempt: ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    } catch (err) {
      console.error('Error connecting to device:', err);
      // Check for user cancellation with a more friendly message
      if (err instanceof Error && err.message.includes('cancelled the requestDevice() chooser')) {
        setError('Device selection cancelled. You can try again when ready!');
      } else {
        setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to request WiFi status
  const requestWifiStatus = async () => {
    if (!device || !gattServer?.connected) {
      setError("No device connected");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      addDebug(`Getting UART service: ${UART_SERVICE_UUID}`);
      const service = await gattServer.getPrimaryService(UART_SERVICE_UUID);
      
      addDebug(`Getting RX characteristic: ${UART_RX_CHARACTERISTIC_UUID}`);
      const rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
      
      // Create the command data
      const commandData = JSON.stringify({
        command: 'wifi_status'
      });
      
      // Convert the string to bytes
      const encoder = new TextEncoder();
      const commandBytes = encoder.encode(commandData);
      
      addDebug(`Sending command: ${commandData}`);
      // Send the data
      await rxCharacteristic.writeValue(commandBytes);
      
    } catch (err) {
      console.error('Error requesting WiFi status:', err);
      setError(`Failed to request WiFi status: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  // Function to restart WiFi connection
  const restartWifi = async () => {
    if (!device || !gattServer?.connected) {
      setError("No device connected");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      addDebug(`Getting UART service: ${UART_SERVICE_UUID}`);
      const service = await gattServer.getPrimaryService(UART_SERVICE_UUID);
      
      addDebug(`Getting RX characteristic: ${UART_RX_CHARACTERISTIC_UUID}`);
      const rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
      
      // Create the command data
      const commandData = JSON.stringify({
        command: 'restart_wifi'
      });
      
      // Convert the string to bytes
      const encoder = new TextEncoder();
      const commandBytes = encoder.encode(commandData);
      
      addDebug(`Sending command: ${commandData}`);
      // Send the data
      await rxCharacteristic.writeValue(commandBytes);
      
      setSuccessMessage("WiFi restart command sent!");
      
    } catch (err) {
      console.error('Error restarting WiFi:', err);
      setError(`Failed to restart WiFi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{appName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Connect to your device and monitor WiFi status
          </p>
        </div>

        {!isBluetoothSupported && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or another compatible browser.</p>
          </div>
        )}

        {/* Device Connection Status */}
        <div className="mb-6">
          {isConnected ? (
            <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-medium">Connected to {device?.name || 'device'}</span>
              </div>
              {successMessage && <p className="mt-2">{successMessage}</p>}
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
              <p>{error}</p>
            </div>
          ) : null}
        </div>

        {/* WiFi Status Display */}
        {wifiStatus && (
          <div className={`mb-6 p-4 ${wifiStatus.connected ? 
            'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'} rounded-lg`}>
            <h3 className="font-medium mb-2">WiFi Status</h3>
            <p>{wifiStatus.connected ? 'Connected' : 'Disconnected'}</p>
            {wifiStatus.message && <p className="text-sm mt-1">{wifiStatus.message}</p>}
            {wifiStatus.ip && <p className="font-mono text-sm mt-1">IP: {wifiStatus.ip}</p>}
          </div>
        )}

        {/* Add debug information section with toggle indicator */}
        {debug.length > 0 && (
          <div className="relative">
            {isDebugVisible && (
              <div className="mt-2 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-xs font-mono overflow-auto max-h-60">
                <h3 className="text-sm font-semibold mb-2">Debug Log:</h3>
                <ul className="space-y-1">
                  {debug.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={connectToDevice}
            disabled={isConnecting || !isBluetoothSupported}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Connect to Device'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4">
              <button
                onClick={requestWifiStatus}
                disabled={isConnecting}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? 'Requesting...' : 'Refresh WiFi Status'}
              </button>
              
              <button
                onClick={restartWifi}
                disabled={isConnecting}
                className="w-full py-3 px-4 bg-yellow-600 hover:bg-yellow-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? 'Restarting...' : 'Restart WiFi Connection'}
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>WiFi credentials are configured in settings.toml on the device.</p>
        {debug.length > 0 && (
          <p className="mt-1 cursor-pointer hover:underline" onClick={() => setIsDebugVisible(prev => !prev)}>
            {isDebugVisible ? 'Hide' : 'Show'} Debug Log (Ctrl+K)
          </p>
        )}
      </footer>
    </div>
  );
}
