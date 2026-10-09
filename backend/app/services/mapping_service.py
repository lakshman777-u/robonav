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

def process_lidar_points(points: list, position: dict, orientation: float):
    """Processes live LiDAR scans from ESP32 into 2D SLAM occupancy grid in real-time."""
    global current_map_data
    if not current_map_data:
        current_map_data = {
            "name": "Live SLAM Map",
            "resolution": 0.05,
            "width": 400,
            "height": 300,
            "origin_x": 0.0,
            "origin_y": 0.0,
            "grid": [[-1 for _ in range(400)] for _ in range(300)]
        }
    
    grid = current_map_data.get("grid")
    if not grid:
        grid = [[-1 for _ in range(400)] for _ in range(300)]
        current_map_data["grid"] = grid
        
    width = current_map_data.get("width", 400)
    height = current_map_data.get("height", 300)
    res = current_map_data.get("resolution", 0.05)
    
    rx = position.get("x", 2.0)
    ry = position.get("y", 2.0)
    
    updates = []
    
    for pt in points:
        angle_deg = pt.get("angle", 0.0)
        dist = pt.get("distance", 0.0)
        if dist <= 0.05 or dist > 12.0:
            continue
            
        rad = math.radians(orientation + angle_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)
        
        # Ray trace free space
        curr = 0.0
        step = res
        while curr < dist - res:
            curr += step
            fx = int((rx + curr * cos_a) / res)
            fy = int((ry + curr * sin_a) / res)
            if 0 <= fx < width and 0 <= fy < height:
                if grid[fy][fx] != 0:
                    grid[fy][fx] = 0
                    updates.append({"x": fx, "y": fy, "val": 0})
        
        # Mark obstacle cell
        ox = int((rx + dist * cos_a) / res)
        oy = int((ry + dist * sin_a) / res)
        if 0 <= ox < width and 0 <= oy < height:
            if grid[oy][ox] != 100:
                grid[oy][ox] = 100
                updates.append({"x": ox, "y": oy, "val": 100})
                
    if updates:
        asyncio.create_task(manager.broadcast_to_browsers({
            "type": "map_update",
            "data": {"updates": updates}
        }))

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
