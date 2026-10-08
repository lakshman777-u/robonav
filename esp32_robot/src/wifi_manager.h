#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

class WiFiManager {
public:
    WiFiManager();
    void begin();
    void update();
    bool isConnected();
    String getIP();
    int getRSSI();

private:
    unsigned long _lastReconnectAttempt;
    bool _wasConnected;
};

extern WiFiManager wifiManager;

#endif // WIFI_MANAGER_H
