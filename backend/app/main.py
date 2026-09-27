import asyncio
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.database import init_db
from app.api import auth, robot, api_keys, mapping, destinations, navigation, telemetry
from app.ws import browser, robot as ws_robot
from app.simulation.robot_simulator import simulator
from app.security.authentication import require_admin, User

app = FastAPI(title="RoboNav API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(robot.router)
app.include_router(api_keys.router)
app.include_router(mapping.router)
app.include_router(destinations.router)
app.include_router(navigation.router)
app.include_router(telemetry.router)
app.include_router(browser.router)
app.include_router(ws_robot.router)

@app.on_event("startup")
async def startup_event():
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    if simulator.is_running:
        simulator.stop()

@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@app.post("/api/robot/auth")
async def robot_auth_alias(req: robot.RobotAuthRequest, db: AsyncSession = Depends(robot.get_db)):
    return await robot.robot_auth(req, db)

class SimToggle(BaseModel):
    enabled: bool

class DemoTime(BaseModel):
    enabled: bool

@app.post("/api/simulation/toggle")
async def toggle_simulation(req: SimToggle, current_user: User = Depends(require_admin)):
    if req.enabled and not simulator.is_running:
        await simulator.start()
    elif not req.enabled and simulator.is_running:
        simulator.stop()
    return {"status": "running" if simulator.is_running else "stopped"}

@app.post("/api/simulation/demo-time")
async def toggle_demo_time(req: DemoTime, current_user: User = Depends(require_admin)):
    simulator.demo_mode = req.enabled
    simulator.time_scale = 10.0 if req.enabled else 1.0
    return {"demo_mode": simulator.demo_mode, "time_scale": simulator.time_scale}

# Serve Frontend Static Assets and SPA Routes directly
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
assets_dir = os.path.join(frontend_dist, "assets")

if os.path.isdir(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    file_path = os.path.join(frontend_dist, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    index_file = os.path.join(frontend_dist, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {"message": "RoboNav API is running. Frontend dist not built."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
