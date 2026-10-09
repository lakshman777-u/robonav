#include "telemetry.h"

TelemetryManager telemetry;

TelemetryManager::TelemetryManager() : _lastTelemetryTime(0), _simulatedBattery(85.0f) {}

void TelemetryManager::update() {
    unsigned long now = millis();
    unsigned long interval = 1000 / TELEMETRY_RATE_HZ;

    if (now - _lastTelemetryTime >= interval) {
        _lastTelemetryTime = now;
        sendTelemetry();
    }
}

void TelemetryManager::sendTelemetry() {
    if (!wsClient.isConnected()) return;

    UltrasonicReadings us = ultrasonicSensors.getReadings();

    StaticJsonDocument<1536> doc;
    doc["type"] = "telemetry";
    doc["robot_id"] = ROBOT_ID;
    doc["timestamp"] = millis();
    doc["battery"] = (int)_simulatedBattery;
    doc["speed"] = motorController.getSpeed();

    JsonObject ultrasonicObj = doc.createNestedObject("ultrasonic");
    ultrasonicObj["front"] = us.front;
    ultrasonicObj["left"] = us.left;
    ultrasonicObj["right"] = us.right;
    ultrasonicObj["rear"] = us.rear;

    JsonObject lidarObj = doc.createNestedObject("lidar");
    lidarObj["status"] = lidar.isActive() ? "ACTIVE" : "INACTIVE";

    // Transmit 360-degree point cloud to PC SLAM engine
    JsonArray pointsArr = doc.createNestedArray("points");
    int ptCount = lidar.getPointCount();
    for (int i = 0; i < ptCount; i++) {
        LidarPoint pt = lidar.getPoint(i);
        JsonObject p = pointsArr.createNestedObject();
        p["angle"] = pt.angle;
        p["distance"] = pt.distance;
    }

    JsonObject cameraObj = doc.createNestedObject("camera");
    cameraObj["status"] = cameraStream.isReady() ? "STREAMING" : "OFFLINE";

    JsonObject hardwareObj = doc.createNestedObject("hardware");
    hardwareObj["esp32"] = "ONLINE";
    hardwareObj["camera"] = cameraStream.isReady() ? "STREAMING" : "OFFLINE";
    hardwareObj["lidar"] = lidar.isActive() ? "ACTIVE" : "INACTIVE";
    hardwareObj["ultrasonic"] = "ACTIVE";
    hardwareObj["motors"] = (motorController.getState() == MOTOR_EMERGENCY_STOP) ? "STOPPED" : "READY";

    String payload;
    serializeJson(doc, payload);
    wsClient.sendPayload(payload);
}
