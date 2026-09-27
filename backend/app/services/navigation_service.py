import asyncio
from datetime import datetime
from app.services.robot_service import robot_state, transition
from app.services.path_planner import plan_path
from app.database import AsyncSessionLocal, NavigationRequest, NavigationHistory, Destination, Map
from app.ws.manager import manager
from sqlalchemy.future import select
from app.simulation.robot_simulator import simulator

async def request_navigation(destination_id: int, user_id: int) -> bool:
    async with AsyncSessionLocal() as session:
        dest_res = await session.execute(select(Destination).where(Destination.id == destination_id))
        dest = dest_res.scalar_one_or_none()
        if not dest:
            return False
        
        # In simulation mode, the simulator has its own virtual environment
        # so we don't need a saved map with occupancy data
        if not simulator.is_running:
            if dest.map_id:
                map_res = await session.execute(select(Map).where(Map.id == dest.map_id))
                map_obj = map_res.scalar_one_or_none()
                if not map_obj or not map_obj.occupancy_data:
                    return False
            else:
                return False
            
        req = NavigationRequest(user_id=user_id, destination_id=destination_id, robot_id="ROBOT-001", status="active")
        session.add(req)
        await session.commit()
        
        if transition("NAVIGATING"):
            robot_state.destination = {"x": dest.x, "y": dest.y, "name": dest.name, "id": dest.id}
            await simulator.command_queue.put({
                "type": "GO_TO_DESTINATION",
                "destination": robot_state.destination
            })
            return True
        return False

async def cancel_navigation():
    if robot_state.state in ["NAVIGATING", "OBSTACLE_DETECTED", "WAITING_AT_DESTINATION"]:
        if transition("IDLE"):
            robot_state.destination = None
            await simulator.command_queue.put({"type": "STOP"})
            return True
    return False

async def return_home():
    robot_state.state = "RETURNING_HOME"
    robot_state.destination = {"x": 2.0, "y": 2.0, "name": "Charging Station"}
    await simulator.command_queue.put({"type": "RETURN_HOME"})
    return True

async def wait_and_return(duration_seconds: int):
    pass

def start_waiting_timer(duration_seconds: int = 300):
    pass

def cancel_waiting_timer():
    pass

async def update_navigation_progress(data: dict):
    pass
        
async def save_navigation_history(req_id: int, user_id: int, username: str, dest_name: str, distance: float, duration: float, status: str):
    async with AsyncSessionLocal() as session:
        history = NavigationHistory(
            request_id=req_id,
            user_id=user_id,
            username=username,
            destination_name=dest_name,
            distance=distance,
            duration=duration,
            status=status
        )
        session.add(history)
        await session.commit()
