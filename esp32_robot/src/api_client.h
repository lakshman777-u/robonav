#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

class ApiClient {
public:
    ApiClient();
    bool authenticate();
    bool isAuthenticated();
    String getSessionToken();
    String getWsUrl();

private:
    bool _authenticated;
    String _sessionToken;
    String _wsUrl;
};

extern ApiClient apiClient;

#endif // API_CLIENT_H
