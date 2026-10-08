from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, Robot
from app.security.authentication import require_admin, User
from app.security.api_keys import generate_api_key

router = APIRouter(prefix="/api/robots/{robot_id}/api-key")

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("")
@router.get("/status")
async def get_key_status(robot_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Robot).where(Robot.robot_id == robot_id))
    robot = result.scalars().first()
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
    return {
        "has_key": robot.api_key_hash is not None,
        "prefix": robot.api_key_prefix or "rb_live_",
        "robot_id": robot.robot_id
    }

@router.post("")
@router.post("/generate")
async def generate_key(robot_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Robot).where(Robot.robot_id == robot_id))
    robot = result.scalars().first()
    
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
        
    full_key, key_hash, key_prefix = generate_api_key()
    
    robot.api_key_hash = key_hash
    robot.api_key_prefix = key_prefix
    await db.commit()
    
    return {"api_key": full_key, "prefix": key_prefix}

@router.post("/revoke")
async def revoke_key(robot_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Robot).where(Robot.robot_id == robot_id))
    robot = result.scalars().first()
    
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
        
    robot.api_key_hash = None
    robot.api_key_prefix = None
    await db.commit()
    
    return {"status": "revoked"}

@router.post("/regenerate")
async def regenerate_key(robot_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_admin)):
    result = await db.execute(select(Robot).where(Robot.robot_id == robot_id))
    robot = result.scalars().first()
    
    if not robot:
        raise HTTPException(status_code=404, detail="Robot not found")
        
    full_key, key_hash, key_prefix = generate_api_key()
    
    robot.api_key_hash = key_hash
    robot.api_key_prefix = key_prefix
    await db.commit()
    
    return {"api_key": full_key, "prefix": key_prefix}
