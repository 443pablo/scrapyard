print("Starting WiFi, Bluetooth, and HTTP Server")
import time
import os
import wifi
import socketpool
import json
import asyncio

from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService

# Import HTTP server support
from adafruit_httpserver import Server, Request, Response, GET

# Set up virtual flashlight (console logging only for now)
flashlight_state = False  # Track the flashlight state
print("Virtual flashlight initialized (console logging only)")

# BLE setup for pairing
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
    
    # Toggle the state
    flashlight_state = not flashlight_state
    
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

# Function to turn the flashlight on
def flashlight_on():
    global flashlight_state
    
    if not flashlight_state:
        flashlight_state = True
        print("FLASHLIGHT: ON")
        return {
            "status": "success", 
            "message": "Flashlight turned ON",
            "flashlight": True
        }
    else:
        return {
            "status": "success", 
            "message": "Flashlight is already ON",
            "flashlight": True
        }

# Function to turn the flashlight off
def flashlight_off():
    global flashlight_state
    
    if flashlight_state:
        flashlight_state = False
        print("FLASHLIGHT: OFF")
        return {
            "status": "success", 
            "message": "Flashlight turned OFF",
            "flashlight": False
        }
    else:
        return {
            "status": "success", 
            "message": "Flashlight is already OFF",
            "flashlight": False
        }

# Function to blink the flashlight (simulated with console logs for now)
def blink_flashlight(interval_ms=1000):
    interval_sec = interval_ms / 1000.0
    print(f"FLASHLIGHT: BLINKING every {interval_sec} seconds (simulated)")
    return {
        "status": "success",
        "message": f"Flashlight blinking simulation started (interval: {interval_sec}s)",
        "blink": interval_ms
    }

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

# HTTP server variables
server = None
pool = None

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
    
    # Initialize the HTTP server
    server = Server(pool, debug=True)
    
    # Define HTTP routes for flashlight control
    @server.route("/hello", GET)
    def hello_world(request: Request):
        return Response(request, "Hello World!")
    
    @server.route("/flashlight/on", GET)
    def route_flashlight_on(request: Request):
        result = flashlight_on()
        return Response(request, json.dumps(result), content_type="application/json")
    
    @server.route("/flashlight/off", GET)
    def route_flashlight_off(request: Request):
        result = flashlight_off()
        return Response(request, json.dumps(result), content_type="application/json")
    
    @server.route("/flashlight/toggle", GET)
    def route_flashlight_toggle(request: Request):
        result = toggle_flashlight()
        return Response(request, json.dumps(result), content_type="application/json")
    
    @server.route("/flashlight/blink", GET)
    def route_flashlight_blink(request: Request):
        # Get interval parameter from query string if provided
        params = request.query_params
        interval_ms = 1000  # Default to 1000ms
        
        if "interval" in params:
            try:
                interval_ms = int(params["interval"])
            except ValueError:
                pass  # Stick with default on error
        
        result = blink_flashlight(interval_ms)
        return Response(request, json.dumps(result), content_type="application/json")
    
    @server.route("/flashlight/status", GET)
    def route_flashlight_status(request: Request):
        status = {
            "status": "success",
            "message": f"Flashlight is {'ON' if flashlight_state else 'OFF'}",
            "flashlight": flashlight_state
        }
        return Response(request, json.dumps(status), content_type="application/json")
    
    # Start the server
    server.start(str(wifi.radio.ipv4_address))
    print(f"HTTP server started on http://{wifi.radio.ipv4_address}/")
        
    # Send WiFi status via BLE if a client is connected
    if ble.connected:
        status_msg = json.dumps({
            "status": "success",
            "message": "WiFi connected",
            "ip": str(wifi.radio.ipv4_address)
        })
        uart.write(bytes(status_msg, "utf-8"))
            
except Exception as e:
    print(f"Failed to connect to WiFi or setup server: {e}")
    # Send failure status via BLE if a client is connected
    if ble.connected:
        status_msg = json.dumps({
            "status": "error",
            "message": f"WiFi connection failed: {str(e)}"
        })
        uart.write(bytes(status_msg, "utf-8"))

print("Waiting for Bluetooth connections and HTTP requests...")

# Track connection state to avoid repeating messages
was_ble_connected = False

# Main loop
async def main():
    global was_ble_connected
    
    while True:
        # Handle HTTP server requests
        if server:
            server.poll()
        
        # Handle Bluetooth connections for pairing
        if ble.connected:
            # Check if this is a new connection
            if not was_ble_connected:
                was_ble_connected = True
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
            
            # We're still listening for commands via BLE for initial setup/pairing
            data = safe_uart_read()
            if data:
                try:
                    received_text = data.decode().strip()
                    print(f"Received via BLE: {received_text}")
                    try:
                        # Handle BLE commands for WiFi status and reconnection only
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
                    except Exception as e:
                        print(f"Error processing BLE data: {e}")
                except Exception as e:
                    print(f"Error decoding BLE data: {e}")
        else:
            # Reset connection state when disconnected from BLE
            if was_ble_connected:
                print("Bluetooth client disconnected")
                was_ble_connected = False
                
            if not ble.advertising:
                ble.start_advertising(advertisement)
                print("Advertising BLE service...")
        
        # Add a short delay to prevent tight loop issues
        await asyncio.sleep(0.1)

# Run the main async loop
try:
    asyncio.run(main())
except Exception as e:
    print(f"Error in main loop: {e}")
    # If asyncio is not supported or fails, fall back to regular loop
    was_ble_connected = False
    while True:
        if server:
            server.poll()
            
        # Handle BLE connections (simplified without WebSocket handling)
        if ble.connected:
            if not was_ble_connected:
                was_ble_connected = True
                print("Bluetooth client connected!")
                
        else:
            if was_ble_connected:
                print("Bluetooth client disconnected")
                was_ble_connected = False
                
            if not ble.advertising:
                ble.start_advertising(advertisement)
        
        time.sleep(0.1)