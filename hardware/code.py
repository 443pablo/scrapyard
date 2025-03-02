import os
import wifi
import socketpool
import json
from adafruit_httpserver import Server, Request, Response, GET, OPTIONS
import board
import digitalio
import time
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService
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
relay = digitalio.DigitalInOut(board.IO1)
relay.direction = digitalio.Direction.OUTPUT

mode = 'off'
delay = 500
def turn_on():
    relay.value = False
def turn_off():
    relay.value = True
def toggle():
    relay.value = not relay.value
def flash(delay=500):
    turn_on()
    time.sleep(delay/1000)
    turn_off()
    time.sleep(delay/1000)

turn_off()
ssid = os.getenv("CIRCUITPY_WIFI_SSID")
password = os.getenv("CIRCUITPY_WIFI_PASSWORD")
print(f"Connecting to network: {ssid}")
wifi.radio.connect(ssid, password)
print("Connected to WiFi!")
print("IP Address:", wifi.radio.ipv4_address)
# Initialize Wi-Fi and Socket Pool
pool = socketpool.SocketPool(wifi.radio)
# Create a server instance
server = Server(pool, debug=True)
# Set CORS headers at the server level
server.headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
}
disabled=None
# Define a route and handler
@server.route("/", GET)
def base(request: Request):
    """Handles requests to the root URL ("/")"""
    return Response(request, "Hello from Adafruit HTTPServer!")
@server.route("/on", GET)
def route_flashlight_on(request: Request):
    global delay, mode
    mode = 'on'
    return Response(request, json.dumps({}), content_type="application/json")
@server.route("/off", GET)
def route_flashlight_off(request: Request):
    global delay, mode
    mode = 'off'
    return Response(request, json.dumps({}), content_type="application/json")
@server.route("/toggle", GET)
def route_flashlight_toggle(request: Request):
    global delay, mode
    if mode == 'on':
        mode = 'off'
    else:
        mode = 'on'
    return Response(request, json.dumps({}), content_type="application/json")
@server.route("/flash", GET)
def route_flashlight_blink(request: Request):
    global delay, mode
    # Get interval parameter from query string if provided
    params = request.query_params
    interval_ms = 500  # Default to 1000ms
    if "interval" in params:
        try:
            interval_ms = int(params["interval"])
        except ValueError:
            pass  # Stick with default on error
    delay = interval_ms
    mode = 'flash'
    return Response(request, json.dumps({}), content_type="application/json")
@server.route("/disable", GET)
def route_flashlight_blink(request: Request):
    global disabled
    turn_off()
    disabled = time.time() + 60
    return Response(request, json.dumps({}), content_type="application/json")
# Start the server
server.start()
was_ble_connected = False
# Main loop to process requests

while True:
    server.poll()
    if disabled != None:
        if time.time() > disabled:
            disabled = None
    if disabled == None:
        if mode == 'off':
            turn_off()
        if mode == 'on':
            turn_on()
        if mode == 'flash':
            flash(delay)
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