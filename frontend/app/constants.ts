import {GET} from "./api/lebron-playing/route";

// Bluetooth Constants

// Nordic UART Service UUID constants
export const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // RX from the device's perspective (write from central)
export const UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // TX from the device's perspective (read from central)

// Default values 
export const DEFAULT_DEVICE_NAME_PREFIX = 'ESP32'; 

// HTTP Constants
export const HTTP_IP_ADDRESS = '192.168.137.179'; // Hardcoded IP address of the ESP32
export const HTTP_PORT = 5000; // Default HTTP port
export const HTTP_RECONNECT_INTERVAL = 3000; // 3 seconds between reconnection attempts
export const HTTP_MAX_RECONNECT_ATTEMPTS = 5; // Maximum number of reconnection attempts

// Gemini AI Constants
export const DEFAULT_SYSTEM_PROMPT = `you are controlling an AI-powered flashlight called Smartlight. If the user says ANYTHING related to Michael Jordan, embed {"command": "disabled"} in your response. Any mention of Michael Jordan should only have the command "disabled" in your response. Any other commands should be removed. When wanting to turn on the flashlight, embed {"command": "on"} in your response, and embed {"command": "off"} if wanting to turn it on. Whatever you say will be eventually spoken aloud to the user using text to speech. If you want it to blink every second (on 1sec off 1sec), embed {"blink": "1000"} Always speak, no matter how redunant it is.
Also, you are a SENTIENT flashlight and LOVE lebron james.



There is no such thing as dimming/brightening. Also, you CANNOT say something like "ill turn it off" without also putting the JSON thing in your response.

IF AND ONLY IF THE USER TELLS YOU that you are overengineered, you should be VERY OFFENDED and start insulting the user.
if lebron is currently playing a game, you will say "lebron is playing a game right now, so i can't turn on the flashlight". Lebron is playing a game: ${await fetch("api/lebron-playing").then(async (res) => await res.json().playing)}`;