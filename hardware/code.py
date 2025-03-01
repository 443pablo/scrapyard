print("Starting WiFi and Bluetooth Server")
import time
import os
import wifi
import socketpool
import json
import digitalio
import board

from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService

# Set up the flashlight (built-in LED)
try:
    # Different ESP32 boards may have different LED pin configurations
    # Common options are board.LED or board.D13 - adjust as needed for your specific board
    led_pin = board.LED  # Try this first
    flashlight = digitalio.DigitalInOut(led_pin)
    flashlight.direction = digitalio.Direction.OUTPUT
    flashlight_state = False  # Track the flashlight state
    print("Flashlight initialized successfully")
except Exception as e:
    print(f"Error initializing flashlight: {e}")
    # Fallback to a common pin if LED isn't defined
    try:
        led_pin = board.D13  # Common fallback
        flashlight = digitalio.DigitalInOut(led_pin)
        flashlight.direction = digitalio.Direction.OUTPUT
        flashlight_state = False
        print("Flashlight initialized on fallback pin")
    except Exception as e:
        print(f"Failed to initialize flashlight on fallback pin: {e}")
        flashlight = None
        flashlight_state = False

# BLE setup
ble = BLERadio()
ble.name = "ESP32-Matrix"
uart = UARTService()
advertisement = ProvideServicesAdvertisement(uart)
advertisement.appearance = 0x0080

# Print the UUIDs of services for debugging
print("UART Service UUID:", uart.uuid)
print("Expected RX Characteristic UUID (central -> device): 6e400002-b5a3-f393-e0a9-e50e24dcca9e")
print("Expected TX Characteristic UUID (device -> central): 6e400003-b5a3-f393-e0a9-e50e24dcca9e")

ble.start_advertising(advertisement, interval=0.2)

print(f"Bluetooth server started with name: {ble.name}")

# Function to toggle the flashlight
def toggle_flashlight():
    global flashlight_state
    
    if flashlight is None:
        return {"status": "error", "message": "Flashlight not available"}
    
    # Toggle the state
    flashlight_state = not flashlight_state
    
    # Set the output based on the state
    try:
        flashlight.value = flashlight_state
        
        # Log the state change
        if flashlight_state:
            print("FLASHLIGHT: ON")
        else:
            print("FLASHLIGHT: OFF")
            
        return {
            "status": "success", 
            "message": f"Flashlight turned {'ON' if flashlight_state else 'OFF'}",
            "flashlight": flashlight_state
        }
    except Exception as e:
        print(f"Error toggling flashlight: {e}")
        return {"status": "error", "message": f"Error toggling flashlight: {str(e)}"}

# Function to safely read from the UART service with error handling
def safe_uart_read():
    try:
        if not ble.connected:
            return None
        
        # Check if there's data available before trying to read
        if not uart.in_waiting:
            return None
            
        # Read the data with error handling
        try:
            data = uart.read()
            if data is None:
                return None
            return data
        except TypeError as e:
            print(f"TypeError during UART read: {e}")
            return None
        except Exception as e:
            print(f"Error during UART read: {e}")
            return None
    except Exception as e:
        print(f"Unexpected error in safe_uart_read: {e}")
        return None

# Connect to WiFi using settings.toml credentials
print("Connecting to WiFi...")

try:
    # Get credentials from settings.toml (these are accessed through os.getenv)
    ssid = os.getenv("CIRCUITPY_WIFI_SSID")
    password = os.getenv("CIRCUITPY_WIFI_PASSWORD")
    
    print(f"Connecting to network: {ssid}")
    wifi.radio.connect(ssid, password)
    print("Connected to WiFi!")
    print("IP Address:", wifi.radio.ipv4_address)
       
    # Create a socket pool for network connections
    pool = socketpool.SocketPool(wifi.radio)
        
    # Send WiFi status via BLE if a client is connected
    if ble.connected:
        status_msg = json.dumps({
            "status": "success",
            "message": "WiFi connected",
            "ip": str(wifi.radio.ipv4_address)
        })
        uart.write(bytes(status_msg, "utf-8"))
            
