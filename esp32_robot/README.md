# RoboNav ESP32-CAM Robot Controller Firmware

This folder contains the complete embedded firmware for the **ESP32-CAM** mobile robot controller.

## Architecture

```
[Camera OV2640]  [Ultrasonic 4x]  [Motors L298N]  [LiDAR Mode A/B]
       │               │                │               │
       └───────────────┼────────────────┼───────────────┘
                       ▼
                 [ESP32-CAM]
                 (FreeRTOS)
                       │
                 Wi-Fi 802.11 b/g/n
                       │
                       ▼
             [PC Robot API Server]
```

## Hardware Pinout (AI-Thinker ESP32-CAM)

| Function | Pin Name | GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **Left Motor PWM** | ENA / PWM | GPIO 12 | Motor speed control |
| **Left Motor DIR** | IN1 / IN2 | GPIO 13 | Direction control |
| **Right Motor PWM** | ENB / PWM | GPIO 14 | Motor speed control |
| **Right Motor DIR** | IN3 / IN4 | GPIO 15 | Direction control |
| **Ultrasonic Front** | TRIG / ECHO | GPIO 2 / 3 | Front obstacle range |
| **Ultrasonic Left** | TRIG / ECHO | GPIO 4 / 16 | Left flank range (GPIO 4 is onboard LED) |
| **Ultrasonic Right**| TRIG / ECHO | GPIO 0 / 1 | Right flank range (UART0) |
| **LiDAR (Mode A)** | RX / TX | GPIO 14 / 15 | UART serial data (Mode A only) |
| **LiDAR (Mode B)** | USB Direct | - | Connects directly to Main PC USB (Recommended) |
| **Camera OV2640** | D0 - D7, PCLK, VSYNC | Dedicated | Standard AI-Thinker internal bus |

---

## Flashing Instructions

### Option 1: Arduino IDE

1. **Install ESP32 Board Support**:
   - In Arduino IDE, open **Preferences** -> **Additional Board Manager URLs**:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Go to **Boards Manager**, search for `esp32` and install version `2.0.11` or later.
2. **Install Required Libraries**:
   - `ArduinoJson` (v6.x) by Benoit Blanchon
   - `WebSockets` by Markus Sattler
3. **Select Board**:
   - Board: **AI Thinker ESP32-CAM**
   - Flash Frequency: **80MHz**
   - Flash Mode: **QIO**
   - Partition Scheme: **Huge APP (3MB No OTA / 1MB SPIFFS)**
   - PSRAM: **Enabled**
4. **Configure Credentials**:
   - Open `src/config.h`.
   - Set `WIFI_SSID` and `WIFI_PASSWORD`.
   - Set `SERVER_IP` to your Main PC local IP (e.g. `192.168.1.100`).
   - Copy the API Key generated in the RoboNav Admin page (`#/admin/connection`) and set `ROBOT_API_KEY`.
5. **Flash via FTDI Adapter**:
   - Connect **GPIO 0 to GND** (bootloader mode).
   - Connect FTDI: `VCC -> 5V`, `GND -> GND`, `TX -> RX (GPIO 3)`, `RX -> TX (GPIO 1)`.
   - Press RESET button on ESP32-CAM, then click **Upload** in Arduino IDE.
   - Once upload completes, **disconnect GPIO 0 from GND** and press RESET.

---

### Option 2: PlatformIO

```bash
cd esp32_robot
# Edit src/config.h with your Wi-Fi and PC IP
pio run --target upload
pio devicemonitor
```

---

## Safety Features

- **Watchdog Timeout**: If Wi-Fi or WebSocket link drops for > 650ms, motor throttle is immediately cut to zero (`0.0 m/s`).
- **Local Collision Braking**: If front ultrasonic reads < 20cm, forward drive is instantly inhibited on the hardware level.
- **Emergency Stop**: Handled via physical command or immediate WebSocket packet.
