import json
import time
import socket
import threading

# Simple server to simulate the Bluetooth functionality
# Instead of using actual Bluetooth, we'll use a socket connection on localhost

class BluetoothServerSim:
    def __init__(self, host='localhost', port=8888):
        self.host = host
        self.port = port
        self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_socket.bind((self.host, self.port))
        self.running = False
        self.clients = []
        self.ssid = None
        self.password = None
        
    def start(self):
        self.running = True
        self.server_socket.listen(5)
        print(f"[+] Bluetooth server simulator started on {self.host}:{self.port}")
        print("[+] Waiting for connections...")
        
        # Start a thread to handle connections
        self.thread = threading.Thread(target=self.handle_connections)
        self.thread.daemon = True
        self.thread.start()
        
        # Main loop to show the current state
        try:
            while self.running:
                if self.ssid and self.password:
                    print(f"\n[*] WiFi credentials received:")
                    print(f"    SSID: {self.ssid}")
                    print(f"    Password: {self.password}")
                    # Reset after displaying
                    self.ssid = None
                    self.password = None
                time.sleep(2)
        except KeyboardInterrupt:
            self.stop()
        
    def handle_connections(self):
        while self.running:
            try:
                client_socket, addr = self.server_socket.accept()
                print(f"[+] New connection from {addr}")
                client_thread = threading.Thread(target=self.handle_client, args=(client_socket, addr))
                client_thread.daemon = True
                client_thread.start()
                self.clients.append((client_socket, addr, client_thread))
            except Exception as e:
                if self.running:
                    print(f"[!] Error accepting connection: {e}")
                break
    
    def handle_client(self, client_socket, addr):
        try:
            while self.running:
                data = client_socket.recv(1024)
                if not data:
                    break
                    
                try:
                    # Try to parse as JSON (WiFi credentials)
                    wifi_data = json.loads(data.decode())
                    if 'ssid' in wifi_data and 'password' in wifi_data:
                        self.ssid = wifi_data['ssid']
                        self.password = wifi_data['password']
                        # Send back a confirmation
                        client_socket.send(b'{"status": "success", "message": "WiFi credentials received"}')
                except json.JSONDecodeError:
                    # Not JSON, treat as a regular message
                    print(f"[+] Received from {addr}: {data.decode().strip()}")
                    # Echo back
                    client_socket.send(data)
        except Exception as e:
            print(f"[!] Error handling client {addr}: {e}")
        finally:
            print(f"[-] Connection from {addr} closed")
            client_socket.close()
            self.clients = [(s, a, t) for s, a, t in self.clients if a != addr]
    
    def stop(self):
        self.running = False
        # Close all client connections
        for client_socket, _, _ in self.clients:
            try:
                client_socket.close()
            except:
                pass
        # Close server socket
        try:
            self.server_socket.close()
        except:
            pass
        print("[+] Bluetooth server simulator stopped")

if __name__ == "__main__":
    server = BluetoothServerSim()
    try:
        server.start()
    except KeyboardInterrupt:
        server.stop() 