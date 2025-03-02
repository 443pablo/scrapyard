# SPDX-FileCopyrightText: 2020 Jeff Epler for Adafruit Industries
#
# SPDX-License-Identifier: MIT

import adafruit_display_text.label
import board
import displayio
import framebufferio
import rgbmatrix
import terminalio

displayio.release_displays()

matrix = rgbmatrix.RGBMatrix(
    width=64, height=32, bit_depth=6,
    rgb_pins=[board.IO1, board.IO2, board.IO3, board.IO5, board.IO4, board.IO6],
    addr_pins=[board.IO8, board.IO7, board.IO10, board.IO9],
    clock_pin=board.IO12, latch_pin=board.IO11, output_enable_pin=board.IO13)

display = framebufferio.FramebufferDisplay(matrix, auto_refresh=False)

line1 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0x00FF00,
    text="Eagles are")
line1.x = display.width
line1.y = 8

line2 = adafruit_display_text.label.Label(
    terminalio.FONT,
    color=0xFFFFFF,
    text="Superbowl Champions")
line2.x = display.width
line2.y = 24

g = displayio.Group()
g.append(line1)
g.append(line2)
display.root_group = g

def scroll(line):
    line.x = line.x - 1
    line_width = line.bounding_box[2]
    if line.x < -line_width:
        line.x = display.width

def reverse_scroll(line):
    line.x = line.x + 1
    line_width = line.bounding_box[2]
    if line.x >= display.width:
        line.x = -line_width

while True:
    scroll(line1)
    scroll(line2)
    #reverse_scroll(line2)
    display.refresh(minimum_frames_per_second=0)
