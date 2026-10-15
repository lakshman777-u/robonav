import base64
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional, List

from app.database import AsyncSessionLocal, Map
from app.security.authentication import get_current_user, get_optional_user, require_admin, User
from app.services.mapping_service import (
    start_mapping, stop_mapping, pause_mapping, finalize_map, clear_map, load_saved_map,
    current_map_data, decompress_grid
)
from app.services.robot_service import robot_state

router = APIRouter(prefix="/api/maps")

class MapCreate(BaseModel):
    name: Optional[str] = "Building Map"

class MapUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("")
@router.get("/api/map")
async def list_maps(db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    result = await db.execute(select(Map).order_by(Map.id.desc()))
    maps = result.scalars().all()
    return [{
        "id": m.id,
        "map_id": m.map_id,
        "name": m.name,
        "resolution": m.resolution,
        "width": m.width,
        "height": m.height,
        "status": m.status,
        "created_at": m.created_at.isoformat() if hasattr(m, 'created_at') and m.created_at else None
    } for m in maps]

@router.get("/current")
async def get_current_map(db: AsyncSession = Depends(get_db)):
    # 1. Return live in-memory mapping data if active
    if current_map_data and "grid" in current_map_data:
        grid = current_map_data["grid"]
        if grid and isinstance(grid[0], list):
            flat = [val for row in grid for val in row]
        else:
            flat = grid
        return {
            "id": 0,
            "map_id": "MAP-LIVE",
            "name": current_map_data.get("name", "Live SLAM Map"),
            "resolution": current_map_data.get("resolution", 0.05),
            "width": current_map_data.get("width", 600),
            "height": current_map_data.get("height", 600),
            "origin_x": current_map_data.get("origin_x", -15.0),
            "origin_y": current_map_data.get("origin_y", -15.0),
            "occupancy_grid": flat,
            "status": "building" if robot_state.state == "MAPPING" else "ready"
        }

    # 2. Otherwise load the most recently saved map from DB
    result = await db.execute(select(Map).order_by(Map.id.desc()))
    m = result.scalars().first()
    if not m or not m.occupancy_data:
        # Default empty 600x600 grid centered at (-15.0, -15.0)
        return {
            "id": 1,
            "map_id": "MAP-001",
            "name": "Default 2D Map",
            "resolution": 0.05,
            "width": 600,
            "height": 600,
            "origin_x": -15.0,
            "origin_y": -15.0,
            "occupancy_grid": [-1] * (600 * 600),
            "status": "ready"
        }

    try:
        decompressed_2d = decompress_grid(m.occupancy_data)
        flat = [val for row in decompressed_2d for val in row]
    except Exception:
        flat = [-1] * (m.width * m.height)

    return {
        "id": m.id,
        "map_id": m.map_id,
        "name": m.name,
        "resolution": m.resolution,
        "width": m.width,
        "height": m.height,
        "origin_x": m.origin_x,
        "origin_y": m.origin_y,
        "occupancy_grid": flat,
        "status": m.status
    }

@router.get("/{map_id}")
async def get_map(map_id: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    result = await db.execute(select(Map).where(Map.id == map_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")

    flat = []
    if m.occupancy_data:
        try:
            grid_2d = decompress_grid(m.occupancy_data)
            flat = [val for row in grid_2d for val in row]
        except Exception:
            flat = []

    return {
        "id": m.id,
        "map_id": m.map_id,
        "name": m.name,
        "resolution": m.resolution,
        "width": m.width,
        "height": m.height,
        "origin_x": m.origin_x,
        "origin_y": m.origin_y,
        "occupancy_grid": flat,
        "status": m.status
    }

@router.post("/start")
async def api_start_mapping(req: Optional[MapCreate] = None, current_user: Optional[User] = Depends(get_optional_user)):
    name = req.name if req and req.name else "Building Map"
    success = await start_mapping(name)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start mapping from current state")
    return {"status": "mapping_started", "map_name": name}

class MapStopRequest(BaseModel):
    name: Optional[str] = None

@router.post("/pause")
async def api_pause_mapping(current_user: Optional[User] = Depends(get_optional_user)):
    success = await pause_mapping()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot pause from current state")
    return {"status": "mapping_paused"}

class MapFinalizeRequest(BaseModel):
    name: Optional[str] = None

@router.post("/finalize")
async def api_finalize_map(req: Optional[MapFinalizeRequest] = None, current_user: Optional[User] = Depends(get_optional_user)):
    save_as = req.name if req and req.name else None
    success = await finalize_map(save_as)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to finalize map")
    return {"status": "mapping_finalized", "name": save_as}

@router.post("/stop")
async def api_stop_mapping(req: Optional[MapStopRequest] = None, current_user: Optional[User] = Depends(get_optional_user)):
    save_as = req.name if req and req.name else None
    if save_as:
        success = await finalize_map(save_as)
        if not success:
            raise HTTPException(status_code=400, detail="Not currently mapping")
        return {"status": "mapping_stopped_and_saved", "name": save_as}
    else:
        success = await pause_mapping()
        if not success:
            raise HTTPException(status_code=400, detail="Not currently mapping")
        return {"status": "mapping_paused"}

@router.post("/clear")
async def api_clear_map(current_user: Optional[User] = Depends(get_optional_user)):
    await clear_map()
    return {"status": "map_cleared"}

@router.delete("/all")
async def delete_all_saved_maps(db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    from sqlalchemy import delete
    await clear_map()
    await db.execute(delete(Map))
    await db.commit()
    return {"status": "all_maps_deleted"}

@router.post("/{map_id}/load")
async def api_load_map(map_id: int, current_user: Optional[User] = Depends(get_optional_user)):
    success = await load_saved_map(map_id)
    if not success:
        raise HTTPException(status_code=404, detail="Saved map not found or corrupted")
    return {"status": "map_loaded", "id": map_id}

@router.delete("/{map_id}")
async def delete_map(map_id: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    result = await db.execute(select(Map).where(Map.id == map_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")

    # Clean up disk files on laptop server
    import os
    try:
        maps_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../maps"))
        safe_name = "".join(c if c.isalnum() or c in ('-', '_') else '_' for c in m.name).strip('_')
        for ext in [".json", ".yaml", ".pgm"]:
            fpath = os.path.join(maps_dir, f"{safe_name}{ext}")
            if os.path.exists(fpath):
                os.remove(fpath)
    except Exception:
        pass

    await db.delete(m)
    await db.commit()
    return {"status": "deleted", "id": map_id}

