from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, SystemLog
from app.security.authentication import get_current_user, User
from app.services.robot_service import robot_state

router = APIRouter()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.get("/api/robots/{robot_id}/telemetry")
async def get_telemetry(robot_id: str, current_user: User = Depends(get_current_user)):
    return {
        "robot_id": robot_id,
        "battery": robot_state.battery,
        "position": robot_state.position,
        "orientation": robot_state.orientation,
        "velocity": robot_state.velocity,
        "state": robot_state.state
    }

@router.get("/api/logs")
async def get_logs(level: str = None, event_type: str = None, limit: int = 50, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = select(SystemLog).order_by(SystemLog.timestamp.desc()).limit(limit)
    if level:
        query = query.where(SystemLog.level == level)
    if event_type:
        query = query.where(SystemLog.event_type == event_type)
        
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs
