#include "ultrasonic.h"

UltrasonicSensors ultrasonicSensors;

UltrasonicSensors::UltrasonicSensors() {
    _readings = {2.5f, 2.5f, 2.5f, 2.5f};
}

void UltrasonicSensors::begin() {
    Serial.println("[Ultrasonic] Initializing ultrasonic sensor GPIOs...");
    if (ULTRASONIC_FRONT_TRIG >= 0) pinMode(ULTRASONIC_FRONT_TRIG, OUTPUT);
    if (ULTRASONIC_FRONT_ECHO >= 0) pinMode(ULTRASONIC_FRONT_ECHO, INPUT);

    if (ULTRASONIC_LEFT_TRIG >= 0) pinMode(ULTRASONIC_LEFT_TRIG, OUTPUT);
    if (ULTRASONIC_LEFT_ECHO >= 0) pinMode(ULTRASONIC_LEFT_ECHO, INPUT);

    if (ULTRASONIC_RIGHT_TRIG >= 0) pinMode(ULTRASONIC_RIGHT_TRIG, OUTPUT);
    if (ULTRASONIC_RIGHT_ECHO >= 0) pinMode(ULTRASONIC_RIGHT_ECHO, INPUT);

    if (ULTRASONIC_REAR_TRIG >= 0) pinMode(ULTRASONIC_REAR_TRIG, OUTPUT);
    if (ULTRASONIC_REAR_ECHO >= 0) pinMode(ULTRASONIC_REAR_ECHO, INPUT);
}

void UltrasonicSensors::update() {
    if (ULTRASONIC_FRONT_TRIG >= 0 && ULTRASONIC_FRONT_ECHO >= 0) {
        _readings.front = _measureDistance(ULTRASONIC_FRONT_TRIG, ULTRASONIC_FRONT_ECHO);
    }
    if (ULTRASONIC_LEFT_TRIG >= 0 && ULTRASONIC_LEFT_ECHO >= 0) {
        _readings.left = _measureDistance(ULTRASONIC_LEFT_TRIG, ULTRASONIC_LEFT_ECHO);
    }
    if (ULTRASONIC_RIGHT_TRIG >= 0 && ULTRASONIC_RIGHT_ECHO >= 0) {
        _readings.right = _measureDistance(ULTRASONIC_RIGHT_TRIG, ULTRASONIC_RIGHT_ECHO);
    }
    if (ULTRASONIC_REAR_TRIG >= 0 && ULTRASONIC_REAR_ECHO >= 0) {
        _readings.rear = _measureDistance(ULTRASONIC_REAR_TRIG, ULTRASONIC_REAR_ECHO);
    }
}

UltrasonicReadings UltrasonicSensors::getReadings() {
    return _readings;
}

bool UltrasonicSensors::isObstacleNear(float thresholdMeters) {
    return (_readings.front < thresholdMeters || _readings.left < (thresholdMeters * 0.7f) || _readings.right < (thresholdMeters * 0.7f));
}

float UltrasonicSensors::_measureDistance(int trigPin, int echoPin) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    // Timeout after 25ms (~4.2 meters)
    long duration = pulseIn(echoPin, HIGH, 25000);
    if (duration == 0) return 4.0f; // Max range/no echo

    // Speed of sound: 343 m/s -> distance in meters = (duration * 0.000343) / 2
    float meters = (duration * 0.000343f) / 2.0f;
    return constrain(meters, 0.02f, 4.0f);
}
