#!/usr/bin/env bash
set -e

# Source ROS 2 environment
if [ -f "/opt/ros/lyrical/setup.bash" ]; then
    source /opt/ros/lyrical/setup.bash
elif [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
fi

echo "=================================================================="
echo " Starting RoboNav YDLIDAR X2 SLAM & RViz2 Wireless Bridge"
echo " Target Laptop IP: 10.166.2.244  |  UDP Port: 4210"
echo "=================================================================="

# Pass arguments (like --mock or --test) if provided
cd "$(dirname "$0")/ros2_bridge"
python3 launch/slam_mapping.launch.py "$@"
