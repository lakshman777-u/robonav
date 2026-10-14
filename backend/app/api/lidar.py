from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.lidar_service import get_lidar_status, start_driver, stop_driver, detect_lidar_port
from app.security.authentication import require_admin, User

router = APIRouter(prefix="/api/lidar")

class LidarStartReq(BaseModel):
    mock: bool = False
    port: Optional[str] = None

@router.get("/status")
async def api_lidar_status():
    """Returns real-time status of the YDLIDAR X2 USB connection and driver process."""
    return get_lidar_status()

@router.post("/start")
async def api_lidar_start(req: LidarStartReq = LidarStartReq(), current_user: User = Depends(require_admin)):
    """Launches the YDLIDAR X2 driver in hardware or simulation mode."""
    return start_driver(mock=req.mock, port=req.port)

@router.post("/stop")
async def api_lidar_stop(current_user: User = Depends(require_admin)):
    """Terminates the YDLIDAR driver process cleanly."""
    return stop_driver()
