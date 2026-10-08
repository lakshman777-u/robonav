#include <Arduino.h>
#include "config.h"
#include "wifi_manager.h"
#include "api_client.h"
#include "websocket_client.h"
#include "camera_stream.h"
#include "motor_controller.h"
#include "ultrasonic.h"
#include "lidar.h"
#include "safety.h"
#include "telemetry.h"

unsigned long lastSensorSample = 0;
bool authAttempted = false;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n========================================================");
    Serial.println("  ROBONAV ESP32-CAM AUTONOMOUS ROBOT CONTROLLER");
    Serial.println("  Firmware Version: 2.0 (PC + ESP32 Architecture)");
    Serial.println("========================================================");

    // 1. Initialize hardware subsystems
    motorController.begin();
    ultrasonicSensors.begin();
    lidar.begin();
    cameraStream.begin();
    safety.begin();

    // 2. Connect to Wi-Fi Network
    wifiManager.begin();
}

void loop() {
    // 1. Maintain Wi-Fi Connection
    wifiManager.update();

    if (wifiManager.isConnected()) {
        // 2. Authenticate with PC API Server once connected to Wi-Fi
        if (!apiClient.isAuthenticated()) {
            static unsigned long lastAuthRetry = 0;
            if (millis() - lastAuthRetry > 3000) {
                lastAuthRetry = millis();
                if (apiClient.authenticate()) {
                    // Connect WebSocket with token
                    wsClient.begin(
                        SERVER_IP,
                        SERVER_PORT,
                        SERVER_WS_PATH,
                        apiClient.getSessionToken()
                    );
                }
            }
        } else {
            // Maintain WebSocket connection
            wsClient.update();
        }

        // 3. Push Camera Frames to PC Video Server (~15 FPS)
        cameraStream.pushFrameToPC();
    }

    // 4. Sample Sensors (Ultrasonic & LiDAR)
    unsigned long now = millis();
    if (now - lastSensorSample >= (1000 / SENSOR_SAMPLE_RATE_HZ)) {
        lastSensorSample = now;
        ultrasonicSensors.update();
        lidar.update();
    }

    // 5. Send Telemetry to PC (10Hz)
    telemetry.update();

    // 6. Safety Watchdog Check (Stops motors if communication drops)
    safety.update(wsClient.isConnected());

    delay(2); // Yield to FreeRTOS scheduler
}
