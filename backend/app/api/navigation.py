from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, NavigationHistory
from app.security.authentication import get_current_user, require_admin, User
from app.services.navigation_service import request_navigation, cancel_navigation, return_home
from app.services.robot_service import robot_state

router = APIRouter(prefix="/api/navigation")

class NavRequest(BaseModel):
    destination_id: int

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/request")
async def nav_request(req: NavRequest, current_user: User = Depends(get_current_user)):
    success = await request_navigation(req.destination_id, current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail="Navigation failed to start")
    return {"status": "navigating"}

@router.post("/cancel")
async def nav_cancel(current_user: User = Depends(get_current_user)):
    success = await cancel_navigation()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot cancel navigation")
    return {"status": "cancelled"}

@router.post("/return-home")
async def nav_return(current_user: User = Depends(require_admin)):
    success = await return_home()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot return home")
    return {"status": "returning"}

@router.get("/history")
async def get_history(limit: int = 10, offset: int = 0, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(NavigationHistory).order_by(NavigationHistory.timestamp.desc()).limit(limit).offset(offset))
    history = result.scalars().all()
    return history

@router.get("/current")
async def current_nav(current_user: User = Depends(get_current_user)):
    if robot_state.state in ["NAVIGATING", "WAITING_FOR_DESTINATION", "WAITING_AT_DESTINATION", "OBSTACLE_DETECTED"]:
        return {
            "status": robot_state.state,
            "destination": robot_state.destination,
            "path": robot_state.current_path
        }
    return {"status": "none"}
