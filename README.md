# 🔦 Scrapyard Flashlight

An overengineered flashlight app created at Hack Club's Scrapyard event (March 2025). Because why should a flashlight just... turn on and off?

[Demo video](https://hc-cdn.hel1.your-objectstorage.com/s/v3/15f5b4b25a5c45620df0706f1ad6ac393ba13818_img_3034.mp4)

## ✨ Features

- 📱 Web-based control interface built with Next.js
- 🦷 Bluetooth connectivity for device pairing and control
- 📡 WiFi configuration via Bluetooth
- 🤖 AI-powered conversations using Google's Gemini
- 🗣️ Text-to-speech capabilities
- 🏀 Takes breaks to "watch" Lakers games (because even flashlights love LeBron)
- 🔌 WebSocket protocol for real-time communication
- 🌙 Dark mode support

## 🛠️ Tech Stack

- Frontend: Next.js, TailwindCSS
- APIs: Web Bluetooth API, Gemini API, Web Speech API
- Hardware: Raspberry Pi Pico W, LED module, Speaker

## 🚀 Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   cd frontend
   yarn install
   ```
3. Set up environment variables (see `.env.example`)
4. Run the development server:
   ```bash
   yarn dev
   ```

## 📝 Environment Variables

See `.env.example` for required environment variables:
- Bluetooth configuration
- WiFi settings
- Gemini API keys
- NBA API credentials

## 🤔 Why?

Because at Hack Club's Scrapyard, we believe in making simple things complicated and boring things fun! This project demonstrates how modern web technologies, IoT, and AI can be combined to create something delightfully unnecessary.

## 🏗️ Built at Scrapyard 2025

This project was created during Hack Club's Scrapyard event in March 2025, where hackers gather to build wonderfully overengineered projects. Special thanks to Hack Club for hosting such an amazing event!

## 📄 License

MIT License - feel free to overengineer your own flashlight!

