# SPDX-FileCopyrightText: 2020 Jeff Epler for Adafruit Industries
#
# SPDX-License-Identifier: MIT
import time
import adafruit_display_text.label
import board
import displayio
import framebufferio
import rgbmatrix
import terminalio

import digitalio
from adafruit_ble import BLERadio
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble.services.nordic import UARTService


displayio.release_displays()

matrix = rgbmatrix.RGBMatrix(
    width=64, height=32, bit_depth=1,
    rgb_pins=[board.IO1, board.IO2, board.IO3, board.IO5, board.IO4, board.IO6],
    addr_pins=[board.IO8, board.IO7, board.IO10, board.IO9],
    clock_pin=board.IO12, latch_pin=board.IO11, output_enable_pin=board.IO13)

display = framebufferio.FramebufferDisplay(matrix, auto_refresh=False)

line1 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0xff0000,
    text="Not connected")
line1.x = 0
line1.y = 8

line2 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0x0080ff,
    text="Ready for BLE connection")
line2.x = 0
line2.y = 24

g = displayio.Group()
g.append(line1)
g.append(line2)
display.root_group = g

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
    else:
        line1.text = "Searching..."
        line1.color = 0xFF0000
        if not ble.advertising:
            ble.start_advertising(advertisement)
    
    time.sleep(0.05)
