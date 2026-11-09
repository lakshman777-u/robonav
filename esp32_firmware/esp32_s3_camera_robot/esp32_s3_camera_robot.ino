/*
  ========================================================================================
   ROBONAV — COMPLETE ESP32-S3 AUTONOMOUS ROBOT CONTROLLER
  ========================================================================================
   Hardware Architecture:
     - Main Computer: Ubuntu Laptop running ROS 2 (Nav2 & SLAM Toolbox) @ 10.157.2.169:8000
     - Embedded Controller: ESP32-S3 WROOM CAM (N16R8 / N8R8)
     - Brownout Protection: Hardware brownout detector disabled at boot
     - IMU: MPU9250 9-Axis (Accel + Gyro + Magnetometer) on I2C (SDA: GPIO 1, SCL: GPIO 2)
       >>> CRITICAL MOUNTING: VCC PIN FACES EAST SIDE OF ROBOT (Robot Right / -Y_body)
       >>> Transformed coordinate matrix applied to align with ROS body frame:
           a_x_body = a_y_raw,  a_y_body = -a_x_raw, a_z_body = a_z_raw
           w_x_body = w_y_raw,  w_y_body = -w_x_raw, w_z_body = w_z_raw
           m_x_body = m_y_raw * 0.15, m_y_body = -m_x_raw * 0.15, m_z_body = m_z_raw * 0.15
     - Motor Driver: L298N Dual H-Bridge with Smooth LEDC PWM Ramping
       >>> IN1: GPIO 47 (Left Fwd),  IN2: GPIO 21 (Left Rev)
       >>> IN3: GPIO 14 (Right Fwd), IN4: GPIO 48 (Right Rev)
     - Speed Modes: Default TURTLE MODE (Slow Motion) + ACCELERATION BOOST (~1 cm/s)
     - Camera Module: OV2640 with Multi-Frequency Safe Probe (10MHz / 16MHz) & PSRAM Auto-Detect
       >>> Onboard Asynchronous HTTP MJPEG Streaming Server on Port 80 (http://<ESP32_IP>/stream)
       >>> Background FreeRTOS Push Task on Core 0 to Laptop Backend (/api/robot/video/frame)
       >>> Core 1 dedicated to real-time Motor PWM, MPU9250 (50Hz), and OLED Directional Eyes
     - Display: 1.3" I2C OLED (SH1106 / SSD1306 @ 0x3C on GPIO 1 SDA, GPIO 2 SCL)
       >>> Directional AI Robot Eyes (10 expressive animated states synchronized with movement)
     - Wireless Control Channels (Wi-Fi):
       >>> 1. WebSocket Client: Real-time low-latency bidirectional link to laptop
       >>> 2. Direct Onboard HTTP Endpoint: http://<ESP32_IP>/cmd?dir=forward|backward|left|right|stop
     - Front Obstacle Sensor: ULTRASONIC SENSOR REMOVED (GPIO 41 & 42 Freed)
  ========================================================================================
   ESP32-S3 Pinout Verification (ZERO CONFLICT GUARANTEE):
     - Octal PSRAM: GPIO 33-37 RESERVED (Untouched)
     - Camera OV2640: D0:11, D1:9, D2:8, D3:10, D4:12, D5:18, D6:17, D7:16,
                      XCLK:15, PCLK:13, VSYNC:6, HREF:7, SIOD:4, SIOC:5
     - I2C Bus: SDA: GPIO 1, SCL: GPIO 2 (MPU9250 @ 0x68, OLED @ 0x3C)
     - L298N Motors: IN1: GPIO 47, IN2: GPIO 21, IN3: GPIO 14, IN4: GPIO 48
     - UART Console: TX: GPIO 43, RX: GPIO 44
     - Ultrasonic: REMOVED (GPIO 41 & GPIO 42 are free)
  ========================================================================================
*/

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// CRITICAL: Disable brownout detector in early CRT initialization BEFORE app_main() & initArduino()
void __attribute__((constructor)) disable_brownout_early() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
}

// ========================================================================================
// 1. NETWORK & BACKEND CONFIGURATION
// ========================================================================================
#define WIFI_SSID             "ZORO"
#define WIFI_PASSWORD         "00000000"

// Laptop FastAPI Backend IP (Ubuntu Laptop on active Wi-Fi interface)
#define LAPTOP_HOST           "10.206.8.167"
#define LAPTOP_PORT           8000

#define ROBOT_ID              "ESP32S3-CAM-001"
#define ROBOT_API_KEY         "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"

// ========================================================================================
// 2. VERIFIED ESP32-S3 GPIO PIN ASSIGNMENTS
// ========================================================================================
// I2C Bus (MPU9250 9-Axis IMU & 1.3" OLED Display)
#define PIN_I2C_SDA           1
#define PIN_I2C_SCL           2

// L298N Dual H-Bridge Motor Driver
#define PIN_MOTOR_IN1         47  // Left Motor Forward PWM
#define PIN_MOTOR_IN2         21  // Left Motor Reverse PWM
#define PIN_MOTOR_IN3         14  // Right Motor Forward PWM
#define PIN_MOTOR_IN4         48  // Right Motor Reverse PWM

// OLED Display Parameters
#define SCREEN_WIDTH          128
#define SCREEN_HEIGHT         64
#define OLED_RESET            -1
#define SCREEN_ADDRESS        0x3C