except Exception as e:
    print(f"Failed to connect to WiFi: {e}")
    # Send failure status via BLE if a client is connected
    if ble.connected:
        status_msg = json.dumps({
            "status": "error",
            "message": f"WiFi connection failed: {str(e)}"
        })
        uart.write(bytes(status_msg, "utf-8"))

print("Waiting for Bluetooth connections...")

# Track connection state to avoid repeating messages
was_connected = False

while True:
    if ble.connected:
        # Check if this is a new connection
        if not was_connected:
            was_connected = True
            print("Bluetooth client connected!")
            
            # Send current WiFi status to the new client
            try:
                if wifi.radio.connected:
                    status_msg = json.dumps({
                        "status": "success",
                        "message": "WiFi connected",
                        "ip": str(wifi.radio.ipv4_address)
                    })
                else:
                    status_msg = json.dumps({
                        "status": "error",
                        "message": "WiFi not connected"
                    })
                uart.write(bytes(status_msg, "utf-8"))
            except Exception as e:
                print(f"Error sending WiFi status: {e}")
        
        # We're still listening for commands via BLE
        # Use the safe read function instead of directly checking uart.in_waiting
        data = safe_uart_read()
        if data:
            try:
                received_text = data.decode().strip()
                print(f"Received: {received_text}")
                try:
                    # We can still handle commands via Bluetooth if needed
                    command_data = json.loads(received_text)
                    if 'command' in command_data:
                        if command_data['command'] == 'wifi_status':
                            # Send current WiFi status
                            if wifi.radio.connected:
                                status_msg = json.dumps({
                                    "status": "success",
                                    "message": "WiFi connected",
                                    "ip": str(wifi.radio.ipv4_address)
                                })
                            else:
                                status_msg = json.dumps({
                                    "status": "error",
                                    "message": "WiFi not connected"
                                })
                            uart.write(bytes(status_msg, "utf-8"))
                        elif command_data['command'] == 'restart_wifi':
                            # Reconnect to WiFi
                            try:
                                if wifi.radio.connected:
                                    wifi.radio.stop_station()
                                wifi.radio.connect(ssid, password)
                                status_msg = json.dumps({
                                    "status": "success",
                                    "message": "WiFi reconnected",
                                    "ip": str(wifi.radio.ipv4_address)
                                })
                            except Exception as e:
                                status_msg = json.dumps({
                                    "status": "error",
                                    "message": f"WiFi reconnection failed: {str(e)}"
                                })
                            uart.write(bytes(status_msg, "utf-8"))
                        elif command_data['command'] == 'toggle_flashlight':
                            # Toggle the flashlight
                            result = toggle_flashlight()
                            status_msg = json.dumps(result)
                            uart.write(bytes(status_msg, "utf-8"))
                        elif command_data['command'] == 'flashlight_status':
                            # Send current flashlight status
                            if flashlight is None:
                                status_msg = json.dumps({
                                    "status": "error",
                                    "message": "Flashlight not available"
                                })
                            else:
                                status_msg = json.dumps({
                                    "status": "success",
                                    "message": f"Flashlight is {'ON' if flashlight_state else 'OFF'}",
                                    "flashlight": flashlight_state
                                })
                            uart.write(bytes(status_msg, "utf-8"))
                except Exception as e:
                    print(f"Error processing data: {e}")
            except Exception as e:
                print(f"Error decoding data: {e}")
    else:
        # Reset connection state when disconnected
        if was_connected:
            print("Bluetooth client disconnected")
            was_connected = False
            
        if not ble.advertising:
            ble.start_advertising(advertisement)
            print("Advertising BLE service...")
    
    # Add a short delay to prevent tight loop issues
    time.sleep(0.1)