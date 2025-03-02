'use client';

import { useState, useRef, useEffect } from 'react';
import { BluetoothState, BluetoothServices } from '../types';
import { UART_SERVICE_UUID, UART_RX_CHARACTERISTIC_UUID, UART_TX_CHARACTERISTIC_UUID } from '../constants';
import { useDebug } from './useDebug';

export const useBluetooth = (deviceNamePrefix: string): BluetoothState & BluetoothServices => {
  // Bluetooth state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [gattServer, setGattServer] = useState<BluetoothRemoteGATTServer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [wifiStatus, setWifiStatus] = useState<{
    connected: boolean;
    ip?: string;
    message?: string;
  } | null>(null);
  const [flashlightStatus, setSmartlightStatus] = useState<{
    on: boolean;
    available: boolean;
  }>({ on: false, available: true });

  // Bluetooth characteristic references
  const txCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const rxCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  
  // Get debug functionality
  const { addDebug } = useDebug();

  // Check if Web Bluetooth is supported
  useEffect(() => {
    setIsBluetoothSupported('bluetooth' in navigator);
  }, []);

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
  }, [gattServer, addDebug]);

  // Function to send commands to the ESP32 via BLE
  const sendCommand = async (command: string, params?: Record<string, unknown>): Promise<boolean> => {
    try {
      // Check GATT server directly instead of isConnected state
      if (!gattServer) {
        const errorMsg = "No GATT server connection. Please connect first.";
        addDebug(errorMsg);
        setError(errorMsg);
        return false;
      }
      
      // Check if the GATT server is actually connected
      if (!gattServer.connected) {
        const errorMsg = "BLE connection lost. Please reconnect.";
        addDebug(errorMsg);
        setError(errorMsg);
        setIsConnected(false);  // Update UI state to reflect disconnection
        return false;
      }
      
      // Check RX characteristic reference directly
      if (!rxCharacteristicRef.current) {
        const errorMsg = "RX characteristic not available. Try reconnecting.";
        addDebug(errorMsg);
        setError(errorMsg);
        return false;
      }
      
      addDebug(`--------- BLE COMMAND TRANSMISSION START ---------`);
      addDebug(`Timestamp: ${new Date().toISOString()}`);
      addDebug(`Command: "${command}"`);
      
      const commandObj = {
        command,
        ...(params || {})
      };
      
      const commandString = JSON.stringify(commandObj);
      addDebug(`Sending command: ${commandString}`);
      
      // Convert string to ArrayBuffer
      const encoder = new TextEncoder();
      const data = encoder.encode(commandString);
      
      addDebug(`Encoded command length: ${data.length} bytes`);
      
      // Additional debugging for RX characteristic
      addDebug(`RX Characteristic UUID: ${rxCharacteristicRef.current.uuid}`);
      
      // Send the command via BLE
      try {
        addDebug(`Attempting to write value to RX characteristic...`);
        await rxCharacteristicRef.current.writeValue(data);
        addDebug(`Command sent successfully via BLE`);
        addDebug(`--------- BLE COMMAND TRANSMISSION COMPLETE ---------`);
        return true;
      } catch (writeError) {
        const errorMsg = `BLE write error: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
        addDebug(errorMsg);
        addDebug(`--------- BLE COMMAND TRANSMISSION FAILED ---------`);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Error sending command:', error);
      setError(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };
  
  // Function to toggle the flashlight (minimal implementation since WebSocket will handle this)
  const toggleSmartlight = async (): Promise<void> => {
    try {
      addDebug('Sending toggle_flashlight command via Bluetooth (fallback method)...');
      
      if (!rxCharacteristicRef.current) {
        const errorMsg = "RX characteristic isn't ready yet. Please try again in a moment.";
        addDebug(errorMsg);
        setError(errorMsg);
        return;
      }
      
      const success = await sendCommand('toggle_flashlight');
      
      if (success) {
        setSuccessMessage('Smartlight toggle command sent via Bluetooth');
        addDebug(`Bluetooth flashlight toggle command sent (WebSocket preferred when available)`);
      }
    } catch (error) {
      console.error('Error toggling flashlight:', error);
      setError(`Failed to toggle flashlight: ${error instanceof Error ? error.message : String(error)}`);
      addDebug(`Error in toggleSmartlight: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Function to connect to BLE device
  const connectToDevice = async (): Promise<void> => {
    try {
      setIsConnecting(true);
      setError(null);
      
      addDebug('Starting Bluetooth connection process...');
      addDebug(`Looking for devices with namePrefix: ${deviceNamePrefix}`);
      addDebug(`Using UART Service UUID: ${UART_SERVICE_UUID}`);
      
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
        addDebug(`Device ID: ${bluetoothDevice.id}`);
        
        // Immediately try to connect to the GATT server
        addDebug('Connecting to GATT server...');
        
        if (!bluetoothDevice.gatt) {
          throw new Error('Device does not have GATT server');
        }
        
        const server = await bluetoothDevice.gatt.connect();
        
        if (!server) {
          throw new Error('Failed to connect to GATT server');
        }
        
        setGattServer(server);
        addDebug(`GATT server connected: ${server.connected}`);
        
        // Update connection state before continuing
        setIsConnected(true);
        
        // Now try to get the UART service
        addDebug(`Getting UART service with UUID: ${UART_SERVICE_UUID}`);
        try {
          const uartService = await server.getPrimaryService(UART_SERVICE_UUID);
          addDebug('UART service found!');
          
          // Get the TX and RX characteristics
          addDebug(`Looking for RX characteristic: ${UART_RX_CHARACTERISTIC_UUID}`);
          const rxChar = await uartService.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
          addDebug(`RX characteristic found: ${rxChar.uuid}`);
          
          // Store the RX characteristic for later use
          rxCharacteristicRef.current = rxChar;
          
          addDebug(`Looking for TX characteristic: ${UART_TX_CHARACTERISTIC_UUID}`);
          const txChar = await uartService.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
          addDebug(`TX characteristic found: ${txChar.uuid}`);
          
          // Store the TX characteristic for later use
          txCharacteristicRef.current = txChar;
          
          // Set up notification handler for incoming messages
          if (txChar.properties.notify) {
            addDebug('Setting up notification listener on TX characteristic...');
            try {
              await txChar.startNotifications();
              addDebug('Successfully started notifications on TX characteristic');
            } catch (notifyError) {
              addDebug(`Error starting notifications: ${notifyError instanceof Error ? notifyError.message : String(notifyError)}`);
            }
            
            // Add notification handler for incoming BLE messages
            txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
              const target = event.target as unknown;
              const characteristic = target as BluetoothRemoteGATTCharacteristic & { value: DataView };
              const value = characteristic.value;
              const decoder = new TextDecoder('utf-8');
              const response = decoder.decode(value);
              addDebug(`Received BLE response: ${response}`);
              
              try {
                const responseData = JSON.parse(response);
                addDebug(`DEVICE RESPONSE [${new Date().toISOString()}]: ${JSON.stringify(responseData, null, 2)}`);
                
                if (responseData.status === 'success') {
                  setSuccessMessage(responseData.message || 'Operation successful!');
                  
                  // Process WiFi status information (primary purpose of Bluetooth)
                  if (responseData.ip) {
                    setWifiStatus({
                      connected: true,
                      ip: responseData.ip,
                      message: responseData.message
                    });
                    
                    addDebug(`WiFi Status Updated: Connected to IP ${responseData.ip}`);
                  }
                  
                  // Still handle flashlight state updates for backward compatibility
                  if (responseData.hasOwnProperty('flashlight') !== undefined) {
                    setSmartlightStatus({
                      on: responseData.flashlight,
                      available: true
                    });
                  }
                } else {
                  setError(responseData.message || 'Operation failed');
                  
                  // Handle WiFi status errors
                  if (responseData.hasOwnProperty('connected')) {
                    setWifiStatus({
                      connected: responseData.connected,
                      message: responseData.message
                    });
                  }
                }
              } catch (e) {
                addDebug(`Error parsing JSON response: ${e}`);
                setSuccessMessage(`Received: ${response}`);
              }
            });
            
            // Wait for connection to stabilize
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Automatically send wifi_status command after connecting
            addDebug('Automatically requesting WiFi status...');
            sendCommand('wifi_status');
            
            setSuccessMessage('Connected and ready!');
          } else {
            addDebug('TX characteristic does not support notifications!');
          }
          
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          addDebug(`Error getting UART service: ${errorMessage}`);
          throw new Error(`Failed to get UART service: ${errorMessage}`);
        }
      } catch (err) {
        throw new Error(`Bluetooth connection error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      console.error('Error connecting to device:', err);
      setError(`${err instanceof Error ? err.message : String(err)}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  return {
    // State
    isConnecting,
    isConnected,
    device,
    gattServer,
    error,
    successMessage,
    isBluetoothSupported,
    wifiStatus,
    flashlightStatus,
    
    // Methods
    connectToDevice,
    sendCommand,
    toggleSmartlight
  };
}; 