// PWM Channels & Parameters
#define PWM_FREQ              10000
#define PWM_RES               8
#define CH_LEFT_FWD           0
#define CH_LEFT_REV           1
#define CH_RIGHT_FWD          2
#define CH_RIGHT_REV          3

// Speed Constants (TURTLE MODE: Slow, Safe Autonomous Navigation)
#define PWM_DEADBAND          55    // Minimum PWM to overcome static motor friction
#define PWM_TURTLE_NORMAL     75    // Very slow forward/turn (~0.08 - 0.10 m/s)
#define PWM_ACCEL_BOOST       100   // Acceleration boost (~1 cm/s target delta)
#define PWM_MAX_LIMIT         120   // Hardware safety speed ceiling

// Safety Watchdog
#define CMD_TIMEOUT_MS        600   // Auto-stop motors if wireless command drops > 600ms

// ========================================================================================
// 3. ESP32-S3 CAMERA CONFIGURATION (Freenove / AI-Thinker S3 Cam Pinout)
// ========================================================================================
#define PWDN_GPIO_NUM         -1
#define RESET_GPIO_NUM        -1
#define XCLK_GPIO_NUM         15
#define SIOD_GPIO_NUM         4
#define SIOC_GPIO_NUM         5
#define Y9_GPIO_NUM           16
#define Y8_GPIO_NUM           17
#define Y7_GPIO_NUM           18
#define Y6_GPIO_NUM           12
#define Y5_GPIO_NUM           10
#define Y4_GPIO_NUM           8
#define Y3_GPIO_NUM           9
#define Y2_GPIO_NUM           11
#define VSYNC_GPIO_NUM        6
#define HREF_GPIO_NUM         7
#define PCLK_GPIO_NUM         13

// ========================================================================================
// 4. MPU9250 I2C REGISTERS & VCC EAST MOUNTING ORIENTATION
// ========================================================================================
#define MPU9250_ADDR          0x68
#define AK8963_ADDR           0x0C

#define MPU_PWR_MGMT_1        0x6B
#define MPU_ACCEL_CONFIG      0x1C
#define MPU_GYRO_CONFIG       0x1B
#define MPU_ACCEL_XOUT_H      0x3B
#define MPU_GYRO_XOUT_H       0x43
#define MPU_INT_PIN_CFG       0x37  // Bypass enable to access AK8963 Magnetometer
#define AK8963_CNTL1          0x0A
#define AK8963_HXL            0x03

// Global Objects
WebSocketsClient webSocket;
Adafruit_SSD1306 oled(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
httpd_handle_t camera_httpd = NULL;

// State Variables
String sessionToken = "";
bool isServerAuthenticated = false;
bool isWsConnected = false;
bool isEmergencyStopped = false;
bool isBoostActive = false;
bool cameraInitialized = false;

// Motor Speeds & Direction
int targetLeftPwm = 0;
int targetRightPwm = 0;
int currentLeftPwm = 0;
int currentRightPwm = 0;

String currentDirection = "STOPPED";
String currentEyeExpression = "HAPPY";
int eyePriority = 9; // 1 = highest (E-Stop), 9 = lowest (Idle)

// MPU9250 9-Axis Measurements (Transformed to ROS Body Frame with VCC facing East)
float accelX = 0, accelY = 0, accelZ = 9.80665f;
float gyroX = 0, gyroY = 0, gyroZ = 0;
float magX = 0, magY = 0, magZ = 0;
float rollDeg = 0, pitchDeg = 0, yawDeg = 0, compassHeading = 0;

// Timing
unsigned long lastCommandTime = 0;
unsigned long lastTelemetryTime = 0;
unsigned long lastSensorSampleTime = 0;
unsigned long lastOledFrameTime = 0;
int blinkCounter = 0;
bool isBlinking = false;

// Function Prototypes
void initPwmChannels();
void writePwm(int pin, int channel, int duty);
void initCamera();
void startCameraServer();
void initMPU9250();
void readMPU9250();
void updateMotorPWM();
void handleDirectMotorCommand(String cmd);
void setDirectionAndEyes(String dir, String expr, int priority);
void renderOledEyes();
bool authenticateWithLaptop();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void sendTelemetry();
void cameraPushTask(void * pvParameters);

// ========================================================================================
// CORE-COMPATIBLE LEDC PWM WRAPPERS (Supports ESP32 Arduino Core 2.x and 3.x)
// ========================================================================================
void initPwmChannels() {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcAttach(PIN_MOTOR_IN1, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_IN2, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_IN3, PWM_FREQ, PWM_RES);
  ledcAttach(PIN_MOTOR_IN4, PWM_FREQ, PWM_RES);
#else
  ledcSetup(CH_LEFT_FWD, PWM_FREQ, PWM_RES);
  ledcSetup(CH_LEFT_REV, PWM_FREQ, PWM_RES);
  ledcSetup(CH_RIGHT_FWD, PWM_FREQ, PWM_RES);
  ledcSetup(CH_RIGHT_REV, PWM_FREQ, PWM_RES);
  ledcAttachPin(PIN_MOTOR_IN1, CH_LEFT_FWD);
  ledcAttachPin(PIN_MOTOR_IN2, CH_LEFT_REV);
  ledcAttachPin(PIN_MOTOR_IN3, CH_RIGHT_FWD);
  ledcAttachPin(PIN_MOTOR_IN4, CH_RIGHT_REV);
#endif
}

void writePwm(int pin, int channel, int duty) {
#if defined(ESP_ARDUINO_VERSION_MAJOR) && (ESP_ARDUINO_VERSION_MAJOR >= 3)
  ledcWrite(pin, duty);
#else
  ledcWrite(channel, duty);
#endif
}

// ========================================================================================
// 5. CAMERA INITIALIZATION WITH STABLE XCLK, BROWNOUT PROTECTION & PSRAM DETECT
// ========================================================================================
void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_4;
  config.ledc_timer = LEDC_TIMER_2;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  
  // Set initial clock to 10 MHz: Rock-solid I2C SCCB clock locking and probe stability
  config.xclk_freq_hz = 10000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.printf("[Camera] PSRAM Detected! Size: %u KB, Free: %u KB\n",
                  ESP.getPsramSize() / 1024, ESP.getFreePsram() / 1024);
    config.frame_size = FRAMESIZE_VGA;    // 640x480
    config.jpeg_quality = 12;             // 10-63 (lower = sharper)
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    Serial.println(F("[Camera] No PSRAM detected. Using internal DRAM fallback (QVGA 320x240)."));
    config.frame_size = FRAMESIZE_QVGA;   // 320x240
    config.jpeg_quality = 14;
    config.fb_count = 1;
    config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // Attempt 1: 10 MHz
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[Camera] Init failed (0x%x) at 10 MHz. De-init and retrying at 16 MHz...\n", err);
    esp_camera_deinit();
    delay(150);
    config.xclk_freq_hz = 16000000;
    err = esp_camera_init(&config);
  }

  // Attempt 2: 20 MHz fallback
  if (err != ESP_OK) {
    Serial.printf("[Camera] Init failed (0x%x) at 16 MHz. Retrying with QVGA 20 MHz...\n", err);
    esp_camera_deinit();
    delay(150);
    config.xclk_freq_hz = 20000000;
    config.frame_size = FRAMESIZE_QVGA;
    config.fb_count = 1;
    err = esp_camera_init(&config);
  }

  if (err == ESP_OK) {
    cameraInitialized = true;
    Serial.println(F("[Camera] OV2640 Camera initialized successfully!"));
    sensor_t * s = esp_camera_sensor_get();
    if (s != NULL) {
      s->set_vflip(s, 0);
      s->set_hmirror(s, 0);
      s->set_brightness(s, 1);
      s->set_contrast(s, 1);
      s->set_saturation(s, 0);
    }
  } else {
    cameraInitialized = false;
    Serial.printf("[Camera] ERROR: OV2640 probe failed (0x%x). Check ribbon cable and PSRAM setting in Tools menu.\n", err);
  }
}

