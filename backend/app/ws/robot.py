import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
from app.services.robot_service import transition, robot_state
from app.services.mapping_service import update_map, process_lidar_points
from app.services.navigation_service import update_navigation_progress
from app.services.video_service import video_service

router = APIRouter()

@router.websocket("/ws/robot")
async def robot_websocket_endpoint(websocket: WebSocket, token: str = ""):
    await manager.connect_robot(websocket)
    video_service.set_real_robot_status(True)
    transition("CONNECTING")
    await asyncio.sleep(0.5)
    transition("IDLE")
    
    # Broadcast connection success
    await manager.broadcast_to_browsers({
        "type": "robot_status",
        "data": {
            **robot_state.to_dict(),
            "connection_status": "ONLINE",
            "hardware": {
                "pc_server": "ONLINE",
                "esp32": "ONLINE",
                "websocket": "CONNECTED",
                "camera": "STREAMING",
                "lidar": "ACTIVE",
                "ultrasonic": "ACTIVE",
                "motor_controller": "READY"
            }
        }
    })
    
    heartbeat_task = asyncio.create_task(check_heartbeat())
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            robot_state.last_heartbeat = asyncio.get_event_loop().time()
            
            if msg_type in ["telemetry", "robot_status"]:
                # Process ESP32-CAM telemetry payload
                t_data = message if msg_type == "telemetry" else message.get("data", {})
                
                if "position" in t_data:
                    robot_state.position = t_data["position"]
                if "orientation" in t_data:
                    robot_state.orientation = t_data["orientation"]
                if "battery" in t_data:
                    robot_state.battery = float(t_data["battery"])
                if "speed" in t_data or "velocity" in t_data:
                    robot_state.velocity = float(t_data.get("speed", t_data.get("velocity", 0.0)))
                    
                # Broadcast unified status to browsers
                await manager.broadcast_to_browsers({
                    "type": "robot_status",
                    "data": {
                        **robot_state.to_dict(),
                        "connection_status": "ONLINE",
                        "hardware": {
                            "pc_server": "ONLINE",
                            "esp32": "ONLINE",
                            "websocket": "CONNECTED",
                            "camera": "STREAMING",
                            "lidar": "ACTIVE",
                            "ultrasonic": "ACTIVE",
                            "motor_controller": "READY"
                        }
                    }
                })
                
                # Process LiDAR points into 2D SLAM grid
                if "points" in t_data or "lidar_points" in t_data:
                    pts = t_data.get("points") or t_data.get("lidar_points")
                    if pts:
                        process_lidar_points(pts, robot_state.position, robot_state.orientation)

                # If telemetry includes sensors, forward sensor_data
                if "ultrasonic" in t_data or "lidar" in t_data:
                    await manager.broadcast_to_browsers({
                        "type": "sensor_data",
                        "data": {
                            "ultrasonic": t_data.get("ultrasonic", {"front": 1.25, "left": 2.10, "right": 1.70, "rear": 2.10}),
                            "lidar": t_data.get("lidar", {"active": True, "status": "ACTIVE"}),
                            "camera": video_service.get_status(),
                            "glass_detected": t_data.get("glass_detected", False)
                        }
                    })
                    
            elif msg_type in ["sensor_data", "lidar_scan"]:
                pts = message.get("points") or message.get("data", {}).get("points")
                if pts:
                    process_lidar_points(pts, robot_state.position, robot_state.orientation)
                await manager.broadcast_to_browsers(message)
                
            elif msg_type == "map_update":
                update_map(message.get("data", {}))
                await manager.broadcast_to_browsers(message)
                
            elif msg_type == "navigation_status":
                await update_navigation_progress(message.get("data", {}))
                await manager.broadcast_to_browsers(message)
                
            elif msg_type == "error":
                transition("ERROR")
                await manager.broadcast_to_browsers(message)
                
    except (WebSocketDisconnect, Exception):
        handle_disconnect()
    finally:
        heartbeat_task.cancel()
        
def handle_disconnect():
    manager.disconnect_robot()
    video_service.set_real_robot_status(False)
    transition("OFFLINE")
    asyncio.create_task(manager.broadcast_to_browsers({
        "type": "robot_status",
        "data": {
            **robot_state.to_dict(),
            "connection_status": "OFFLINE",
            "hardware": {
                "pc_server": "ONLINE",
                "esp32": "OFFLINE",
                "websocket": "DISCONNECTED",
                "camera": "OFFLINE",
                "lidar": "INACTIVE",
                "ultrasonic": "INACTIVE",
                "motor_controller": "STOPPED"
            }
        }
    }))
    asyncio.create_task(manager.broadcast_to_browsers({
        "type": "robot_connection_lost",
        "message": "⚠ ROBOT CONNECTION LOST"
    }))
    
async def check_heartbeat():
    while True:
        await asyncio.sleep(3)
        now = asyncio.get_event_loop().time()
        if hasattr(robot_state, 'last_heartbeat'):
            if now - robot_state.last_heartbeat > 6:
                handle_disconnect()
                break
