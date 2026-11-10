#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Starting RoboNav Autonomous Indoor Robot Platform..."

# Kill any existing instances first
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true
sleep 1

# Start Backend
cd "$DIR/backend"
nohup "$DIR/backend/venv/bin/python" -u -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$DIR/backend/backend.log" 2>&1 &
BACKEND_PID=$!
disown $BACKEND_PID 2>/dev/null || true
echo $BACKEND_PID > "$DIR/.backend.pid"
echo "Backend started (PID: $BACKEND_PID) on http://0.0.0.0:8000"

# Start Frontend
export PATH="/home/obito/.local/share/fnm:$PATH"
if command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
fi
cd "$DIR/frontend"
nohup npx vite --host 0.0.0.0 --port 5173 > "$DIR/frontend/frontend.log" 2>&1 &
FRONTEND_PID=$!
disown $FRONTEND_PID 2>/dev/null || true
echo $FRONTEND_PID > "$DIR/.frontend.pid"
echo "Frontend started (PID: $FRONTEND_PID) on http://0.0.0.0:5173"

# Start ROS 2 Direct YDLIDAR SLAM Bridge (if ROS 2 is installed)
SLAM_PID=""
if [ -f "/opt/ros/lyrical/setup.bash" ] || [ -f "/opt/ros/humble/setup.bash" ]; then
    pkill -f "ydlidar_direct_driver" 2>/dev/null || true
    pkill -f "ros2_to_esp32_bridge" 2>/dev/null || true
    pkill -f "async_slam_toolbox" 2>/dev/null || true
    pkill -f "lifecycle_manager_slam" 2>/dev/null || true
    sleep 0.5
    nohup "$DIR/start_slam_bridge.sh" > "$DIR/slam_bridge.log" 2>&1 &
    SLAM_PID=$!
    disown $SLAM_PID 2>/dev/null || true
    echo $SLAM_PID > "$DIR/.slam.pid"
    echo "SLAM Bridge started (PID: $SLAM_PID) | Logs: $DIR/slam_bridge.log"
fi

echo ""
echo "=========================================================="
echo " RoboNav Autonomous Platform is RUNNING!"
echo " Web UI:     http://localhost:5173"
echo " API Docs:   http://localhost:8000/docs"
if [ -n "$SLAM_PID" ]; then
echo " SLAM Node:  ONLINE (PID: $SLAM_PID) [Motor Facing North]"
fi
echo " Logs:       $DIR/backend/backend.log"
echo "             $DIR/frontend/frontend.log"
echo "             $DIR/slam_bridge.log"
echo " Admin:      admin / admin123"
echo " User:       user / user123"
echo "=========================================================="
