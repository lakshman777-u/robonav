import asyncio
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, Robot
from app.security.authentication import get_current_user, get_optional_user, require_admin, User, create_access_token
from app.security.api_keys import verify_api_key
from app.services.robot_service import get_status, handle_emergency_stop, robot_state
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
async def read_robot_status(robot_id: Optional[str] = None, current_user: Optional[User] = Depends(get_optional_user)):
    status = get_status()
    # Augment with hardware indicators
    is_bridge_active = (time.time() - bridge_metrics["last_seen"] < 3.0) if bridge_metrics["last_seen"] > 0 else False
    is_connected = (manager.robot_authenticated and (manager.robot_connection is not None)) or is_bridge_active
    status["connection_status"] = "ONLINE" if is_connected else ("ONLINE" if simulator.is_running else "OFFLINE")
    status["position"] = robot_state.position
    status["orientation"] = robot_state.orientation
    status["trajectory"] = robot_state.current_path
    status["hardware"] = {
        "pc_server": "ONLINE",
        "esp32": "ONLINE" if is_connected else ("STANDBY" if simulator.is_running else "OFFLINE"),
        "websocket": "CONNECTED" if (manager.robot_authenticated or is_connected) else ("CONNECTED" if simulator.is_running else "DISCONNECTED"),
        "camera": "STREAMING" if (manager.robot_authenticated or simulator.is_running) else "OFFLINE",
        "lidar": "ACTIVE" if ((is_bridge_active and bridge_metrics["scans_published"] > 0) or simulator.is_running) else "INACTIVE",
        "ultrasonic": "ACTIVE" if (manager.robot_authenticated or simulator.is_running) else "INACTIVE",
        "motor_controller": "READY" if (manager.robot_authenticated or simulator.is_running) else "STANDBY",
        "udp_bridge": "STREAMING" if (is_bridge_active and bridge_metrics["scans_published"] > 0) else ("ONLINE" if is_bridge_active else "IDLE")
    }
    status["bridge"] = bridge_metrics
    return status

# Telemetry endpoint
@router.get("/api/robot/telemetry")
@router.get("/api/robots/telemetry")
async def get_robot_telemetry(current_user: Optional[User] = Depends(get_optional_user)):
    status = get_status()
    vid_status = video_service.get_status()
    is_bridge_active = (time.time() - bridge_metrics["last_seen"] < 3.0) if bridge_metrics["last_seen"] > 0 else False
    is_connected = (manager.robot_authenticated and (manager.robot_connection is not None)) or is_bridge_active
    return {
        "robot_id": "ESP32DEVKIT-001" if is_bridge_active else "ESP32CAM-001",
        "timestamp": vid_status.get("timestamp"),
        "connection": "ONLINE" if is_connected else ("SIMULATED" if simulator.is_running else "OFFLINE"),
        "wifi": "CONNECTED" if (is_connected or simulator.is_running) else "DISCONNECTED",
        "battery": status.get("battery", 100),
        "speed": status.get("velocity", 0.0),
        "position": robot_state.position,
        "orientation": robot_state.orientation,
        "trajectory": robot_state.current_path,
        "ultrasonic": {
            "front": 1.25,
            "left": 2.10,
            "right": 1.70,
            "rear": 2.10
        },
        "lidar": {
            "status": "ACTIVE" if ((is_bridge_active and bridge_metrics["scans_published"] > 0) or simulator.is_running) else "INACTIVE",
            "active": ((is_bridge_active and bridge_metrics["scans_published"] > 0) or simulator.is_running),
            "hz": bridge_metrics["scan_hz"] if is_bridge_active else (10.0 if simulator.is_running else 0.0),
            "scan_rate": bridge_metrics["scan_hz"] if is_bridge_active else (10.0 if simulator.is_running else 0.0),
            "rays": latest_lidar_rays if latest_lidar_rays else simulator.lidar_rays,
            "points": len(latest_lidar_rays) if latest_lidar_rays else len(simulator.lidar_rays),
            "port": "/dev/ttyUSB0",
            "packets": bridge_metrics["udp_packets_rx"],
            "bytes_rx": bridge_metrics["udp_bytes_rx"]
        },
        "camera": vid_status,
        "bridge": bridge_metrics,
        "hardware": {
            "pc_server": "ONLINE",
            "esp32": "STREAMING" if (is_bridge_active and bridge_metrics["scans_published"] > 0) else ("ONLINE" if is_connected else ("STANDBY" if simulator.is_running else "OFFLINE")),
            "camera": "STREAMING" if (manager.robot_authenticated or simulator.is_running) else "OFFLINE",
            "lidar": "ACTIVE" if (is_bridge_active and bridge_metrics["scans_published"] > 0) else ("NO DATA" if is_bridge_active else "INACTIVE"),
            "ultrasonic": "ACTIVE" if (manager.robot_authenticated or simulator.is_running) else "INACTIVE",
            "motor_controller": "READY" if (manager.robot_authenticated or simulator.is_running) else "STANDBY",
            "udp_bridge": "STREAMING" if (is_bridge_active and bridge_metrics["scans_published"] > 0) else ("ONLINE" if is_bridge_active else "IDLE")
        }
    }

