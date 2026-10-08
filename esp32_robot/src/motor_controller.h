#ifndef MOTOR_CONTROLLER_H
#define MOTOR_CONTROLLER_H

#include <Arduino.h>
#include "config.h"

enum MotorState {
    MOTOR_STOPPED,
    MOTOR_FORWARD,
    MOTOR_BACKWARD,
    MOTOR_TURNING_LEFT,
    MOTOR_TURNING_RIGHT,
    MOTOR_EMERGENCY_STOP
};

class MotorController {
public:
    MotorController();
    void begin();
    void setSpeed(float normalizedSpeed); // 0.0 to 1.0
    void forward();
    void backward();
    void left();
    void right();
    void stop();
    void emergencyStop();
    
    MotorState getState();
    float getSpeed();

private:
    MotorState _state;
    int _currentPwm;
    void _applyOutputs(int leftPwm, bool leftDir, int rightPwm, bool rightDir);
};

extern MotorController motorController;

#endif // MOTOR_CONTROLLER_H
