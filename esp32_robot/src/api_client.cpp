#include "api_client.h"

ApiClient apiClient;

ApiClient::ApiClient() : _authenticated(false), _sessionToken(""), _wsUrl("") {}

bool ApiClient::authenticate() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Auth] Cannot authenticate: Wi-Fi not connected");
        return false;
    }

    HTTPClient http;
    String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + String(SERVER_AUTH_PATH);
    Serial.print("[Auth] Authenticating with PC Robot Server at: ");
    Serial.println(url);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<256> doc;
    doc["robot_id"] = ROBOT_ID;
    doc["api_key"] = ROBOT_API_KEY;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode == 200) {
        String response = http.getString();
        StaticJsonDocument<512> responseDoc;
        DeserializationError error = deserializeJson(responseDoc, response);

        if (!error && (responseDoc["authenticated"] == true || responseDoc.containsKey("access_token"))) {
            _authenticated = true;
            _sessionToken = responseDoc["access_token"].as<String>();
            _wsUrl = responseDoc["websocket_url"].as<String>();
            Serial.println("[Auth] ✓ Authentication Successful! Session Token acquired.");
            http.end();
            return true;
        } else {
            Serial.println("[Auth] ✗ Server returned 200 but payload invalid.");
        }
    } else {
        Serial.print("[Auth] ✗ Authentication failed. HTTP code: ");
        Serial.println(httpResponseCode);
        _authenticated = false;
    }

    http.end();
    return false;
}

bool ApiClient::isAuthenticated() {
    return _authenticated;
}

String ApiClient::getSessionToken() {
    return _sessionToken;
}

String ApiClient::getWsUrl() {
    return _wsUrl;
}
