/*
  ========================================================================================
   ROBONAV — COMPLETE INTEGRATED AUTONOMOUS ROBOT ESP32 FIRMWARE
   Architecture: Laptop ROS 2 Brain + ESP32 DevKit V1 Hardware Controller
   Peripherals:
     - L298N Dual Motor Driver (GPIO 25, 26, 27, 33)
     - 1x Front HC-SR04 Ultrasonic Sensor (Front: 4/18 with 1k/2k Voltage Divider)
     - 1.3" I2C OLED Animated Robot Face (SDA: 13, SCL: 14)
     - Wi-Fi + API Key REST Authentication + Authenticated WebSocket Telemetry & Control
     - Local Safety Watchdog (500ms command timeout + 15cm obstacle auto-stop)
  ========================================================================================
   ESP32 ARDUINO CORE: Compatible with Core 3.x (ledcAttach) and Core 2.x (ledcSetup)
  ========================================================================================
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_arduino_version.h>

// ========================================================================================
// 1. CONFIGURATION & NETWORK CREDENTIALS
// ========================================================================================
#define WIFI_SSID             "ZORO"
#define WIFI_PASSWORD         "00000000"

#define LAPTOP_HOST           "10.25.188.222"  // Active Ubuntu Laptop IP (update if your Wi-Fi IP changes)
#define LAPTOP_PORT           8000


#define ROBOT_ID              "ESP32-ROBOT-001"
#define ROBOT_API_KEY         "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"

// ========================================================================================
// 2. HARDWARE GPIO PIN ASSIGNMENTS
// ========================================================================================
// L298N Motor Driver Pins
#define PIN_MOTOR_LEFT_IN1    25
#define PIN_MOTOR_LEFT_IN2    26
#define PIN_MOTOR_RIGHT_IN3   27
#define PIN_MOTOR_RIGHT_IN4   33

// 1x HC-SR04 Front Ultrasonic Pins (ECHO pin MUST use 1k/2k voltage divider to 3.3V!)
#define PIN_FRONT_TRIG        4
#define PIN_FRONT_ECHO        18


// 1.3" OLED I2C Pins
#define OLED_SDA              13
#define OLED_SCL              14
#define SCREEN_WIDTH          128
#define SCREEN_HEIGHT         64
#define OLED_RESET            -1
#define SCREEN_ADDRESS        0x3C

// Motor PWM Parameters
#define PWM_FREQ              10000
#define PWM_RES               8
#define CH_LEFT_1             0
#define CH_LEFT_2             1
#define CH_RIGHT_1            2
#define CH_RIGHT_2            3

#define MOTOR_MIN_PWM         55    // Overcome motor deadband friction
#define MOTOR_MAX_PWM         255

// Ultrasonic Thresholds (cm)
#define DIST_EMERGENCY_STOP   15.0f
#define DIST_OBSTACLE         25.0f
#define DIST_CAUTION          50.0f
#define MAX_ECHO_TIMEOUT_US   18000 // ~3.1 meters timeout

// ========================================================================================
// 3. GLOBAL OBJECTS & STATE
// ========================================================================================
WebSocketsClient webSocket;
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

String sessionToken = "";
bool isServerAuthenticated = false;
bool isWsConnected = false;
bool emergencyStopActive = false;

int targetLeftSpeed = 0;
int targetRightSpeed = 0;
int currentLeftSpeed = 0;
int currentRightSpeed = 0;

float frontDistanceCm = -1.0f;


unsigned long lastCommandTime = 0;
unsigned long lastTelemetryTime = 0;
unsigned long lastOledFrameTime = 0;
unsigned long lastSensorSampleTime = 0;
int oledAnimFrame = 0;

enum RobotFaceState {
  FACE_BOOTING,
  FACE_CONNECTING,
  FACE_ONLINE,
  FACE_MAPPING,
  FACE_OBSERVATION,
  FACE_NAVIGATING,
  FACE_OBSTACLE,
  FACE_REPLANNING,
  FACE_ARRIVED,
  FACE_RETURNING_HOME,
  FACE_IDLE,
  FACE_EMERGENCY_STOP,
  FACE_NO_CONNECTION
};

RobotFaceState currentOledState = FACE_BOOTING;

// ========================================================================================
// 4. MOTOR CONTROL (ESP32 CORE 3.X & 2.X COMPATIBLE)
// ========================================================================================
void writePwm(uint8_t pin, uint8_t channel, uint32_t duty) {
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

void initMotors() {
#if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
  ledcAttach(PIN_MOTOR_LEFT_IN1, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_LEFT_IN2, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_RIGHT_IN3, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_RIGHT_IN4, PWM_FREQ, PWM_RES);
#else
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

void applyMotorPwm(int left, int right) {
  // Constrain
  left = constrain(left, -MOTOR_MAX_PWM, MOTOR_MAX_PWM);
  right = constrain(right, -MOTOR_MAX_PWM, MOTOR_MAX_PWM);

  // Left Motor
  if (left > 0) {
    int pwm = map(left, 1, 255, MOTOR_MIN_PWM, MOTOR_MAX_PWM);
    writePwm(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, pwm);
    writePwm(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, 0);
  } else if (left < 0) {
    int pwm = map(-left, 1, 255, MOTOR_MIN_PWM, MOTOR_MAX_PWM);
    writePwm(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, 0);
    writePwm(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, pwm);
  } else {
    writePwm(PIN_MOTOR_LEFT_IN1, CH_LEFT_1, 0);
    writePwm(PIN_MOTOR_LEFT_IN2, CH_LEFT_2, 0);
  }

  // Right Motor
  if (right > 0) {
    int pwm = map(right, 1, 255, MOTOR_MIN_PWM, MOTOR_MAX_PWM);
    writePwm(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, pwm);
    writePwm(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, 0);
  } else if (right < 0) {
    int pwm = map(-right, 1, 255, MOTOR_MIN_PWM, MOTOR_MAX_PWM);
    writePwm(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, 0);
    writePwm(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, pwm);
  } else {
    writePwm(PIN_MOTOR_RIGHT_IN3, CH_RIGHT_1, 0);
    writePwm(PIN_MOTOR_RIGHT_IN4, CH_RIGHT_2, 0);
  }
}

void setMotorSpeed(int leftSpeed, int rightSpeed) {
  if (emergencyStopActive) {
    targetLeftSpeed = 0;
    targetRightSpeed = 0;
    currentLeftSpeed = 0;
    currentRightSpeed = 0;
    applyMotorPwm(0, 0);
    return;
  }
  targetLeftSpeed = leftSpeed;
  targetRightSpeed = rightSpeed;
  lastCommandTime = millis();
}

void forward(int speed)   { setMotorSpeed(speed, speed); }
void reverse(int speed)   { setMotorSpeed(-speed, -speed); }
void turnLeft(int speed)  { setMotorSpeed(-speed, speed); }
void turnRight(int speed) { setMotorSpeed(speed, -speed); }

void stopMotors() {
  targetLeftSpeed = 0;
  targetRightSpeed = 0;
  currentLeftSpeed = 0;
  currentRightSpeed = 0;
  applyMotorPwm(0, 0);
}

void emergencyStop() {
  emergencyStopActive = true;
  stopMotors();
  currentOledState = FACE_EMERGENCY_STOP;
  Serial.println("[SAFETY] *** EMERGENCY STOP ACTIVATED ***");
}

void updateMotorRamping() {
  if (emergencyStopActive) {
    stopMotors();
    return;
  }

  // Smooth acceleration / deceleration ramp (max delta 25 PWM units per 20ms)
  const int maxRampDelta = 25;
  if (currentLeftSpeed < targetLeftSpeed) {
    currentLeftSpeed = min(currentLeftSpeed + maxRampDelta, targetLeftSpeed);
  } else if (currentLeftSpeed > targetLeftSpeed) {
    currentLeftSpeed = max(currentLeftSpeed - maxRampDelta, targetLeftSpeed);
  }

  if (currentRightSpeed < targetRightSpeed) {
    currentRightSpeed = min(currentRightSpeed + maxRampDelta, targetRightSpeed);
  } else if (currentRightSpeed > targetRightSpeed) {
    currentRightSpeed = max(currentRightSpeed - maxRampDelta, targetRightSpeed);
  }

  applyMotorPwm(currentLeftSpeed, currentRightSpeed);
}

// ========================================================================================
// 5. ULTRASONIC SENSOR MEASUREMENT (NON-BLOCKING WITH TIMEOUT)
// ========================================================================================
void initUltrasonics() {
  pinMode(PIN_FRONT_TRIG, OUTPUT);
  pinMode(PIN_FRONT_ECHO, INPUT);
  digitalWrite(PIN_FRONT_TRIG, LOW);
  Serial.println("[SENSORS] Front HC-SR04 pin configured (TRIG: 4, ECHO: 18).");
}

float measureDistance(uint8_t trigPin, uint8_t echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, MAX_ECHO_TIMEOUT_US);
  if (duration <= 0) return -1.0f;
  float distCm = (float)duration / 58.2f;
  return (distCm >= 2.0f && distCm <= 350.0f) ? distCm : -1.0f;
}

void sampleUltrasonics() {
  frontDistanceCm = measureDistance(PIN_FRONT_TRIG, PIN_FRONT_ECHO);

  // Local safety check: If obstacle closer than 15 cm ahead and moving forward, halt!
  if (frontDistanceCm > 0 && frontDistanceCm <= DIST_EMERGENCY_STOP) {
    if (targetLeftSpeed > 0 || targetRightSpeed > 0) {
      stopMotors();
      currentOledState = FACE_OBSTACLE;
      Serial.printf("[SAFETY] Obstacle detected at %3.1f cm! Stopping motors.\n", frontDistanceCm);
    }
  }
}


// ========================================================================================
// 6. 1.3-INCH OLED ANIMATED ROBOT EXPRESSIONS (SH1106 / SSD1306)
// ========================================================================================
void drawEye(int x, int y, int w, int h, bool pupilLeft, bool pupilRight, bool closed) {
  if (closed) {
    oled.drawFastHLine(x, y + h / 2, w, SSD1306_WHITE);
    oled.drawFastHLine(x, y + h / 2 + 1, w, SSD1306_WHITE);
    return;
  }
  oled.fillRoundRect(x, y, w, h, 4, SSD1306_WHITE);
  int px = x + w / 2 - 2;
  int py = y + h / 2 - 2;
  if (pupilLeft) px = x + 2;
  if (pupilRight) px = x + w - 6;
  oled.fillCircle(px + 2, py + 2, 2, SSD1306_BLACK);
}

void updateOledFace(RobotFaceState state, int frame) {
  oled.clearDisplay();
  const char* label = "";

  switch (state) {
    case FACE_BOOTING:
      label = "BOOTING...";
      drawEye(24, 12 + (frame % 3), 26, 26, false, false, false);
      drawEye(78, 12 + (frame % 3), 26, 26, false, false, false);
      oled.drawFastHLine(48, 44, 32, SSD1306_WHITE);
      break;

    case FACE_CONNECTING:
      label = "CONNECTING...";
      drawEye(24, 14, 26, 24, (frame % 2 == 0), (frame % 2 != 0), false);
      drawEye(78, 14, 26, 24, (frame % 2 == 0), (frame % 2 != 0), false);
      oled.drawCircle(64, 46, 4, SSD1306_WHITE);
      break;

    case FACE_ONLINE:
      label = "ONLINE";
      drawEye(24, 12, 26, 26, false, false, false);
      drawEye(78, 12, 26, 26, false, false, false);
      oled.drawFastHLine(50, 44, 28, SSD1306_WHITE);
      oled.drawPixel(48, 43, SSD1306_WHITE);
      oled.drawPixel(79, 43, SSD1306_WHITE);
      break;

    case FACE_MAPPING:
      label = "MAPPING...";
      drawEye(24, 14, 28, 22, (frame % 4 < 2), (frame % 4 >= 2), false);
      drawEye(76, 14, 28, 22, (frame % 4 < 2), (frame % 4 >= 2), false);
      for (int x = 40; x <= 88; x += 4) {
        oled.drawPixel(x, 44 + ((x / 4 + frame) % 4) - 2, SSD1306_WHITE);
      }
      break;

    case FACE_OBSERVATION:
      label = "HAPPY OBSERVATION";
      if (frame % 6 == 0) {
        drawEye(24, 12, 26, 26, false, false, true);
        drawEye(78, 12, 26, 26, false, false, true);
      } else {
        drawEye(24, 12, 26, 26, false, false, false);
        drawEye(78, 12, 26, 26, false, false, false);
      }
      oled.drawFastHLine(52, 45, 24, SSD1306_WHITE);
      oled.drawPixel(50, 43, SSD1306_WHITE);
      oled.drawPixel(77, 43, SSD1306_WHITE);
      break;

    case FACE_NAVIGATING:
      label = "NAVIGATING";
      drawEye(26, 16, 28, 18, false, true, false);
      drawEye(74, 16, 28, 18, false, true, false);
      oled.drawFastHLine(54, 44, 20, SSD1306_WHITE);
      break;

    case FACE_OBSTACLE:
      label = "OBSTACLE!";
      drawEye(20 + (frame % 2 * 2), 10, 32, 28, false, false, false);
      drawEye(76 - (frame % 2 * 2), 10, 32, 28, false, false, false);
      oled.drawRect(52, 42, 24, 8, SSD1306_WHITE);
      break;

    case FACE_REPLANNING:
      label = "REROUTING...";
      drawEye(24, 14, 26, 24, (frame % 2 == 0), (frame % 2 == 1), false);
      drawEye(78, 14, 26, 24, (frame % 2 == 0), (frame % 2 == 1), false);
      oled.drawFastHLine(56, 44, 16, SSD1306_WHITE);
      break;

    case FACE_ARRIVED:
      label = "ARRIVED!";
      oled.drawCircle(37, 24, 12, SSD1306_WHITE);
      oled.fillRect(20, 24, 34, 14, SSD1306_BLACK);
      oled.drawCircle(91, 24, 12, SSD1306_WHITE);
      oled.fillRect(74, 24, 34, 14, SSD1306_BLACK);
      oled.drawCircle(64, 40, 10, SSD1306_WHITE);
      oled.fillRect(52, 30, 24, 10, SSD1306_BLACK);
      break;

    case FACE_RETURNING_HOME:
      label = "RETURNING HOME";
      drawEye(26, 14, 26, 22, true, false, false);
      drawEye(76, 14, 26, 22, true, false, false);
      oled.drawFastHLine(52, 44, 24, SSD1306_WHITE);
      break;

    case FACE_IDLE:
      label = "IDLE";
      drawEye(24, 16, 26, 18, false, false, false);
      drawEye(78, 16, 26, 18, false, false, false);
      oled.drawFastHLine(54, 44, 20, SSD1306_WHITE);
      break;

    case FACE_EMERGENCY_STOP:
      label = "STOPPED";
      oled.drawLine(24, 12, 50, 36, SSD1306_WHITE);
      oled.drawLine(50, 12, 24, 36, SSD1306_WHITE);
      oled.drawLine(78, 12, 104, 36, SSD1306_WHITE);
      oled.drawLine(104, 12, 78, 36, SSD1306_WHITE);
      oled.drawFastHLine(48, 46, 32, SSD1306_WHITE);
      break;

    case FACE_NO_CONNECTION:
      label = "NO CONNECTION";
      drawEye(24, 16, 26, 22, false, false, false);
      drawEye(78, 16, 26, 22, false, false, false);
      oled.drawCircle(64, 52, 8, SSD1306_WHITE);
      oled.fillRect(54, 52, 20, 10, SSD1306_BLACK);
      break;

    default:
      break;
  }

  oled.setTextSize(1);
  oled.setTextColor(SSD1306_WHITE);
  int16_t x1, y1;
  uint16_t w, h;
  oled.getTextBounds(label, 0, 54, &x1, &y1, &w, &h);
  oled.setCursor((SCREEN_WIDTH - w) / 2, 54);
  oled.print(label);

  oled.display();
}

void initOled() {
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[OLED] Warning: OLED at 0x3C not found! Continuing without OLED.");
  } else {
    Serial.println("[OLED] 1.3\" OLED Display initialized.");
    oled.clearDisplay();
    oled.display();
  }
}

// ========================================================================================
// 7. WEBSOCKET & REST API AUTHENTICATION
// ========================================================================================
bool authenticateWithLaptop() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String authUrl = String("http://") + LAPTOP_HOST + ":" + LAPTOP_PORT + "/api/robots/auth";
  Serial.printf("[AUTH] Requesting session token from %s...\n", authUrl.c_str());

  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");

  JsonDocument doc;
  doc["robot_id"] = ROBOT_ID;
  doc["api_key"]  = ROBOT_API_KEY;

  String reqBody;
  serializeJson(doc, reqBody);

  int httpCode = http.POST(reqBody);
  if (httpCode == 200) {
    String resp = http.getString();
    JsonDocument respDoc;
    deserializeJson(respDoc, resp);

    if (respDoc["authenticated"] == true) {
      sessionToken = respDoc["session_token"].as<String>();
      if (sessionToken.length() == 0) sessionToken = respDoc["access_token"].as<String>();
      isServerAuthenticated = true;
      Serial.printf("[AUTH] Authentication SUCCESS! Session token acquired.\n");
      http.end();
      return true;
    }
  }

  Serial.printf("[AUTH] Authentication FAILED (HTTP %d). Check API Key.\n", httpCode);
  http.end();
  return false;
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      isWsConnected = false;
      stopMotors();
      currentOledState = FACE_NO_CONNECTION;
      Serial.println("[WS] Disconnected from Laptop Backend.");
      break;

    case WStype_CONNECTED:
      isWsConnected = true;
      currentOledState = FACE_ONLINE;
      Serial.println("[WS] Connected to Laptop Backend!");
      break;

    case WStype_TEXT: {
      JsonDocument doc;
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) return;

      const char* msgType = doc["type"] | "";
      const char* cmd     = doc["command"] | "";

      lastCommandTime = millis();

      // Emergency Stop
      if (strcmp(cmd, "EMERGENCY_STOP") == 0 || strcmp(msgType, "emergency_stop") == 0) {
        emergencyStop();
        return;
      }

      // Resume from emergency stop
      if (strcmp(cmd, "RESUME") == 0) {
        emergencyStopActive = false;
        currentOledState = FACE_IDLE;
        Serial.println("[SAFETY] Emergency Stop cleared.");
        return;
      }

      // Movement Commands
      if (strcmp(cmd, "FORWARD") == 0 || strcmp(cmd, "MOVE_FORWARD") == 0) {
        int spd = (int)((doc["speed"] | 0.35f) * 255.0f);
        forward(spd);
        currentOledState = FACE_NAVIGATING;
      } else if (strcmp(cmd, "REVERSE") == 0 || strcmp(cmd, "MOVE_BACKWARD") == 0) {
        int spd = (int)((doc["speed"] | 0.35f) * 255.0f);
        reverse(spd);
        currentOledState = FACE_NAVIGATING;
      } else if (strcmp(cmd, "LEFT") == 0 || strcmp(cmd, "TURN_LEFT") == 0) {
        int spd = (int)((doc["speed"] | 0.35f) * 255.0f);
        turnLeft(spd);
        currentOledState = FACE_NAVIGATING;
      } else if (strcmp(cmd, "RIGHT") == 0 || strcmp(cmd, "TURN_RIGHT") == 0) {
        int spd = (int)((doc["speed"] | 0.35f) * 255.0f);
        turnRight(spd);
        currentOledState = FACE_NAVIGATING;
      } else if (strcmp(cmd, "STOP") == 0) {
        stopMotors();
        currentOledState = FACE_IDLE;
      } else if (strcmp(cmd, "SET_WHEEL_SPEEDS") == 0) {
        // Direct differential drive setpoints from ROS 2 Nav2 /cmd_vel bridge
        int leftSpd = doc["parameters"]["left"] | (doc["left"] | 0);
        int rightSpd = doc["parameters"]["right"] | (doc["right"] | 0);
        setMotorSpeed(leftSpd, rightSpd);
        currentOledState = (leftSpd != 0 || rightSpd != 0) ? FACE_NAVIGATING : FACE_IDLE;
      }


      // OLED Expression Override
      const char* expr = doc["expression"] | "";
      if (strlen(expr) > 0) {
        if (strcmp(expr, "MAPPING") == 0) currentOledState = FACE_MAPPING;
        else if (strcmp(expr, "NAVIGATING") == 0) currentOledState = FACE_NAVIGATING;
        else if (strcmp(expr, "ARRIVED") == 0) currentOledState = FACE_ARRIVED;
        else if (strcmp(expr, "OBSTACLE") == 0) currentOledState = FACE_OBSTACLE;
        else if (strcmp(expr, "REPLANNING") == 0) currentOledState = FACE_REPLANNING;
        else if (strcmp(expr, "HAPPY") == 0) currentOledState = FACE_OBSERVATION;
        else if (strcmp(expr, "HOME") == 0) currentOledState = FACE_RETURNING_HOME;
      }
      break;
    }

    default:
      break;
  }
}

void connectWebSocket() {
  if (sessionToken.length() == 0) return;
  String path = String("/ws/robot?token=") + sessionToken;
  webSocket.begin(LAPTOP_HOST, LAPTOP_PORT, path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
  Serial.printf("[WS] Initiating connection to ws://%s:%d%s\n", LAPTOP_HOST, LAPTOP_PORT, path.c_str());
}

// ========================================================================================
// 8. TELEMETRY PUSH (10 HZ TO LAPTOP BACKEND)
// ========================================================================================
void sendTelemetry() {
  if (!isWsConnected) return;

  JsonDocument doc;
  doc["type"] = "telemetry";

  JsonObject data = doc["data"].to<JsonObject>();
  data["robot_id"] = ROBOT_ID;
  data["uptime"]   = millis() / 1000;
  data["battery"]  = 98.0f;
  data["rssi"]     = WiFi.RSSI();

  // Ultrasonic sensor data (1x Front Sensor)
  JsonObject us = data["ultrasonic"].to<JsonObject>();
  us["front"] = (frontDistanceCm > 0) ? frontDistanceCm / 100.0f : 2.50f;
  us["front_cm"] = frontDistanceCm;
  us["status"] = (frontDistanceCm > 0 && frontDistanceCm < DIST_EMERGENCY_STOP) ? "OBSTACLE DETECTED" : "CLEAR";


  // Motor state
  JsonObject mot = data["motors"].to<JsonObject>();
  mot["left_speed"]  = currentLeftSpeed;
  mot["right_speed"] = currentRightSpeed;
  mot["state"] = (currentLeftSpeed == 0 && currentRightSpeed == 0) ? "STOPPED" : "RUNNING";
  mot["emergency_stop"] = emergencyStopActive;

  // OLED and controller state
  const char* faceNames[] = {
    "BOOTING", "CONNECTING", "ONLINE", "MAPPING", "HAPPY OBSERVATION",
    "NAVIGATING", "OBSTACLE!", "REROUTING...", "ARRIVED!", "RETURNING HOME",
    "IDLE", "STOPPED", "NO CONNECTION"
  };
  data["oled_expression"] = faceNames[currentOledState];

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
}

// ========================================================================================
// 9. SETUP & MAIN LOOP
// ========================================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n====================================================================");
  Serial.println(" ROBONAV — ESP32 DevKit V1 AUTONOMOUS ROBOT CONTROLLER");
  Serial.println(" Motors: L298N (25, 26, 27, 33) | Ultrasonic: (4/18) | OLED: (13/14)");
  Serial.printf(" Robot ID: %s | Host: %s:%d\n", ROBOT_ID, LAPTOP_HOST, LAPTOP_PORT);
  Serial.println("====================================================================");

  initOled();
  currentOledState = FACE_BOOTING;
  updateOledFace(currentOledState, 0);

  initMotors();
  initUltrasonics();

  // Connect Wi-Fi
  currentOledState = FACE_CONNECTING;
  updateOledFace(currentOledState, 1);
  Serial.printf("[WIFI] Connecting to SSID '%s'...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 30) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
    if (authenticateWithLaptop()) {
      connectWebSocket();
    }
  } else {
    Serial.println("\n[WIFI] Connection failed. Will retry in loop.");
    currentOledState = FACE_NO_CONNECTION;
  }
}

void loop() {
  unsigned long now = millis();

  // 1. Maintain Wi-Fi and WebSocket
  if (WiFi.status() == WL_CONNECTED) {
    if (!isServerAuthenticated) {
      static unsigned long lastAuthRetry = 0;
      if (now - lastAuthRetry > 5000) {
        lastAuthRetry = now;
        if (authenticateWithLaptop()) connectWebSocket();
      }
    } else {
      webSocket.loop();
    }
  } else {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > 5000) {
      lastWifiRetry = now;
      WiFi.reconnect();
    }
  }

  // 2. Local Safety Watchdog (500 ms command timeout)
  // If moving and no command or keep-alive arrived within 500 ms, stop motors immediately!
  if ((targetLeftSpeed != 0 || targetRightSpeed != 0) && (now - lastCommandTime > 500)) {
    stopMotors();
    Serial.println("[SAFETY] Watchdog Timeout (>500ms). Motors stopped locally.");
  }

  // 3. Smooth Motor Acceleration Ramping (50 Hz / every 20ms)
  static unsigned long lastMotorRampTime = 0;
  if (now - lastMotorRampTime >= 20) {
    lastMotorRampTime = now;
    updateMotorRamping();
  }

  // 4. Sample Ultrasonic Distances (10 Hz / every 100ms)
  if (now - lastSensorSampleTime >= 100) {
    lastSensorSampleTime = now;
    sampleUltrasonics();
  }

  // 5. Send Telemetry to Laptop (10 Hz / every 100ms)
  if (now - lastTelemetryTime >= 100) {
    lastTelemetryTime = now;
    sendTelemetry();
  }

  // 6. Animate OLED Face (5 Hz / every 200ms)
  if (now - lastOledFrameTime >= 200) {
    lastOledFrameTime = now;
    oledAnimFrame++;
    updateOledFace(currentOledState, oledAnimFrame);
  }
}
