# WebSocket Protocol

## Robot → Server Messages

- **heartbeat**: `{"type": "heartbeat", "robot_id": "...", "timestamp": "..."}`
- **robot_status**: `{"type": "robot_status", "robot_id": "...", "battery": 85, "state": "idle", "position": {...}, "orientation": 0, "velocity": 0, "destination": null}`
- **sensor_data**: `{"type": "sensor_data", "lidar": {...}, "camera": {...}, "ultrasonic": {...}}`
- **lidar_scan**: `{"type": "lidar_scan", "rays": [{"angle": 0, "distance": 1.2}, ...]}`
- **map_update**: `{"type": "map_update", "cells": [{"x": 1, "y": 2, "value": 100}], "coverage": 85}`
- **obstacle_detected**: `{"type": "obstacle_detected", "sensor": "lidar", "distance": 0.5, "obstacle_type": "wall"}`
- **navigation_status**: `{"type": "navigation_status", "status": "navigating", "progress": 50, "distance_remaining": 2.5, "estimated_time": 10}`
- **destination_reached**: `{"type": "destination_reached", "destination_id": "dest-1", "destination_name": "Kitchen"}`
- **battery_update**: `{"type": "battery_update", "percentage": 85, "charging": false}`
- **error**: `{"type": "error", "code": 500, "message": "Internal error"}`

## Server → Robot Messages

- **manual_command**: `{"type": "manual_command", "command": "MOVE_FORWARD", "speed": 0.5}`
- **navigation_goal**: `{"type": "navigation_goal", "destination_id": "dest-1", "destination_name": "Kitchen", "path": [...], "x": 1.0, "y": 2.0}`
- **start_mapping**: `{"type": "start_mapping", "map_id": "map-1"}`
- **stop_mapping**: `{"type": "stop_mapping"}`
- **emergency_stop**: `{"type": "emergency_stop"}`
- **return_home**: `{"type": "return_home"}`
- **pause**: `{"type": "pause"}`
- **resume**: `{"type": "resume"}`

## Server → Browser Messages

Same as Robot → Server (forwarded), plus:
- **command_ack**: `{"type": "command_ack", "command": "MOVE_FORWARD", "status": "success"}`
- **log_event**: `{"type": "log_event", "timestamp": "...", "event_type": "info", "message": "Started moving"}`
- **navigation_path**: `{"type": "navigation_path", "path": [...], "distance": 2.5, "estimated_time": 10}`
- **mapping_progress**: `{"type": "mapping_progress", "stage": "exploring", "coverage": 50}`
