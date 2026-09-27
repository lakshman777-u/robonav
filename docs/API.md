# RoboNav API Documentation

## Authentication

### Login
- **Method:** `POST`
- **Path:** `/api/auth/login`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "username": "admin",
    "password": "password123"
  }
  ```
- **Response:**
  ```json
  {
    "token": "eyJhb...",
    "role": "admin",
    "username": "admin"
  }
  ```

## Robot Authentication

### Robot Login
- **Method:** `POST`
- **Path:** `/api/robot/auth`
- **Auth Required:** API Key
- **Request Body:**
  ```json
  {
    "robot_id": "ROBOT-001",
    "api_key": "YOUR_API_KEY"
  }
  ```
- **Response:**
  ```json
  {
    "authenticated": true,
    "robot_id": "ROBOT-001",
    "access_token": "token123",
    "websocket_url": "ws://localhost:8000"
  }
  ```

## Robot Management

### Get Robot Status
- **Method:** `GET`
- **Path:** `/api/robots/{robot_id}/status`
- **Auth Required:** Yes

### Send Command
- **Method:** `POST`
- **Path:** `/api/robots/{robot_id}/command`
- **Auth Required:** Yes
- **Request Body:**
  ```json
  {
    "command": "MOVE_FORWARD",
    "speed": 0.5
  }
  ```

### Emergency Stop
- **Method:** `POST`
- **Path:** `/api/robots/{robot_id}/emergency-stop`
- **Auth Required:** Yes

## Mapping

- `GET /api/maps`
- `POST /api/maps`
- `GET /api/maps/{id}`
- `POST /api/maps/start`
- `POST /api/maps/stop`

## Destinations

- `GET /api/destinations`
- `POST /api/destinations`
- `PUT /api/destinations/{id}`
- `DELETE /api/destinations/{id}`

## Navigation

- `POST /api/navigation/request`
- `POST /api/navigation/cancel`
- `POST /api/navigation/return-home`
- `GET /api/navigation/history`

## Telemetry & Logs

- `GET /api/robots/{robot_id}/telemetry`
- `GET /api/logs`

## Simulation Control

- `POST /api/simulation/toggle`
- `POST /api/simulation/demo-time`
