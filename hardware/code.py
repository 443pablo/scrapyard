print("running")
import board
import displayio
import framebufferio
import rgbmatrix
import terminalio
import time
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService
import adafruit_display_text.label

displayio.release_displays()

# ESP32-S3-Mini specific matrix config
matrix = rgbmatrix.RGBMatrix(
    width=64, height=32, bit_depth=6,
    rgb_pins=[board.IO1, board.IO2, board.IO3, board.IO5, board.IO4, board.IO6],
    addr_pins=[board.IO8, board.IO7, board.IO10, board.IO9],
    clock_pin=board.IO12, latch_pin=board.IO11, output_enable_pin=board.IO13)

display = framebufferio.FramebufferDisplay(matrix, auto_refresh=False)
display.brightness = 0.2
display.rotation = 0

# Text elements
line1 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0xFF0000,
    text="Disconnected",
    x=0,
    y=8
)

line2 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0x0080FF,
    text="",
    x=0,
    y=24
)

group = displayio.Group()
group.append(line1)
group.append(line2)
display.root_group = group

# BLE setup
ble = BLERadio()
ble.name = "ESP32-Matrix"
uart = UARTService()
advertisement = ProvideServicesAdvertisement(uart)
advertisement.appearance = 0x0080
ble.start_advertising(advertisement, interval=0.2)

while True:
    display.refresh()
    
    if ble.connected:
        line1.text = f"Connected: {ble.name}"
        line1.color = 0x00FF00

        data = uart.read()
        if data:
            received_text = data.decode().strip()
            line2.text = received_text
            display.refresh()
    
    else:
        line1.text = "Searching..."
        line1.color = 0xFF0000
        if not ble.advertising:
            ble.start_advertising(advertisement)
    
    time.sleep(0.05)
