import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from app.ws.manager import manager
from app.security.authentication import verify_token
from app.services.robot_service import handle_emergency_stop, handle_resume, robot_state
from app.services.mapping_service import start_mapping, stop_mapping
from app.services.navigation_service import request_navigation, cancel_navigation

router = APIRouter()

@router.websocket("/ws/browser")
async def browser_websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = verify_token(token)
        user_id = payload.get("sub")
        role = payload.get("role", "user")
    except Exception:
        await websocket.close(code=1008)
        return
        
    connection_id = str(uuid.uuid4())
    await manager.connect_browser(websocket, connection_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "manual_command" and role == "admin":
                await manager.send_to_robot(message)
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
                # User id logic could be properly derived, for now mock it to 1
                await request_navigation(dest_id, 1)
            elif msg_type == "cancel_navigation":
                await cancel_navigation()
    except WebSocketDisconnect:
        manager.disconnect_browser(connection_id)
    except Exception:
        manager.disconnect_browser(connection_id)
