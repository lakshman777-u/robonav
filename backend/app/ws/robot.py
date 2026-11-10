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
    # Validate robot token
    if token:
        try:
            from app.security.authentication import verify_token
            payload = verify_token(token)
            if not payload or payload.get("type") != "robot":
                await websocket.close(code=4003, reason="Unauthorized")
                return
        except Exception:
            await websocket.close(code=4003, reason="Invalid token")
            return

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
                "ultrasonic": "REMOVED",
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
                t_data = message if msg_type == "telemetry" else message.get("data", {})
                
                if "position" in t_data:
                    robot_state.position = t_data["position"]
                if "orientation" in t_data:
                    robot_state.orientation = t_data["orientation"]
                if "battery" in t_data:
                    robot_state.battery = float(t_data["battery"])
                if "speed" in t_data or "velocity" in t_data:
                    robot_state.velocity = float(t_data.get("speed", t_data.get("velocity", 0.0)))
                    
                oled_expr = t_data.get("oled_expression", "ONLINE")
                us_data = t_data.get("ultrasonic", {"front": 1.25, "side": 2.10, "status": "CLEAR"})
                mot_data = t_data.get("motors", {"state": "STOPPED", "left_speed": 0, "right_speed": 0})

                from app.api.robot import mpu9250_data, ultrasonic_data, speed_control_state, wifi_config_state
                if "mpu9250" in t_data:
                    mpu9250_data.update(t_data["mpu9250"])
                if "imu" in t_data:
                    mpu9250_data.update(t_data["imu"])
                if "ultrasonic" in t_data:
                    us_in = t_data["ultrasonic"]
                    if isinstance(us_in, dict):
                        ultrasonic_data.update(us_in)
                    elif isinstance(us_in, (int, float)):
                        ultrasonic_data["distance_cm"] = float(us_in)
                        ultrasonic_data["distance_m"] = round(float(us_in) / 100.0, 3)
                if "speed_mode" in t_data:
                    speed_control_state["mode"] = t_data["speed_mode"]
                    speed_control_state["boost_active"] = (t_data["speed_mode"] == "BOOST")
                if "direction" in t_data:
                    speed_control_state["current_direction"] = t_data["direction"]
                if oled_expr:
                    speed_control_state["oled_expression"] = oled_expr
                if "wifi_rssi" in t_data:
                    try:
                        rssi_val = int(t_data["wifi_rssi"])
                        wifi_config_state["rssi_dbm"] = rssi_val
                        wifi_config_state["signal_percentage"] = max(0, min(100, 2 * (rssi_val + 100)))
                    except Exception:
                        pass
                if "ip" in t_data:
                    wifi_config_state["esp32_ip"] = t_data["ip"]
                wifi_config_state["connected"] = True
                wifi_config_state["status"] = "CONNECTED"


                # Broadcast unified status to browsers
                await manager.broadcast_to_browsers({
                    "type": "robot_status",
                    "data": {
                        **robot_state.to_dict(),
                        "connection_status": "ONLINE",
                        "oled_expression": oled_expr,
                        "direction": speed_control_state["current_direction"],
                        "speed_control": speed_control_state,
                        "mpu9250": mpu9250_data,
                        "ultrasonic": ultrasonic_data,
                        "motors": mot_data,
                        "hardware": {
                            "pc_server": "ONLINE",
                            "esp32": "ONLINE",
                            "websocket": "CONNECTED",
                            "camera": "STREAMING",
                            "lidar": "ACTIVE",
                            "ultrasonic": "REMOVED",
                            "motor_controller": "READY" if mot_data.get("state") != "EMERGENCY_STOP" else "STOPPED"
                        }
                    }
                })
                
                # Store live LiDAR points solely for real-time visualization layer
                if "points" in t_data or "lidar_points" in t_data:
                    pts = t_data.get("points") or t_data.get("lidar_points")
                    if pts:
                        from app.api.robot import latest_lidar_rays
                        import app.api.robot
                        app.api.robot.latest_lidar_rays = pts

                # Broadcast real sensor data
                await manager.broadcast_to_browsers({
                    "type": "sensor_data",
                    "data": {
                        "ultrasonic": ultrasonic_data,
                        "mpu9250": mpu9250_data,
                        "speed_control": speed_control_state,
                        "direction": speed_control_state["current_direction"],
                        "lidar": t_data.get("lidar", {"active": True, "status": "ACTIVE"}),
                        "oled_expression": oled_expr,
                        "camera": video_service.get_status(),
                        "glass_detected": t_data.get("glass_detected", False)
                    }
                })

                    
            elif msg_type in ["sensor_data", "lidar_scan"]:
                pts = message.get("points") or message.get("data", {}).get("points")
                if pts:
                    import app.api.robot
                    app.api.robot.latest_lidar_rays = pts
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
                "ultrasonic": "REMOVED",
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
