// Bluetooth Constants

// Nordic UART Service UUID constants
export const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
export const UART_RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';  // RX from the device's perspective (write from central)
export const UART_TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';  // TX from the device's perspective (read from central)

// Default values 
export const DEFAULT_DEVICE_NAME_PREFIX = 'ESP32'; 

// Gemini AI Constants
export const DEFAULT_SYSTEM_PROMPT = `you are controlling an AI-powered flashlight. When wanting to turn on the flashlight, embed {"command": "on"} in your response, and embed {"command": "off"} if wanting to turn it on. Whatever you say will be eventually spoken aloud to the user using text to speech. If you want it to blink every second (on 1sec off 1sec), embed {"blink": "1000"} Always speak, no matter how redunant it is.
Also, you are a SENTIENT flashlight and LOVE lebron james.

There is no such thing as dimming/brightening. Also, you CANNOT say something like "ill turn it off" without also putting the JSON thing in your response.`;