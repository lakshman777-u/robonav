#!/usr/bin/env bash
set -e

# Source ROS 2 environment
if [ -f "/opt/ros/lyrical/setup.bash" ]; then
    source /opt/ros/lyrical/setup.bash
elif [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
fi

echo "=================================================================="
echo " Starting RoboNav Laptop ROS 2 Nav2 Autonomous Navigation Stack"
echo " LiDAR: Direct USB (/dev/ttyUSB0)  |  ESP32: Wireless WebSocket"
echo "=================================================================="

# Ensure no orphaned driver processes hold the serial port
pkill -f "ydlidar_direct_driver" 2>/dev/null || true
pkill -f "ros2_to_esp32_bridge" 2>/dev/null || true
sleep 0.5

cd "$(dirname "$0")/ros2_bridge"
python3 launch/autonomous_nav.launch.py "$@"
