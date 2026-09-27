import asyncio
from typing import Dict, Any, Optional

class RobotState:
    def __init__(self):
        self.state = "OFFLINE"
        self.position = {"x": 0.0, "y": 0.0}
        self.orientation = 0.0
        self.battery = 100.0
        self.velocity = 0.0
        self.destination = None
        self.current_path = []
        self.map_id = None
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "state": self.state,
            "position": self.position,
            "orientation": self.orientation,
            "battery": self.battery,
            "velocity": self.velocity,
            "destination": self.destination
        }

VALID_TRANSITIONS = {
    "OFFLINE": ["CONNECTING"],
    "CONNECTING": ["IDLE", "OFFLINE", "ERROR"],
    "IDLE": ["MAPPING", "MANUAL_CONTROL", "WAITING_FOR_DESTINATION", "NAVIGATING", "CHARGING", "OFFLINE"],
    "MAPPING": ["IDLE", "MAP_READY", "EMERGENCY_STOP", "OFFLINE"],
    "MAP_READY": ["IDLE", "WAITING_FOR_DESTINATION", "NAVIGATING", "RETURNING_HOME", "OFFLINE"],
    "MANUAL_CONTROL": ["IDLE", "EMERGENCY_STOP", "OFFLINE"],
    "WAITING_FOR_DESTINATION": ["NAVIGATING", "IDLE", "RETURNING_HOME", "OFFLINE"],
    "NAVIGATING": ["OBSTACLE_DETECTED", "WAITING_AT_DESTINATION", "EMERGENCY_STOP", "ERROR", "OFFLINE", "IDLE"],
    "OBSTACLE_DETECTED": ["NAVIGATING", "EMERGENCY_STOP", "ERROR", "IDLE", "OFFLINE"],
    "WAITING_AT_DESTINATION": ["NAVIGATING", "RETURNING_HOME", "IDLE", "OFFLINE"],
    "RETURNING_HOME": ["CHARGING", "OBSTACLE_DETECTED", "EMERGENCY_STOP", "ERROR", "OFFLINE"],
    "CHARGING": ["IDLE", "MAPPING", "MANUAL_CONTROL", "OFFLINE"],
    "EMERGENCY_STOP": ["IDLE", "MANUAL_CONTROL", "OFFLINE"],
    "ERROR": ["IDLE", "OFFLINE"]
}

robot_state = RobotState()
waiting_timer_task: Optional[asyncio.Task] = None

def transition(new_state: str) -> bool:
    global robot_state
    if new_state in VALID_TRANSITIONS.get(robot_state.state, []) or new_state == "OFFLINE":
        robot_state.state = new_state
        return True
    return False

def get_status() -> Dict[str, Any]:
    global robot_state
    return robot_state.to_dict()

def handle_emergency_stop() -> bool:
    return transition("EMERGENCY_STOP")

def handle_resume() -> bool:
    return transition("IDLE")