# Command dispatching
@router.post("/api/robot/command")
@router.post("/api/robots/{robot_id}/command")
async def send_command(
    cmd: RobotCommand,
    request: Request,
    robot_id: Optional[str] = "ESP32CAM-001"
):
    # Authenticate via X-Robot-Key header, Bearer token, or local loopback
    robot_key = request.headers.get("X-Robot-Key")
    auth_header = request.headers.get("Authorization")
    client_host = request.client.host if request.client else ""
    is_authorized = False

    if client_host in ["127.0.0.1", "localhost", "::1"]:
        is_authorized = True
    elif robot_key:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Robot))
            robots = result.scalars().all()
            for r in robots:
                if r.api_key_hash and verify_api_key(robot_key, r.api_key_hash):
                    is_authorized = True
                    break
    elif auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        try:
            from app.security.authentication import verify_token
            payload = verify_token(token)
            if payload:
                is_authorized = True
        except Exception:
            pass

    if not is_authorized:
        raise HTTPException(status_code=401, detail="Unauthorized robot command")

    # 1. Forward to physical ESP32 if connected
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
async def emergency_stop(
    request: Request,
    robot_id: Optional[str] = "ESP32CAM-001"
):
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

# ==============================================================================
# UDP LIDAR BRIDGE & ROS 2 INTEGRATION
# ==============================================================================
import time

bridge_metrics: Dict[str, Any] = {
    "active": False,
    "last_seen": 0.0,
    "robot_id": "ESP32DEVKIT-001",
    "udp_packets_rx": 0,
    "udp_bytes_rx": 0,
    "dropped_packets": 0,
    "scans_published": 0,
    "scan_hz": 0.0,
    "wifi_rssi": 0,
    "esp32_crc_errors": 0,
    "esp32_lidar_rx_bytes": 0,
    "esp32_lidar_packets": 0,
    "sender_ip": "none"
}

latest_lidar_rays: list = []

@router.post("/api/bridge/scan")
async def ingest_bridge_scan(data: Dict[str, Any]):
    """Receives decoded LiDAR scans from laptop_udp_receiver and updates 2D occupancy SLAM."""
    global latest_lidar_rays
    now = time.time()
    bridge_metrics["active"] = True
    bridge_metrics["last_seen"] = now
    bridge_metrics["udp_packets_rx"] = data.get("udp_packets_rx", 0)
    bridge_metrics["udp_bytes_rx"] = data.get("udp_bytes_rx", 0)
    bridge_metrics["dropped_packets"] = data.get("dropped_packets", 0)
    bridge_metrics["scans_published"] = data.get("scans_published", 0)
    bridge_metrics["scan_hz"] = data.get("scan_hz", 0.0)
    bridge_metrics["wifi_rssi"] = data.get("wifi_rssi", 0)
    bridge_metrics["esp32_crc_errors"] = data.get("esp32_crc_errors", 0)
    bridge_metrics["esp32_lidar_rx_bytes"] = data.get("esp32_lidar_rx_bytes", 0)
    bridge_metrics["esp32_lidar_packets"] = data.get("esp32_lidar_packets", 0)
    bridge_metrics["sender_ip"] = data.get("sender_ip", "unknown")

    points = data.get("points", [])
    if points:
        latest_lidar_rays = points
        from app.services.lidar_odometry import lidar_odometry
        from app.services.robot_service import robot_state
        from app.services.mapping_service import process_lidar_points

        # Real-time continuous LiDAR Odometry Tracking
        if not lidar_odometry.is_tracking:
            lidar_odometry.start(
                robot_state.position.get("x", 0.0),
                robot_state.position.get("y", 0.0),
                robot_state.orientation
            )
        cur_x, cur_y, cur_ori = lidar_odometry.update(points)
        robot_state.position = {"x": cur_x, "y": cur_y}
        robot_state.orientation = cur_ori
        robot_state.current_path = lidar_odometry.trajectory

        process_lidar_points(points, robot_state.position, robot_state.orientation)

    # Always broadcast updated bridge telemetry and robot status to all browser clients
    from app.services.robot_service import robot_state
    await manager.broadcast_to_browsers({
        "type": "robot_status",
        "data": {
            **robot_state.to_dict(),
            "connection_status": "ONLINE",
            "hardware": {
                "pc_server": "ONLINE",
                "esp32": "STREAMING" if bridge_metrics["scans_published"] > 0 else "ONLINE",
                "websocket": "CONNECTED",
                "camera": "STREAMING" if (manager.robot_authenticated or simulator.is_running) else "OFFLINE",
                "lidar": "ACTIVE" if bridge_metrics["scans_published"] > 0 else ("NO DATA" if bridge_metrics.get("esp32_lidar_rx_bytes", 0) <= 1 else "SYNCING"),
                "ultrasonic": "ACTIVE" if (manager.robot_authenticated or simulator.is_running) else "INACTIVE",
                "motor_controller": "READY" if (manager.robot_authenticated or simulator.is_running) else "STANDBY",
                "udp_bridge": "STREAMING" if bridge_metrics["scans_published"] > 0 else "ONLINE"
            },
            "bridge": bridge_metrics
        }
    })

    await manager.broadcast_to_browsers({
        "type": "sensor_data",
        "data": {
            "lidar": {
                "active": True,
                "status": "ACTIVE" if bridge_metrics["scans_published"] > 0 else ("NO DATA" if bridge_metrics.get("esp32_lidar_rx_bytes", 0) <= 1 else "SYNCING"),
                "scan_rate": bridge_metrics["scan_hz"],
                "points": len(points),
                "range": 8.0,
                "rays": points if points else [],
                "packets": bridge_metrics["udp_packets_rx"]
            },
            "camera": video_service.get_status(),
            "ultrasonic": {"front": 1.25, "left": 2.10, "right": 1.70, "rear": 2.10},
            "glass_detected": False,
            "bridge": bridge_metrics
        }
    })

    return {"status": "ok", "scans": bridge_metrics["scans_published"]}

@router.get("/api/bridge/status")
async def get_bridge_status():
    """Returns telemetry of the wireless UDP LiDAR bridge."""
    is_active = (time.time() - bridge_metrics["last_seen"] < 3.0) if bridge_metrics["last_seen"] > 0 else False
    bridge_metrics["active"] = is_active
    return bridge_metrics