// ========================================================================================
// 6. ONBOARD ASYNCHRONOUS HTTP STREAMING & COMMAND SERVER (Port 80)
// ========================================================================================
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char part_buf[128];

  res = httpd_resp_set_type(req, "multipart/x-mixed-replace; boundary=123456789000000000000987654321");
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      res = ESP_FAIL;
      break;
    }
    _jpg_buf_len = fb->len;
    _jpg_buf = fb->buf;

    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 128,
        "\r\n--123456789000000000000987654321\r\nContent-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n",
        (unsigned int)_jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    esp_camera_fb_return(fb);
    fb = NULL;
    if (res != ESP_OK) break;
    vTaskDelay(pdMS_TO_TICKS(50)); // ~20 FPS stream
  }
  return res;
}

static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

static esp_err_t cmd_handler(httpd_req_t *req) {
  char query[128];
  char param[32];
  if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
    if (httpd_query_key_value(query, "dir", param, sizeof(param)) == ESP_OK ||
        httpd_query_key_value(query, "action", param, sizeof(param)) == ESP_OK) {
      handleDirectMotorCommand(String(param));
    }
    if (httpd_query_key_value(query, "speed", param, sizeof(param)) == ESP_OK) {
      String s = String(param);
      s.toUpperCase();
      isBoostActive = (s == "BOOST");
    }
  }
  httpd_resp_set_type(req, "application/json");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  String resp = "{\"status\":\"ok\",\"direction\":\"" + currentDirection + "\",\"mode\":\"" + (isBoostActive ? "BOOST" : "TURTLE") + "\"}";
  return httpd_resp_send(req, resp.c_str(), resp.length());
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };
  httpd_uri_t root_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };
  httpd_uri_t snap_uri = {
    .uri       = "/jpg",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };
  httpd_uri_t cmd_uri = {
    .uri       = "/cmd",
    .method    = HTTP_GET,
    .handler   = cmd_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&camera_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(camera_httpd, &stream_uri);
    httpd_register_uri_handler(camera_httpd, &root_uri);
    httpd_register_uri_handler(camera_httpd, &snap_uri);
    httpd_register_uri_handler(camera_httpd, &cmd_uri);
    Serial.println(F("[HTTP Server] Camera HTTP server active on port 80"));
    Serial.printf("[HTTP Server] Stream URL: http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("[HTTP Server] Motor Cmd:  http://%s/cmd?dir=forward\n", WiFi.localIP().toString().c_str());
  }
}

