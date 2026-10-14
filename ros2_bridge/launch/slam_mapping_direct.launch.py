#!/usr/bin/env python3
"""
RoboNav Direct SLAM Mapping Launch Script
Launches direct USB YDLIDAR driver, ROS 2-to-ESP32 differential movement bridge,
SLAM Toolbox online async mapping node, and RViz2 visualizer.
"""

import os
import sys
from launch import LaunchDescription
from launch.actions import ExecuteProcess
from launch_ros.actions import Node

def generate_launch_description():
    bridge_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rviz_config_path = os.path.join(bridge_dir, "config", "ydlidar_rviz2.rviz")
    slam_params_path = os.path.join(bridge_dir, "config", "slam_toolbox_params.yaml")
    lidar_driver_script = os.path.join(bridge_dir, "ydlidar_direct_driver.py")
    movement_bridge_script = os.path.join(bridge_dir, "ros2_to_esp32_bridge.py")

    is_mock = ("--mock" in sys.argv or "--demo" in sys.argv)
    lidar_cmd = ["python3", lidar_driver_script, "--mock"] if is_mock else ["python3", lidar_driver_script]

    return LaunchDescription([
        # 1. YDLIDAR Direct Driver Node
        ExecuteProcess(
            cmd=lidar_cmd,
            output="screen",
            name="ydlidar_direct_driver"
        ),

        # 2. ROS 2 to ESP32 Movement Bridge (/cmd_vel & /odom TF)
        ExecuteProcess(
            cmd=["python3", movement_bridge_script],
            output="screen",
            name="ros2_to_esp32_bridge"
        ),

        # 3. SLAM Toolbox Online Asynchronous Mapping Node
        Node(
            package="slam_toolbox",
            executable="async_slam_toolbox_node",
            name="slam_toolbox",
            output="screen",
            parameters=[slam_params_path]
        ),

        # 4. RViz2 Visualizer
        Node(
            package="rviz2",
            executable="rviz2",
            name="rviz2",
            arguments=["-d", rviz_config_path],
            output="screen"
        )
    ])

if __name__ == "__main__":
    from launch import LaunchService
    ls = LaunchService(argv=sys.argv[1:])
    ls.include_launch_description(generate_launch_description())
    sys.exit(ls.run())
