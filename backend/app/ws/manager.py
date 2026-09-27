from typing import Dict, Any, Optional
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.browser_connections: Dict[str, WebSocket] = {}
        self.robot_connection: Optional[WebSocket] = None
        self.robot_authenticated: bool = False

    async def connect_browser(self, websocket: WebSocket, connection_id: str):
        await websocket.accept()
        self.browser_connections[connection_id] = websocket

    def disconnect_browser(self, connection_id: str):
        if connection_id in self.browser_connections:
            del self.browser_connections[connection_id]

    async def connect_robot(self, websocket: WebSocket):
        await websocket.accept()
        self.robot_connection = websocket
        self.robot_authenticated = True

    def disconnect_robot(self):
        self.robot_connection = None
        self.robot_authenticated = False

    async def broadcast_to_browsers(self, message: dict):
        for connection in self.browser_connections.values():
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def send_to_robot(self, message: dict):
        if self.robot_connection and self.robot_authenticated:
            try:
                await self.robot_connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()
