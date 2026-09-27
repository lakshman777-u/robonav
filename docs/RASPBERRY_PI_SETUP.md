# Raspberry Pi Setup Guide

## 1. Hardware Requirements
- Raspberry Pi 4 (or newer)
- RPLiDAR A1/A2 (optional)
- Raspberry Pi Camera Module 3 (optional)
- HC-SR04 Ultrasonic Sensor (optional)
- L298N Motor Driver + Motors (optional)

## 2. OS Setup
Install Raspberry Pi OS 64-bit on an SD card using the Raspberry Pi Imager.

## 3. Python 3.11+ Installation
Ensure Python 3.11 or newer is installed on the system.
```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv
```

## 4. Dependencies Installation
```bash
cd raspberry_pi_client
pip install -r requirements.txt
```

## 5. Network Configuration
Ensure the Raspberry Pi is connected to the same Wi-Fi network as the backend server.

## 6. Configuration
1. Generate an API key from the admin dashboard on the web UI.
2. Copy `.env.example` to `.env`.
3. Set the variables:
```
ROBOT_ID=ROBOT-001
ROBOT_API_KEY=your_generated_key
SERVER_URL=http://<backend_ip>:8000
WS_URL=ws://<backend_ip>:8000
```

## 7. Starting the client
```bash
python robot_client.py
```

## 8. Verifying Connection
Check the web dashboard to see if the robot appears as "Online".

## 9. Integrating Real Hardware
Modify `/home/obito/web page/raspberry_pi_client/sensors.py` and `robot_controller.py` to use GPIO and serial inputs for real hardware control.

- LiDAR: RPLiDAR library over USB
- Camera: picamera2 library
- Ultrasonic: RPi.GPIO for Trig/Echo pins
- Motor driver: RPi.GPIO or gpiozero for L298N PWM

## 10. ROS 2 Integration Notes
See `ROS2_INTEGRATION.md` for details on how to integrate with ROS 2.

## 11. Troubleshooting
- If connection fails, check firewall settings on the backend machine.
- Verify API Key in the `.env` file matches the dashboard.