// ========================================================================================
// 7. BACKGROUND DUAL-CORE CAMERA STREAM PUSH TASK (Core 0)
// ========================================================================================
void cameraPushTask(void * pvParameters) {
  while (true) {
    if (cameraInitialized && (WiFi.status() == WL_CONNECTED)) {
      camera_fb_t * fb = esp_camera_fb_get();
      if (fb) {
        if (fb->len > 0) {
          HTTPClient http;
          http.setTimeout(1200); // 1.2s safety timeout
          String url = "http://" + String(LAPTOP_HOST) + ":" + String(LAPTOP_PORT) + "/api/robot/video/frame";
          if (http.begin(url)) {
            http.addHeader("Content-Type", "image/jpeg");
            http.addHeader("X-Robot-Key", ROBOT_API_KEY);
            http.POST(fb->buf, fb->len);
            http.end();
          }
        }
        esp_camera_fb_return(fb);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(66)); // ~15 FPS stream to laptop backend
  }
}

// ========================================================================================
// 8. MPU9250 DRIVER WITH EXACT VCC EAST MOUNTING TRANSFORMATION
// ========================================================================================
void initMPU9250() {
  Wire.beginTransmission(MPU9250_ADDR);
  Wire.write(MPU_PWR_MGMT_1);
  Wire.write(0x00); // Wake up MPU9250
  Wire.endTransmission();
  delay(10);

  // Configure Accelerometer to ±4g (0x08)
  Wire.beginTransmission(MPU9250_ADDR);
  Wire.write(MPU_ACCEL_CONFIG);
  Wire.write(0x08);
  Wire.endTransmission();

  // Configure Gyroscope to ±500 deg/s (0x08)
  Wire.beginTransmission(MPU9250_ADDR);
  Wire.write(MPU_GYRO_CONFIG);
  Wire.write(0x08);
  Wire.endTransmission();

  // Enable bypass multiplexer to access AK8963 Magnetometer on secondary I2C
  Wire.beginTransmission(MPU9250_ADDR);
  Wire.write(MPU_INT_PIN_CFG);
  Wire.write(0x02);
  Wire.endTransmission();
  delay(10);

  // Wake up AK8963 Magnetometer (Continuous Measurement Mode 2, 16-bit output: 0x16)
  Wire.beginTransmission(AK8963_ADDR);
  Wire.write(AK8963_CNTL1);
  Wire.write(0x16);
  Wire.endTransmission();

  Serial.println(F("[MPU9250] Initialized with VCC-East body frame transformation matrix."));
}

void readMPU9250() {
  // Read Accelerometer (6 bytes) + Temp (2 bytes) + Gyroscope (6 bytes) = 14 bytes
  Wire.beginTransmission(MPU9250_ADDR);
  Wire.write(MPU_ACCEL_XOUT_H);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU9250_ADDR, 14, true);

  if (Wire.available() >= 14) {
    int16_t raw_ax = (Wire.read() << 8) | Wire.read();
    int16_t raw_ay = (Wire.read() << 8) | Wire.read();
    int16_t raw_az = (Wire.read() << 8) | Wire.read();
    Wire.read(); Wire.read(); // Skip temp
    int16_t raw_gx = (Wire.read() << 8) | Wire.read();
    int16_t raw_gy = (Wire.read() << 8) | Wire.read();
    int16_t raw_gz = (Wire.read() << 8) | Wire.read();

    float s_ax = (float)raw_ax * (4.0f / 32768.0f) * 9.80665f;
    float s_ay = (float)raw_ay * (4.0f / 32768.0f) * 9.80665f;
    float s_az = (float)raw_az * (4.0f / 32768.0f) * 9.80665f;

    float s_gx = (float)raw_gx * (500.0f / 32768.0f) * (PI / 180.0f);
    float s_gy = (float)raw_gy * (500.0f / 32768.0f) * (PI / 180.0f);
    float s_gz = (float)raw_gz * (500.0f / 32768.0f) * (PI / 180.0f);

    /*
      ========================================================================
       CRITICAL MPU9250 TRANSFORMATION: VCC PIN FACES EAST (Robot Right / -Y)
      ========================================================================
       Robot Body Frame: X = Forward, Y = Left, Z = Up (ROS 2 REP 103)
       Sensor to Robot mapping:
         a_x_robot =  a_y_sensor
         a_y_robot = -a_x_sensor
         a_z_robot =  a_z_sensor
         w_x_robot =  w_y_sensor
         w_y_robot = -w_x_sensor
         w_z_robot =  w_z_sensor
      ========================================================================
    */
    accelX = s_ay;
    accelY = -s_ax;
    accelZ = s_az;

    gyroX = s_gy;
    gyroY = -s_gx;
    gyroZ = s_gz;

    // Roll and Pitch tilt angles (degrees)
    rollDeg = atan2(accelY, accelZ) * (180.0f / PI);
    pitchDeg = atan2(-accelX, sqrt(accelY * accelY + accelZ * accelZ)) * (180.0f / PI);
  }

  // Read AK8963 Magnetometer (7 bytes: HXL..HZH + ST2 register)
  Wire.beginTransmission(AK8963_ADDR);
  Wire.write(AK8963_HXL);
  Wire.endTransmission(false);
  Wire.requestFrom(AK8963_ADDR, 7, true);

  if (Wire.available() >= 7) {
    int16_t m_x = (Wire.read()) | (Wire.read() << 8);
    int16_t m_y = (Wire.read()) | (Wire.read() << 8);
    int16_t m_z = (Wire.read()) | (Wire.read() << 8);
    uint8_t stat2 = Wire.read(); // ST2 register release

    // AK8963 sensor axes: X_mag = Y_accel, Y_mag = X_accel
    // After VCC-East alignment:
    magX = (float)m_y * 0.15f;
    magY = -(float)m_x * 0.15f;
    magZ = (float)m_z * 0.15f;

    // Tilt-compensated magnetic compass heading
    float rRad = rollDeg * (PI / 180.0f);
    float pRad = pitchDeg * (PI / 180.0f);
    float compX = magX * cos(pRad) + magZ * sin(pRad);
    float compY = magX * sin(rRad) * sin(pRad) + magY * cos(rRad) - magZ * sin(rRad) * cos(pRad);

    compassHeading = atan2(compY, compX) * (180.0f / PI);
    if (compassHeading < 0) compassHeading += 360.0f;
    yawDeg = compassHeading;
  }
}

