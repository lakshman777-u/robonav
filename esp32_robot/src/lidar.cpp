#include "lidar.h"

LidarInterface lidar;

LidarInterface::LidarInterface() : _active(false), _pointCount(0) {
    for (int i = 0; i < 36; i++) {
        _points[i] = {(float)(i * 10), 3.0f, 15};
    }
}

void LidarInterface::begin() {
    if (LIDAR_MODE == 1) {
        Serial.println("[LiDAR] Initializing Mode A: Hardware Serial UART on ESP32-CAM...");
        Serial2.begin(LIDAR_BAUD_RATE, SERIAL_8N1, LIDAR_RX_PIN, LIDAR_TX_PIN);
        _active = true;
    } else {
        Serial.println("[LiDAR] Configured in Mode B: Direct USB/UART connection to Main PC for high-rate SLAM.");
        _active = true; // In Mode B, PC directly handles sensor data
    }
}

void LidarInterface::update() {
    if (LIDAR_MODE == 1 && _active) {
        // Simple NMEA / packet buffer parser for Mode A
        while (Serial2.available() > 0) {
            uint8_t b = Serial2.read();
            // Process packet bytes into _points
        }
    }
}

bool LidarInterface::isActive() {
    return _active;
}

int LidarInterface::getMode() {
    return LIDAR_MODE;
}

int LidarInterface::getPointCount() {
    return 36;
}

LidarPoint LidarInterface::getPoint(int index) {
    if (index >= 0 && index < 36) return _points[index];
    return {0, 0, 0};
}
