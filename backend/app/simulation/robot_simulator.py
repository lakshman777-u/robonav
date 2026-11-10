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
        
        self.grid_width = 600
        self.grid_height = 600
        self.resolution = 0.05
        self.origin_x = -15.0
        self.origin_y = -15.0
        
        self.virtual_environment = self._generate_environment()
        self.explored_map = [[-1 for _ in range(self.grid_width)] for _ in range(self.grid_height)]
        
        self.position = {"x": 0.0, "y": 0.0}
        self.orientation = 90.0
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
        self.tour_active = False
        self.tour_step = 0
        self.tour_waypoints = [
            {"x": 0.0, "y": 0.0, "name": "HOME (0,0)", "id": "home"},
            {"x": 2.0, "y": -3.5, "name": "Bedroom 2", "id": "bedroom2"},
            {"x": 5.5, "y": -3.5, "name": "Bathroom", "id": "bathroom"},
            {"x": 1.0, "y": 0.0, "name": "Hallway (LC1)", "id": "lc1"},
            {"x": 9.5, "y": 3.0, "name": "Master Bedroom", "id": "master_bedroom"},
            {"x": 9.5, "y": -1.5, "name": "Closet", "id": "closet"},
            {"x": 6.5, "y": 0.5, "name": "Hallway (LC2)", "id": "lc2"},
            {"x": 2.5, "y": 4.0, "name": "Kitchen", "id": "kitchen"},
            {"x": -2.5, "y": 3.5, "name": "Dining Area", "id": "dining"},
            {"x": -6.0, "y": -2.5, "name": "Living Room", "id": "living_room"},
            {"x": -3.5, "y": 0.0, "name": "Hallway (LC3)", "id": "lc3"},
            {"x": 0.0, "y": 0.0, "name": "HOME (0,0)", "id": "home"}
        ]
        self.loop_closures = [
            {"id": "LC1", "x": 1.0, "y": 0.0, "label": "LC1"},
            {"id": "LC2", "x": 6.5, "y": 0.5, "label": "LC2"},
            {"id": "LC3", "x": -3.5, "y": 0.0, "label": "LC3"}
        ]
        self.rooms = [
            {"name": "Living Room", "x": -6.0, "y": -2.5},
            {"name": "Dining Area", "x": -2.5, "y": 3.5},
            {"name": "Kitchen", "x": 2.5, "y": 4.5},
            {"name": "Hallway", "x": 4.0, "y": 0.0},
            {"name": "Entryway", "x": -1.0, "y": -4.0},
            {"name": "Bedroom 2", "x": 2.0, "y": -3.5},
            {"name": "Bathroom", "x": 5.5, "y": -3.5},
            {"name": "Master Bedroom", "x": 9.5, "y": 3.0},
            {"name": "Closet", "x": 9.5, "y": -1.5},
            {"name": "Utility Room", "x": 9.5, "y": -4.5},
            {"name": "Bedroom 2 (North)", "x": -6.5, "y": 3.5},
            {"name": "Shower", "x": -4.0, "y": 4.5}
        ]

    def _generate_environment(self) -> List[List[int]]:
        grid = [[0 for _ in range(self.grid_width)] for _ in range(self.grid_height)]
        
        def to_gx(wx: float) -> int:
            return max(0, min(self.grid_width - 1, int((wx - self.origin_x) / self.resolution)))
            
        def to_gy(wy: float) -> int:
            return max(0, min(self.grid_height - 1, int((wy - self.origin_y) / self.resolution)))

        def h_wall(wx1: float, wx2: float, wy: float, thick: int = 2):
            gx1, gx2 = sorted([to_gx(wx1), to_gx(wx2)])
            gy = to_gy(wy)
            for x in range(gx1, gx2 + 1):
                for t in range(thick):
                    if 0 <= gy + t < self.grid_height:
                        grid[gy + t][x] = 100

        def v_wall(wx: float, wy1: float, wy2: float, thick: int = 2):
            gy1, gy2 = sorted([to_gy(wy1), to_gy(wy2)])
            gx = to_gx(wx)
            for y in range(gy1, gy2 + 1):
                for t in range(thick):
                    if 0 <= gx + t < self.grid_width:
                        grid[y][gx + t] = 100

        def clear_rect(wx1: float, wy1: float, wx2: float, wy2: float):
            gx1, gx2 = sorted([to_gx(wx1), to_gx(wx2)])
            gy1, gy2 = sorted([to_gy(wy1), to_gy(wy2)])
            for y in range(gy1, gy2 + 1):
                for x in range(gx1, gx2 + 1):
                    grid[y][x] = 0

        # 1. House Outer Perimeter Walls (24m x 12m)
        h_wall(-12.0, 12.0, -6.0)  # South exterior
        h_wall(-12.0, 12.0, 6.0)   # North exterior
        v_wall(-12.0, -6.0, 6.0)   # West exterior
        v_wall(12.0, -6.0, 6.0)    # East exterior

        # 2. Main Interior Dividing Walls
        # Left Wing Divider (x = -4.0)
        v_wall(-4.0, -6.0, 6.0)
        # Doorway into Living Room (South)
        clear_rect(-4.3, -2.5, -3.7, -1.0)
        # Doorway into Dining Area (North)
        clear_rect(-4.3, 1.5, -3.7, 3.0)

        # Living Room & Dining Area partition (y = 0.5)
        h_wall(-12.0, -4.0, 0.5)
        # Open archway between Living & Dining
        clear_rect(-8.5, 0.2, -7.0, 0.8)

        # North Bedroom partition (y = 3.5)
        h_wall(-12.0, -4.0, 3.5)
        clear_rect(-7.0, 3.2, -6.0, 3.8)

        # Entryway East Wall (x = 0.0)
        v_wall(0.0, -6.0, -1.0)
        clear_rect(-0.3, -3.5, 0.3, -2.5)

        # Kitchen / Central Hallway Boundaries (y = 1.0)
        h_wall(-4.0, 7.0, 1.0)
        # Wide kitchen entrance from hallway
        clear_rect(1.0, 0.7, 3.5, 1.3)

        # Central Hallway South Wall (y = -1.0)
        h_wall(-4.0, 7.0, -1.0)
        # Doorway from Hallway to Entryway
        clear_rect(-2.5, -1.3, -1.0, -0.7)
        # Doorway from Hallway to Bedroom 2
        clear_rect(1.5, -1.3, 2.5, -0.7)
        # Doorway from Hallway to Bathroom
        clear_rect(4.5, -1.3, 5.5, -0.7)

        # Divider between Bedroom 2 and Bathroom (x = 3.5)
        v_wall(3.5, -6.0, -1.0)

        # Right Wing Divider (x = 7.0)
        v_wall(7.0, -6.0, 6.0)
        # Hallway entry into Master Suite
        clear_rect(6.7, -0.5, 7.3, 1.0)

        # Master Bedroom & Closet divider (y = 0.5)
        h_wall(7.0, 12.0, 0.5)
        clear_rect(8.5, 0.2, 9.5, 0.8)

        # Closet & Utility Room divider (y = -3.0)
        h_wall(7.0, 12.0, -3.0)
        clear_rect(9.0, -3.3, 10.0, -2.7)

        # Furniture & Structural obstacles
        # Living room couch / table
        for y in range(to_gy(-3.5), to_gy(-2.5)):
            for x in range(to_gx(-8.5), to_gx(-7.0)):
                grid[y][x] = 100
        # Kitchen island
        for y in range(to_gy(3.0), to_gy(4.0)):
            for x in range(to_gx(1.5), to_gx(2.5)):
                grid[y][x] = 100
        # Master bed
        for y in range(to_gy(3.5), to_gy(5.0)):
            for x in range(to_gx(9.5), to_gx(11.0)):
                grid[y][x] = 100

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
                plan = plan_path(self.virtual_environment, start, goal, self.resolution, self.origin_x, self.origin_y)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                else:
                    self.current_path = [goal]
                self.state = "NAVIGATING"
                self.wait_timer = None
            elif ctype == "RETURN_HOME":
                self.destination = {"x": 0.0, "y": 0.0, "name": "HOME (0,0)", "id": "home"}
                start = (self.position["x"], self.position["y"])
                goal = (self.destination["x"], self.destination["y"])
                plan = plan_path(self.virtual_environment, start, goal, self.resolution, self.origin_x, self.origin_y)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                else:
                    self.current_path = [goal]
                self.state = "RETURNING_HOME"
                self.wait_timer = None
            elif ctype == "START_TOUR":
                self.tour_active = True
                self.tour_step = 0
                self._dispatch_next_tour_step()
            elif ctype == "STOP_TOUR":
                self.tour_active = False
                self.state = "IDLE"
                self.velocity = 0.0
                self.current_path = []
            elif ctype in ["U_TURN_LEFT", "U_TURN_RIGHT"]:
                turn_deg = 180 if ctype == "U_TURN_LEFT" else -180
                self.orientation = (self.orientation + turn_deg) % 360
            elif ctype == "EMERGENCY_STOP":
                self.velocity = 0.0
                self.current_path = []
                self.state = "EMERGENCY_STOP"
                self.wait_timer = None
                self.tour_active = False

    def _dispatch_next_tour_step(self):
        if not self.tour_active or not self.tour_waypoints:
            return
        dest = self.tour_waypoints[self.tour_step]
        self.destination = dest
        start = (self.position["x"], self.position["y"])
        goal = (dest["x"], dest["y"])
        plan = plan_path(self.virtual_environment, start, goal, self.resolution, self.origin_x, self.origin_y)
        if plan and plan.get("path"):
            self.current_path = plan["path"]
        else:
            self.current_path = [goal]
        self.state = "NAVIGATING"
        self.wait_timer = None
        from app.api.robot import speed_control_state
        speed_control_state["oled_expression"] = "LOOKING AHEAD"
        speed_control_state["current_direction"] = "FORWARD"

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

            from app.api.robot import bridge_metrics
            is_hardware_active = (time.time() - bridge_metrics["last_seen"] < 4.0) if bridge_metrics["last_seen"] > 0 else False
            if is_hardware_active and not self.tour_active:
                # Real hardware LiDAR is active; yield sensor overwrite to real LiDAR telemetry
                await asyncio.sleep(0.1)
                continue
            
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
            if self.demo_mode and random.random() < 0.01:
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
                plan = plan_path(self.virtual_environment, start, goal, self.resolution, self.origin_x, self.origin_y)
                if plan and plan.get("path"):
                    self.current_path = plan["path"]
                    self.state = "NAVIGATING" if self.destination.get("id") != "home" else "RETURNING_HOME"
                else:
                    self.state = "IDLE"

    def _check_collision(self, x: float, y: float) -> bool:
        grid_x = int((x - self.origin_x) / self.resolution)
        grid_y = int((y - self.origin_y) / self.resolution)
        if 0 <= grid_x < self.grid_width and 0 <= grid_y < self.grid_height:
            return self.virtual_environment[grid_y][grid_x] >= 50
        return True

    def _update_slam(self):
        self.lidar_rays = []
        max_range = 8.0
        self.recent_map_updates = []
        
        for angle_deg in range(360):
            world_angle_rad = math.radians((self.orientation + angle_deg) % 360)
            cos_a = math.cos(world_angle_rad)
            sin_a = math.sin(world_angle_rad)
            
            dist = 0.0
            hit = False
            
            while dist < max_range:
                curr_x = self.position["x"] + dist * cos_a
                curr_y = self.position["y"] + dist * sin_a
                check_x = int((curr_x - self.origin_x) / self.resolution)
                check_y = int((curr_y - self.origin_y) / self.resolution)
                
                if 0 <= check_x < self.grid_width and 0 <= check_y < self.grid_height:
                    val = self.virtual_environment[check_y][check_x]
                    if val >= 50:
                        hit = True
                        break
                else:
                    break
                dist += self.resolution
            self.lidar_rays.append({"angle": float(angle_deg), "distance": round(dist, 3)})

        import app.api.robot as api_robot
        api_robot.latest_lidar_rays = self.lidar_rays

        if self.mapping_active:
            from app.services.mapping_service import process_lidar_points
            process_lidar_points(self.lidar_rays, self.position, self.orientation)

    def _update_waiting(self):
        if self.state == "WAITING_AT_DESTINATION" and self.wait_timer:
            wait_time = 3.0 if self.tour_active else (5.0 if self.demo_mode else 15.0)
            if time.time() - self.wait_timer > wait_time:
                self.wait_timer = None
                if self.tour_active:
                    self.tour_step = (self.tour_step + 1) % len(self.tour_waypoints)
                    self._dispatch_next_tour_step()
                else:
                    self.command_queue.put_nowait({"type": "RETURN_HOME"})

    async def _send_status(self):
        from app.services.video_service import video_service
        video_service.set_sim_context(self.orientation, self.velocity, sim_mode=True)
        
        progress = 0
        rem_dist = 0
        if self.current_path:
            rem_dist = len(self.current_path) * 0.1
            progress = max(0, min(100, 100 - (rem_dist / max(1, rem_dist + 5)) * 100))
            
        msg = {
            "type": "robot_status",
            "data": {
                "robot_id": "ESP32CAM-001",
                "state": self.state,
                "connection_status": "ONLINE",
                "position": self.position,
                "orientation": self.orientation,
                "velocity": self.velocity,
                "battery": self.battery,
                "charging": self.state == "CHARGING",
                "current_destination": self.destination,
                "navigation_progress": progress,
                "distance_remaining": rem_dist,
                "estimated_time_remaining": rem_dist / max(0.1, abs(self.velocity)) if self.velocity != 0 else 0,
                "origin_x": self.origin_x,
                "origin_y": self.origin_y,
                "loop_closures": self.loop_closures,
                "rooms": self.rooms,
                "lidar": {
                    "active": True,
                    "scan_rate": 10,
                    "points": len(self.lidar_rays),
                    "range": 8.0,
                    "rays": self.lidar_rays,
                    "status": "ACTIVE"
                },
                "trajectory": [
                    {"x": p[0], "y": p[1]} for p in (self.current_path[:20] if self.current_path else [])
                ],
                "hardware": {
                    "pc_server": "ONLINE",
                    "esp32": "ONLINE",
                    "websocket": "CONNECTED",
                    "camera": "STREAMING",
                    "lidar": "ACTIVE",
                    "ultrasonic": "ACTIVE",
                    "motor_controller": "READY"
                }
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
        from app.services.video_service import video_service
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
                    "obstacle_detected": self.state == "OBSTACLE_DETECTED" or video_service.cv_obstacle_detected,
                    "obstacle_type": "dynamic" if self.state == "OBSTACLE_DETECTED" else video_service.cv_obstacle_type,
                    "distance": 0.5
                },
                "ultrasonic": {
                    "front": round(random.uniform(0.8, 1.9), 2),
                    "left": round(random.uniform(1.2, 2.5), 2),
                    "right": round(random.uniform(1.0, 2.2), 2),
                    "rear": round(random.uniform(1.5, 3.0), 2)
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
                "updates": self.recent_map_updates,
                "width": self.grid_width,
                "height": self.grid_height,
                "coverage": coverage,
                "origin_x": self.origin_x,
                "origin_y": self.origin_y,
                "loop_closures": self.loop_closures,
                "rooms": self.rooms
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