// ========================================================================================
// 9. MOTOR DRIVER & SPEED CONTROL (TURTLE MODE & ACCEL BOOST)
// ========================================================================================
void updateMotorPWM() {
  // Left Motor (IN1: Forward, IN2: Reverse)
  if (currentLeftPwm > 0) {
    writePwm(PIN_MOTOR_IN1, CH_LEFT_FWD, currentLeftPwm);
    writePwm(PIN_MOTOR_IN2, CH_LEFT_REV, 0);
  } else if (currentLeftPwm < 0) {
    writePwm(PIN_MOTOR_IN1, CH_LEFT_FWD, 0);
    writePwm(PIN_MOTOR_IN2, CH_LEFT_REV, -currentLeftPwm);
  } else {
    writePwm(PIN_MOTOR_IN1, CH_LEFT_FWD, 0);
    writePwm(PIN_MOTOR_IN2, CH_LEFT_REV, 0);
  }

  // Right Motor (IN3: Forward, IN4: Reverse)
  if (currentRightPwm > 0) {
    writePwm(PIN_MOTOR_IN3, CH_RIGHT_FWD, currentRightPwm);
    writePwm(PIN_MOTOR_IN4, CH_RIGHT_REV, 0);
  } else if (currentRightPwm < 0) {
    writePwm(PIN_MOTOR_IN3, CH_RIGHT_FWD, 0);
    writePwm(PIN_MOTOR_IN4, CH_RIGHT_REV, -currentRightPwm);
  } else {
    writePwm(PIN_MOTOR_IN3, CH_RIGHT_FWD, 0);
    writePwm(PIN_MOTOR_IN4, CH_RIGHT_REV, 0);
  }
}

void handleDirectMotorCommand(String cmd) {
  lastCommandTime = millis();
  cmd.toUpperCase();
  int basePwm = isBoostActive ? PWM_ACCEL_BOOST : PWM_TURTLE_NORMAL;

  if (cmd == "FORWARD" || cmd == "MOVE_FORWARD") {
    targetLeftPwm = basePwm;
    targetRightPwm = basePwm;
    setDirectionAndEyes("FORWARD", "MOVING FORWARD", 8);
  }
  else if (cmd == "BACKWARD" || cmd == "REVERSE" || cmd == "MOVE_BACKWARD") {
    targetLeftPwm = -basePwm;
    targetRightPwm = -basePwm;
    setDirectionAndEyes("REVERSE", "LOOKING BACK", 7);
  }
  else if (cmd == "LEFT" || cmd == "TURN_LEFT") {
    targetLeftPwm = -basePwm;
    targetRightPwm = basePwm;
    setDirectionAndEyes("TURN_LEFT", "TURNING LEFT", 6);
  }
  else if (cmd == "RIGHT" || cmd == "TURN_RIGHT") {
    targetLeftPwm = basePwm;
    targetRightPwm = -basePwm;
    setDirectionAndEyes("TURN_RIGHT", "TURNING RIGHT", 6);
  }
  else if (cmd == "U_TURN_LEFT" || cmd == "UTURN_LEFT") {
    targetLeftPwm = -basePwm;
    targetRightPwm = basePwm;
    setDirectionAndEyes("U_TURN_LEFT", "U-TURN LEFT", 5);
  }
  else if (cmd == "U_TURN_RIGHT" || cmd == "UTURN_RIGHT") {
    targetLeftPwm = basePwm;
    targetRightPwm = -basePwm;
    setDirectionAndEyes("U_TURN_RIGHT", "U-TURN RIGHT", 5);
  }
  else if (cmd == "STOP" || cmd == "BRAKE") {
    targetLeftPwm = 0;
    targetRightPwm = 0;
    currentLeftPwm = 0;
    currentRightPwm = 0;
    updateMotorPWM();
    setDirectionAndEyes("STOPPED", "HAPPY", 9);
  }
  else if (cmd == "EMERGENCY_STOP") {
    targetLeftPwm = 0;
    targetRightPwm = 0;
    currentLeftPwm = 0;
    currentRightPwm = 0;
    isEmergencyStopped = true;
    updateMotorPWM();
    setDirectionAndEyes("STOPPED", "STOP!", 1);
  }
}

// ========================================================================================
// 10. DIRECTION & AI ROBOT EYE ANIMATION ENGINE (10 Expressive States)
// ========================================================================================
void setDirectionAndEyes(String dir, String expr, int priority) {
  currentDirection = dir;
  eyePriority = priority;
  currentEyeExpression = expr;
}

