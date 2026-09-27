from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import AsyncSessionLocal, Robot
from app.security.authentication import get_current_user, require_admin, User, create_access_token
from app.security.api_keys import verify_api_key
from app.services.robot_service import get_status, handle_emergency_stop
from app.ws.manager import manager
from app.simulation.robot_simulator import simulator

router = APIRouter(prefix="/api/robots")

class RobotAuthRequest(BaseModel):
    robot_id: str
    api_key: str

class RobotCommand(BaseModel):
    command: str
    parameters: dict = {}

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

@router.post("/auth")
async def robot_auth(req: RobotAuthRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Robot).where(Robot.robot_id == req.robot_id))
    robot = result.scalar_one_or_none()
    
    if not robot or not robot.api_key_hash:
        raise HTTPException(status_code=401, detail="Invalid robot credentials")
        
    if not verify_api_key(req.api_key, robot.api_key_hash):
        raise HTTPException(status_code=401, detail="Invalid API key")
        
    access_token = create_access_token(data={"sub": robot.robot_id, "type": "robot"})
    return {"access_token": access_token, "websocket_url": f"ws://localhost:8000/ws/robot?token={access_token}"}

@router.get("/{robot_id}/status")
async def read_robot_status(robot_id: str, current_user: User = Depends(get_current_user)):
    return get_status()

@router.post("/{robot_id}/command")
async def send_command(robot_id: str, cmd: RobotCommand, current_user: User = Depends(require_admin)):
    await simulator.command_queue.put({"type": cmd.command, "parameters": cmd.parameters})
    return {"status": "command_sent"}

@router.post("/{robot_id}/emergency-stop")
async def emergency_stop(robot_id: str, current_user: User = Depends(require_admin)):
    handle_emergency_stop()
    await simulator.command_queue.put({"type": "EMERGENCY_STOP"})
    return {"status": "emergency_stop_activated"}

@router.get("")
async def list_robots(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Robot))
    robots = result.scalars().all()
    return [{"robot_id": r.robot_id, "name": r.name, "status": r.connection_status} for r in robots]
