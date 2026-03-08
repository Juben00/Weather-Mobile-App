# Weather App 🌤️

A beautiful cross-platform weather application built with Tauri, React, and TypeScript.

## Features

- 🔍 **Search Weather** - Search for any city worldwide
- 📍 **GPS Location** - Get weather for your current location
- 💾 **Save Locations** - Save your favorite locations for quick access
- 📊 **Detailed Weather Data**:
  - Current temperature, feels like, humidity, wind speed
  - Pressure, cloud cover, visibility, wind direction
  - Sunrise/sunset times, UV index, precipitation
- ⏰ **24-Hour Forecast** - Hourly temperature and conditions
- 📅 **7-Day Forecast** - Weekly weather outlook
- 🌙 **Dark/Light Mode** - Toggle between themes

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Rust (Tauri)
- **API**: [Open-Meteo](https://open-meteo.com/) (Free, no API key required)
- **Database**: SQLite (for saved locations)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

For Android development:
- [Android Studio](https://developer.android.com/studio)
- Android SDK & NDK

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/WeatherApp.git
cd WeatherApp

# Install dependencies
npm install

# Run in development mode (Desktop)
npm run tauri dev

# Run on Android
npm run tauri android dev
```

## Build

```bash
# Build for Desktop
npm run tauri build

# Build for Android
npm run tauri android build
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
