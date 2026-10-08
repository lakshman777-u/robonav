#include "wifi_manager.h"

WiFiManager wifiManager;

WiFiManager::WiFiManager() : _lastReconnectAttempt(0), _wasConnected(false) {}

void WiFiManager::begin() {
    Serial.println("[WiFi] Initializing Wi-Fi station mode...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(300);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        _wasConnected = true;
        Serial.println();
        Serial.print("[WiFi] Connected successfully! IP Address: ");
        Serial.println(WiFi.localIP());
        Serial.print("[WiFi] RSSI Signal: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println();
        Serial.println("[WiFi] Initial connection failed. Will retry in background loop.");
    }
}

void WiFiManager::update() {
    if (WiFi.status() != WL_CONNECTED) {
        if (_wasConnected) {
            Serial.println("[WiFi] Lost connection to AP!");
            _wasConnected = false;
        }
        unsigned long now = millis();
        if (now - _lastReconnectAttempt > 5000) {
            _lastReconnectAttempt = now;
            Serial.println("[WiFi] Attempting reconnection...");
            WiFi.disconnect();
            WiFi.reconnect();
        }
    } else {
        if (!_wasConnected) {
            _wasConnected = true;
            Serial.print("[WiFi] Reconnected! IP: ");
            Serial.println(WiFi.localIP());
        }
    }
}

bool WiFiManager::isConnected() {
    return WiFi.status() == WL_CONNECTED;
}

String WiFiManager::getIP() {
    return WiFi.localIP().toString();
}

int WiFiManager::getRSSI() {
    return WiFi.RSSI();
}
