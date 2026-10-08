import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, Robot
from app.security.authentication import get_current_user, require_admin, User, create_access_token
from app.security.api_keys import verify_api_key
from app.services.robot_service import get_status, handle_emergency_stop
from app.services.video_service import video_service
from app.ws.manager import manager
from app.simulation.robot_simulator import simulator

router = APIRouter()

class RobotAuthRequest(BaseModel):
    robot_id: str
    api_key: str

class RobotCommand(BaseModel):
    command: str
    speed: Optional[float] = 0.30
    parameters: Dict[str, Any] = {}

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# Auth endpoint (supports /api/robots/auth and /api/robot/auth)
@router.post("/api/robots/auth")
@router.post("/api/robot/auth")
async def robot_auth(req: RobotAuthRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Robot).where(Robot.robot_id == req.robot_id)
    )
    robot = result.scalars().first()

    if not robot:
        # Fallback to default ESP32-CAM if requested with generic id
        result = await db.execute(
            select(Robot).where(Robot.robot_id == "ESP32CAM-001")
        )
        robot = result.scalars().first()
    
    if not robot or not robot.api_key_hash:
        raise HTTPException(status_code=401, detail="Invalid robot credentials")
        
    if not verify_api_key(req.api_key, robot.api_key_hash):
        raise HTTPException(status_code=401, detail="Invalid API key")
        
    access_token = create_access_token(data={"sub": robot.robot_id, "type": "robot"})
    ws_url = f"ws://localhost:8000/ws/robot?token={access_token}"
    return {
        "authenticated": True,
        "robot_id": robot.robot_id,
        "session_token": access_token,
        "access_token": access_token,
        "websocket_url": ws_url
    }

# Status endpoints
@router.get("/api/robot/status")
@router.get("/api/robots/status")
@router.get("/api/robots/{robot_id}/status")
async def read_robot_status(robot_id: Optional[str] = None, current_user: Optional[User] = Depends(get_current_user)):
    status = get_status()
    # Augment with hardware indicators
    is_connected = manager.robot_authenticated and (manager.robot_connection is not None)
    status["connection_status"] = "ONLINE" if is_connected else ("ONLINE" if simulator.is_running else "OFFLINE")
    status["hardware"] = {
        "pc_server": "ONLINE",
        "esp32": "ONLINE" if is_connected else ("STANDBY" if simulator.is_running else "OFFLINE"),
        "websocket": "CONNECTED" if is_connected else ("CONNECTED" if simulator.is_running else "DISCONNECTED"),
        "camera": "STREAMING" if (is_connected or simulator.is_running) else "OFFLINE",
        "lidar": "ACTIVE" if (is_connected or simulator.is_running) else "INACTIVE",
        "ultrasonic": "ACTIVE" if (is_connected or simulator.is_running) else "INACTIVE",
        "motor_controller": "READY" if (is_connected or simulator.is_running) else "STOPPED"
    }
    return status

# Telemetry endpoint
@router.get("/api/robot/telemetry")
@router.get("/api/robots/telemetry")
async def get_robot_telemetry(current_user: Optional[User] = Depends(get_current_user)):
    status = get_status()
    vid_status = video_service.get_status()
    is_connected = manager.robot_authenticated and (manager.robot_connection is not None)
    return {
        "robot_id": "ESP32CAM-001",
        "timestamp": vid_status.get("timestamp"),
        "connection": "ONLINE" if is_connected else ("SIMULATED" if simulator.is_running else "OFFLINE"),
        "wifi": "CONNECTED" if (is_connected or simulator.is_running) else "DISCONNECTED",
        "battery": status.get("battery", 82),
        "speed": status.get("velocity", 0.0),
        "position": status.get("position", {"x": 2.0, "y": 2.0}),
        "orientation": status.get("orientation", 0.0),
        "ultrasonic": {
            "front": 1.25,
            "left": 2.10,
            "right": 1.70,
            "rear": 2.10
        },
        "lidar": {"status": "ACTIVE" if (is_connected or simulator.is_running) else "INACTIVE"},
        "camera": vid_status,
        "hardware": {
            "esp32": "ONLINE" if is_connected else ("STANDBY" if simulator.is_running else "OFFLINE"),
            "camera": "STREAMING" if (is_connected or simulator.is_running) else "OFFLINE",
            "lidar": "ACTIVE" if (is_connected or simulator.is_running) else "INACTIVE",
            "ultrasonic": "ACTIVE" if (is_connected or simulator.is_running) else "INACTIVE",
            "motor_controller": "READY" if (is_connected or simulator.is_running) else "STOPPED"
        }
    }

# Command dispatching
@router.post("/api/robot/command")
@router.post("/api/robots/{robot_id}/command")
async def send_command(cmd: RobotCommand, robot_id: Optional[str] = "ESP32CAM-001", current_user: User = Depends(require_admin)):
    # 1. Forward to physical ESP32-CAM if connected
    await manager.send_to_robot({
        "type": "command",
        "command": cmd.command,
        "speed": cmd.speed,
        "parameters": cmd.parameters
    })
    # 2. Forward to PC simulator
    await simulator.command_queue.put({"type": cmd.command, "parameters": cmd.parameters, "speed": cmd.speed})
    return {"status": "command_sent", "command": cmd.command}

# Emergency Stop
@router.post("/api/robot/emergency-stop")
@router.post("/api/robots/{robot_id}/emergency-stop")
async def emergency_stop(robot_id: Optional[str] = "ESP32CAM-001", current_user: User = Depends(require_admin)):
    handle_emergency_stop()
    await manager.send_to_robot({"type": "command", "command": "EMERGENCY_STOP"})
    await simulator.command_queue.put({"type": "EMERGENCY_STOP"})
    return {"status": "emergency_stop_activated"}

# Video stream endpoints
@router.get("/api/robot/video")
@router.get("/api/robots/video")
async def get_video_stream():
    """Serves continuous multipart/x-mixed-replace MJPEG video stream to browser."""
    return StreamingResponse(
        video_service.mjpeg_frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@router.post("/api/robot/video/frame")
@router.post("/api/robots/video/frame")
async def upload_video_frame(request: Request):
    """ESP32-CAM pushes raw JPEG frames to PC."""
    frame_bytes = await request.body()
    if frame_bytes:
        video_service.update_real_frame(frame_bytes)
        return {"status": "ok", "bytes": len(frame_bytes)}
    return {"status": "empty_frame"}

@router.get("/api/video/status")
@router.get("/api/robot/video/status")
async def get_video_status():
    """Returns telemetry of video stream (FPS, resolution, latency, CV detections)."""
    return video_service.get_status()

# Robot listing
@router.get("/api/robots")
@router.get("/api/robot")
async def list_robots(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Robot))
    robots = result.scalars().all()
    return [{
        "robot_id": r.robot_id,
        "name": r.name,
        "type": getattr(r, 'robot_type', 'ESP32-CAM'),
        "status": r.connection_status
    } for r in robots]
