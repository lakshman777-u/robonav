import os
import time
import zlib
import json
import math
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.future import select

from app.services.robot_service import robot_state, transition
from app.ws.manager import manager
from app.database import AsyncSessionLocal, Map
from app.simulation.robot_simulator import simulator
from app.services.lidar_service import is_driver_running, start_driver, detect_lidar_port

current_map_data: Dict[str, Any] = {}

def get_current_map() -> Optional[Dict[str, Any]]:
    return current_map_data if current_map_data else None

async def start_mapping(map_name: str, clean: bool = True) -> bool:
    """Initiates 2D SLAM mapping session, ensures LiDAR is running, and notifies clients."""
    global current_map_data
    from app.services.lidar_odometry import lidar_odometry
    from app.services.robot_service import robot_state

    # Auto-start YDLIDAR driver if hardware USB is detected and driver isn't running
    if detect_lidar_port() and not is_driver_running():
        start_driver(mock=False)

    if transition("MAPPING"):
        # Reset odometry tracking origin to (0, 0, 0)
        lidar_odometry.start(0.0, 0.0, 0.0)
        robot_state.position = {"x": 0.0, "y": 0.0}
        robot_state.orientation = 0.0
        robot_state.current_path = [{"x": 0.0, "y": 0.0}]

        # Tell ESP32 to display MAPPING expression on OLED
        await manager.send_to_robot({
            "type": "command",
            "command": "EXPRESSION",
            "expression": "MAPPING"
        })

        # Initialize clean grid for genuine real-world LiDAR exploration
        grid = [[-1 for _ in range(400)] for _ in range(300)]

        current_map_data = {
            "name": map_name,
            "resolution": 0.05,
            "width": 400,
            "height": 300,
            "origin_x": -10.0,
            "origin_y": -7.5,
            "grid": grid,
            "real_points_mapped": 0
        }

        # Tell simulator
        await simulator.command_queue.put({"type": "START_MAPPING"})

        # Broadcast initial clean map to browser clients
        flat_grid = [-1] * (400 * 300)
        await manager.broadcast_to_browsers({
            "type": "map_update",
            "data": {
                "occupancy_grid": flat_grid,
                "width": 400,
                "height": 300,
                "resolution": 0.05,
                "name": map_name,
                "status": "building"
            }
        })
        return True
    return False

async def stop_mapping(save_as_name: Optional[str] = None) -> bool:
    """Freezes and stops 2D SLAM mapping, saves the resulting map, and sets state to MAP_READY."""
    global current_map_data
    from app.services.lidar_odometry import lidar_odometry
    if transition("MAP_READY"):
        lidar_odometry.stop()
        await simulator.command_queue.put({"type": "STOP_MAPPING"})
        if current_map_data:
            if save_as_name and save_as_name.strip():
                current_map_data["name"] = save_as_name.strip()
            # If no real LiDAR points were captured, fall back to simulator grid
            if current_map_data.get("real_points_mapped", 0) == 0 and not is_driver_running():
                current_map_data["grid"] = simulator.explored_map
            await save_map(current_map_data)
        return True
    return False

async def clear_map() -> bool:
    """Clears the live occupancy grid and resets odometry so a fresh scan can begin."""
    global current_map_data, accumulated_updates, last_map_broadcast
    from app.services.lidar_odometry import lidar_odometry
    from app.services.robot_service import robot_state

    lidar_odometry.reset(0.0, 0.0, 0.0)
    robot_state.position = {"x": 0.0, "y": 0.0}
    robot_state.orientation = 0.0
    robot_state.current_path = [{"x": 0.0, "y": 0.0}]

    current_map_data = {
        "name": "Live SLAM Map",
        "resolution": 0.05,
        "width": 400,
        "height": 300,
        "origin_x": -10.0,
        "origin_y": -7.5,
        "grid": [[-1 for _ in range(400)] for _ in range(300)],
        "real_points_mapped": 0
    }
    accumulated_updates = {}
    last_map_broadcast = 0.0
    flat_grid = [-1] * (400 * 300)
    await manager.broadcast_to_browsers({
        "type": "map_update",
        "data": {
            "occupancy_grid": flat_grid,
            "width": 400,
            "height": 300,
            "resolution": 0.05,
            "name": "Live SLAM Map",
            "status": "cleared"
        }
    })
    return True

