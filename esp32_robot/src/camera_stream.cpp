#include "camera_stream.h"

CameraStream cameraStream;

CameraStream::CameraStream() : _initialized(false), _lastFramePush(0) {}

bool CameraStream::begin() {
    Serial.println("[Camera] Initializing OV2640 camera sensor on ESP32-CAM...");

    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
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
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    // Use PSRAM if available for higher resolution
    if (psramFound()) {
        config.frame_size = FRAMESIZE_VGA; // 640x480
        config.jpeg_quality = 12;          // 0-63, lower means higher quality
        config.fb_count = 2;
    } else {
        config.frame_size = FRAMESIZE_QVGA; // 320x240
        config.jpeg_quality = 16;
        config.fb_count = 1;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[Camera] ✗ Camera init failed with error 0x%x\n", err);
        _initialized = false;
        return false;
    }

    _initialized = true;
    Serial.println("[Camera] ✓ OV2640 Camera initialized successfully (VGA 640x480)!");
    return true;
}

bool CameraStream::isReady() {
    return _initialized;
}

camera_fb_t* CameraStream::captureFrame() {
    if (!_initialized) return nullptr;
    return esp_camera_fb_get();
}

void CameraStream::releaseFrame(camera_fb_t* fb) {
    if (fb) esp_camera_fb_return(fb);
}

void CameraStream::pushFrameToPC() {
    if (!_initialized || WiFi.status() != WL_CONNECTED) return;

    unsigned long now = millis();
    if (now - _lastFramePush < 65) return; // Cap at ~15 FPS
    _lastFramePush = now;

    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("[Camera] Frame capture failed");
        return;
    }

    HTTPClient http;
    String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + String(SERVER_VIDEO_PATH);
    http.begin(url);
    http.addHeader("Content-Type", "image/jpeg");
    http.addHeader("X-Robot-ID", ROBOT_ID);

    int httpCode = http.POST(fb->buf, fb->len);
    if (httpCode != 200 && httpCode > 0) {
        // Frame push dropped
    }

    http.end();
    esp_camera_fb_return(fb);
}
