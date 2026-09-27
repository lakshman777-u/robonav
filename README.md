# RoboNav

An autonomous indoor robot control platform.

## Architecture

```text
+-------------------+       REST API       +-------------------+
|                   | <------------------> |                   |
|   Web Frontend    |                      |   FastAPI Backend |
|   (React/Next.js) | <------------------> |   (Python)        |
|                   |      WebSockets      |                   |
+-------------------+                      +-------------------+
                                                   ^  |
                                                   |  |
                                        WebSockets |  | REST API
                                                   |  v
                                           +-------------------+
                                           |                   |
                                           |  Raspberry Pi     |
                                           |  Client (Robot)   |
                                           |                   |
                                           +-------------------+
```

## Features

- Real-time robot telemetry (battery, position, speed)
- Remote manual control (Forward, Backward, Left, Right)
- Autonomous navigation and mapping
- Sensor data visualization
- Multi-user RBAC (Admin, User)
- WebSocket bidirectional communication

## Tech Stack

- **Backend:** Python, FastAPI, WebSockets
- **Frontend:** React, Next.js, TailwindCSS
- **Robot Client:** Python, asyncio, WebSockets

## Quick Start

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```

### Raspberry Pi Client (optional, on Pi)
```bash
cd raspberry_pi_client
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your ROBOT_API_KEY from the admin dashboard
python robot_client.py
```

## Simulation Mode
By default, the robot client uses simulated sensors and motors if real hardware is not available.

## Demo Credentials
- Admin: admin / admin123
- User: user / user123

## License
MIT License
