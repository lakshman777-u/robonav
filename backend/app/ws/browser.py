import json
import uuid
import math
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.ws.manager import manager
from app.security.authentication import verify_token
from app.services.robot_service import handle_emergency_stop, handle_resume, robot_state
from app.services.mapping_service import start_mapping, stop_mapping
from app.services.navigation_service import request_navigation, cancel_navigation
from app.simulation.robot_simulator import simulator
from app.services.lidar_odometry import lidar_odometry

router = APIRouter()

@router.websocket("/ws/browser")
async def browser_websocket_endpoint(websocket: WebSocket, token: str = ""):
    role = "user"
    user_id = "guest"
    client_host = websocket.client.host if websocket.client else ""
    if client_host in ["127.0.0.1", "localhost", "::1"]:
        role = "admin"
        user_id = "admin"

    if token and token not in ["anonymous", "undefined", "null", ""]:
        try:
            payload = verify_token(token)
            user_id = payload.get("sub", user_id)
            role = payload.get("role", role)
        except Exception:
            pass
        
    connection_id = str(uuid.uuid4())
    await manager.connect_browser(websocket, connection_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type in ["manual_command", "command"]:
                command = message.get("command") or message.get("action")
                params = message.get("params") or message.get("parameters") or {}
                speed = params.get("speed", 0.4)

                cmd_upper = (command or "").upper()
                if cmd_upper in ["LEFT", "TURN_LEFT"]:
                    sim_cmd = "TURN_LEFT"
                    robot_state.orientation = (robot_state.orientation + 15.0) % 360.0
                    lidar_odometry.orientation = robot_state.orientation
                elif cmd_upper in ["RIGHT", "TURN_RIGHT"]:
                    sim_cmd = "TURN_RIGHT"
                    robot_state.orientation = (robot_state.orientation - 15.0 + 360.0) % 360.0
                    lidar_odometry.orientation = robot_state.orientation
                elif cmd_upper in ["FORWARD", "MOVE_FORWARD"]:
                    sim_cmd = "MOVE_FORWARD"
                    rad = math.radians(robot_state.orientation)
                    robot_state.position["x"] = round(robot_state.position.get("x", 0.0) + 0.25 * math.cos(rad), 3)
                    robot_state.position["y"] = round(robot_state.position.get("y", 0.0) + 0.25 * math.sin(rad), 3)
                    lidar_odometry.x = robot_state.position["x"]
                    lidar_odometry.y = robot_state.position["y"]
                elif cmd_upper in ["BACKWARD", "REVERSE", "MOVE_BACKWARD"]:
                    sim_cmd = "MOVE_BACKWARD"
                    rad = math.radians(robot_state.orientation)
                    robot_state.position["x"] = round(robot_state.position.get("x", 0.0) - 0.20 * math.cos(rad), 3)
                    robot_state.position["y"] = round(robot_state.position.get("y", 0.0) - 0.20 * math.sin(rad), 3)
                    lidar_odometry.x = robot_state.position["x"]
                    lidar_odometry.y = robot_state.position["y"]
                elif cmd_upper in ["STOP", "BRAKE"]:
                    sim_cmd = "STOP"
                else:
                    sim_cmd = cmd_upper

                await manager.send_to_robot({
                    "type": "command",
                    "command": sim_cmd,
                    "speed": speed,
                    "parameters": params
                })
                await simulator.command_queue.put({"type": sim_cmd, "parameters": params, "speed": speed})

                # Broadcast immediate robot_status with new orientation/position to all browsers
                await manager.broadcast_to_browsers({
                    "type": "robot_status",
                    "data": robot_state.to_dict()
                })
            elif msg_type == "start_mapping" and role == "admin":
                await start_mapping(message.get("name", "New Map"))
            elif msg_type == "stop_mapping" and role == "admin":
                await stop_mapping()
            elif msg_type == "emergency_stop" and role == "admin":
                handle_emergency_stop()
                await manager.send_to_robot({"type": "emergency_stop"})
            elif msg_type == "resume" and role == "admin":
                handle_resume()
            elif msg_type == "navigation_request":
                # Expects destination_id
                dest_id = message.get("destination_id")
                await request_navigation(dest_id, 1)
            elif msg_type == "cancel_navigation":
                await cancel_navigation()
    except WebSocketDisconnect:
        manager.disconnect_browser(connection_id)
    except Exception:
        manager.disconnect_browser(connection_id)
