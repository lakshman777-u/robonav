#include "motor_controller.h"

MotorController motorController;

MotorController::MotorController() : _state(MOTOR_STOPPED), _currentPwm(DEFAULT_SPEED_PWM) {}

void MotorController::begin() {
    Serial.println("[Motors] Initializing motor driver pins...");
    pinMode(MOTOR_LEFT_PWM, OUTPUT);
    pinMode(MOTOR_LEFT_DIR, OUTPUT);
    pinMode(MOTOR_RIGHT_PWM, OUTPUT);
    pinMode(MOTOR_RIGHT_DIR, OUTPUT);

    stop();
}

void MotorController::setSpeed(float normalizedSpeed) {
    if (normalizedSpeed < 0.0f) normalizedSpeed = 0.0f;
    if (normalizedSpeed > 1.0f) normalizedSpeed = 1.0f;
    _currentPwm = (int)(normalizedSpeed * MAX_SPEED_PWM);
    
    // If currently moving, reapply speed
    if (_state == MOTOR_FORWARD) forward();
    else if (_state == MOTOR_BACKWARD) backward();
    else if (_state == MOTOR_TURNING_LEFT) left();
    else if (_state == MOTOR_TURNING_RIGHT) right();
}

void MotorController::forward() {
    _state = MOTOR_FORWARD;
    _applyOutputs(_currentPwm, true, _currentPwm, true);
}

void MotorController::backward() {
    _state = MOTOR_BACKWARD;
    _applyOutputs(_currentPwm, false, _currentPwm, false);
}

void MotorController::left() {
    _state = MOTOR_TURNING_LEFT;
    // Differential pivot: left wheel reverse, right wheel forward
    _applyOutputs(TURN_SPEED_PWM, false, TURN_SPEED_PWM, true);
}

void MotorController::right() {
    _state = MOTOR_TURNING_RIGHT;
    // Differential pivot: left wheel forward, right wheel reverse
    _applyOutputs(TURN_SPEED_PWM, true, TURN_SPEED_PWM, false);
}

void MotorController::stop() {
    _state = MOTOR_STOPPED;
    _applyOutputs(0, false, 0, false);
}

void MotorController::emergencyStop() {
    _state = MOTOR_EMERGENCY_STOP;
    _applyOutputs(0, false, 0, false);
    Serial.println("[Motors] !!! EMERGENCY STOP ENGAGED !!!");
}

MotorState MotorController::getState() {
    return _state;
}

float MotorController::getSpeed() {
    if (_state == MOTOR_STOPPED || _state == MOTOR_EMERGENCY_STOP) return 0.0f;
    return (float)_currentPwm / MAX_SPEED_PWM * 0.40f; // Scale to ~0.40 m/s
}

void MotorController::_applyOutputs(int leftPwm, bool leftDir, int rightPwm, bool rightDir) {
    digitalWrite(MOTOR_LEFT_DIR, leftDir ? HIGH : LOW);
    analogWrite(MOTOR_LEFT_PWM, leftPwm);

    digitalWrite(MOTOR_RIGHT_DIR, rightDir ? HIGH : LOW);
    analogWrite(MOTOR_RIGHT_PWM, rightPwm);
}
