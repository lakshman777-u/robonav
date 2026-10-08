# RoboNav — Autonomous Robot Navigation Platform (PC + ESP32-CAM)

An enterprise-grade autonomous indoor robot platform powered by a **Distributed PC + ESP32-CAM Architecture**.

RoboNav offloads heavy computational workloads (SLAM, 2D Occupancy Grid Mapping, A* Dynamic Path Planning, and OpenCV Computer Vision) to a host **PC**, while utilizing a lightweight **ESP32-CAM** microcontroller for real-time motor actuation, sensor acquisition, and low-latency MJPEG video streaming.

---

## 1. System Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                         WEB BROWSER                         │
 │           React + Vite + Tailwind CSS + Lucide Icons        │
 │                                                             │
 │  [Dual Dashboard: Live Video Stream + Live 2D Occupancy Map]│
 │  - Real-time Telemetry & Hardware Status HUD                │
 │  - SLAM Exploration & Destination Waypoint Dispatcher       │
 │  - Emergency Stop & Real Robot / Simulation Mode Switcher   │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               HTTP / REST & WebSockets (/ws/browser)
               MJPEG Stream (/api/robot/video)
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                       PC / WORKSTATION                      │
 │                 FastAPI Backend (Python 3.10+)              │
 │                                                             │
 │  - Heavy Compute: SLAM & 2D Grid Mapping Engine             │
 │  - Motion Planning: A* Path Planner & Dynamic Obstacle Reroute│
 │  - Computer Vision: OpenCV Obstacle & Glass Detection       │
 │  - State Machine & 5-Minute Waiting / Auto-Return Logic     │
 │  - Low-Latency MJPEG Video Proxy & WebSocket Bridge         │
 │  - SQLite Storage & RBAC Authentication (JWT + API Keys)    │
 └──────────────────────────────┬──────────────────────────────┘
                                │
               Wi-Fi LAN (802.11 b/g/n)
               WebSocket (/ws/robot) & HTTP Telemetry / Video
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                     ESP32-CAM CONTROLLER                    │
 │               FreeRTOS / C++ Embedded Firmware              │
 │                                                             │
 │  - Video: OV2640 Camera (SVGA / VGA / QVGA @ 20-30 FPS)     │
 │  - Sensors: 4x Ultrasonic (Front, Left, Right, Rear in m)   │
 │  - Optional LiDAR: Mode A (UART) or Mode B (Direct USB to PC)│
 │  - Actuation: PWM Motor Driver (L298N / TB6612FNG)          │
 │  - Safety: Hardware Watchdog, Fail-Safe Auto Brake (500ms)  │
 └─────────────────────────────────────────────────────────────┘
```

---

## 2. Hardware Wiring & Pinout Guide

### ESP32-CAM AI-Thinker Pin Configuration
*Power Requirement: 5V DC (minimum 2A continuous, 3A peak with Wi-Fi TX bursts).*

| ESP32-CAM Pin | Peripheral | Description |
|---|---|---|
| **5V / GND** | Power Supply | 5V regulated output from DC-DC Buck Converter; common GND with motor driver |
| **GPIO 12** | Motor Left PWM / IN1 | Left Motor Forward / PWM speed control |
| **GPIO 13** | Motor Left IN2 | Left Motor Direction (Reverse) |
| **GPIO 14** | Motor Right PWM / IN3 | Right Motor Forward / PWM speed control |
| **GPIO 15** | Motor Right IN4 | Right Motor Direction (Reverse) |
| **GPIO 2** | Front Ultrasonic TRIG | HC-SR04 Trigger pulse |
| **GPIO 4** | Front Ultrasonic ECHO | HC-SR04 Echo input *(via 1kΩ / 2kΩ voltage divider to 3.3V)* |
| **GPIO 16 (RX2)**| LiDAR RX (Mode A) | RPLiDAR A1 / LDS-01 Serial UART RX |
| **GPIO 3 (U0RX)**| Shared Trigger/Echo | Diagnostic Serial / Sensor Expansion |
| **GPIO 1 (U0TX)**| Diagnostic Serial | TX @ 115200 baud |

> [!CAUTION]
> **HC-SR04 5V Echo Warning:** HC-SR04 Echo pins output 5V logic. ESP32 GPIOs are **3.3V maximum**. You **MUST** install a resistor voltage divider (e.g., 1kΩ series + 2kΩ to GND) between HC-SR04 Echo and the ESP32 GPIO to protect the microcontroller.

### Motor Driver Wiring (L298N / TB6612FNG)
- **VM / VMS:** 7.4V–11.1V (Direct battery pack connection)
- **VCC:** 5V logic power
- **GND:** Connected to ESP32-CAM GND and battery GND
- **OUT1 & OUT2:** Left DC Gear Motor
- **OUT3 & OUT4:** Right DC Gear Motor

---

## 3. LiDAR Operational Modes

### Mode A: ESP32-CAM Serial UART Pass-Through
- Connect LiDAR TX/RX directly to ESP32-CAM GPIO 16 (RX2) and GPIO 17 (TX2).
- The ESP32 parses distance packets and bundles them into the 10Hz JSON telemetry packet sent to `/ws/robot`.

### Mode B: Direct USB to PC (Recommended for 360° RPLiDAR A1/A2)
- Connect LiDAR directly to a PC USB port via CP2102/CH340 USB-UART adapter.
- The PC backend reads point cloud measurements directly via PyLidar / RPLidar SDK, reducing ESP32 CPU and Wi-Fi transmission overhead.

---

## 4. Quick Start

### 1. Prerequisites
- **Python 3.10+**
- **Node.js 18+** & npm
- **PlatformIO** (or Arduino IDE with ESP32 board definitions)

---

### 2. PC Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies (FastAPI, OpenCV, NumPy, WebSockets, SQLAlchemy)
pip install -r requirements.txt

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Backend will be accessible at:
- **API Server:** `http://localhost:8000`
- **Interactive Swagger Docs:** `http://localhost:8000/docs`
- **Live MJPEG Camera Stream:** `http://localhost:8000/api/robot/video`
- **WebSocket Endpoint:** `ws://localhost:8000/ws/browser`

