#ifndef ULTRASONIC_H
#define ULTRASONIC_H

#include <Arduino.h>
#include "config.h"

struct UltrasonicReadings {
    float front; // meters
    float left;  // meters
    float right; // meters
    float rear;  // meters
};

class UltrasonicSensors {
public:
    UltrasonicSensors();
    void begin();
    void update();
    UltrasonicReadings getReadings();
    bool isObstacleNear(float thresholdMeters = 0.35f);

private:
    UltrasonicReadings _readings;
    float _measureDistance(int trigPin, int echoPin);
};

extern UltrasonicSensors ultrasonicSensors;

#endif // ULTRASONIC_H
