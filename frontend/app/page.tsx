"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
    getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  }

  interface BluetoothRemoteGATTCharacteristic {
    writeValue(value: BufferSource): Promise<void>;
  }
}

export default function Home() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [wifiName, setWifiName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if Web Bluetooth is supported
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);

  useEffect(() => {
    setIsBluetoothSupported('bluetooth' in navigator);
  }, []);

  const connectToDevice = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Request the device with a specific service UUID (you'll need to replace this with your Raspberry Pi's service UUID)
      const bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['battery_service'] } // Replace with your actual service UUID
          // Alternatively, you can use: { namePrefix: 'Raspberry Pi' }
        ],
        optionalServices: ['generic_access'] // Add any other services you need
      });
      
      setDevice(bluetoothDevice);
      setIsConnected(true);
      //setSuccessMessage("Successfully connected to device!");
      setSuccessMessage(null);

      // Setup disconnect listener
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setDevice(null);
        setSuccessMessage(null);
      });

    } catch (err) {
      console.error('Error connecting to device:', err);
      if (err instanceof Error && err.message === 'User cancelled the requestDevice() chooser.') {
        setError('Device selection cancelled. Please try again when ready.');
      } else {
        setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const sendWifiCredentials = async () => {
    if (!device || !device.gatt) {
      setError("No device connected");
      return;
    }

    if (!wifiName || !wifiPassword) {
      setError("Please enter both WiFi name and password");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);
      
      // Connect to the GATT server
      const server = await device.gatt.connect();
      
      // Get the primary service (replace with your actual service UUID)
      const service = await server.getPrimaryService('battery_service'); // Replace with your actual service UUID
      
      // Get the characteristic (replace with your actual characteristic UUID)
      const characteristic = await service.getCharacteristic('battery_level'); // Replace with your actual characteristic UUID
      
      // Create the WiFi credentials data
      const wifiData = JSON.stringify({
        ssid: wifiName,
        password: wifiPassword
      });
      
      // Convert the string to bytes
      const encoder = new TextEncoder();
      const wifiDataBytes = encoder.encode(wifiData);
      
      // Send the data
      await characteristic.writeValue(wifiDataBytes);
      
      setSuccessMessage("WiFi credentials sent successfully!");
    } catch (err) {
      console.error('Error sending WiFi credentials:', err);
      setError(`Failed to send WiFi credentials: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="min-h-screen p-8 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <main className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Flashlight Setup</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
            Connect to your Flashlight via Bluetooth and send WiFi credentials
          </p>
        </div>

        {!isBluetoothSupported && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>Web Bluetooth is not supported in this browser. Please use Chrome, Edge, or any other chromium based browser.</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
            <p>{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
            <p>{successMessage}</p>
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={connectToDevice}
            disabled={isConnecting || !isBluetoothSupported}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isConnecting ? 'Connecting...' : 'Pair Flashlight'}
          </button>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2 mb-4 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Connected to {device?.name || 'device'}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="ssid" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WiFi Name (SSID)
                </label>
                <input
                  type="text"
                  id="ssid"
                  value={wifiName}
                  onChange={(e) => setWifiName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter WiFi name"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WiFi Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Enter WiFi password"
                />
              </div>
              
              <button
                onClick={sendWifiCredentials}
                disabled={isConnecting || !wifiName || !wifiPassword}
                className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? 'Sending...' : 'Send WiFi Credentials'}
              </button>
            </div>
          </div>
        )}
      </main>
      
      <footer className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Make sure your Flashlight is on and within range.</p>
      </footer>
    </div>
  );
}
