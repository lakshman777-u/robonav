/*
  ========================================================================================
   ROBONAV — ESP32 DevKit V1 + YDLIDAR X2 STANDALONE SLAM TEST FIRMWARE
   Hardware: ESP32 DevKit V1 + YDLIDAR X2 (NO motors, NO camera, NO ultrasonics)
  ========================================================================================

   Wiring Pinout for ESP32 DevKit V1 & YDLIDAR X2:
   -------------------------------------------------------------------------
   YDLIDAR X2 Pin           ESP32 DevKit V1 Pin           Notes
   -------------------------------------------------------------------------
   Pin 1 (Red Wire):   VCC  ->  VIN (or 5V pin)           Requires 5V (>=1.5A)
   Pin 2 (Black Wire): GND  ->  GND                       Common ground
   Pin 3 (Yellow Wire): TXD ->  GPIO 16 (RX2)             LiDAR data to ESP32
   Pin 4 (White Wire): M_EN ->  GPIO 17 (TX2) or 5V       HIGH = Motor spins
   -------------------------------------------------------------------------

   Credentials & Server Configuration:
   - Wi-Fi SSID:    ZORO
   - Wi-Fi Pass:    00000000
   - Laptop IP:     10.166.2.244
   - Laptop Port:   8000
   - Robot ID:      ESP32CAM-001
   - API Key:       rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq
  ========================================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

// ========================================================================================
// 1. NETWORK & CREDENTIALS
// ========================================================================================
#define WIFI_SSID             "ZORO"
#define WIFI_PASSWORD         "00000000"

#define PC_SERVER_HOST        "10.166.2.244"
#define PC_SERVER_PORT        8000

#define ROBOT_ID              "ESP32CAM-001"
#define ROBOT_API_KEY         "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"

#define TELEMETRY_RATE_HZ     10  // Transmit point cloud to laptop 10 times/second

// ========================================================================================
// 2. YDLIDAR X2 UART PIN DEFINITIONS (Hardware Serial2)
// ========================================================================================
#define PIN_LIDAR_RX          16  // ESP32 GPIO 16 (RX2) <- YDLIDAR X2 TXD (Yellow wire)
#define PIN_LIDAR_M_EN        17  // ESP32 GPIO 17 (TX2) -> YDLIDAR X2 M_EN (White wire)
#define LIDAR_BAUD_RATE       115200

// ========================================================================================
// 3. GLOBAL OBJECTS & STATE
// ========================================================================================
WebSocketsClient webSocket;
HardwareSerial LidarSerial(2);

String sessionToken = "";
bool isServerAuthenticated = false;
bool isWsConnected = false;

unsigned long lastTelemetryTime = 0;
unsigned long lastSerialDebugTime = 0;
unsigned long validPacketCount = 0;

// 36-bucket 360-degree point cloud (10 degrees per bucket)
struct LidarPoint {
  float angle;     // degrees (0 - 360)
  float distance;  // meters
};
LidarPoint lidarPoints[36];

// ========================================================================================
// 4. YDLIDAR X2 INITIALIZATION & PACKET PARSER (0xAA 0x55)
// ========================================================================================
void initLidar() {
  for (int i = 0; i < 36; i++) {
    lidarPoints[i].angle = (float)(i * 10);
    lidarPoints[i].distance = 0.0f;
  }

  // Drive Motor Enable HIGH to start the scanning motor
  if (PIN_LIDAR_M_EN >= 0) {
    pinMode(PIN_LIDAR_M_EN, OUTPUT);
    digitalWrite(PIN_LIDAR_M_EN, HIGH);
    Serial.println("[LIDAR] Motor Enable (M_EN) set to HIGH. LiDAR motor is spinning.");
  }

  // Initialize Hardware Serial2 on GPIO 16 (RX)
  LidarSerial.begin(LIDAR_BAUD_RATE, SERIAL_8N1, PIN_LIDAR_RX, -1);
  Serial.println("[LIDAR] Hardware UART Serial2 initialized @ 115200 baud on GPIO 16.");
}

void readYdLidarData() {
  // Non-blocking binary state machine for YDLIDAR X2 packet protocol (Sync Header: 0xAA 0x55)
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
      lsn = b; // Sample count in this packet
      if (lsn > 0 && lsn <= 55) {
        expectedBytes = lsn * 2;
        sampleIndex = 0;
        state = 4;
      } else {
        state = 0;
      }
    } else if (state == 4) {
      fsa = b; // FSA start angle low byte
      state = 5;
    } else if (state == 5) {
      fsa |= ((uint16_t)b << 8); // FSA start angle high byte
      state = 6;
    } else if (state == 6) {
      lsa = b; // LSA end angle low byte
      state = 7;
    } else if (state == 7) {
      lsa |= ((uint16_t)b << 8); // LSA end angle high byte
      state = 8;
    } else if (state == 8) {
      cs = b; // Check Code low
      state = 9;
    } else if (state == 9) {
      cs |= ((uint16_t)b << 8); // Check Code high
      state = 10;
    } else if (state == 10) {
      sampleBuf[sampleIndex++] = b;
      if (sampleIndex >= expectedBytes) {
        // Complete YDLIDAR X2 packet received
        validPacketCount++;

        float angleFSA = (float)((fsa >> 1)) / 64.0f;
        float angleLSA = (float)((lsa >> 1)) / 64.0f;
        float diffAngle = angleLSA - angleFSA;
        if (diffAngle < 0.0f) diffAngle += 360.0f;

        // Process distance samples
        for (int i = 0; i < lsn; i++) {
          uint16_t rawDist = (uint16_t)sampleBuf[2 * i] | ((uint16_t)sampleBuf[2 * i + 1] << 8);
          float distM = (float)(rawDist) / 4000.0f; // Convert mm to meters

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
// 5. WI-FI & LAPTOP REST API AUTHENTICATION
// ========================================================================================
void connectWiFi() {
  Serial.print("[WIFI] Connecting to SSID: ");
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
    Serial.println("\n[WIFI] Connected to ZORO successfully!");
    Serial.print("[WIFI] ESP32 IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Failed to connect to ZORO. Check password and router.");
  }
}

bool authenticateWithLaptop() {
  if (WiFi.status() != WL_CONNECTED) return false;

  HTTPClient http;
  String authUrl = String("http://") + PC_SERVER_HOST + ":" + PC_SERVER_PORT + "/api/robot/auth";
  Serial.print("[AUTH] Handshaking with Laptop Server: ");
  Serial.println(authUrl);

  http.begin(authUrl);
  http.addHeader("Content-Type", "application/json");

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument authDoc;
#else
  StaticJsonDocument<256> authDoc;
#endif
  authDoc["robot_id"] = ROBOT_ID;
  authDoc["api_key"] = ROBOT_API_KEY;

  String authPayload;
  serializeJson(authDoc, authPayload);

  int httpCode = http.POST(authPayload);

  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    Serial.println("[AUTH] Handshake SUCCESSFUL! Response:");
    Serial.println(response);

#if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument respDoc;
#else
    StaticJsonDocument<512> respDoc;
#endif
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
    Serial.print("[AUTH] Handshake Failed! HTTP Code: ");
    Serial.println(httpCode);
    Serial.println("[AUTH] Details: " + http.getString());
  }

  http.end();
  return false;
}

// ========================================================================================
// 6. WEBSOCKET REAL-TIME CLIENT
// ========================================================================================
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      isWsConnected = false;
      Serial.println("[WS] Disconnected from Laptop WebSocket server.");
      break;

    case WStype_CONNECTED:
      isWsConnected = true;
      Serial.println("[WS] Connected to Laptop WebSocket (/ws/robot)! Ready to stream LiDAR.");
      break;

    case WStype_TEXT:
      // Commands from server (if any)
      break;

    default:
      break;
  }
}

void connectWebSocket() {
  if (!isServerAuthenticated) return;

  String wsPath = String("/ws/robot?token=") + sessionToken;
  Serial.print("[WS] Connecting to: ws://");
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
// 7. REAL-TIME LIDAR POINT CLOUD TRANSMISSION (10Hz)
// ========================================================================================
void sendTelemetryAndLidar() {
  if (!isWsConnected) return;

  unsigned long now = millis();
  if (now - lastTelemetryTime < (1000 / TELEMETRY_RATE_HZ)) return;
  lastTelemetryTime = now;

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<2048> doc;
#endif
  doc["type"] = "telemetry";
  doc["robot_id"] = ROBOT_ID;
  doc["timestamp"] = now;
  doc["battery"] = 100;
  doc["speed"] = 0.0f;

  // LiDAR Status
  doc["lidar"]["status"] = "ACTIVE";
  doc["lidar"]["model"] = "YDLIDAR X2";
  doc["lidar"]["packets_rx"] = validPacketCount;

  // Stream 360-degree YDLIDAR X2 point cloud directly to laptop SLAM engine
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonArray pointsArr = doc["points"].to<JsonArray>();
  for (int i = 0; i < 36; i++) {
    JsonObject p = pointsArr.add<JsonObject>();
    p["angle"] = lidarPoints[i].angle;
    p["distance"] = lidarPoints[i].distance;
  }
#else
  JsonArray pointsArr = doc.createNestedArray("points");
  for (int i = 0; i < 36; i++) {
    JsonObject p = pointsArr.createNestedObject();
    p["angle"] = lidarPoints[i].angle;
    p["distance"] = lidarPoints[i].distance;
  }
#endif

  // Hardware status
  doc["hardware"]["esp32"] = "ONLINE";
  doc["hardware"]["lidar"] = (validPacketCount > 0) ? "ACTIVE" : "STARTING";

  String payload;
  serializeJson(doc, payload);
  webSocket.sendTXT(payload);
}

// ========================================================================================
// 8. SERIAL MONITOR DEBUG PRINTS (Every 2 seconds)
// ========================================================================================
void printDebugInfo() {
  unsigned long now = millis();
  if (now - lastSerialDebugTime < 2000) return;
  lastSerialDebugTime = now;

  Serial.println("--------------------------------------------------");
  Serial.printf("[LIDAR STATS] Total Packets: %lu | WS: %s\n", 
                validPacketCount, isWsConnected ? "CONNECTED" : "OFFLINE");
  Serial.printf("  0° (Front): %.2fm |  90° (Right): %.2fm\n", 
                lidarPoints[0].distance, lidarPoints[9].distance);
  Serial.printf("180° (Back):  %.2fm | 270° (Left):  %.2fm\n", 
                lidarPoints[18].distance, lidarPoints[27].distance);
  Serial.println("--------------------------------------------------");
}

// ========================================================================================
// 9. SETUP & MAIN LOOP
// ========================================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("====================================================================");
  Serial.println(" ROBONAV ESP32 DevKit V1 + YDLIDAR X2 SLAM TEST");
  Serial.println("====================================================================");
  Serial.println(" Robot ID:       " ROBOT_ID);
  Serial.println(" Wi-Fi Target:   " WIFI_SSID);
  Serial.println(" Target Laptop:  http://" PC_SERVER_HOST ":8000");
  Serial.println("====================================================================");

  // Initialize LiDAR
  initLidar();

  // Connect to Wi-Fi
  connectWiFi();

  // Authenticate with laptop using your API Key
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

  // Re-authenticate if server was restarted
  if (!isServerAuthenticated) {
    if (authenticateWithLaptop()) {
      connectWebSocket();
    }
    delay(2000);
    return;
  }

  // Handle WebSocket
  webSocket.loop();

  // Read raw binary packets from YDLIDAR X2
  readYdLidarData();

  // Send 10Hz point cloud to laptop SLAM engine
  sendTelemetryAndLidar();

  // Print distance readings to Serial Monitor
  printDebugInfo();
}
