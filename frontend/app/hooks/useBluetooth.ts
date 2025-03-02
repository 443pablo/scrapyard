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
  const [flashlightStatus, setFlashlightStatus] = useState<{
    on: boolean;
    available: boolean;
  }>({ on: false, available: true });

  // Bluetooth characteristic references
  const txCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const rxCharacteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  
  // Interval reference for status polling
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
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

      // Also clear any active status check interval
      if (statusIntervalRef.current) {
        addDebug('Component unmounting, clearing status polling interval');
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
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
      addDebug(`Encoded data (hex): ${Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
      
      // Check if data exceeds BLE packet size (typically ~20 bytes)
      if (data.length > 20) {
        addDebug(`Warning: Command exceeds typical BLE packet size (${data.length} bytes)`);
      }
      
      // Additional debugging for RX characteristic
      addDebug(`RX Characteristic UUID: ${rxCharacteristicRef.current.uuid}`);
      addDebug(`RX Characteristic Properties: ${JSON.stringify({
        write: rxCharacteristicRef.current.properties.write,
        writeWithoutResponse: rxCharacteristicRef.current.properties.writeWithoutResponse
      })}`);
      
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
  
  // Function to toggle the flashlight
  const toggleFlashlight = async (): Promise<void> => {
    try {
      addDebug('Sending toggle_flashlight command...');
      addDebug(`Current UI flashlight state: ${flashlightStatus.on ? 'ON' : 'OFF'}`);
      
      // Direct check for characteristics instead of relying on state variables
      if (!rxCharacteristicRef.current) {
        const errorMsg = "RX characteristic isn't ready yet. Please try again in a moment.";
        addDebug(errorMsg);
        setError(errorMsg);
        return;
      }
      
      // Add more detailed logging for flashlight toggle action
      addDebug(`USER ACTION: Clicked ${flashlightStatus.on ? 'Turn Off' : 'Turn On'} Flashlight button`);
      addDebug(`Timestamp: ${new Date().toISOString()}`);
      
      // Add more debugging to see the command object
      const commandObj = {
        command: 'toggle_flashlight'
      };
      addDebug(`Command object: ${JSON.stringify(commandObj)}`);
      
      const success = await sendCommand('toggle_flashlight');
      
      addDebug(`Command sent successfully: ${success}`);
      
      if (success) {
        // We'll let the notification handler update the actual state
        // after receiving confirmation from the device
        setSuccessMessage('Flashlight toggle command sent');
        addDebug(`Waiting for device response with updated flashlight state...`);
      }
    } catch (error) {
      console.error('Error toggling flashlight:', error);
      setError(`Failed to toggle flashlight: ${error instanceof Error ? error.message : String(error)}`);
      addDebug(`Error in toggleFlashlight: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Function to request flashlight status
  const requestFlashlightStatus = async (): Promise<void> => {
    try {
      // Check if we're ready to send commands
      if (!rxCharacteristicRef.current) {
        addDebug("Cannot request flashlight status - RX characteristic not available yet");
        return;
      }
      
      addDebug('Requesting flashlight status...');
      const success = await sendCommand('flashlight_status');
      addDebug(`Flashlight status request sent: ${success}`);
    } catch (e) {
      addDebug(`Error requesting flashlight status: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Setup polling for flashlight status when connected
  useEffect(() => {
    // Start polling when connected
    if (isConnected && gattServer && gattServer.connected) {
      addDebug('Starting flashlight status polling');
      
      // Clear any existing interval first
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
      
      // Set up new interval
      statusIntervalRef.current = setInterval(() => {
        // Check if still connected before requesting status
        if (gattServer && gattServer.connected && rxCharacteristicRef.current) {
          addDebug('Polling: checking flashlight status');
          requestFlashlightStatus();
        } else {
          addDebug('Polling: detected disconnection, updating UI');
          setIsConnected(false);
          // Clear the interval since we're disconnected
          if (statusIntervalRef.current) {
            clearInterval(statusIntervalRef.current);
            statusIntervalRef.current = null;
          }
        }
      }, 3000); // Poll every 3 seconds
    }
    
    // Cleanup function to clear the interval
    return () => {
      if (statusIntervalRef.current) {
        addDebug('Stopping flashlight status polling');
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [isConnected, gattServer, addDebug]);

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
          
          // Log all characteristics available in the service
          try {
            const allCharacteristics = await uartService.getCharacteristics();
            addDebug(`Service has ${allCharacteristics.length} characteristics:`);
            for (const char of allCharacteristics) {
              addDebug(`- UUID: ${char.uuid}, Properties: ${JSON.stringify({
                read: char.properties.read,
                write: char.properties.write,
                writeWithoutResponse: char.properties.writeWithoutResponse,
                notify: char.properties.notify,
                indicate: char.properties.indicate
              })}`);
            }
          } catch (charError) {
            addDebug(`Error listing all characteristics: ${charError instanceof Error ? charError.message : String(charError)}`);
          }
          
          // Test getting the TX and RX characteristics to make sure they exist
          addDebug(`Looking for RX characteristic: ${UART_RX_CHARACTERISTIC_UUID}`);
          const rxChar = await uartService.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);
          addDebug(`RX characteristic found: ${rxChar.uuid}`);
          addDebug(`RX properties: write=${rxChar.properties.write}, writeWithoutResponse=${rxChar.properties.writeWithoutResponse}`);
          
          if (!rxChar.properties.write && !rxChar.properties.writeWithoutResponse) {
            addDebug('WARNING: RX characteristic does not support writing! Communication may fail.');
          }
          
          // Store the RX characteristic for later use
          rxCharacteristicRef.current = rxChar;
          
          addDebug(`Looking for TX characteristic: ${UART_TX_CHARACTERISTIC_UUID}`);
          const txChar = await uartService.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);
          addDebug(`TX characteristic found: ${txChar.uuid}`);
          addDebug(`TX properties: notify=${txChar.properties.notify}, indicate=${txChar.properties.indicate}`);
          
          if (!txChar.properties.notify && !txChar.properties.indicate) {
            addDebug('WARNING: TX characteristic does not support notifications or indications! Communication may fail.');
          }
          
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
            
            // Add detailed debug about event listener
            addDebug('Adding characteristicvaluechanged event listener');
            txChar.addEventListener('characteristicvaluechanged', (event: Event) => {
              addDebug(`Notification event received from device`);
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
                addDebug(`DEVICE RESPONSE [${new Date().toISOString()}]: ${JSON.stringify(responseData, null, 2)}`);
                
                if (responseData.status === 'success') {
                  setSuccessMessage(responseData.message || 'Operation successful!');
                  
                  // Handle flashlight status updates
                  if (responseData.hasOwnProperty('flashlight') !== undefined) {
                    const previousState = flashlightStatus.on;
                    const newState = responseData.flashlight;
                    
                    setFlashlightStatus({
                      on: newState,
                      available: true
                    });
                    
                    addDebug(`FLASHLIGHT STATE CHANGE: ${previousState ? 'ON' : 'OFF'} → ${newState ? 'ON' : 'OFF'}`);
                    
                    // Additional detailed logging for state changes
                    if (previousState !== newState) {
                      addDebug(`UI updated to reflect flashlight state change at ${new Date().toISOString()}`);
                    } else {
                      addDebug(`Flashlight state unchanged (still ${newState ? 'ON' : 'OFF'})`);
                    }
                  }
                  
                  // Display additional log information if available
                  if (responseData.log) {
                    addDebug(`DEVICE LOG: ${responseData.log}`);
                  }
                  
                  if (responseData.ip) {
                    setWifiStatus({
                      connected: true,
                      ip: responseData.ip,
                      message: responseData.message
                    });
                  }
                } else {
                  setError(responseData.message || 'Operation failed');
                  
                  // Handle flashlight not available errors
                  if (responseData.message && responseData.message.includes('Flashlight not available')) {
                    setFlashlightStatus({
                      on: false,
                      available: false
                    });
                    
                    addDebug('Flashlight is not available on this device');
                  }
                  
                  if (responseData.hasOwnProperty('connected')) {
                    setWifiStatus({
                      connected: responseData.connected,
                      message: responseData.message
                    });
                  }
                }
              } catch (e) {
                addDebug(`Error parsing JSON response: ${e}`);
                // Still show the raw response
                setSuccessMessage(`Received: ${response}`);
              }
            });
            
            // Add a small delay to ensure connection is stable before requesting status
            addDebug('Waiting for connection to stabilize...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Request the current flashlight status after connecting
            requestFlashlightStatus();
            
            setSuccessMessage('Connected and ready!');
          } else {
            addDebug('TX characteristic does not support notifications!');
          }
          
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          addDebug(`Error getting UART service: ${errorMessage}`);
          
          // Try to list all available services for debugging
          try {
            const services = await server.getPrimaryServices();
            addDebug(`Found ${services.length} services:`);
            for (const service of services) {
              addDebug(`Service UUID: ${service.uuid}`);
            }
          } catch (e) {
            addDebug(`Error listing services: ${e instanceof Error ? e.message : String(e)}`);
          }
          
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
    toggleFlashlight,
    requestFlashlightStatus
  };
}; 