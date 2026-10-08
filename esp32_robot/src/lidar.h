#ifndef LIDAR_H
#define LIDAR_H

#include <Arduino.h>
#include "config.h"

struct LidarPoint {
    float angle;    // degrees (0 - 360)
    float distance; // meters
    uint8_t quality;
};

class LidarInterface {
public:
    LidarInterface();
    void begin();
    void update();
    bool isActive();
    int getMode(); // 1 = Mode A (ESP32 UART), 2 = Mode B (PC Direct)
    int getPointCount();
    LidarPoint getPoint(int index);

private:
    bool _active;
    int _pointCount;
    LidarPoint _points[36]; // Compressed 10-degree buckets for ESP32 Wi-Fi efficiency
};

extern LidarInterface lidar;

#endif // LIDAR_H
