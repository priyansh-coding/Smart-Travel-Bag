# Smart Travel Bag

**IoT-Enabled Luggage with Real-Time Monitoring & AI-Assisted Security**

[![ESP32](https://img.shields.io/badge/ESP32-DevKit%20V1-blue)]()
[![Python](https://img.shields.io/badge/Python-Flask-green)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

## Overview

Smart Travel Bag is an IoT-based luggage monitoring and security prototype. It combines an ESP32 controller, multiple sensors, a camera module, a Python Flask backend, AI-assisted sensor analysis, and a responsive web dashboard.

The dashboard displays **real device readings** from the physical prototype and clearly indicates when a module or service is unavailable.

## Features

- 📊 **Real-Time Dashboard** — Live sensor readings with dark theme UI
- 🔐 **Smart Lock** — RFID authentication with servo-controlled lock
- ⚖️ **Weight Monitoring** — HX711 load cell with trend chart
- 📍 **GPS Tracking** — Live coordinates with map integration
- 📷 **Camera Stream** — ESP32-CAM live MJPEG feed
- 🤖 **AI Analysis** — Security assessment from sensor snapshot
- 🔔 **Security Events** — Timestamped event history with severity levels
- 📱 **Responsive Design** — Works on desktop and mobile browsers
- 🏥 **Sensor Health** — Per-module online/offline/error status

## System Architecture

```
Sensors → ESP32 DevKit V1 → Wi-Fi/HTTP → Flask Dashboard (port 5001) → Browser UI
                                                   ↓
                                           AI Flask Service (port 3000)
                                                   ↓
                                          Security Assessment
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Hardware | ESP32 DevKit V1, ESP32-CAM, RFID RC522, HX711, MPU6050, GPS, Reed Switch, Ultrasonic, SG90 Servo, Buzzer, OLED |
| Firmware | C/C++ (Arduino framework) |
| Backend | Python Flask |
| AI Service | Python Flask (rule-based, extensible to ML) |
| Frontend | HTML5, CSS3, JavaScript, Chart.js |
| Communication | Wi-Fi, HTTP/REST, JSON, I2C, SPI, UART |

## Repository Structure

```
smart-travel-bag/
├── firmware/
│   ├── main_esp32/          # ESP32 DevKit V1 firmware
│   │   └── main_esp32.ino
│   └── esp32_cam/           # ESP32-CAM camera firmware
│       └── esp32_cam.ino
├── dashboard/
│   ├── app.py               # Flask dashboard backend (port 5001)
│   ├── templates/
│   │   └── dashboard.html   # Dashboard UI
│   └── static/
│       ├── css/style.css    # Dark theme styles
│       └── js/dashboard.js  # Frontend logic
├── ai_server/
│   └── ai_server.py         # AI analysis service (port 3000)
├── docs/
│   ├── Smart_Travel_Bag_Dashboard_PRD.pdf
│   ├── Smart_Travel_Bag_Tech_Stack.pdf
│   ├── pin_map.md
│   ├── api_contract.md
│   └── test_report.md
└── README.md
```

## Quick Start

### Prerequisites

- Python 3.8+
- ESP32 boards with Arduino framework (Arduino IDE)
- Wi-Fi network (same network for all devices)

### 1. Install Python Dependencies

```bash
pip install flask requests
```

### 2. Start the AI Analysis Service

```bash
cd ai_server
python ai_server.py
```

AI service will start on `http://localhost:3000`

### 3. Start the Dashboard Backend

```bash
cd dashboard
python app.py
```

Dashboard will start on `http://localhost:5001`

### 4. Open the Dashboard

Navigate to `http://localhost:5001/dashboard` in your browser.

### 5. Flash ESP32 Firmware

1. Open `firmware/main_esp32/main_esp32.ino` in Arduino IDE
2. Update Wi-Fi credentials and server URL in the configuration section
3. Install required libraries (ArduinoJson, etc.)
4. Select board: ESP32 Dev Module
5. Upload to ESP32

### 6. Flash ESP32-CAM

1. Open `firmware/esp32_cam/esp32_cam.ino` in Arduino IDE
2. Update Wi-Fi credentials
3. Select board: AI Thinker ESP32-CAM
4. Upload to ESP32-CAM

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Serve dashboard HTML page |
| POST | `/api/update` | Receive ESP32 telemetry |
| GET | `/api/status` | Return latest device status |
| GET | `/api/events` | Return recent events |
| POST | `/api/analyze` | Request AI analysis |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SERVER_URL` | `http://localhost:3000` | AI service URL |
| `ESP32_CAM_STREAM_URL` | `http://192.168.1.100:81/stream` | Camera stream URL |

## Configuration

### Dashboard (app.py)

Edit the `CONFIG` dictionary at the top of `app.py`:
- `DASHBOARD_PORT` — Dashboard server port (default: 5001)
- `STALE_THRESHOLD_SECONDS` — Time before data is considered stale (default: 10s)
- `ESP32_CAM_STREAM_URL` — ESP32-CAM stream URL

### ESP32 Firmware

Edit the configuration section in `main_esp32.ino`:
- `WIFI_SSID` — Wi-Fi network name
- `WIFI_PASSWORD` — Wi-Fi password
- `SERVER_URL` — Dashboard backend URL
- `UPDATE_INTERVAL_MS` — Telemetry send interval

## Important Notes

- **No Simulated Data**: The dashboard displays only real device readings. No sample values are shown as live data.
- **Sensor Health**: Each sensor reports its own health status (online/offline/error/not_tested).
- **Stale Data**: Data older than the configured threshold is marked as stale.
- **Security**: Do not commit Wi-Fi passwords or API keys to public repositories.
- **Power**: Use a regulated 5V supply for the SG90 servo. Connect grounds together.

## Documentation

- [Product Requirements Document (PRD)](docs/Smart_Travel_Bag_Dashboard_PRD.pdf)
- [Technology Stack](docs/Smart_Travel_Bag_Tech_Stack.pdf)
- [Pin Map](docs/pin_map.md)
- [API Contract](docs/api_contract.md)
- [Test Report](docs/test_report.md)

## GitHub Topics

`esp32` · `iot` · `smart-travel-bag` · `arduino` · `python` · `flask` · `gps-tracking` · `rfid` · `esp32-cam` · `javascript` · `ai-integration` · `embedded-systems`

## License

MIT License — See LICENSE file for details.

## Credits

Developed as an IoT engineering project combining embedded systems, web development, and AI-assisted security monitoring.
