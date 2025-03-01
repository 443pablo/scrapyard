import asyncio
import json
import websockets
import socket
import threading

# Configuration
BT_SIM_HOST = 'localhost'
BT_SIM_PORT = 8888
WS_HOST = 'localhost'
WS_PORT = 8000

# Global connection to the Bluetooth simulator
bt_socket = None

async def handle_websocket(websocket):
    """Handle WebSocket connections from frontend clients."""
    global bt_socket
    
    print(f"[+] New WebSocket connection established")
    
    try:
        # If not already connected to the Bluetooth simulator, connect now
        if bt_socket is None:
            try:
                bt_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                bt_socket.connect((BT_SIM_HOST, BT_SIM_PORT))
                print(f"[+] Connected to Bluetooth simulator at {BT_SIM_HOST}:{BT_SIM_PORT}")
            except Exception as e:
                print(f"[!] Failed to connect to Bluetooth simulator: {e}")
                await websocket.send(json.dumps({
                    "type": "error",
                    "message": f"Failed to connect to Bluetooth device: {str(e)}"
                }))
                return
        
        # Start a thread to read from the Bluetooth socket and forward to WebSocket
        def bt_reader():
            try:
                while True:
                    data = bt_socket.recv(1024)
                    if not data:
                        break
                    # Create an async task to send the data to the WebSocket
                    message = {
                        "type": "message",
                        "data": data.decode()
                    }
                    asyncio.run_coroutine_threadsafe(
                        websocket.send(json.dumps(message)), 
                        asyncio.get_event_loop()
                    )
            except Exception as e:
                print(f"[!] Error reading from Bluetooth: {e}")
            finally:
                print("[-] Bluetooth reader thread stopped")
        
        reader_thread = threading.Thread(target=bt_reader)
        reader_thread.daemon = True
        reader_thread.start()
        
        # Send initial connection status
        await websocket.send(json.dumps({
            "type": "status",
            "connected": True,
            "deviceName": "Simulated ESP32-Matrix"
        }))
        
        # Process messages from the WebSocket (frontend)
        async for message in websocket:
            try:
                # Parse the message
                data = json.loads(message)
                
                # Check the type of message
                if data.get("type") == "wifi_credentials":
                    # Forward WiFi credentials to the Bluetooth simulator
                    wifi_data = json.dumps({
                        "ssid": data.get("ssid", ""),
                        "password": data.get("password", "")
                    })
                    bt_socket.send(wifi_data.encode())
                    print(f"[+] Sent WiFi credentials to Bluetooth simulator")
                
                elif data.get("type") == "disconnect":
                    # Handle disconnect request
                    print(f"[+] Client requested disconnect")
                    break
                
                else:
                    # Forward other messages as-is
                    bt_socket.send(message.encode())
                    
            except json.JSONDecodeError:
                print(f"[!] Received invalid JSON: {message}")
            except Exception as e:
                print(f"[!] Error processing message: {e}")
    
    except websockets.exceptions.ConnectionClosed:
        print("[-] WebSocket connection closed")
    finally:
        # Don't close the Bluetooth socket here so it can be reused for other WebSocket clients
        print("[-] WebSocket handler finished")

async def main():
    print(f"[+] Starting WebSocket server on {WS_HOST}:{WS_PORT}")
    print(f"[+] Will connect to Bluetooth simulator at {BT_SIM_HOST}:{BT_SIM_PORT}")
    
    async with websockets.serve(handle_websocket, WS_HOST, WS_PORT):
        print(f"[+] WebSocket server running. Connect frontend to ws://{WS_HOST}:{WS_PORT}")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[-] Server stopped by user")
        if bt_socket:
            bt_socket.close()
            print("[-] Bluetooth connection closed") 