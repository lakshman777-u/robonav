#!/usr/bin/env python3
"""
RoboNav Nav2 Autonomous Navigation Launch Script
Launches direct USB YDLIDAR driver, ROS 2-to-ESP32 movement bridge,
Nav2 Bringup stack (AMCL, Costmaps, DWB Controller, Navfn Planner),
and RViz2 with Nav2 goal tools.
"""

import os
import sys
from launch import LaunchDescription
from launch.actions import ExecuteProcess, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch_ros.actions import Node

def generate_launch_description():
    bridge_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rviz_config_path = os.path.join(bridge_dir, "config", "ydlidar_rviz2.rviz")
    nav2_params_path = os.path.join(bridge_dir, "config", "nav2_params.yaml")
    lidar_driver_script = os.path.join(bridge_dir, "ydlidar_direct_driver.py")
    movement_bridge_script = os.path.join(bridge_dir, "ros2_to_esp32_bridge.py")

    # Default map path
    map_yaml_file = os.path.join(bridge_dir, "maps", "robonav_map.yaml")
    for i, a in enumerate(sys.argv):
        if a == "--map" and i + 1 < len(sys.argv):
            map_yaml_file = sys.argv[i + 1]

    is_mock = ("--mock" in sys.argv or "--demo" in sys.argv)
    lidar_cmd = ["python3", lidar_driver_script, "--mock"] if is_mock else ["python3", lidar_driver_script]

    nav2_bringup_launch_dir = "/opt/ros/lyrical/share/nav2_bringup/launch"
    bringup_launch_file = os.path.join(nav2_bringup_launch_dir, "bringup_launch.py")

    actions = [
        # 1. YDLIDAR Direct Driver
        ExecuteProcess(
            cmd=lidar_cmd,
            output="screen",
            name="ydlidar_direct_driver"
        ),

        # 2. ROS 2 to ESP32 Movement Bridge
        ExecuteProcess(
            cmd=["python3", movement_bridge_script],
            output="screen",
            name="ros2_to_esp32_bridge"
        ),

        # 3. RViz2 Visualizer
        Node(
            package="rviz2",
            executable="rviz2",
            name="rviz2",
            arguments=["-d", rviz_config_path],
            output="screen"
        )
    ]

    # Include Nav2 Bringup if map exists or launch file is present
    if os.path.exists(bringup_launch_file):
        actions.append(
            IncludeLaunchDescription(
                PythonLaunchDescriptionSource(bringup_launch_file),
                launch_arguments={
                    "map": map_yaml_file,
                    "params_file": nav2_params_path,
                    "use_sim_time": "False",
                    "autostart": "True"
                }.items()
            )
        )

    return LaunchDescription(actions)

if __name__ == "__main__":
    from launch import LaunchService
    ls = LaunchService(argv=sys.argv[1:])
    ls.include_launch_description(generate_launch_description())
    sys.exit(ls.run())