async def load_saved_map(map_id: int) -> bool:
    """Loads a previously saved map from SQLite database into active live memory."""
    global current_map_data, accumulated_updates
    accumulated_updates = {}
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Map).where(Map.id == map_id))
        m = result.scalar_one_or_none()
        if not m or not m.occupancy_data:
            return False

        grid = decompress_grid(m.occupancy_data)
        current_map_data = {
            "name": m.name,
            "resolution": m.resolution,
            "width": m.width,
            "height": m.height,
            "origin_x": m.origin_x,
            "origin_y": m.origin_y,
            "grid": grid,
            "real_points_mapped": 1
        }

        # Flatten grid for frontend
        flat_grid = [val for row in grid for val in row]
        await manager.broadcast_to_browsers({
            "type": "map_update",
            "data": {
                "occupancy_grid": flat_grid,
                "width": m.width,
                "height": m.height,
                "resolution": m.resolution,
                "name": m.name,
                "status": "ready"
            }
        })
        return True

def update_map(data: dict):
    pass

accumulated_updates: Dict[int, int] = {}
last_map_broadcast: float = 0.0

def process_lidar_points(points: list, position: dict, orientation: float):
    """Processes live LiDAR scans into 2D SLAM occupancy grid in real-time."""
    global current_map_data, accumulated_updates, last_map_broadcast
    if not current_map_data:
        current_map_data = {
            "name": "Live SLAM Map",
            "resolution": 0.05,
            "width": 400,
            "height": 300,
            "origin_x": -10.0,
            "origin_y": -7.5,
            "grid": [[-1 for _ in range(400)] for _ in range(300)],
            "real_points_mapped": 0
        }

    grid = current_map_data.get("grid")
    if not grid:
        grid = [[-1 for _ in range(400)] for _ in range(300)]
        current_map_data["grid"] = grid

    width = current_map_data.get("width", 400)
    height = current_map_data.get("height", 300)
    res = current_map_data.get("resolution", 0.05)
    origin_x = current_map_data.get("origin_x", -10.0)
    origin_y = current_map_data.get("origin_y", -7.5)

    rx = position.get("x", 0.0)
    ry = position.get("y", 0.0)

    points_counted = 0
    now = time.time()

    for pt in points:
        angle_deg = pt.get("angle", 0.0)
        dist = pt.get("distance", 0.0)
        if dist <= 0.10 or dist > 10.0:
            continue

        points_counted += 1
        rad = math.radians(orientation + angle_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)

        # 1. Ray trace free space
        curr = 0.0
        while curr < dist - res:
            curr += res
            curr_x = rx + curr * cos_a
            curr_y = ry + curr * sin_a
            fx = int((curr_x - origin_x) / res)
            fy = int((curr_y - origin_y) / res)
            if 0 <= fx < width and 0 <= fy < height:
                if grid[fy][fx] != 0:
                    grid[fy][fx] = 0
                    accumulated_updates[fy * width + fx] = 0

        # 2. Mark obstacle cell with 2x2 solid wall footprint
        obs_x = rx + dist * cos_a
        obs_y = ry + dist * sin_a
        ox = int((obs_x - origin_x) / res)
        oy = int((obs_y - origin_y) / res)

        for dx in (0, 1):
            for dy in (0, 1):
                nox, noy = ox + dx, oy + dy
                if 0 <= nox < width and 0 <= noy < height:
                    if grid[noy][nox] != 100:
                        grid[noy][nox] = 100
                        accumulated_updates[noy * width + nox] = 100

    if points_counted > 0:
        current_map_data["real_points_mapped"] = current_map_data.get("real_points_mapped", 0) + points_counted

    # Broadcast deduplicated updates at smooth 4 Hz rate
    if accumulated_updates and (now - last_map_broadcast >= 0.25):
        last_map_broadcast = now
        updates_list = [
            {"x": idx % width, "y": idx // width, "val": val}
            for idx, val in accumulated_updates.items()
        ]
        accumulated_updates = {}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(manager.broadcast_to_browsers({
                "type": "map_update",
                "data": {"updates": updates_list}
            }))
        except RuntimeError:
            pass

async def save_map(map_data: dict):
    map_name = map_data.get("name", "Location 1")
    timestamp_str = int(datetime.utcnow().timestamp())
    map_id_str = f"MAP-{timestamp_str}"

    # 1. Save in SQLite Database
    async with AsyncSessionLocal() as session:
        compressed_grid = compress_grid(map_data["grid"])
        new_map = Map(
            map_id=map_id_str,
            name=map_name,
            resolution=map_data.get("resolution", 0.05),
            width=map_data.get("width", 400),
            height=map_data.get("height", 300),
            origin_x=map_data.get("origin_x", 0.0),
            origin_y=map_data.get("origin_y", 0.0),
            occupancy_data=compressed_grid,
            status="ready"
        )
        session.add(new_map)
        await session.commit()

    # 2. Save physical copy on laptop server filesystem
    try:
        maps_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../maps"))
        os.makedirs(maps_dir, exist_ok=True)
        safe_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in map_name).strip('_')
        if not safe_name:
            safe_name = "Location_1"

        # Save JSON
        json_path = os.path.join(maps_dir, f"{safe_name}.json")
        with open(json_path, "w") as f:
            json.dump({
                "map_id": map_id_str,
                "name": map_name,
                "resolution": map_data.get("resolution", 0.05),
                "width": map_data.get("width", 400),
                "height": map_data.get("height", 300),
                "origin": [map_data.get("origin_x", 0.0), map_data.get("origin_y", 0.0), 0.0],
                "saved_at": datetime.utcnow().isoformat(),
                "grid": map_data["grid"]
            }, f, indent=2)

        # Save ROS 2 PGM and YAML
        pgm_path = os.path.join(maps_dir, f"{safe_name}.pgm")
        yaml_path = os.path.join(maps_dir, f"{safe_name}.yaml")
        w = map_data.get("width", 400)
        h = map_data.get("height", 300)
        grid = map_data["grid"]

        pgm_bytes = bytearray()
        for y in range(h - 1, -1, -1):
            for x in range(w):
                v = grid[y][x] if (y < len(grid) and x < len(grid[y])) else -1
                if v == 0:
                    pgm_bytes.append(254)
                elif v >= 100:
                    pgm_bytes.append(0)
                else:
                    pgm_bytes.append(205)

        with open(pgm_path, "wb") as f:
            header = f"P5\n{w} {h}\n255\n".encode('ascii')
            f.write(header + pgm_bytes)

        with open(yaml_path, "w") as f:
            f.write(f"""image: {safe_name}.pgm
mode: trinary
resolution: {map_data.get("resolution", 0.05)}
origin: [-10.0, -7.5, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
""")
        print(f"[MAPPER] Map '{map_name}' successfully saved to laptop disk at {maps_dir}/{safe_name}.*")
    except Exception as e:
        print(f"[MAPPER] Warning: Could not write physical map files to disk: {e}")

def compress_grid(grid: List[List[int]]) -> bytes:
    json_str = json.dumps(grid)
    return zlib.compress(json_str.encode('utf-8'))

def decompress_grid(data: bytes) -> List[List[int]]:
    json_str = zlib.decompress(data).decode('utf-8')
    return json.loads(json_str)
