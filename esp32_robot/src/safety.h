#ifndef SAFETY_H
#define SAFETY_H

#include <Arduino.h>
#include "motor_controller.h"
#include "ultrasonic.h"
#include "config.h"

class SafetyWatchdog {
public:
    SafetyWatchdog();
    void begin();
    void pet();
    void update(bool isConnected);
    void triggerEmergencyStop();
    bool isTriggered();

private:
    unsigned long _lastHeartbeat;
    bool _isTriggered;
};

extern SafetyWatchdog safety;

#endif // SAFETY_H
