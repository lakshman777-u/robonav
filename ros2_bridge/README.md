# ESP32 DevKit V1 + YDLIDAR X2 Wireless LiDAR Bridge

Wireless LiDAR telemetry bridge transmitting raw YDLIDAR X2 serial data over Wi-Fi UDP to an Ubuntu laptop running ROS 2 (Lyrical), RViz2, SLAM Toolbox, and the RoboNav Web Application.

---

## 1. Hardware Pinout & Wiring

| YDLIDAR X2 Pin | Wire Color | ESP32 DevKit V1 Pin | Notes |
|:---|:---|:---|:---|
| **VCC (5V)** | Red | `VIN` (or 5V rail) | Connect to 5V (USB 5V or external 5V / 1A supply) |
| **GND** | Black | `GND` | Common ground |
| **TX** | Green / Yellow | `GPIO 16` (`RX2`) | LiDAR UART output -> ESP32 Hardware UART2 RX (3.3V safe) |
| **M_CTR** | White / Blue | `GPIO 17` (`TX2`) | Motor Control: ESP32 drives HIGH (3.3V) to spin motor |

> **IMPORTANT POWER NOTE**: YDLIDAR X2 draws ~350–500mA continuous and up to 1A during motor startup. Power the ESP32 via a good 5V USB adapter (do not use low-current USB hubs).

---

## 2. Network & Configuration

- **Wi-Fi SSID**: `ZORO`
- **Wi-Fi Password**: `00000000`
- **Laptop IP**: `10.166.2.244` (UDP Port `4210`)
- **Robot Device ID**: `ESP32DEVKIT-001`
- **Device API Key**: `rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq`

---

## 3. Architecture Overview

```text
  ┌──────────────────┐
  │   YDLIDAR X2     │
  │  (115200 baud)   │
  └────────┬─────────┘
           │ UART2 (GPIO 16 / RX2)
           ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   ESP32 DevKit V1                       │
  │ - Reads raw packets (0xAA 0x55)                         │
  │ - Verifies XOR Checksum                                 │
  │ - Frames binary UDP packets with seq_num & timestamp    │
  │ - Emits 1Hz diagnostic heartbeat                        │
  └────────────────────────┬────────────────────────────────┘
                           │ Wi-Fi UDP (Port 4210)
                           ▼
  ┌─────────────────────────────────────────────────────────┐
  │            Ubuntu Laptop (10.166.2.244)                 │
  │                                                         │
  │  [laptop_udp_receiver.py]                               │
  │  ├─ Decodes angles (FSA/LSA) & ranges (meters)          │
  │  ├─ Publishes ROS 2 sensor_msgs/msg/LaserScan on /scan  │
  │  └─ POSTs telemetry to Web App (http://127.0.0.1:8000)  │
  │                                                         │
  │  [ROS 2 Ecosystem]                                      │
  │  ├─ Static TF: odom -> base_link -> laser_frame         │
  │  ├─ SLAM Toolbox: async_slam_toolbox_node (scan-match)  │
  │  └─ RViz2: Real-time pointcloud & 2D Occupancy Grid     │
  │                                                         │
  │  [Web Browser]                                          │
  │  └─ RoboNav Dashboard: Live LiDAR rays, Hz & HUD        │
  └─────────────────────────────────────────────────────────┘
```

---

## 4. Step-by-Step Running Instructions

### Step 1: Flash ESP32 Firmware
1. Open Arduino IDE.
2. Open `esp32_firmware/esp32_ydlidar_udp_bridge.ino` (or `/home/obito/snap/arduino/current/Arduino/test case/sketch_oct08a/sketch_oct08a.ino`).
3. Select Board: **ESP32 Dev Module**.
4. Select Port: `/dev/ttyUSB0` (or your ESP32 serial port).
5. Click **Upload**.
6. Open Serial Monitor at **115200 baud** to verify:
   - Wi-Fi connection to `ZORO`.
   - Assigned ESP32 IP address.
   - LiDAR packet decoding and UDP transmission.

---

### Step 2: Launch Web Backend & Frontend (Optional but Recommended)
Terminal 1 (Backend):
```bash
cd "/home/obito/web page/backend"
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Terminal 2 (Frontend):
```bash
cd "/home/obito/web page/frontend"
npm run dev
```
Open your browser at `http://localhost:5173`. Log in with `admin` / `admin123`.

---

### Step 3: Launch ROS 2 UDP Bridge & SLAM

**Option A: Everything with One Launch File (Recommended)**
```bash
source /opt/ros/lyrical/setup.bash
cd "/home/obito/web page/ros2_bridge"
python3 launch/slam_mapping.launch.py
```
This automatically launches:
1. `laptop_udp_receiver.py` (UDP Receiver & ROS 2 `/scan` publisher)
2. Static Transform Publisher (`laser_frame`)
3. SLAM Toolbox (`async_slam_toolbox_node` in scan-matching mode)
4. RViz2 pre-configured with Rainbow LaserScan and OccupancyGrid

**Option B: Step-by-Step Individual Commands**

1. Run the UDP Receiver:
   ```bash
   source /opt/ros/lyrical/setup.bash
   python3 "/home/obito/web page/ros2_bridge/laptop_udp_receiver.py"
   ```

2. In another terminal, verify the ROS 2 `/scan` topic:
   ```bash
   source /opt/ros/lyrical/setup.bash
   ros2 topic hz /scan
   ros2 topic echo /scan --once
   ```

3. Launch RViz2:
   ```bash
   source /opt/ros/lyrical/setup.bash
   rviz2 -d "/home/obito/web page/ros2_bridge/config/ydlidar_rviz2.rviz"
   ```
