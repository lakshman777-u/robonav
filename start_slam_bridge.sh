#!/usr/bin/env bash
set -e

# Clear any active virtualenv that could conflict with system ROS 2 libraries
if [ -n "$VIRTUAL_ENV" ]; then
    unset VIRTUAL_ENV
    export PATH=$(echo "$PATH" | sed -e 's|[^:]*venv[^:]*:*||g')
fi

# Source ROS 2 environment
if [ -f "/opt/ros/lyrical/setup.bash" ]; then
    source /opt/ros/lyrical/setup.bash
elif [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
fi

echo "=================================================================="
echo " Starting RoboNav Laptop Direct USB YDLIDAR X2 SLAM & RViz2"
echo " LiDAR: Direct USB (/dev/ttyUSB0)  |  ESP32: Wireless WebSocket"
echo "=================================================================="

# Ensure no orphaned processes hold ports or serial devices
pkill -f "laptop_udp_receiver" 2>/dev/null || true
pkill -f "ydlidar_direct_driver" 2>/dev/null || true
pkill -f "ros2_to_esp32_bridge" 2>/dev/null || true
pkill -f "async_slam_toolbox" 2>/dev/null || true
pkill -f "lifecycle_manager_slam" 2>/dev/null || true
sleep 0.5

# Pass arguments (like --mock or --port /dev/ttyUSB1) if provided
cd "$(dirname "$0")/ros2_bridge"
/usr/bin/python3 launch/slam_mapping_direct.launch.py "$@"
