import zlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.services.robot_service import robot_state, transition
from app.ws.manager import manager
from app.database import AsyncSessionLocal, Map
from app.simulation.robot_simulator import simulator

current_map_data: Dict[str, Any] = {}

async def start_mapping(map_name: str) -> bool:
    global current_map_data
    if transition("MAPPING"):
        current_map_data = {
            "name": map_name,
            "resolution": 0.05,
            "width": 400,
            "height": 300,
            "origin_x": 0.0,
            "origin_y": 0.0,
            "grid": simulator.explored_map
        }
        await simulator.command_queue.put({"type": "START_MAPPING"})
        return True
    return False

async def stop_mapping() -> bool:
    global current_map_data
    if transition("MAP_READY"):
        await simulator.command_queue.put({"type": "STOP_MAPPING"})
        if current_map_data:
            current_map_data["grid"] = simulator.explored_map
            await save_map(current_map_data)
        return True
    return False

def update_map(data: dict):
    pass

async def save_map(map_data: dict):
    async with AsyncSessionLocal() as session:
        compressed_grid = compress_grid(map_data["grid"])
        new_map = Map(
            map_id=f"MAP-{int(datetime.utcnow().timestamp())}",
            name=map_data["name"],
            resolution=map_data["resolution"],
            width=map_data["width"],
            height=map_data["height"],
            origin_x=map_data["origin_x"],
            origin_y=map_data["origin_y"],
            occupancy_data=compressed_grid,
            status="ready"
        )
        session.add(new_map)
        await session.commit()

def get_current_map() -> Optional[Dict[str, Any]]:
    return current_map_data if current_map_data else None

def compress_grid(grid: List[List[int]]) -> bytes:
    json_str = json.dumps(grid)
    return zlib.compress(json_str.encode('utf-8'))

def decompress_grid(data: bytes) -> List[List[int]]:
    json_str = zlib.decompress(data).decode('utf-8')
    return json.loads(json_str)
