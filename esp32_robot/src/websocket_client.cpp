#include "websocket_client.h"

RobotWebSocketClient wsClient;

RobotWebSocketClient::RobotWebSocketClient() : _connected(false) {}

void RobotWebSocketClient::begin(const String& host, int port, const String& path, const String& token) {
    String fullPath = path;
    if (token.length() > 0) {
        fullPath += "?token=" + token;
    }

    Serial.print("[WS] Connecting to PC WebSocket: ws://");
    Serial.print(host);
    Serial.print(":");
    Serial.print(port);
    Serial.println(fullPath);

    _ws.begin(host.c_str(), port, fullPath.c_str());
    _ws.onEvent(_webSocketEvent);
    _ws.setReconnectInterval(2000);
    _ws.enableHeartbeat(3000, 2000, 2);
}

void RobotWebSocketClient::update() {
    _ws.loop();
}

bool RobotWebSocketClient::isConnected() {
    return _connected;
}

void RobotWebSocketClient::sendPayload(const String& payload) {
    if (_connected) {
        _ws.sendTXT(payload);
    }
}

void RobotWebSocketClient::_webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected from PC Server.");
            wsClient._connected = false;
            break;
        case WStype_CONNECTED:
            Serial.println("[WS] ✓ Connected to PC Server WebSocket!");
            wsClient._connected = true;
            safety.pet();
            break;
        case WStype_TEXT: {
            String msg = String((char*)payload);
            wsClient._handleMessage(msg);
            break;
        }
        case WStype_BIN:
        case WStype_ERROR:
        default:
            break;
    }
}

void RobotWebSocketClient::_handleMessage(const String& message) {
    safety.pet(); // Reset safety watchdog

    StaticJsonDocument<512> doc;
    DeserializationError err = deserializeJson(doc, message);
    if (err) return;

    String msgType = doc["type"].as<String>();
    String cmd = doc["command"].as<String>();

    if (msgType == "command" || msgType == "manual_command") {
        if (doc.containsKey("speed")) {
            motorController.setSpeed(doc["speed"].as<float>());
        }

        if (cmd == "MOVE_FORWARD") {
            motorController.forward();
        } else if (cmd == "MOVE_BACKWARD") {
            motorController.backward();
        } else if (cmd == "TURN_LEFT") {
            motorController.left();
        } else if (cmd == "TURN_RIGHT") {
            motorController.right();
        } else if (cmd == "STOP") {
            motorController.stop();
        } else if (cmd == "EMERGENCY_STOP") {
            safety.triggerEmergencyStop();
        } else if (cmd == "SET_SPEED") {
            float spd = doc["speed"].as<float>();
            motorController.setSpeed(spd);
        }
    }
}
