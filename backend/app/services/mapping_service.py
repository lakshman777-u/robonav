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

MAP_WIDTH = 600
MAP_HEIGHT = 600
MAP_RESOLUTION = 0.05
MAP_ORIGIN_X = -15.0
MAP_ORIGIN_Y = -15.0

current_map_data: Dict[str, Any] = {
    "name": "Building Map",
    "resolution": MAP_RESOLUTION,
    "width": MAP_WIDTH,
    "height": MAP_HEIGHT,
    "origin_x": MAP_ORIGIN_X,
    "origin_y": MAP_ORIGIN_Y,
    "grid": [[-1 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)],
    "real_points_mapped": 0
}

def get_current_map() -> Optional[Dict[str, Any]]:
    return current_map_data if current_map_data else None

async def start_mapping(map_name: str, clean: bool = False) -> bool:
    """Starts or resumes 2D continuous multi-room SLAM mapping."""
    global current_map_data, accumulated_updates
    from app.services.lidar_odometry import lidar_odometry
    from app.services.robot_service import robot_state

    # Auto-start YDLIDAR driver if hardware USB is detected and driver isn't running
    if detect_lidar_port() and not is_driver_running():
        start_driver(mock=False)

    if transition("MAPPING"):
        # If clean reset requested or grid not initialized
        if clean or not current_map_data or "grid" not in current_map_data:
            lidar_odometry.start(0.0, 0.0, 0.0)
            robot_state.position = {"x": 0.0, "y": 0.0}
            robot_state.orientation = 0.0
            robot_state.current_path = [{"x": 0.0, "y": 0.0}]
            grid = [[-1 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)]
            accumulated_updates = {}
            current_map_data = {
                "name": map_name or "Building Map",
                "resolution": MAP_RESOLUTION,
                "width": MAP_WIDTH,
                "height": MAP_HEIGHT,
                "origin_x": MAP_ORIGIN_X,
                "origin_y": MAP_ORIGIN_Y,
                "grid": grid,
                "real_points_mapped": 0
            }
        else:
            # Resuming without clearing: preserve all previous rooms and walls!
            if not lidar_odometry.is_tracking:
                lidar_odometry.start(
                    robot_state.position.get("x", 0.0),
                    robot_state.position.get("y", 0.0),
                    robot_state.orientation
                )
            if map_name:
                current_map_data["name"] = map_name

        # Tell ESP32 to display MAPPING expression on OLED
        await manager.send_to_robot({
            "type": "command",
            "command": "EXPRESSION",
            "expression": "MAPPING"
        })

        # Broadcast map state to all browser clients
        flat_grid = [val for row in current_map_data["grid"] for val in row]
        await manager.broadcast_to_browsers({
            "type": "map_update",
            "data": {
                "occupancy_grid": flat_grid,
                "width": MAP_WIDTH,
                "height": MAP_HEIGHT,
                "resolution": MAP_RESOLUTION,
                "origin_x": MAP_ORIGIN_X,
                "origin_y": MAP_ORIGIN_Y,
                "name": current_map_data.get("name", "Building Map"),
                "status": "building"
            }
        })
        return True
    return False

async def pause_mapping() -> bool:
    """Stops / freezes mapping right where it is, keeping all mapped rooms and trajectory intact."""
    global current_map_data
    from app.services.lidar_odometry import lidar_odometry
    if transition("MAP_READY"):
        lidar_odometry.stop()
        await manager.broadcast_to_browsers({
            "type": "map_status",
            "data": {"status": "paused", "message": "Map frozen. All scanned areas preserved."}
        })
        return True
    return False

async def finalize_map(save_as_name: Optional[str] = None) -> bool:
    """Finalizes and saves the 2D multi-room map to laptop server (maps/) and database."""
    global current_map_data
    from app.services.lidar_odometry import lidar_odometry
    lidar_odometry.stop()
    transition("MAP_READY")

    if current_map_data:
        if save_as_name and save_as_name.strip():
            current_map_data["name"] = save_as_name.strip()
        await save_map(current_map_data)
        await manager.broadcast_to_browsers({
            "type": "map_status",
            "data": {
                "status": "saved", 
                "name": current_map_data.get("name"),
                "message": f"Successfully finalized and saved map '{current_map_data.get('name')}'"
            }
        })
        return True
    return False

async def stop_mapping(save_as_name: Optional[str] = None) -> bool:
    """Alias for finalize_map for backward compatibility."""
    return await finalize_map(save_as_name)

