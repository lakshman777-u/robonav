#ifndef WEBSOCKET_CLIENT_H
#define WEBSOCKET_CLIENT_H

#include <Arduino.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "motor_controller.h"
#include "safety.h"

class RobotWebSocketClient {
public:
    RobotWebSocketClient();
    void begin(const String& host, int port, const String& path, const String& token);
    void update();
    bool isConnected();
    void sendPayload(const String& payload);

private:
    WebSocketsClient _ws;
    bool _connected;
    static void _webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
    void _handleMessage(const String& message);
};

extern RobotWebSocketClient wsClient;

#endif // WEBSOCKET_CLIENT_H
