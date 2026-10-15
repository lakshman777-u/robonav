from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
import uuid

from app.database import AsyncSessionLocal, Destination, Map
from app.security.authentication import get_current_user, get_optional_user, require_admin, User
from app.ws.manager import manager

router = APIRouter(prefix="/api/destinations")

class DestinationCreate(BaseModel):
    name: str
    type: str = "room"
    x: float
    y: float
    map_id: Optional[int] = None

class DestinationUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None

class RoomFlagCreate(BaseModel):
    flag_number: int  # 1, 2, 3, or 4
    x: float
    y: float
    name: Optional[str] = None

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("")
async def list_destinations(map_id: Optional[int] = None, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    query = select(Destination)
    if map_id:
        query = query.where(Destination.map_id == map_id)
        
    result = await db.execute(query)
    dests = result.scalars().all()
    return dests

@router.post("")
async def create_destination(req: DestinationCreate, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    dest_id = f"DEST-{str(uuid.uuid4())[:8]}"
    dest = Destination(
        dest_id=dest_id,
        name=req.name,
        type=req.type,
        x=req.x,
        y=req.y,
        map_id=req.map_id
    )
    db.add(dest)
    await db.commit()
    await db.refresh(dest)
    return dest

@router.post("/flag")
async def set_room_flag(req: RoomFlagCreate, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    """Upserts Room Flag 1, 2, 3, or 4 at coordinates (x, y)."""
    flag_id = f"FLAG-{req.flag_number}"
    flag_name = req.name or f"Room {req.flag_number}"

    result = await db.execute(select(Destination).where(
        (Destination.dest_id == flag_id) | (Destination.name.like(f"Room {req.flag_number}%"))
    ))
    dest = result.scalars().first()
    if dest:
        dest.dest_id = flag_id
        dest.name = flag_name
        dest.x = req.x
        dest.y = req.y
        dest.type = "room"
    else:
        dest = Destination(
            dest_id=flag_id,
            name=flag_name,
            type="room",
            x=req.x,
            y=req.y
        )
        db.add(dest)

    await db.commit()
    await db.refresh(dest)

    # Broadcast destination update to all connected web clients
    await manager.broadcast_to_browsers({
        "type": "destination_update",
        "data": {
            "id": dest.id,
            "dest_id": dest.dest_id,
            "name": dest.name,
            "type": dest.type,
            "x": dest.x,
            "y": dest.y
        }
    })
    return dest

@router.delete("/flag/{flag_number}")
async def delete_room_flag(flag_number: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    flag_id = f"FLAG-{flag_number}"
    result = await db.execute(select(Destination).where(
        (Destination.dest_id == flag_id) | (Destination.name.like(f"Room {flag_number}%"))
    ))
    dest = result.scalars().first()
    if dest:
        await db.delete(dest)
        await db.commit()
        return {"status": "deleted", "flag_number": flag_number}
    return {"status": "not_found", "flag_number": flag_number}

@router.put("/{dest_id}")
async def update_destination(dest_id: int, req: DestinationUpdate, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    if req.name is not None: dest.name = req.name
    if req.type is not None: dest.type = req.type
    if req.x is not None: dest.x = req.x
    if req.y is not None: dest.y = req.y
    
    await db.commit()
    return dest

@router.delete("/{dest_id}")
async def delete_destination(dest_id: int, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_user)):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    await db.delete(dest)
    await db.commit()
    return {"status": "deleted"}

