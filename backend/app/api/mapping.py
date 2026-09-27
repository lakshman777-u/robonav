import base64
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from app.database import AsyncSessionLocal, Map
from app.security.authentication import get_current_user, require_admin, User
from app.services.mapping_service import start_mapping, stop_mapping

router = APIRouter(prefix="/api/maps")

class MapCreate(BaseModel):
    name: str

class MapUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.post("")
async def create_map(map_data: MapCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    # Handled by mapping service primarily
    pass

@router.get("")
async def list_maps(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Map))
    maps = result.scalars().all()
    return [{"id": m.id, "map_id": m.map_id, "name": m.name, "status": m.status} for m in maps]

@router.get("/{map_id}")
async def get_map(map_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Map).where(Map.id == map_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")
        
    occupancy = base64.b64encode(m.occupancy_data).decode('utf-8') if m.occupancy_data else None
    
    return {
        "id": m.id, 
        "map_id": m.map_id,
        "name": m.name, 
        "resolution": m.resolution,
        "width": m.width,
        "height": m.height,
        "origin_x": m.origin_x,
        "origin_y": m.origin_y,
        "occupancy_data": occupancy,
        "status": m.status
    }

@router.put("/{map_id}")
async def update_map(map_id: int, map_update: MapUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Map).where(Map.id == map_id))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Map not found")
        
    if map_update.name:
        m.name = map_update.name
    if map_update.status:
        m.status = map_update.status
        
    await db.commit()
    return {"status": "updated"}

@router.post("/start")
async def api_start_mapping(req: MapCreate, current_user: User = Depends(require_admin)):
    success = await start_mapping(req.name)
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start mapping from current state")
    return {"status": "mapping_started"}

@router.post("/stop")
async def api_stop_mapping(current_user: User = Depends(require_admin)):
    success = await stop_mapping()
    if not success:
        raise HTTPException(status_code=400, detail="Not currently mapping")
    return {"status": "mapping_stopped"}