---

### 3. Frontend Web Application Setup
```bash
# Navigate to frontend directory
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173/` or visit the hosted application on GitHub Pages.

---

### 4. ESP32-CAM Firmware Installation

#### Method A: PlatformIO (Recommended)
```bash
cd esp32_robot

# Configure Wi-Fi SSID, Password, PC Server IP, and Robot API Key
nano config.h

# Build and flash to ESP32-CAM via FTDI programmer
pio run -t upload
```

#### Method B: Arduino IDE
1. Open `esp32_robot/esp32_robot.ino` (or `main.cpp`).
2. Install libraries via Library Manager:
   - `WebSockets` by Markus Sattler
   - `ArduinoJson` (v6 or v7) by Benoit Blanchon
   - `esp32-camera` by Espressif
3. Under **Tools > Board**, select **AI Thinker ESP32-CAM**.
4. Set **Partition Scheme** to **Huge APP (3MB No OTA)**.
5. Edit `config.h` with your Wi-Fi credentials and PC IP address.
6. Connect FTDI programmer (IO0 jumpered to GND during flash), compile and upload.

---

## 5. API Key Generation & Robot Pairing

1. Log into the Web Dashboard as **Admin** (`admin` / `admin123`).
2. Navigate to **API Keys** / **Robot Connection**.
3. Locate **ESP32CAM-001** and click **Generate API Key**.
4. Copy the secret key (e.g. `rb_live_abc123...`).
5. Paste into `esp32_robot/config.h`:
   ```cpp
   #define ROBOT_ID "ESP32CAM-001"
   #define ROBOT_API_KEY "rb_live_your_secret_key_here"
   #define PC_SERVER_HOST "192.168.1.100"  // Your PC's LAN IP
   #define PC_SERVER_PORT 8000
   ```
6. When powered on, the ESP32-CAM authenticates against `POST /api/robot/auth`, acquires a JWT token, and connects to `ws://{PC_IP}:8000/ws/robot`.

---

## 6. Real Robot vs Simulation Mode

RoboNav includes dual-mode operation:
- **REAL ROBOT Mode:** Hardware-enforced telemetry. If the physical ESP32-CAM drops connection, the dashboard instantly flags `ESP32-CAM OFFLINE`, halts motors, and shows a no-signal overlay on the live video display.
- **SIMULATION Mode:** Full 20m x 15m virtual environment with raycasting LiDAR, ultrasonic simulation, and house navigation (including the 26-node topological graph simulator in `PaganiSimulatorGame.tsx`).

Switch modes anytime via the **Settings** menu or the mode toggle button on the Admin Dashboard.

---

## 7. Default Demo Credentials

| Role | Username | Password | Access Rights |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Full control: SLAM mapping, destinations, API keys, manual drive, emergency stop |
| **Operator** | `user` | `user123` | Navigation requests, live map & camera monitoring, status telemetry |

---

## 8. REST & WebSocket API Specification

| Endpoint | Method / Protocol | Description |
|---|---|---|
| `/api/auth/login` | POST | Authenticates Admin/User; returns JWT access token |
| `/api/robots/auth` | POST | Authenticates ESP32-CAM with API key; returns robot JWT |
| `/api/robot/status` | GET | Real-time status: battery, pose, state, hardware indicators |
| `/api/robot/video` | GET (MJPEG) | Multi-part live camera feed for browser display |
| `/api/robot/video/frame` | POST | ESP32-CAM raw JPEG frame ingestion |
| `/api/robot/command` | POST | Dispatches movement commands (`FORWARD`, `LEFT`, `STOP`, etc.) |
| `/api/robot/emergency-stop` | POST | Global e-stop: halts motors and triggers fail-safe |
| `/api/maps/start` | POST | Initiates SLAM exploration and occupancy grid mapping |
| `/api/maps/stop` | POST | Finalizes and stores occupancy grid map |
| `/api/navigation/request` | POST | Dispatches A* path navigation to destination waypoint |
| `/ws/browser` | WebSocket | Real-time telemetry, sensor data, and map updates to browser |
| `/ws/robot` | WebSocket | Bidirectional command & telemetry stream for ESP32-CAM |

---

## 9. Verification & Automated Testing

To run the complete automated test suite verifying auth, API key generation, WebSocket telemetry, SLAM mapping, and autonomous navigation:
```bash
cd backend
source venv/bin/activate
python verify_flow.py
```

---

## 10. License
MIT License. Created for Autonomous Indoor Robot Navigation.
