/*
  ========================================================================================
   ROBONAV — STANDALONE L298N DUAL MOTOR DRIVER TEST
   Board: ESP32 DevKit V1 (Core 3.x & Core 2.x LEDC Compatible)
  ========================================================================================
   SAFETY WARNING:
   ELEVATE ROBOT WHEELS OFF THE GROUND BEFORE TESTING!
   Do not power motors directly from the ESP32!
   Use an external 7.4V - 12V battery connected to the L298N 12V terminal.
   Ensure COMMON GROUND between ESP32 and L298N GND.
  ========================================================================================
   WIRING TABLE:
   - Left Motor:
       IN1 -> ESP32 GPIO 25 (PWM Direction 1)
       IN2 -> ESP32 GPIO 26 (PWM Direction 2)
       ENA -> Jumpered to 5V (or remove jumper and wire to GPIO 32)
   - Right Motor:
       IN3 -> ESP32 GPIO 27 (PWM Direction 1)
       IN4 -> ESP32 GPIO 33 (PWM Direction 2)
       ENB -> Jumpered to 5V (or remove jumper and wire to GPIO 15)
   - Power:
       L298N GND  -> ESP32 GND AND Battery Negative
       L298N +12V -> Battery Positive (7.4V - 12V)
       L298N +5V  -> ESP32 VIN (Powers ESP32 from L298N onboard regulator)
  ========================================================================================
*/

#include <Arduino.h>
#include <esp_arduino_version.h>

#define PIN_MOTOR_LEFT_IN1  25
#define PIN_MOTOR_LEFT_IN2  26
#define PIN_MOTOR_RIGHT_IN3 27
#define PIN_MOTOR_RIGHT_IN4 33

#define PWM_FREQ 10000   // 10 kHz PWM
#define PWM_RES  8       // 8-bit resolution (0 - 255)

// LEDC Core 2.x channel numbers if needed
#define CH_LEFT_1  0
#define CH_LEFT_2  1
#define CH_RIGHT_1 2
#define CH_RIGHT_2 3

// Speed limit for bench testing (0 - 255)
#define TEST_SPEED 120

void writePwmPin(uint8_t pin, uint8_t channel, uint32_t duty) {
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

void initMotors() {
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  // ESP32 Arduino Core 3.x API
  ledcAttach(PIN_MOTOR_LEFT_IN1, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_LEFT_IN2, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_RIGHT_IN3, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_RIGHT_IN4, PWM_FREQ, PWM_RES);
#else
  // ESP32 Arduino Core 2.x API
  ledcSetup(CH_LEFT_1, PWM_FREQ, PWM_RES);
  ledcSetup(CH_LEFT_2, PWM_FREQ, PWM_RES);
  ledcSetup(CH_RIGHT_1, PWM_FREQ, PWM_RES);
  ledcSetup(CH_RIGHT_2, PWM_FREQ, PWM_RES);

  ledcAttachPin(PIN_MOTOR_LEFT_IN1, CH_LEFT_1);
  ledcAttachPin(PIN_MOTOR_LEFT_IN2, CH_LEFT_2);
  ledcAttachPin(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1);
  ledcAttachPin(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2);
#endif

  stopMotors();
  Serial.println("[MOTORS] L298N LEDC PWM initialized on GPIO 25, 26, 27, 33.");
}

void setMotorSpeed(int leftSpeed, int rightSpeed) {
  // Constrain speeds to -255 to +255
  leftSpeed = constrain(leftSpeed, -255, 255);
  rightSpeed = constrain(rightSpeed, -255, 255);

  // Left Motor
  if (leftSpeed > 0) {
    writePwmPin(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, leftSpeed);
    writePwmPin(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, 0);
  } else if (leftSpeed < 0) {
    writePwmPin(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, 0);
    writePwmPin(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, -leftSpeed);
  } else {
    writePwmPin(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, 0);
    writePwmPin(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, 0);
  }

  // Right Motor
  if (rightSpeed > 0) {
    writePwmPin(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, rightSpeed);
    writePwmPin(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, 0);
  } else if (rightSpeed < 0) {
    writePwmPin(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, 0);
    writePwmPin(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, -rightSpeed);
  } else {
    writePwmPin(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, 0);
    writePwmPin(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, 0);
  }
}

void forward(int speed) {
  setMotorSpeed(speed, speed);
}

void reverse(int speed) {
  setMotorSpeed(-speed, -speed);
}

void turnLeft(int speed) {
  setMotorSpeed(-speed, speed);
}

void turnRight(int speed) {
  setMotorSpeed(speed, -speed);
}

void stopMotors() {
  setMotorSpeed(0, 0);
}

void emergencyStop() {
  setMotorSpeed(0, 0);
  Serial.println("[MOTORS] *** EMERGENCY STOP ACTIVATED ***");
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n====================================================================");
  Serial.println(" ROBONAV — STANDALONE L298N DUAL MOTOR DRIVER BENCH TEST");
  Serial.println(" Make sure the robot wheels are elevated off the desk!");
  Serial.println("====================================================================");

  initMotors();
}

void loop() {
  Serial.println("\n--- Step 1: FORWARD (Speed: 120 / 255) for 2s ---");
  forward(TEST_SPEED);
  delay(2000);

  Serial.println("--- Step 2: STOP for 1s ---");
  stopMotors();
  delay(1000);

  Serial.println("--- Step 3: REVERSE (Speed: 120 / 255) for 2s ---");
  reverse(TEST_SPEED);
  delay(2000);

  Serial.println("--- Step 4: STOP for 1s ---");
  stopMotors();
  delay(1000);

  Serial.println("--- Step 5: TURN LEFT for 2s ---");
  turnLeft(TEST_SPEED);
  delay(2000);

  Serial.println("--- Step 6: STOP for 1s ---");
  stopMotors();
  delay(1000);

  Serial.println("--- Step 7: TURN RIGHT for 2s ---");
  turnRight(TEST_SPEED);
  delay(2000);

  Serial.println("--- Step 8: EMERGENCY STOP for 3s ---");
  emergencyStop();
  delay(3000);
}
