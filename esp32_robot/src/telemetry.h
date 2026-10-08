#ifndef TELEMETRY_H
#define TELEMETRY_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "config.h"
#include "motor_controller.h"
#include "ultrasonic.h"
#include "lidar.h"
#include "camera_stream.h"
#include "websocket_client.h"

class TelemetryManager {
public:
    TelemetryManager();
    void update();
    void sendTelemetry();

private:
    unsigned long _lastTelemetryTime;
    float _simulatedBattery;
};

extern TelemetryManager telemetry;

#endif // TELEMETRY_H
