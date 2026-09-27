import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.ws.manager import manager
from app.services.robot_service import transition, robot_state
from app.services.mapping_service import update_map
from app.services.navigation_service import update_navigation_progress

router = APIRouter()

@router.websocket("/ws/robot")
async def robot_websocket_endpoint(websocket: WebSocket, token: str):
    # Dummy authentication for robot
    # In real world, verify robot token
    await manager.connect_robot(websocket)
    transition("CONNECTING")
    await asyncio.sleep(1) # Simulate connection delay
    transition("IDLE")
    
    heartbeat_task = asyncio.create_task(check_heartbeat())
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "heartbeat":
                robot_state.last_heartbeat = asyncio.get_event_loop().time()
            elif msg_type == "robot_status":
                # Merge state
                state_data = message.get("data", {})
                robot_state.position = state_data.get("position", robot_state.position)
                robot_state.orientation = state_data.get("orientation", robot_state.orientation)
                robot_state.battery = state_data.get("battery", robot_state.battery)
                robot_state.velocity = state_data.get("velocity", robot_state.velocity)
                await manager.broadcast_to_browsers(message)
            elif msg_type in ["sensor_data", "lidar_scan"]:
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
                
    except WebSocketDisconnect:
        handle_disconnect()
    except Exception:
        handle_disconnect()
    finally:
        heartbeat_task.cancel()
        
def handle_disconnect():
    manager.disconnect_robot()
    transition("OFFLINE")
    asyncio.create_task(manager.broadcast_to_browsers({
        "type": "robot_status",
        "data": robot_state.to_dict()
    }))
    
async def check_heartbeat():
    while True:
        await asyncio.sleep(5)
        now = asyncio.get_event_loop().time()
        if hasattr(robot_state, 'last_heartbeat'):
            if now - robot_state.last_heartbeat > 15:
                # Timeout
                handle_disconnect()
                break
