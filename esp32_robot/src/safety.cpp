#include "safety.h"

SafetyWatchdog safety;

SafetyWatchdog::SafetyWatchdog() : _lastHeartbeat(0), _isTriggered(false) {}

void SafetyWatchdog::begin() {
    _lastHeartbeat = millis();
    _isTriggered = false;
    Serial.println("[Safety] Hardware watchdog armed (Timeout: " + String(WATCHDOG_TIMEOUT_MS) + " ms).");
}

void SafetyWatchdog::pet() {
    _lastHeartbeat = millis();
    if (_isTriggered) {
        _isTriggered = false;
        Serial.println("[Safety] Watchdog recovered by valid incoming command.");
    }
}

void SafetyWatchdog::update(bool isConnected) {
    unsigned long now = millis();

    // 1. Check Communication Loss Failsafe
    if (!isConnected || (now - _lastHeartbeat > WATCHDOG_TIMEOUT_MS)) {
        if (!_isTriggered) {
            _isTriggered = true;
            motorController.stop();
            Serial.println("[Safety] ⚠ Watchdog timeout / Link drop! Cutting motor power for collision safety.");
        }
    }

    // 2. Local Ultrasonic Hardware Collision Brake (Critical near-field override)
    if (ultrasonicSensors.isObstacleNear(0.20f)) {
        if (motorController.getState() == MOTOR_FORWARD) {
            motorController.stop();
            Serial.println("[Safety] ⚠ Emergency Near-field Ultrasonic Obstacle detected (< 20cm)! Halting motors.");
        }
    }
}

void SafetyWatchdog::triggerEmergencyStop() {
    _isTriggered = true;
    motorController.emergencyStop();
}

bool SafetyWatchdog::isTriggered() {
    return _isTriggered;
}