async def clear_map() -> bool:
    """Clears the live building grid and resets odometry back to origin (0, 0)."""
    global current_map_data, accumulated_updates, last_map_broadcast
    from app.services.lidar_odometry import lidar_odometry
    from app.services.robot_service import robot_state

    lidar_odometry.reset(0.0, 0.0, 0.0)
    robot_state.position = {"x": 0.0, "y": 0.0}
    robot_state.orientation = 0.0
    robot_state.current_path = [{"x": 0.0, "y": 0.0}]

    current_map_data = {
        "name": "Building Map",
        "resolution": MAP_RESOLUTION,
        "width": MAP_WIDTH,
        "height": MAP_HEIGHT,
        "origin_x": MAP_ORIGIN_X,
        "origin_y": MAP_ORIGIN_Y,
        "grid": [[-1 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)],
        "real_points_mapped": 0
    }
    accumulated_updates = {}
    last_map_broadcast = 0.0
    flat_grid = [-1] * (MAP_WIDTH * MAP_HEIGHT)
    await manager.broadcast_to_browsers({
        "type": "map_update",
        "data": {
            "occupancy_grid": flat_grid,
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "resolution": MAP_RESOLUTION,
            "origin_x": MAP_ORIGIN_X,
            "origin_y": MAP_ORIGIN_Y,
            "name": "Building Map",
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
            "name": "Building Map",
            "resolution": MAP_RESOLUTION,
            "width": MAP_WIDTH,
            "height": MAP_HEIGHT,
            "origin_x": MAP_ORIGIN_X,
            "origin_y": MAP_ORIGIN_Y,
            "grid": [[-1 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)],
            "real_points_mapped": 0
        }

    grid = current_map_data.get("grid")
    if not grid:
        grid = [[-1 for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)]
        current_map_data["grid"] = grid

    width = current_map_data.get("width", MAP_WIDTH)
    height = current_map_data.get("height", MAP_HEIGHT)
    res = current_map_data.get("resolution", MAP_RESOLUTION)
    origin_x = current_map_data.get("origin_x", MAP_ORIGIN_X)
    origin_y = current_map_data.get("origin_y", MAP_ORIGIN_Y)

    rx = position.get("x", 0.0)
    ry = position.get("y", 0.0)

    points_counted = 0
    now = time.time()
    n_pts = len(points)

    for i, pt in enumerate(points):
        angle_deg = pt.get("angle", 0.0)
        dist = pt.get("distance", 0.0)
        if dist <= 0.15 or dist > 8.0:
            continue

        # Noise Filter: Reject isolated laser spikes (dust, mirror/glass glare)
        if n_pts >= 4:
            prev_d = points[(i - 1) % n_pts].get("distance", 0.0)
            next_d = points[(i + 1) % n_pts].get("distance", 0.0)
            if abs(dist - prev_d) > 0.45 and abs(dist - next_d) > 0.45:
                continue

        points_counted += 1
        rad = math.radians(orientation + angle_deg)
        cos_a = math.cos(rad)
        sin_a = math.sin(rad)

        # 1. Ray trace free space in master grid (for ROS saving & navigation)
        curr = 0.0
        while curr < dist - res:
            curr += res
            curr_x = rx + curr * cos_a
            curr_y = ry + curr * sin_a
            fx = int((curr_x - origin_x) / res)
            fy = int((curr_y - origin_y) / res)
            if 0 <= fx < width and 0 <= fy < height:
                if grid[fy][fx] == -1:
                    grid[fy][fx] = 0

        # 2. Mark solid bounce-backed obstacle wall
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
            resolution=map_data.get("resolution", MAP_RESOLUTION),
            width=map_data.get("width", MAP_WIDTH),
            height=map_data.get("height", MAP_HEIGHT),
            origin_x=map_data.get("origin_x", MAP_ORIGIN_X),
            origin_y=map_data.get("origin_y", MAP_ORIGIN_Y),
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

        w = map_data.get("width", MAP_WIDTH)
        h = map_data.get("height", MAP_HEIGHT)
        res = map_data.get("resolution", MAP_RESOLUTION)
        orig_x = map_data.get("origin_x", MAP_ORIGIN_X)
        orig_y = map_data.get("origin_y", MAP_ORIGIN_Y)

        # Save JSON
        json_path = os.path.join(maps_dir, f"{safe_name}.json")
        with open(json_path, "w") as f:
            json.dump({
                "map_id": map_id_str,
                "name": map_name,
                "resolution": res,
                "width": w,
                "height": h,
                "origin": [orig_x, orig_y, 0.0],
                "saved_at": datetime.utcnow().isoformat(),
                "grid": map_data["grid"]
            }, f, indent=2)

        # Save ROS 2 PGM and YAML
        pgm_path = os.path.join(maps_dir, f"{safe_name}.pgm")
        yaml_path = os.path.join(maps_dir, f"{safe_name}.yaml")
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
resolution: {res}
origin: [{orig_x}, {orig_y}, 0.0]
negate: 0
occupied_thresh: 0.65
free_thresh: 0.25
""")
        print(f"[MAPPER] Map '{map_name}' successfully saved to laptop disk at {maps_dir}/{safe_name}.*")
    except Exception as e:
        print(f"[MAPPER] Warning: Could not write physical map files to disk: {e}")

async def manual_save_map(save_as_name: Optional[str] = None) -> bool:
    """Manually saves current active map state to DB and laptop maps/ with custom name."""
    global current_map_data
    if current_map_data and "grid" in current_map_data:
        if save_as_name and save_as_name.strip():
            current_map_data["name"] = save_as_name.strip()
        await save_map(current_map_data)
        await manager.broadcast_to_browsers({
            "type": "map_status",
            "data": {
                "status": "saved", 
                "name": current_map_data.get("name"),
                "message": f"Successfully manually saved map '{current_map_data.get('name')}'"
            }
        })
        return True
    return False

def compress_grid(grid: List[List[int]]) -> bytes:
    json_str = json.dumps(grid)
    return zlib.compress(json_str.encode('utf-8'))

def decompress_grid(data: bytes) -> List[List[int]]:
    json_str = zlib.decompress(data).decode('utf-8')
    return json.loads(json_str)