void renderOledEyes() {
  oled.clearDisplay();

  blinkCounter++;
  if (blinkCounter >= 70) {
    isBlinking = true;
    if (blinkCounter >= 74) {
      isBlinking = false;
      blinkCounter = 0;
    }
  }

  int eyeW = 28;
  int eyeH = isBlinking ? 4 : 38;
  int eyeY = 14 + (isBlinking ? 17 : 0);

  int leftEyeX = 24;
  int rightEyeX = 76;
  int pupilOffsetX = 0;
  int pupilOffsetY = 0;
  const char* labelText = "ROBONAV";

  // Evaluate Expression Priorities
  if (currentEyeExpression == "STOP!" || isEmergencyStopped) {
    labelText = "STOP!";
    oled.drawRect(leftEyeX, eyeY, eyeW, eyeH, SSD1306_WHITE);
    oled.drawRect(rightEyeX, eyeY, eyeW, eyeH, SSD1306_WHITE);
    oled.drawLine(leftEyeX + 4, eyeY + 4, leftEyeX + eyeW - 4, eyeY + eyeH - 4, SSD1306_WHITE);
    oled.drawLine(leftEyeX + eyeW - 4, eyeY + 4, leftEyeX + 4, eyeY + eyeH - 4, SSD1306_WHITE);
    oled.drawLine(rightEyeX + 4, eyeY + 4, rightEyeX + eyeW - 4, eyeY + eyeH - 4, SSD1306_WHITE);
    oled.drawLine(rightEyeX + eyeW - 4, eyeY + 4, rightEyeX + 4, eyeY + eyeH - 4, SSD1306_WHITE);
  }
  else if (currentEyeExpression == "OFFLINE") {
    labelText = "OFFLINE";
    oled.drawRoundRect(leftEyeX, eyeY + 6, eyeW, eyeH - 12, 6, SSD1306_WHITE);
    oled.drawRoundRect(rightEyeX, eyeY + 6, eyeW, eyeH - 12, 6, SSD1306_WHITE);
    oled.drawLine(leftEyeX + 2, eyeY + 2, leftEyeX + eyeW, eyeY + 12, SSD1306_WHITE);
    oled.drawLine(rightEyeX, eyeY + 12, rightEyeX + eyeW - 2, eyeY + 2, SSD1306_WHITE);
  }
  else if (currentEyeExpression == "ALERT") {
    labelText = "ALERT";
    oled.fillRoundRect(leftEyeX, eyeY + 8, eyeW, eyeH - 14, 8, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY + 8, eyeW, eyeH - 14, 8, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14, eyeY + 18, 5, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14, eyeY + 18, 5, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "U-TURN LEFT") {
    labelText = "U-TURN LEFT";
    pupilOffsetX = -8;
    pupilOffsetY = 2;
    oled.fillRoundRect(leftEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14 + pupilOffsetX, eyeY + 19 + pupilOffsetY, 6, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14 + pupilOffsetX, eyeY + 19 + pupilOffsetY, 6, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "U-TURN RIGHT") {
    labelText = "U-TURN RIGHT";
    pupilOffsetX = 8;
    pupilOffsetY = 2;
    oled.fillRoundRect(leftEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14 + pupilOffsetX, eyeY + 19 + pupilOffsetY, 6, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14 + pupilOffsetX, eyeY + 19 + pupilOffsetY, 6, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "TURNING LEFT") {
    labelText = "TURNING LEFT";
    pupilOffsetX = -7;
    oled.fillRoundRect(leftEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14 + pupilOffsetX, eyeY + 19, 6, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14 + pupilOffsetX, eyeY + 19, 6, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "TURNING RIGHT") {
    labelText = "TURNING RIGHT";
    pupilOffsetX = 7;
    oled.fillRoundRect(leftEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14 + pupilOffsetX, eyeY + 19, 6, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14 + pupilOffsetX, eyeY + 19, 6, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "LOOKING BACK") {
    labelText = "LOOKING BACK";
    pupilOffsetX = -5;
    pupilOffsetY = 4;
    oled.fillRoundRect(leftEyeX, eyeY + 4, eyeW, eyeH - 8, 8, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY + 4, eyeW, eyeH - 8, 8, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14 + pupilOffsetX, eyeY + 16 + pupilOffsetY, 5, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14 + pupilOffsetX, eyeY + 16 + pupilOffsetY, 5, SSD1306_BLACK);
  }
  else if (currentEyeExpression == "ARRIVED!") {
    labelText = "ARRIVED!";
    oled.drawCircle(leftEyeX + 14, eyeY + 12, 12, SSD1306_WHITE);
    oled.drawCircle(rightEyeX + 14, eyeY + 12, 12, SSD1306_WHITE);
    oled.fillRect(leftEyeX, eyeY + 14, eyeW, 20, SSD1306_BLACK);
    oled.fillRect(rightEyeX, eyeY + 14, eyeW, 20, SSD1306_BLACK);
  }
  else {
    labelText = isBoostActive ? "BOOST ACTIVE" : (currentDirection == "FORWARD" ? "MOVING FORWARD" : "ROBONAV");
    oled.fillRoundRect(leftEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillRoundRect(rightEyeX, eyeY, eyeW, eyeH, 10, SSD1306_WHITE);
    oled.fillCircle(leftEyeX + 14, eyeY + 19, 6, SSD1306_BLACK);
    oled.fillCircle(rightEyeX + 14, eyeY + 19, 6, SSD1306_BLACK);
    oled.fillCircle(leftEyeX + 12, eyeY + 17, 2, SSD1306_WHITE);
    oled.fillCircle(rightEyeX + 12, eyeY + 17, 2, SSD1306_WHITE);
  }

  oled.setTextSize(1);
  oled.setCursor(20, 56);
  oled.print(labelText);
  oled.display();
}

// ========================================================================================
// 11. AUTHENTICATION & WEBSOCKET CLIENT
// ========================================================================================
bool authenticateWithLaptop() {
  HTTPClient http;
  String authUrl = "http://" + String(LAPTOP_HOST) + ":" + String(LAPTOP_PORT) + "/api/robots/auth";

  if (!http.begin(authUrl)) return false;
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["robot_id"] = ROBOT_ID;
  doc["api_key"] = ROBOT_API_KEY;
  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);
  if (httpCode == 200 || httpCode == 201) {
    String response = http.getString();
    StaticJsonDocument<512> resDoc;
    deserializeJson(resDoc, response);
    if (resDoc.containsKey("access_token")) {
      sessionToken = resDoc["access_token"].as<String>();
    } else if (resDoc.containsKey("session_token")) {
      sessionToken = resDoc["session_token"].as<String>();
    } else if (resDoc.containsKey("token")) {
      sessionToken = resDoc["token"].as<String>();
    }
    isServerAuthenticated = true;
    http.end();
    return true;
  }

  http.end();
  return false;
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      isWsConnected = true;
      Serial.println(F("[WS] Connected to Laptop Backend!"));
      break;

    case WStype_DISCONNECTED:
      isWsConnected = false;
      Serial.println(F("[WS] Disconnected from Laptop Backend. Stopping motors."));
      targetLeftPwm = 0;
      targetRightPwm = 0;
      setDirectionAndEyes("STOPPED", "OFFLINE", 2);
      break;

    case WStype_TEXT: {
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, payload);
      if (error) return;

      lastCommandTime = millis();
      String cmdType = doc["type"].as<String>();

      if (cmdType == "command") {
        String cmd = doc["command"].as<String>();
        String mode = doc["speed_mode"].as<String>();
        isBoostActive = (mode == "BOOST");

        if (cmd == "SET_WHEEL_SPEEDS") {
          int left = doc["parameters"]["left"].as<int>();
          int right = doc["parameters"]["right"].as<int>();
          targetLeftPwm = constrain(left, -PWM_MAX_LIMIT, PWM_MAX_LIMIT);
          targetRightPwm = constrain(right, -PWM_MAX_LIMIT, PWM_MAX_LIMIT);
          String dir = doc["direction"].as<String>();
          String expr = doc["oled_expression"].as<String>();
          if (dir.length() > 0) currentDirection = dir;
          if (expr.length() > 0) currentEyeExpression = expr;
        } else {
          handleDirectMotorCommand(cmd);
        }
      }
      else if (cmdType == "speed_mode") {
        String mode = doc["mode"].as<String>();
        isBoostActive = (mode == "BOOST");
      }
      break;
    }

    default:
      break;
  }
}

// ========================================================================================
// 12. TELEMETRY TRANSMISSION (10 Hz over WebSocket)
// ========================================================================================
void sendTelemetry() {
  StaticJsonDocument<1024> doc;
  doc["type"] = "telemetry";
  doc["robot_id"] = ROBOT_ID;
  doc["timestamp"] = millis();
  doc["battery"] = 98.5;
  doc["speed"] = isBoostActive ? 0.12 : 0.10;
  doc["speed_mode"] = isBoostActive ? "BOOST" : "TURTLE";
  doc["direction"] = currentDirection;
  doc["oled_expression"] = currentEyeExpression;
  doc["wifi"] = "CONNECTED";
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["ip"] = WiFi.localIP().toString();

  // MPU9250 9-Axis (VCC East Transformed ROS Body Frame)
  JsonObject mpuObj = doc.createNestedObject("mpu9250");
  JsonObject acc = mpuObj.createNestedObject("accelerometer");
  acc["x"] = accelX; acc["y"] = accelY; acc["z"] = accelZ;
  acc["magnitude"] = sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ);
  acc["roll"] = rollDeg; acc["pitch"] = pitchDeg;

  JsonObject gyr = mpuObj.createNestedObject("gyroscope");
  gyr["x"] = gyroX; gyr["y"] = gyroY; gyr["z"] = gyroZ;

  JsonObject mag = mpuObj.createNestedObject("magnetometer");
  mag["x"] = magX; mag["y"] = magY; mag["z"] = magZ;
  mag["heading"] = compassHeading;

  JsonObject ori = mpuObj.createNestedObject("orientation");
  ori["roll"] = rollDeg; ori["pitch"] = pitchDeg; ori["yaw"] = yawDeg;

  // L298N Motors
  JsonObject mot = doc.createNestedObject("motors");
  mot["left_pwm"] = currentLeftPwm;
  mot["right_pwm"] = currentRightPwm;
  mot["state"] = isEmergencyStopped ? "EMERGENCY_STOP" :
                 (currentLeftPwm != 0 || currentRightPwm != 0) ? "DRIVING" : "IDLE";

  String output;
  serializeJson(doc, output);
  webSocket.sendTXT(output);
}

// ========================================================================================
// 13. SETUP
// ========================================================================================
void setup() {
  // CRITICAL: Disable brownout detector to prevent reboot loops during OV2640 inrush surge
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

  Serial.begin(115200);
  delay(500);
  Serial.println(F("\n========================================================"));
  Serial.println(F(" ROBONAV: ESP32-S3 Autonomous Robot Controller"));
  Serial.println(F(" Hardware: ESP32-S3 + OV2640 Cam + MPU9250 + L298N Motors"));
  Serial.println(F(" Ultrasonic: REMOVED (GPIO 41 & 42 Freed)"));
  Serial.println(F(" Speed Mode: TURTLE MODE (Slow) with ACCELERATION BOOST"));
  Serial.println(F(" MPU9250 Mount: VCC PIN FACING EAST (Robot Right / -Y)"));
  Serial.println(F("========================================================"));

  // 1. Initialize I2C Bus on GPIO 1 (SDA) and GPIO 2 (SCL) @ 400kHz Fast-Mode
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);
  delay(100);

  // 2. Initialize 1.3" OLED Display (SH1106 / SSD1306 @ 0x3C or 0x3D)
  if (!oled.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("[OLED] 0x3C not found, probing 0x3D..."));
    oled.begin(SSD1306_SWITCHCAPVCC, 0x3D);
  }
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(1);
  oled.setCursor(16, 20);
  oled.println(F("ROBONAV S3"));
  oled.setCursor(16, 36);
  oled.println(F("STARTING UP..."));
  oled.display();

  // 3. Initialize L298N Dual Motor Driver LEDC PWM Channels
  initPwmChannels();
  updateMotorPWM();

  // 4. Initialize MPU9250 9-Axis IMU (VCC East Mount Alignment)
  initMPU9250();

  // 5. Initialize OV2640 Camera
  initCamera();

  // 6. Connect to Wi-Fi Network
  Serial.printf("[Wi-Fi] Connecting to %s...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int wifiRetries = 0;
  while (WiFi.status() != WL_CONNECTED && wifiRetries < 30) {
    delay(300);
    Serial.print(F("."));
    wifiRetries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[Wi-Fi] Connected! Robot IP: %s\n", WiFi.localIP().toString().c_str());
    setDirectionAndEyes("STOPPED", "HAPPY", 9);

    // 7. Start Onboard HTTP Camera Streaming & Direct Motor Command Server (Port 80)
    if (cameraInitialized) {
      startCameraServer();

      // Launch background camera frame push task on Core 0 (preserves Core 1 for motors)
      xTaskCreatePinnedToCore(
        cameraPushTask,
        "camPushTask",
        8192,
        NULL,
        1,
        NULL,
        0
      );
    }

    // 8. Authenticate with Ubuntu Laptop Backend & Connect WebSocket
    if (authenticateWithLaptop()) {
      Serial.println(F("[Auth] Authenticated! Connecting WebSocket to Laptop..."));
      String wsPath = "/ws/robot?token=" + sessionToken;
      webSocket.begin(LAPTOP_HOST, LAPTOP_PORT, wsPath);
      webSocket.onEvent(webSocketEvent);
      webSocket.setReconnectInterval(2000);
      webSocket.enableHeartbeat(3000, 2000, 2);
    }
  } else {
    Serial.println(F("\n[Wi-Fi] Failed to connect. Operating in offline safe mode."));
    setDirectionAndEyes("STOPPED", "OFFLINE", 2);
  }

  lastCommandTime = millis();
}

// ========================================================================================
// 14. MAIN LOOP (Core 1: Motors, MPU9250 50Hz, Watchdog, OLED Eyes)
// ========================================================================================
void loop() {
  webSocket.loop();
  unsigned long now = millis();

  // 1. Sample MPU9250 9-Axis IMU (50 Hz)
  if (now - lastSensorSampleTime >= 20) {
    lastSensorSampleTime = now;
    readMPU9250();
  }

  // 2. Command Timeout Watchdog (Stop motors if no wireless command received within 600ms)
  if (now - lastCommandTime > CMD_TIMEOUT_MS) {
    if (targetLeftPwm != 0 || targetRightPwm != 0) {
      targetLeftPwm = 0;
      targetRightPwm = 0;
      if (eyePriority >= 8) {
        setDirectionAndEyes("STOPPED", "HAPPY", 9);
      }
    }
  }

  // 3. Smooth PWM Acceleration/Deceleration Ramping
  if (currentLeftPwm != targetLeftPwm || currentRightPwm != targetRightPwm) {
    int rampStep = isBoostActive ? 12 : 8;

    if (currentLeftPwm < targetLeftPwm) currentLeftPwm = min(targetLeftPwm, currentLeftPwm + rampStep);
    else if (currentLeftPwm > targetLeftPwm) currentLeftPwm = max(targetLeftPwm, currentLeftPwm - rampStep);

    if (currentRightPwm < targetRightPwm) currentRightPwm = min(targetRightPwm, currentRightPwm + rampStep);
    else if (currentRightPwm > targetRightPwm) currentRightPwm = max(targetRightPwm, currentRightPwm - rampStep);

    updateMotorPWM();
  }

  // 4. Render OLED Animated Robot Eyes (~20 FPS)
  if (now - lastOledFrameTime >= 50) {
    lastOledFrameTime = now;
    renderOledEyes();
  }

  // 5. Transmit Telemetry over WebSocket to Laptop (10 Hz)
  if (now - lastTelemetryTime >= 100 && isWsConnected) {
    lastTelemetryTime = now;
    sendTelemetry();
  }

  // 6. Wi-Fi Auto-Reconnect Watchdog
  static unsigned long lastWifiCheckTime = 0;
  if (now - lastWifiCheckTime >= 3000) {
    lastWifiCheckTime = now;
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println(F("[Wi-Fi] Connection lost. Auto-reconnecting..."));
      WiFi.reconnect();
      setDirectionAndEyes("STOPPED", "OFFLINE", 2);
    }
  }
}
