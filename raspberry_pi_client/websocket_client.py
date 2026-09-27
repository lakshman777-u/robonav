import asyncio
import json
import logging
import websockets
from websockets.exceptions import ConnectionClosed

logger = logging.getLogger(__name__)

class RobotWebSocketClient:
    def __init__(self, server_url, access_token):
        self.server_url = server_url
        self.access_token = access_token
        self.ws = None
        self._is_connected = False
        self._reconnect_delay = 1
        
    @property
    def is_connected(self):
        return self._is_connected

    async def connect(self):
        url = f"{self.server_url}?token={self.access_token}"
        while True:
            try:
                self.ws = await websockets.connect(url)
                self._is_connected = True
                self._reconnect_delay = 1
                logger.info("Connected to WebSocket server")
                asyncio.create_task(self.send_heartbeat())
                break
            except Exception as e:
                self._is_connected = False
                logger.error(f"WebSocket connection failed: {e}. Retrying in {self._reconnect_delay}s...")
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(self._reconnect_delay * 2, 60)

    async def send(self, message: dict):
        if self.is_connected and self.ws:
            try:
                await self.ws.send(json.dumps(message))
            except ConnectionClosed:
                self._is_connected = False
                logger.warning("Connection closed while sending. Attempting reconnect...")
                asyncio.create_task(self.connect())

    async def receive(self) -> dict:
        if self.is_connected and self.ws:
            try:
                msg = await self.ws.recv()
                return json.loads(msg)
            except ConnectionClosed:
                self._is_connected = False
                logger.warning("Connection closed while receiving. Attempting reconnect...")
                asyncio.create_task(self.connect())
                return None
        return None

    async def send_heartbeat(self):
        while self.is_connected:
            await self.send({"type": "heartbeat"})
            await asyncio.sleep(5)

    async def send_status(self, status_data):
        await self.send({"type": "robot_status", **status_data})

    async def send_sensor_data(self, sensor_data):
        await self.send({"type": "sensor_data", **sensor_data})

    async def send_map_update(self, map_data):
        await self.send({"type": "map_update", **map_data})

    async def send_position(self, x, y, orientation):
        await self.send({"type": "position_update", "position": {"x": x, "y": y}, "orientation": orientation})

    async def send_battery(self, percentage, charging):
        await self.send({"type": "battery_update", "percentage": percentage, "charging": charging})

    async def send_obstacle(self, sensor, distance, obstacle_type):
        await self.send({"type": "obstacle_detected", "sensor": sensor, "distance": distance, "obstacle_type": obstacle_type})

    async def send_navigation_status(self, status, progress, distance_remaining, estimated_time=0):
        await self.send({
            "type": "navigation_status",
            "status": status,
            "progress": progress,
            "distance_remaining": distance_remaining,
            "estimated_time": estimated_time
        })

    async def send_destination_reached(self, destination_id, destination_name=""):
        await self.send({"type": "destination_reached", "destination_id": destination_id, "destination_name": destination_name})

    async def receive_commands(self, callback):
        while True:
            msg = await self.receive()
            if msg:
                await callback(msg)
            else:
                await asyncio.sleep(1)

    async def disconnect(self):
        if self.ws:
            await self.ws.close()
            self._is_connected = False
