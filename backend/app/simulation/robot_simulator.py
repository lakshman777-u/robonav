import asyncio
import math
import random
import time
from typing import List, Tuple, Dict, Any, Optional
from app.ws.manager import manager
from app.services.path_planner import plan_path

class RobotSimulator:
    def __init__(self):
        self.is_running = False
        self.demo_mode = False
        self.time_scale = 1.0
        
        self.grid_width = 400
        self.grid_height = 300
        self.resolution = 0.05
        
        self.virtual_environment = self._generate_environment()
        self.explored_map = [[-1 for _ in range(self.grid_width)] for _ in range(self.grid_height)]
        
        self.position = {"x": 2.0, "y": 2.0}
        self.orientation = 0.0
        self.velocity = 0.0
        self.battery = 100.0
        
        self.state = "IDLE"
        self.current_path = []
        self.destination = None
        
        self.message_queue = asyncio.Queue()
        self.command_queue = asyncio.Queue()
        
        self.lidar_rays = []
        self.recent_map_updates = []
        
        self.wait_timer = None
        self.mapping_active = False

    def _generate_environment(self) -> List[List[int]]:
        grid = [[0 for _ in range(self.grid_width)] for _ in range(self.grid_height)]
        # Outer walls
        for x in range(self.grid_width):
            grid[0][x] = 100
            grid[self.grid_height - 1][x] = 100
        for y in range(self.grid_height):
            grid[y][0] = 100
            grid[y][self.grid_width - 1] = 100
            
        # Reception (bottom-left)
        for y in range(0, 100):
            grid[y][100] = 100
        for x in range(0, 100):
            grid[100][x] = 100
        for x in range(40, 60):
            grid[100][x] = 0
            
        # Room A (top-left)
        for x in range(0, 120):
            grid[200][x] = 100
        for y in range(200, 300):
            grid[y][120] = 100
        for y in range(240, 260):
            grid[y][120] = 0
            
        # Room B (top-right)
        for x in range(250, 400):
            grid[200][x] = 100
        for y in range(200, 300):
            grid[y][250] = 100
        for x in range(300, 320):
            grid[200][x] = 0
            
        # Room C (bottom-right)
        for x in range(280, 400):
            grid[120][x] = 100
        for y in range(0, 120):
            grid[y][280] = 100
        for y in range(50, 70):
            grid[y][280] = 0
            
        # Meeting room (center)
        for x in range(160, 240):
            grid[120][x] = 100
            grid[180][x] = 100
        for y in range(120, 180):
            grid[y][160] = 100
            grid[y][240] = 100
        for x in range(190, 210):
            grid[120][x] = 0
            
        # Glass walls
        for y in range(130, 170):
            grid[y][160] = 50 
        for x in range(290, 390):
            grid[120][x] = 50 
            
        # Small obstacles
        obstacles = [(130, 150), (260, 150), (140, 80), (250, 250)]
        for ox, oy in obstacles:
            for dy in range(-2, 3):
                for dx in range(-2, 3):
                    if 0 <= ox+dx < 400 and 0 <= oy+dy < 300:
                        grid[oy+dy][ox+dx] = 100
        
        return grid

    async def start(self):
        from app.services.robot_service import transition, robot_state
        self.is_running = True
        self.state = "IDLE"
        # Sync with the global robot state machine
        transition("CONNECTING")
        transition("IDLE")
        robot_state.position = self.position
        robot_state.orientation = self.orientation
        robot_state.battery = self.battery
        asyncio.create_task(self.run())
        
    def stop(self):
        from app.services.robot_service import transition
        self.is_running = False
        self.state = "OFFLINE"
        transition("OFFLINE")
        
    async def process_commands(self):
        while not self.command_queue.empty():
            cmd = self.command_queue.get_nowait()
            ctype = cmd.get("type")
            
            if ctype == "MOVE_FORWARD":
                self.velocity = 0.5
                self.state = "MANUAL_CONTROL"
            elif ctype == "MOVE_BACKWARD":
                self.velocity = -0.3
                self.state = "MANUAL_CONTROL"
            elif ctype == "TURN_LEFT":
                self.orientation = (self.orientation + 15) % 360
            elif ctype == "TURN_RIGHT":
                self.orientation = (self.orientation - 15) % 360
            elif ctype == "STOP":
                self.velocity = 0.0
                if self.state == "MANUAL_CONTROL" or self.state == "NAVIGATING":
                    self.state = "IDLE"
                self.current_path = []
            elif ctype == "START_MAPPING":
                self.mapping_active = True
                self.state = "MAPPING"
                self.velocity = 0.0
            elif ctype == "STOP_MAPPING":
                self.mapping_active = False
                self.state = "MAP_READY"
                self.velocity = 0.0
            elif ctype == "GO_TO_DESTINATION":
                self.destination = cmd.get("destination")
                start = (self.position["x"], self.position["y"])
                goal = (self.destination["x"], self.destination["y"])
                plan = plan_path(self.virtual_environment, start, goal, self.resolution)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                else:
                    self.current_path = [goal]
                self.state = "NAVIGATING"
                self.wait_timer = None
            elif ctype == "RETURN_HOME":
                self.destination = {"x": 2.0, "y": 2.0, "name": "Charging Station", "id": "home"}
                start = (self.position["x"], self.position["y"])
                goal = (self.destination["x"], self.destination["y"])
                plan = plan_path(self.virtual_environment, start, goal, self.resolution)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                else:
                    self.current_path = [goal]
                self.state = "RETURNING_HOME"
                self.wait_timer = None
            elif ctype == "EMERGENCY_STOP":
                self.velocity = 0.0
                self.current_path = []
                self.state = "EMERGENCY_STOP"
                self.wait_timer = None

    def _sync_robot_state(self):
        """Keep global robot_state in sync with simulator state."""
        from app.services.robot_service import robot_state
        robot_state.state = self.state
        robot_state.position = self.position
        robot_state.orientation = self.orientation
        robot_state.battery = self.battery
        robot_state.velocity = self.velocity
        robot_state.destination = self.destination
        robot_state.current_path = self.current_path

    async def run(self):
        while self.is_running:
            await self.process_commands()
            
            self._update_battery()
            self._update_movement()
            self._update_slam()
            self._update_waiting()
            self._sync_robot_state()
            
            await self._send_status()
            await self._send_sensor_data()
            if self.mapping_active and self.recent_map_updates:
                await self._send_map_update()
            
            if self.mapping_active:
                coverage = sum(1 for row in self.explored_map for val in row if val != -1) / (self.grid_width * self.grid_height) * 100
                await self._send_event("mapping_progress", {"stage": "mapping", "coverage": coverage})
                
            await asyncio.sleep(0.1 / self.time_scale)
            
    def _update_battery(self):
        if self.velocity != 0:
            self.battery -= 0.05 * 0.1 * self.time_scale
        elif self.state == "CHARGING":
            self.battery += 0.2 * 0.1 * self.time_scale
            if self.battery >= 100:
                self.battery = 100
                self.state = "IDLE"
        elif self.state == "IDLE" and self.battery < 20 and math.hypot(self.position["x"] - 2.0, self.position["y"] - 2.0) < 0.2:
            self.state = "CHARGING"
        self.battery = max(0, min(100, self.battery))
        
    def _update_movement(self):
        if self.state in ["NAVIGATING", "RETURNING_HOME"]:
            if random.random() < (0.1 * 0.1): # 10% per sec
                self.state = "OBSTACLE_DETECTED"
                self.velocity = 0.0
                asyncio.create_task(self._handle_obstacle())
                return
                
            if self.current_path:
                target = self.current_path[0]
                dx = target[0] - self.position["x"]
                dy = target[1] - self.position["y"]
                dist = math.hypot(dx, dy)
                
                if dist < 0.1:
                    self.current_path.pop(0)
                    if not self.current_path:
                        self.velocity = 0.0
                        if self.state == "RETURNING_HOME":
                            self.state = "CHARGING"
                        else:
                            self.state = "WAITING_AT_DESTINATION"
                            self.wait_timer = time.time()
                        asyncio.create_task(self._send_event("destination_reached", {"destination_id": self.destination.get("id", "0"), "destination_name": self.destination.get("name", "Unknown")}))
                else:
                    self.velocity = 0.3
                    self.orientation = math.degrees(math.atan2(dy, dx))
                    move_dist = self.velocity * 0.1 * self.time_scale
                    if move_dist > dist:
                        move_dist = dist
                    
                    new_x = self.position["x"] + math.cos(math.radians(self.orientation)) * move_dist
                    new_y = self.position["y"] + math.sin(math.radians(self.orientation)) * move_dist
                    
                    if not self._check_collision(new_x, new_y):
                        self.position["x"] = new_x
                        self.position["y"] = new_y
                    else:
                        self.state = "OBSTACLE_DETECTED"
                        self.velocity = 0.0
                        asyncio.create_task(self._handle_obstacle())
                        
        elif self.state == "MANUAL_CONTROL":
            if self.velocity != 0:
                move_dist = self.velocity * 0.1 * self.time_scale
                new_x = self.position["x"] + math.cos(math.radians(self.orientation)) * move_dist
                new_y = self.position["y"] + math.sin(math.radians(self.orientation)) * move_dist
                
                if not self._check_collision(new_x, new_y):
                    self.position["x"] = new_x
                    self.position["y"] = new_y

    async def _handle_obstacle(self):
        await self._send_event("obstacle_detected", {"sensor": "lidar", "distance": 0.5, "obstacle_type": "dynamic"})
        await asyncio.sleep(2.0)
        if self.state == "OBSTACLE_DETECTED":
            if self.destination:
                start = (self.position["x"], self.position["y"])
                goal = (self.destination["x"], self.destination["y"])
                plan = plan_path(self.virtual_environment, start, goal, self.resolution)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                    self.state = "NAVIGATING" if self.destination.get("id") != "home" else "RETURNING_HOME"
                else:
                    self.state = "IDLE"

    def _check_collision(self, x: float, y: float) -> bool:
        grid_x = int(x / self.resolution)
        grid_y = int(y / self.resolution)
        if 0 <= grid_x < self.grid_width and 0 <= grid_y < self.grid_height:
            return self.virtual_environment[grid_y][grid_x] >= 50
        return True

    def _update_slam(self):
        self.lidar_rays = []
        max_range = 8.0
        grid_x = int(self.position["x"] / self.resolution)
        grid_y = int(self.position["y"] / self.resolution)
        
        self.recent_map_updates = []
        
        for angle_deg in range(360):
            angle_rad = math.radians(angle_deg)
            cos_a = math.cos(angle_rad)
            sin_a = math.sin(angle_rad)
            
            dist = 0.0
            hit = False
            
            while dist < max_range:
                check_x = int((self.position["x"] + dist * cos_a) / self.resolution)
                check_y = int((self.position["y"] + dist * sin_a) / self.resolution)
                
                if 0 <= check_x < self.grid_width and 0 <= check_y < self.grid_height:
                    val = self.virtual_environment[check_y][check_x]
                    
                    if self.mapping_active:
                        if self.explored_map[check_y][check_x] != val:
                            self.explored_map[check_y][check_x] = val
                            self.recent_map_updates.append({"x": check_x, "y": check_y, "val": val})
                    
                    if val >= 50:
                        hit = True
                        break
                else:
                    break
                dist += self.resolution
            self.lidar_rays.append({"angle": angle_deg, "distance": dist})

    def _update_waiting(self):
        if self.state == "WAITING_AT_DESTINATION" and self.wait_timer:
            wait_time = 30 if self.demo_mode else 300
            if time.time() - self.wait_timer > wait_time:
                self.command_queue.put_nowait({"type": "RETURN_HOME"})
                self.wait_timer = None

    async def _send_status(self):
        progress = 0
        rem_dist = 0
        if self.current_path:
            rem_dist = len(self.current_path) * 0.1
            progress = max(0, min(100, 100 - (rem_dist / max(1, rem_dist + 5)) * 100))
            
        msg = {
            "type": "robot_status",
            "data": {
                "robot_id": "ROBOT-001",
                "state": self.state,
                "position": self.position,
                "orientation": self.orientation,
                "velocity": self.velocity,
                "battery": self.battery,
                "charging": self.state == "CHARGING",
                "current_destination": self.destination,
                "navigation_progress": progress,
                "distance_remaining": rem_dist,
                "estimated_time_remaining": rem_dist / max(0.1, abs(self.velocity)) if self.velocity != 0 else 0
            }
        }
        await manager.broadcast_to_browsers(msg)
        
        if self.state in ["NAVIGATING", "RETURNING_HOME"]:
            nav_msg = {
                "type": "navigation_status",
                "data": {
                    "status": "active",
                    "progress": progress,
                    "distance_remaining": rem_dist,
                    "estimated_time": rem_dist / max(0.1, abs(self.velocity)) if self.velocity != 0 else 0
                }
            }
            await manager.broadcast_to_browsers(nav_msg)
        
    async def _send_sensor_data(self):
        msg = {
            "type": "sensor_data",
            "data": {
                "lidar": {
                    "active": True,
                    "scan_rate": 10,
                    "points": len(self.lidar_rays),
                    "range": 8.0,
                    "rays": self.lidar_rays
                },
                "camera": {
                    "connected": True,
                    "obstacle_detected": self.state == "OBSTACLE_DETECTED",
                    "obstacle_type": "dynamic",
                    "distance": 0.5
                },
                "ultrasonic": {
                    "front": random.uniform(0.5, 2.0),
                    "left": random.uniform(0.5, 2.0),
                    "right": random.uniform(0.5, 2.0),
                    "rear": random.uniform(0.5, 2.0)
                },
                "glass_detected": any(r['distance'] < 2.0 for r in self.lidar_rays)
            }
        }
        await manager.broadcast_to_browsers(msg)
        
    async def _send_map_update(self):
        coverage = sum(1 for row in self.explored_map for val in row if val != -1) / (self.grid_width * self.grid_height) * 100
        msg = {
            "type": "map_update",
            "data": {
                "cells": self.recent_map_updates,
                "coverage": coverage
            }
        }
        await manager.broadcast_to_browsers(msg)
        self.recent_map_updates = []

    async def _send_event(self, event_type: str, data: dict):
        msg = {
            "type": event_type,
            "data": data
        }
        await manager.broadcast_to_browsers(msg)
        
        log = {
            "type": "log_event",
            "data": {
                "timestamp": time.time(),
                "event_type": event_type,
                "message": str(data)
            }
        }
        await manager.broadcast_to_browsers(log)

simulator = RobotSimulator()
