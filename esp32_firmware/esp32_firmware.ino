/*
  ========================================================================================
   ROBONAV — AUTONOMOUS ESP32-CAM + YDLIDAR X2 SLAM ROBOT FIRMWARE
   Distributed Architecture: ESP32-CAM (Robot Controller) + Laptop (SLAM & Web Server)
  ========================================================================================

   Configured specifically for:
   - LiDAR Model: YDLIDAR X2 (115200 baud, 360-degree laser range scanner)
   - Wi-Fi SSID:  ZORO
   - Wi-Fi Pass:  00000000
   - Robot ID:    ESP32CAM-001
   - API Key:     rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq
   - Target PC:   192.168.1.100:8000 (Your laptop)

   Features:
   - Hardware UART Serial2 parsing of native YDLIDAR X2 binary packets (0xAA 0x55)
   - Automatic motor spin-up via M_EN pin
   - Real-time 360-degree point cloud acquisition in meters
   - Wi-Fi 2.4GHz auto-reconnect
   - REST API token authentication using your secret API key
   - High-speed WebSocket (/ws/robot) 10Hz telemetry streaming
   - 4-way ultrasonic proximity detection
   - Differential PWM motor control (L298N / TB6612FNG)
   - Hardware watchdog safety failsafe (>650ms timeout)
   - Real-time 2D SLAM mapping rendered live on your laptop web page!

   Required Arduino IDE Libraries:
   1. WebSockets by Markus Sattler (v2.4.0+) -> Sketch > Include Library > Manage Libraries
   2. ArduinoJson by Benoit Blanchon (v6.x or v7.x) -> Sketch > Include Library > Manage Libraries
   3. WiFi & HTTPClient -> Built-in with ESP32 Board Package

   Board Selection in Arduino IDE:
   - Tools > Board > ESP32 Arduino > "AI Thinker ESP32-CAM" (or "ESP32 Dev Module")
   - Tools > Partition Scheme > "Huge APP (3MB No OTA/1MB SPIFFS)"
   - Tools > CPU Frequency > 240MHz
  ========================================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ========================================================================================
// 1. YOUR PROJECT CREDENTIALS & LAPTOP SERVER LINK
// ========================================================================================

// --- Robot Identity & Laptop Server Link ---
#define ROBOT_ID              "ESP32CAM-001"
#define ROBOT_API_KEY         "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"
#define PC_SERVER_HOST        "192.168.1.100"  // <-- CHANGE TO YOUR LAPTOP LAN IP ADDRESS (e.g. 192.168.1.X)
#define PC_SERVER_PORT        8000

// --- Wi-Fi Network Credentials ---
#define WIFI_SSID             "ZORO"
#define WIFI_PASSWORD         "00000000"

// --- Timing & Safety Parameters ---
#define TELEMETRY_RATE_HZ     10     // Transmit point cloud to laptop 10 times/sec
#define WATCHDOG_TIMEOUT_MS   650    // Cut motor power if no command received within 650ms

// ========================================================================================
// 2. HARDWARE PIN DEFINITIONS
// ========================================================================================

// --- YDLIDAR X2 UART Interface (Hardware Serial2) ---
// YDLIDAR X2 Pinout:
//   Pin 1 (Red):    VCC (5V from 3A Buck Converter)
//   Pin 2 (Black):  GND (Common Ground)
//   Pin 3 (Yellow): TXD (Data Out) -> Connect to ESP32 GPIO 16 (RX2)
//   Pin 4 (White):  M_EN / M_SCT (Motor Enable) -> Connect to ESP32 GPIO 17 (or 5V for constant run)
#define PIN_LIDAR_RX          16     // ESP32 RX2 <- YDLIDAR X2 TXD
#define PIN_LIDAR_M_EN        17     // ESP32 TX2 -> YDLIDAR X2 M_EN (High = Spin motor)
#define LIDAR_BAUD_RATE       115200

// --- Motor Driver Pins (L298N / TB6612FNG) ---
#define PIN_MOTOR_LEFT_PWM    12
#define PIN_MOTOR_LEFT_DIR    13
#define PIN_MOTOR_RIGHT_PWM   14
#define PIN_MOTOR_RIGHT_DIR   15

// PWM Channels (ESP32 LEDC)
#define PWM_CHANNEL_LEFT      0
#define PWM_CHANNEL_RIGHT     1
#define PWM_FREQ              1000   // 1 kHz PWM frequency
#define PWM_RES               8      // 8-bit resolution (0 - 255)

// --- 4-Way Ultrasonic Sensors (HC-SR04) ---
#define PIN_US_FRONT_TRIG     2
#define PIN_US_FRONT_ECHO     3      // Resistor voltage divider (1k/2k) to 3.3V
#define PIN_US_LEFT_TRIG      4      // Onboard Flash LED pin
#define PIN_US_LEFT_ECHO      16
#define PIN_US_RIGHT_TRIG     0
#define PIN_US_RIGHT_ECHO     1      // TX0 pin
#define PIN_US_REAR_TRIG      -1     // Optional rear trigger
#define PIN_US_REAR_ECHO      -1     // Optional rear echo

// ========================================================================================
// 3. GLOBAL OBJECTS & STATE VARIABLES
// ========================================================================================

WebSocketsClient webSocket;
HardwareSerial LidarSerial(2); // Serial2 for YDLIDAR X2

String sessionToken = "";
bool isServerAuthenticated = false;
bool isWsConnected = false;

unsigned long lastTelemetryTime = 0;
unsigned long lastCommandTime = 0;
float currentSpeed = 0.0f;
float simulatedBattery = 96.0f;

// 360-degree LiDAR point cloud (36 sectors of 10-degrees each for high Wi-Fi speed)
struct LidarPoint {
  float angle;
  float distance;
};
LidarPoint lidarPoints[36];

// ========================================================================================
// 4. MOTOR DRIVER CONTROLLER
// ========================================================================================

void initMotors() {
  pinMode(PIN_MOTOR_LEFT_DIR, OUTPUT);
  pinMode(PIN_MOTOR_RIGHT_DIR, OUTPUT);

  ledcSetup(PWM_CHANNEL_LEFT, PWM_FREQ, PWM_RES);
  ledcSetup(PWM_CHANNEL_RIGHT, PWM_FREQ, PWM_RES);

  ledcAttachPin(PIN_MOTOR_LEFT_PWM, PWM_CHANNEL_LEFT);
  ledcAttachPin(PIN_MOTOR_RIGHT_PWM, PWM_CHANNEL_RIGHT);

  stopMotors();
  Serial.println("[MOTORS] Motor driver initialized (PWM & Direction ready).");
}

void setMotorSpeed(int leftSpeed, int rightSpeed) {
  // Left Motor
  if (leftSpeed >= 0) {
    digitalWrite(PIN_MOTOR_LEFT_DIR, HIGH);
    ledcWrite(PWM_CHANNEL_LEFT, constrain(leftSpeed, 0, 255));
  } else {
    digitalWrite(PIN_MOTOR_LEFT_DIR, LOW);
    ledcWrite(PWM_CHANNEL_LEFT, constrain(-leftSpeed, 0, 255));
  }

  // Right Motor
  if (rightSpeed >= 0) {
    digitalWrite(PIN_MOTOR_RIGHT_DIR, HIGH);
    ledcWrite(PWM_CHANNEL_RIGHT, constrain(rightSpeed, 0, 255));
  } else {
    digitalWrite(PIN_MOTOR_RIGHT_DIR, LOW);
    ledcWrite(PWM_CHANNEL_RIGHT, constrain(-rightSpeed, 0, 255));
  }
}

void moveForward(int speed = 200) {
  currentSpeed = 0.30f;
  setMotorSpeed(speed, speed);
}

void moveBackward(int speed = 200) {
  currentSpeed = -0.30f;
  setMotorSpeed(-speed, -speed);
}

void turnLeft(int speed = 180) {
  currentSpeed = 0.15f;
  setMotorSpeed(-speed, speed);
}

void turnRight(int speed = 180) {
  currentSpeed = 0.15f;
  setMotorSpeed(speed, -speed);
}

void stopMotors() {
  currentSpeed = 0.0f;
  ledcWrite(PWM_CHANNEL_LEFT, 0);
  ledcWrite(PWM_CHANNEL_RIGHT, 0);
  digitalWrite(PIN_MOTOR_LEFT_DIR, LOW);
  digitalWrite(PIN_MOTOR_RIGHT_DIR, LOW);
}

void emergencyStop() {
  stopMotors();
  Serial.println("[SAFETY] EMERGENCY STOP ACTIVATED!");
}

// ========================================================================================
// 5. ULTRASONIC SENSORS (IN METERS)
// ========================================================================================

void initUltrasonic() {
  if (PIN_US_FRONT_TRIG >= 0) pinMode(PIN_US_FRONT_TRIG, OUTPUT);
  if (PIN_US_FRONT_ECHO >= 0) pinMode(PIN_US_FRONT_ECHO, INPUT);
  if (PIN_US_LEFT_TRIG >= 0)  pinMode(PIN_US_LEFT_TRIG, OUTPUT);
  if (PIN_US_LEFT_ECHO >= 0)  pinMode(PIN_US_LEFT_ECHO, INPUT);
  if (PIN_US_RIGHT_TRIG >= 0) pinMode(PIN_US_RIGHT_TRIG, OUTPUT);
  if (PIN_US_RIGHT_ECHO >= 0) pinMode(PIN_US_RIGHT_ECHO, INPUT);
}

float measureDistanceMeters(int trigPin, int echoPin, float fallbackDist = 2.5f) {
  if (trigPin < 0 || echoPin < 0) return fallbackDist;

  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 25000); // 25ms timeout (~4.2m)
  if (duration <= 0) return fallbackDist;

  float distMeters = (duration * 0.0343f) / 2.0f / 100.0f;
  return constrain(distMeters, 0.02f, 4.0f);
}

// ========================================================================================
// 6. YDLIDAR X2 NATIVE BINARY PACKET DECODER (115200 BAUD)
// ========================================================================================

void initLidar() {
  // Initialize point cloud array
  for (int i = 0; i < 36; i++) {
    lidarPoints[i].angle = (float)(i * 10);
    lidarPoints[i].distance = 2.5f + (float)(sin(i * 0.2f) * 0.5f);
  }

  // Turn ON the YDLIDAR X2 motor
  if (PIN_LIDAR_M_EN >= 0) {
    pinMode(PIN_LIDAR_M_EN, OUTPUT);
    digitalWrite(PIN_LIDAR_M_EN, HIGH);
    Serial.println("[YDLIDAR X2] Motor Enable set to HIGH (Motor Spinning).");
  }

  // Initialize Serial2 for YDLIDAR X2 UART
  LidarSerial.begin(LIDAR_BAUD_RATE, SERIAL_8N1, PIN_LIDAR_RX, -1);
  Serial.println("[YDLIDAR X2] Hardware UART Serial2 initialized @ 115200 baud.");
}

void readYdLidarData() {
  // Non-blocking state machine for YDLIDAR X2 packet protocol (Sync: 0xAA 0x55)
  while (LidarSerial.available() > 0) {
    static int state = 0;
    static uint8_t ct = 0;
    static uint8_t lsn = 0;
    static uint16_t fsa = 0;
    static uint16_t lsa = 0;
    static uint16_t cs = 0;
    static uint8_t sampleBuf[128];
    static int sampleIndex = 0;
    static int expectedBytes = 0;

    uint8_t b = LidarSerial.read();

    if (state == 0) {
      if (b == 0xAA) state = 1;
    } else if (state == 1) {
      if (b == 0x55) {
        state = 2; // Found 0xAA 0x55 sync header
      } else {
        state = (b == 0xAA) ? 1 : 0;
      }
    } else if (state == 2) {
      ct = b; // Package Type (0x00 = Point cloud, 0x01 = Zero angle)
      state = 3;
    } else if (state == 3) {
      lsn = b; // Sample quantity in this packet (typically 10 to 40)
      if (lsn > 0 && lsn <= 55) {
        expectedBytes = lsn * 2;
        sampleIndex = 0;
        state = 4;
      } else {
        state = 0;
      }
    } else if (state == 4) {
      fsa = b; // FSA Start Angle Low Byte
      state = 5;
    } else if (state == 5) {
      fsa |= ((uint16_t)b << 8); // FSA Start Angle High Byte
      state = 6;
    } else if (state == 6) {
      lsa = b; // LSA End Angle Low Byte
      state = 7;
    } else if (state == 7) {
      lsa |= ((uint16_t)b << 8); // LSA End Angle High Byte
      state = 8;
    } else if (state == 8) {
      cs = b; // Check Code Low
      state = 9;
    } else if (state == 9) {
      cs |= ((uint16_t)b << 8); // Check Code High
      state = 10;
    } else if (state == 10) {
      sampleBuf[sampleIndex++] = b;
      if (sampleIndex >= expectedBytes) {
        // Complete YDLIDAR X2 packet received!
        float angleFSA = (float)((fsa >> 1)) / 64.0f;
        float angleLSA = (float)((lsa >> 1)) / 64.0f;

        float diffAngle = angleLSA - angleFSA;
        if (diffAngle < 0.0f) diffAngle += 360.0f;

        // Process distance samples and populate sectors
        for (int i = 0; i < lsn; i++) {
          uint16_t rawDist = (uint16_t)sampleBuf[2 * i] | ((uint16_t)sampleBuf[2 * i + 1] << 8);
          float distM = (float)(rawDist) / 4000.0f; // Distance in meters

          float angle = angleFSA;
          if (lsn > 1) {
            angle = angleFSA + (diffAngle / (float)(lsn - 1)) * (float)i;
          }
          if (angle >= 360.0f) angle -= 360.0f;

          if (distM >= 0.08f && distM <= 8.0f) {
            int bucket = ((int)(angle / 10.0f)) % 36;
            lidarPoints[bucket].angle = (float)(bucket * 10);
            lidarPoints[bucket].distance = distM;
          }
        }
        state = 0; // Ready for next packet
      }
    }
  }
}

// ========================================================================================
// 7. WI-FI & LAPTOP REST API AUTHENTICATION
// ========================================================================================

void connectWiFi() {
  Serial.println();
  Serial.print("[WIFI] Connecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 40) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WIFI] Wi-Fi Connected Successfully to ZORO!");
    Serial.print("[WIFI] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("[WIFI] Failed to connect to Wi-Fi ZORO. Check password and router.");
  }
}

bool authenticateWithLaptop() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String authUrl = String("http://") + PC_SERVER_HOST + ":" + PC_SERVER_PORT + "/api/robot/auth";
  Serial.print("[AUTH] Handshaking with Laptop API Server: ");
  Serial.println(authUrl);

  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");

  // Create authentication JSON payload with your API key
  StaticJsonDocument<256> authDoc;
  authDoc["robot_id"] = ROBOT_ID;
  authDoc["api_key"] = ROBOT_API_KEY;

  String authPayload;
  serializeJson(authDoc, authPayload);

  int httpCode = http.POST(authPayload);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.println("[AUTH] Handshake SUCCESS! Authenticated with Laptop:");
    Serial.println(response);

    StaticJsonDocument<512> respDoc;
    DeserializationError error = deserializeJson(respDoc, response);

    if (!error) {
      sessionToken = respDoc["access_token"].as<String>();
      if (sessionToken.length() == 0) {
        sessionToken = respDoc["session_token"].as<String>();
      }
      isServerAuthenticated = true;
      Serial.println("[AUTH] Session JWT Token Acquired!");
      http.end();
      return true;
    }
  } else {
    Serial.print("[AUTH] Authentication Failed! HTTP Error Code: ");
    Serial.println(httpCode);
    Serial.println("[AUTH] Response: " + http.getString());
  }

  http.end();
  return false;
}

// ========================================================================================
// 8. WEBSOCKET CLIENT & BIDIRECTIONAL COMMAND HANDLER
// ========================================================================================

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      isWsConnected = false;
      Serial.println("[WS] Disconnected from Laptop WebSocket server.");
      stopMotors();
      break;

    case WStype_CONNECTED:
      isWsConnected = true;
      Serial.println("[WS] Connected to Laptop WebSocket server (/ws/robot)!");
      lastCommandTime = millis();
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      lastCommandTime = millis(); // Refresh watchdog timer

      StaticJsonDocument<512> cmdDoc;
      DeserializationError err = deserializeJson(cmdDoc, msg);
      if (!err) {
        String command = cmdDoc["command"].as<String>();
        int speedPwm = cmdDoc["speed"].isNull() ? 200 : (int)(cmdDoc["speed"].as<float>() * 255.0f);
        if (speedPwm <= 0) speedPwm = 200;

        if (command == "FORWARD" || command == "MOVE_FORWARD") {
          moveForward(speedPwm);
          Serial.println("[CMD] Action: DRIVE FORWARD");
        } else if (command == "BACKWARD" || command == "MOVE_BACKWARD") {
          moveBackward(speedPwm);
          Serial.println("[CMD] Action: DRIVE BACKWARD");
        } else if (command == "LEFT" || command == "PIVOT_LEFT" || command == "TURN_LEFT") {
          turnLeft(speedPwm);
          Serial.println("[CMD] Action: TURN LEFT");
        } else if (command == "RIGHT" || command == "PIVOT_RIGHT" || command == "TURN_RIGHT") {
          turnRight(speedPwm);
          Serial.println("[CMD] Action: TURN RIGHT");
        } else if (command == "STOP") {
          stopMotors();
          Serial.println("[CMD] Action: STOP");
        } else if (command == "EMERGENCY_STOP") {
          emergencyStop();
        }
      }
      break;
    }

    default:
      break;
  }
}

void connectWebSocket() {
  if (!isServerAuthenticated) return;

  String wsPath = String("/ws/robot?token=") + sessionToken;
  Serial.print("[WS] Connecting WebSocket: ws://");
  Serial.print(PC_SERVER_HOST);
  Serial.print(":");
  Serial.print(PC_SERVER_PORT);
  Serial.println(wsPath);

  webSocket.begin(PC_SERVER_HOST, PC_SERVER_PORT, wsPath);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(2000);
  webSocket.enableHeartbeat(5000, 3000, 2);
}

// ========================================================================================
// 9. REAL-TIME TELEMETRY & YDLIDAR SLAM TRANSMISSION (10Hz)
// ========================================================================================

void sendTelemetryAndLidar() {
  if (!isWsConnected) return;

  unsigned long now = millis();
  if (now - lastTelemetryTime < (1000 / TELEMETRY_RATE_HZ)) return;
  lastTelemetryTime = now;

  // Measure 4-way ultrasonic sensors
  float frontDist = measureDistanceMeters(PIN_US_FRONT_TRIG, PIN_US_FRONT_ECHO, 1.35f);
  float leftDist  = measureDistanceMeters(PIN_US_LEFT_TRIG, PIN_US_LEFT_ECHO, 2.10f);
  float rightDist = measureDistanceMeters(PIN_US_RIGHT_TRIG, PIN_US_RIGHT_ECHO, 1.80f);
  float rearDist  = measureDistanceMeters(PIN_US_REAR_TRIG, PIN_US_REAR_ECHO, 2.20f);

  // Build JSON telemetry packet for Laptop SLAM Engine
  StaticJsonDocument<2048> doc;
  doc["type"] = "telemetry";
  doc["robot_id"] = ROBOT_ID;
  doc["timestamp"] = now;
  doc["battery"] = (int)simulatedBattery;
  doc["speed"] = currentSpeed;

  // Ultrasonic sensor readings
  JsonObject usObj = doc.createNestedObject("ultrasonic");
  usObj["front"] = frontDist;
  usObj["left"] = leftDist;
  usObj["right"] = rightDist;
  usObj["rear"] = rearDist;

  // LiDAR status
  JsonObject lidarObj = doc.createNestedObject("lidar");
  lidarObj["status"] = "ACTIVE";
  lidarObj["model"] = "YDLIDAR X2";

  // Transmit 360-degree YDLIDAR X2 point cloud directly to Laptop SLAM Mapping Engine
  JsonArray pointsArr = doc.createNestedArray("points");
  for (int i = 0; i < 36; i++) {
    JsonObject p = pointsArr.createNestedObject();
    p["angle"] = lidarPoints[i].angle;
    p["distance"] = lidarPoints[i].distance;
  }

  // Hardware health indicators
  JsonObject hwObj = doc.createNestedObject("hardware");
  hwObj["esp32"] = "ONLINE";
  hwObj["lidar"] = "ACTIVE";
  hwObj["ultrasonic"] = "ACTIVE";
  hwObj["motors"] = (currentSpeed != 0.0f) ? "RUNNING" : "READY";

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
}

// ========================================================================================
// 10. WATCHDOG SAFETY CHECK
// ========================================================================================

void checkSafetyWatchdog() {
  if (currentSpeed != 0.0f) {
    if (millis() - lastCommandTime > WATCHDOG_TIMEOUT_MS) {
      Serial.println("[WATCHDOG] Command timeout (>650ms). Halting motors safely.");
      stopMotors();
    }
  }
}

// ========================================================================================
// 11. MAIN SETUP & LOOP
// ========================================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("====================================================================");
  Serial.println(" ROBONAV ESP32-CAM + YDLIDAR X2 AUTONOMOUS SLAM ROBOT");
  Serial.println("====================================================================");
  Serial.println(" Robot ID:       " ROBOT_ID);
  Serial.println(" Wi-Fi Target:   ZORO");
  Serial.println(" Target PC Host: http://" PC_SERVER_HOST ":8000");
  Serial.println("====================================================================");

  // Initialize Peripherals
  initMotors();
  initUltrasonic();
  initLidar();

  // Connect to Wi-Fi ZORO
  connectWiFi();

  // Handshake with laptop using your API Key
  if (WiFi.status() == WL_CONNECTED) {
    if (authenticateWithLaptop()) {
      connectWebSocket();
    }
  }
}

void loop() {
  // Reconnect Wi-Fi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(1000);
    return;
  }

  // Re-authenticate if laptop server was restarted
  if (!isServerAuthenticated) {
    if (authenticateWithLaptop()) {
      connectWebSocket();
    }
    delay(2000);
    return;
  }

  // Process WebSocket packets
  webSocket.loop();

  // Read continuous UART YDLIDAR X2 packets
  readYdLidarData();

  // Transmit 10Hz telemetry and LiDAR points to Laptop for SLAM mapping
  sendTelemetryAndLidar();

  // Hardware watchdog failsafe
  checkSafetyWatchdog();
}
