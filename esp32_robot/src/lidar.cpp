#include "lidar.h"

LidarInterface lidar;

LidarInterface::LidarInterface() : _active(false), _pointCount(0) {
    for (int i = 0; i < 36; i++) {
        _points[i] = {(float)(i * 10), 3.0f, 15};
    }
}

void LidarInterface::begin() {
    if (LIDAR_MODE == 1) {
        Serial.println("[LiDAR] Initializing YDLIDAR X2 on Hardware Serial2...");
        // Pin 17 is M_EN (Motor Enable) - drive HIGH to spin the motor
        if (LIDAR_TX_PIN >= 0) {
            pinMode(LIDAR_TX_PIN, OUTPUT);
            digitalWrite(LIDAR_TX_PIN, HIGH);
            Serial.println("[LiDAR] Motor enable pin driven HIGH.");
        }
        Serial2.begin(LIDAR_BAUD_RATE, SERIAL_8N1, LIDAR_RX_PIN, -1);
        _active = true;
    } else {
        Serial.println("[LiDAR] Configured in Mode B: Direct USB/UART connection to Main PC for high-rate SLAM.");
        _active = true; // In Mode B, PC directly handles sensor data
    }
}

void LidarInterface::update() {
    if (LIDAR_MODE == 1 && _active) {
        // YDLIDAR X2 non-blocking packet decoder (0xAA 0x55 header)
        while (Serial2.available() > 0) {
            static int state = 0;
            static uint8_t ct = 0;
            static uint8_t lsn = 0;
            static uint16_t fsa = 0;
            static uint16_t lsa = 0;
            static uint16_t cs = 0;
            static uint8_t sampleBuf[128];
            static int sampleIndex = 0;
            static int expectedBytes = 0;

            uint8_t b = Serial2.read();

            if (state == 0) {
                if (b == 0xAA) state = 1;
            } else if (state == 1) {
                if (b == 0x55) state = 2;
                else state = (b == 0xAA) ? 1 : 0;
            } else if (state == 2) {
                ct = b; // Package type
                state = 3;
            } else if (state == 3) {
                lsn = b; // Sample count (e.g. 10 to 40)
                if (lsn > 0 && lsn <= 55) {
                    expectedBytes = lsn * 2;
                    sampleIndex = 0;
                    state = 4;
                } else {
                    state = 0;
                }
            } else if (state == 4) {
                fsa = b; // FSA start angle low
                state = 5;
            } else if (state == 5) {
                fsa |= ((uint16_t)b << 8); // FSA start angle high
                state = 6;
            } else if (state == 6) {
                lsa = b; // LSA end angle low
                state = 7;
            } else if (state == 7) {
                lsa |= ((uint16_t)b << 8); // LSA end angle high
                state = 8;
            } else if (state == 8) {
                cs = b;
                state = 9;
            } else if (state == 9) {
                cs |= ((uint16_t)b << 8);
                state = 10;
            } else if (state == 10) {
                sampleBuf[sampleIndex++] = b;
                if (sampleIndex >= expectedBytes) {
                    // Complete packet received!
                    float angleFSA = (float)((fsa >> 1)) / 64.0f;
                    float angleLSA = (float)((lsa >> 1)) / 64.0f;
                    float diffAngle = angleLSA - angleFSA;
                    if (diffAngle < 0.0f) diffAngle += 360.0f;

                    for (int i = 0; i < lsn; i++) {
                        uint16_t rawDist = (uint16_t)sampleBuf[2 * i] | ((uint16_t)sampleBuf[2 * i + 1] << 8);
                        float distM = (float)(rawDist) / 4000.0f; // meters

                        float angle = angleFSA;
                        if (lsn > 1) {
                            angle = angleFSA + (diffAngle / (float)(lsn - 1)) * (float)i;
                        }
                        if (angle >= 360.0f) angle -= 360.0f;

                        if (distM >= 0.08f && distM <= 8.0f) {
                            int bucket = ((int)(angle / 10.0f)) % 36;
                            _points[bucket].angle = (float)(bucket * 10);
                            _points[bucket].distance = distM;
                            _points[bucket].quality = 15;
                        }
                    }
                    state = 0;
                }
            }
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
