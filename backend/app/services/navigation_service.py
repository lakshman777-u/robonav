import asyncio
from datetime import datetime
from app.services.robot_service import robot_state, transition
from app.services.path_planner import plan_path
from app.database import AsyncSessionLocal, NavigationRequest, NavigationHistory, Destination, Map
from app.ws.manager import manager
from sqlalchemy.future import select
from app.simulation.robot_simulator import simulator
# Active Nav2 Goal for ROS 2 autonomous navigation
_active_goal = None

def get_active_goal():
    global _active_goal
    return _active_goal

def clear_active_goal():
    global _active_goal
    _active_goal = None

async def request_navigation(destination_id: int, user_id: int) -> bool:
    global _active_goal
    async with AsyncSessionLocal() as session:
        dest_res = await session.execute(select(Destination).where(Destination.id == destination_id))
        dest = dest_res.scalar_one_or_none()
        if not dest:
            return False
            
        req = NavigationRequest(user_id=user_id, destination_id=destination_id, robot_id="ESP32DEVKIT-001", status="active")
        session.add(req)
        await session.commit()
        
        if transition("NAVIGATING"):
            robot_state.destination = {"x": dest.x, "y": dest.y, "name": dest.name, "id": dest.id}
            robot_state.navigation_progress = 0
            
            _active_goal = {
                "x": dest.x,
                "y": dest.y,
                "name": dest.name,
                "id": dest.id,
                "timestamp": datetime.utcnow().isoformat()
            }

            # Forward to PC simulator if active
            await simulator.command_queue.put({
                "type": "GO_TO_DESTINATION",
                "destination": robot_state.destination
            })

            # Forward to physical ESP32 to update OLED face and controller
            await manager.send_to_robot({
                "type": "command",
                "command": "NAVIGATE_TO",
                "parameters": robot_state.destination
            })

            # Broadcast navigation status to web UI
            await manager.broadcast_to_browsers({
                "type": "navigation_status",
                "data": {
                    "status": "NAVIGATING",
                    "destination": robot_state.destination,
                    "progress": 0
                }
            })
            return True
        return False

async def cancel_navigation():
    global _active_goal
    if robot_state.state in ["NAVIGATING", "OBSTACLE_DETECTED", "WAITING_AT_DESTINATION"]:
        if transition("IDLE"):
            robot_state.destination = None
            _active_goal = None
            await simulator.command_queue.put({"type": "STOP"})
            await manager.send_to_robot({"type": "command", "command": "STOP"})
            await manager.broadcast_to_browsers({
                "type": "navigation_status",
                "data": {"status": "IDLE", "destination": None, "progress": 0}
            })
            return True
    return False

async def return_home():
    global _active_goal
    robot_state.state = "RETURNING_HOME"
    robot_state.destination = {"x": 1.0, "y": 1.0, "name": "Charging Station"}
    _active_goal = {
        "x": 1.0,
        "y": 1.0,
        "name": "Charging Station",
        "id": 999,
        "timestamp": datetime.utcnow().isoformat()
    }
    await simulator.command_queue.put({"type": "RETURN_HOME"})
    await manager.send_to_robot({
        "type": "command",
        "command": "RETURN_HOME",
        "parameters": robot_state.destination
    })
    await manager.broadcast_to_browsers({
        "type": "navigation_status",
        "data": {
            "status": "RETURNING_HOME",
            "destination": robot_state.destination,
            "progress": 0
        }
    })
    return True

async def handle_goal_reached():
    global _active_goal
    dest_name = robot_state.destination.get("name", "Target") if robot_state.destination else "Target"
    transition("WAITING_AT_DESTINATION")
    _active_goal = None
    robot_state.navigation_progress = 100
    
    # Notify ESP32 to trigger CELEBRATE / HAPPY face
    await manager.send_to_robot({
        "type": "command",
        "command": "GOAL_REACHED",
        "parameters": {"destination": dest_name}
    })

    await manager.broadcast_to_browsers({
        "type": "navigation_status",
        "data": {
            "status": "WAITING_AT_DESTINATION",
            "destination": robot_state.destination,
            "progress": 100
        }
    })

async def wait_and_return(duration_seconds: int):
    await asyncio.sleep(duration_seconds)
    await return_home()

def start_waiting_timer(duration_seconds: int = 300):
    asyncio.create_task(wait_and_return(duration_seconds))

def cancel_waiting_timer():
    pass

async def update_navigation_progress(data: dict):
    if "progress" in data:
        robot_state.navigation_progress = int(data["progress"])
    if "distance_remaining" in data:
        robot_state.distance_remaining = float(data["distance_remaining"])
    if "estimated_time_remaining" in data:
        robot_state.estimated_time_remaining = int(data["estimated_time_remaining"])
        
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

