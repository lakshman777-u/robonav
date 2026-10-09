# RoboNav — ESP32 + LiDAR SLAM Autonomous Robot Guide

This guide explains how to program your ESP32-CAM with the LiDAR sensor to transmit live point cloud scans to your laptop and display the live 2D SLAM occupancy grid map on the RoboNav web page.

---

## 1. System Architecture

```text
  ┌───────────────────────┐                    ┌─────────────────────────┐
  │      ESP32-CAM        │   Wi-Fi (802.11)   │      LAPTOP / PC        │
  │  (Robot Controller)   ├───────────────────►│  (SLAM & Web Server)    │
  │                       │   WebSocket 10Hz   │                         │
  │ - Reads LiDAR (UART)  │  JSON Point Cloud  │ - FastAPI Backend (8000)│
  │ - Reads 4x Ultrasonic │                    │ - 2D SLAM Raytracing    │
  │ - Drives PWM Motors   │◄───────────────────┤ - A* Path Planner       │
  │ - Watchdog Failsafe   │   Motor Commands   │ - React Web App (5173)  │
  └───────────────────────┘                    └────────────┬────────────┘
                                                            │
                                                   Web Browser Dashboard
                                                   (Live Camera + 2D Map)
```

---

## 2. Hardware Wiring Diagram

### A. Power Distribution
- **Battery Pack:** 2S / 3S Li-ion (7.4V - 11.1V).
- **DC-DC Step-Down (Buck Converter):** 5V @ 3A output for ESP32-CAM and LiDAR.
- **Common Ground:** Connect battery GND, buck converter GND, motor driver GND, and ESP32 GND together.

### B. Pinout Table

| Peripheral | Component Pin | ESP32-CAM AI-Thinker Pin | Notes |
|---|---|---|---|
| **Power** | 5V Output | `5V` | Must supply at least 2A continuous |
| **Ground**| GND | `GND` | Common ground across all components |
| **LiDAR** | TX (Data Out)| `GPIO 16 (RX2)` | Hardware Serial2 Receive |
| **LiDAR** | RX / MOTO_PWM| `GPIO 17 (TX2)` | Motor speed / start command |
| **Motor L**| PWM / IN1 | `GPIO 12` | Left Motor Forward PWM |
| **Motor L**| DIR / IN2 | `GPIO 13` | Left Motor Direction |
| **Motor R**| PWM / IN3 | `GPIO 14` | Right Motor Forward PWM |
| **Motor R**| DIR / IN4 | `GPIO 15` | Right Motor Direction |
| **Front US**| TRIG | `GPIO 2` | HC-SR04 Trigger |
| **Front US**| ECHO | `GPIO 3 (RX0)` | **Important:** 1kΩ / 2kΩ voltage divider to 3.3V |
| **Left US** | TRIG | `GPIO 4` | Onboard Flash LED pin |
| **Left US** | ECHO | `GPIO 16` (or multiplexed)| Echo input |

> [!WARNING]
> **5V Logic Warning:** HC-SR04 ultrasonic Echo pins output 5V logic. ESP32 pins are **3.3V maximum**. Use a 1kΩ resistor in series and 2kΩ to ground (voltage divider) on the Echo pin before connecting to the ESP32.

---

## 3. Arduino IDE Setup & Flashing

### Step 1: Install ESP32 Board Package
1. Open **Arduino IDE**.
2. Go to **File > Preferences**.
3. In **Additional boards manager URLs**, add:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools > Board > Boards Manager...**, search for `esp32` by **Espressif Systems**, and install it.

### Step 2: Install Required Libraries
Open **Sketch > Include Library > Manage Libraries...** and install:
1. **`WebSockets`** by *Markus Sattler* (Version 2.4.0 or higher).
2. **`ArduinoJson`** by *Benoit Blanchon* (Version 6.x or 7.x).

### Step 3: Configure Credentials in `esp32_firmware.ino`
Open `esp32_firmware/esp32_firmware.ino` and review lines 39–48:
```cpp
// --- Robot Identity & Laptop Server Link ---
#define ROBOT_ID        "ESP32CAM-001"
#define ROBOT_API_KEY   "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"
#define PC_SERVER_HOST  "192.168.1.100"  // <-- Put your laptop's Wi-Fi IP address here!
#define PC_SERVER_PORT  8000

// --- Wi-Fi 2.4GHz Network Credentials ---
#define WIFI_SSID       "YOUR_WIFI_NAME"      // <-- Your Wi-Fi router name
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"  // <-- Your Wi-Fi password
```

### Step 4: Board Settings & Upload
1. Connect ESP32-CAM to your laptop using an FTDI USB-to-UART programmer (Jumper **IO0 to GND** to enter flashing mode).
2. Under **Tools**, configure:
   - **Board:** `AI Thinker ESP32-CAM` (or `ESP32 Dev Module`)
   - **Upload Speed:** `115200` or `921600`
   - **Flash Frequency:** `80MHz`
   - **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
   - **Port:** Select your FTDI COM port (e.g., `/dev/ttyUSB0` or `COM3`).
3. Click **Upload**.
4. Once upload completes, remove the IO0-to-GND jumper and press the **RESET (RST)** button on the ESP32.

---

## 4. Running the Laptop Server & Viewing the 2D Map

### Step 1: Find Your Laptop's IP Address
- **On Linux / macOS:** Run `hostname -I` or `ifconfig`.
- **On Windows:** Run `ipconfig` in Command Prompt.
- Note your Wi-Fi IPv4 address (e.g. `192.168.1.100`).

### Step 2: Start the Laptop Backend Server
```bash
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Step 3: Start the Web Dashboard
```bash
cd frontend
npm run dev
```

### Step 4: View the Live 2D SLAM Map
1. Open your browser at `http://localhost:5173/` (or `http://<LAPTOP_IP>:5173/`).
2. Log in:
   - **Username:** `admin`
   - **Password:** `admin123`
3. On the **Cockpit Dashboard**:
   - The **Hardware Indicators** will display:
     - `PC SERVER: ONLINE`
     - `ESP32-CAM: ONLINE`
     - `WEBSOCKET: CONNECTED`
     - `LIDAR: ACTIVE`
   - On the right side, the **Live 2D SLAM Map** will render the real-time room occupancy grid as the LiDAR spins and scans walls!
   - Use the **Chassis Drive D-Pad** or keyboard arrow keys to drive the robot around while it maps your room.
