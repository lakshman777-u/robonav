#!/usr/bin/env bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if [ -f "$DIR/.backend.pid" ]; then
    kill $(cat "$DIR/.backend.pid") 2>/dev/null || true
    rm -f "$DIR/.backend.pid"
fi

if [ -f "$DIR/.frontend.pid" ]; then
    kill $(cat "$DIR/.frontend.pid") 2>/dev/null || true
    rm -f "$DIR/.frontend.pid"
fi

if [ -f "$DIR/.slam.pid" ]; then
    kill $(cat "$DIR/.slam.pid") 2>/dev/null || true
    rm -f "$DIR/.slam.pid"
fi

pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true
pkill -f "ydlidar_direct_driver" 2>/dev/null || true
pkill -f "ros2_to_esp32_bridge" 2>/dev/null || true
pkill -f "async_slam_toolbox" 2>/dev/null || true
pkill -f "lifecycle_manager_slam" 2>/dev/null || true
pkill -f "rviz2" 2>/dev/null || true

echo "RoboNav platform & SLAM stopped."
