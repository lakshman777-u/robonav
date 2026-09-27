from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.database import AsyncSessionLocal, Destination, Map
from app.security.authentication import get_current_user, require_admin, User

router = APIRouter(prefix="/api/destinations")

class DestinationCreate(BaseModel):
    name: str
    type: str = "room"
    x: float
    y: float
    map_id: int = None

class DestinationUpdate(BaseModel):
    name: str = None
    type: str = None
    x: float = None
    y: float = None

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("")
async def list_destinations(map_id: int = None, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(Destination)
    if map_id:
        query = query.where(Destination.map_id == map_id)
        
    result = await db.execute(query)
    dests = result.scalars().all()
    return dests

@router.post("")
async def create_destination(req: DestinationCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
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

@router.put("/{dest_id}")
async def update_destination(dest_id: int, req: DestinationUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
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
async def delete_destination(dest_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Destination).where(Destination.id == dest_id))
    dest = result.scalar_one_or_none()
    if not dest:
        raise HTTPException(status_code=404, detail="Destination not found")
        
    await db.delete(dest)
    await db.commit()
    return {"status": "deleted"}
