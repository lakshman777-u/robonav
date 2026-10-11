#!/usr/bin/env python3
import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    bridge_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rviz_config_path = os.path.join(bridge_dir, "config", "ydlidar_rviz2.rviz")
    slam_params_path = os.path.join(bridge_dir, "config", "slam_toolbox_params.yaml")
    receiver_script_path = os.path.join(bridge_dir, "laptop_udp_receiver.py")

    return LaunchDescription([
        # 1. Static TF: odom -> base_link (Identity transform for scan matching without odometry)
        Node(
            package='tf2_ros',
            executable='static_transform_publisher',
            name='static_tf_odom_base',
            arguments=['--x', '0', '--y', '0', '--z', '0',
                       '--roll', '0', '--pitch', '0', '--yaw', '0',
                       '--frame-id', 'odom', '--child-frame-id', 'base_link']
        ),

        # 2. Static TF: base_link -> laser_frame
        Node(
            package='tf2_ros',
            executable='static_transform_publisher',
            name='static_tf_base_laser',
            arguments=['--x', '0', '--y', '0', '--z', '0',
                       '--roll', '0', '--pitch', '0', '--yaw', '0',
                       '--frame-id', 'base_link', '--child-frame-id', 'laser_frame']
        ),

        # 3. YDLIDAR UDP Receiver Bridge (publishes /scan)
        ExecuteProcess(
            cmd=['python3', receiver_script_path],
            output='screen',
            name='ydlidar_udp_receiver'
        ),

        # 4. SLAM Toolbox Online Asynchronous Mapping Node
        Node(
            package='slam_toolbox',
            executable='async_slam_toolbox_node',
            name='slam_toolbox',
            output='screen',
            parameters=[slam_params_path]
        ),

        # 5. RViz2 Visualizer
        Node(
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            arguments=['-d', rviz_config_path],
            output='screen'
        )
    ])

if __name__ == '__main__':
    import sys
    from launch import LaunchService
    ls = LaunchService(argv=sys.argv[1:])
    ls.include_launch_description(generate_launch_description())
    sys.exit(ls.run())
