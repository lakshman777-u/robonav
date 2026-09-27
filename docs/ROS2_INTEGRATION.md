# ROS 2 Integration

This document outlines the planned future integration of RoboNav with ROS 2 (Robot Operating System).

## Architecture

To fully leverage ROS 2 for SLAM and navigation, we will use a bridging architecture.
The ROS 2 node running on the Raspberry Pi will bridge data to the Python WebSocket client.

- **ROS 2 Node**: Handles low-level hardware integration, SLAM (using `slam_toolbox`), and navigation (using `nav2`).
- **WebSocket Client**: Subscribes to ROS 2 topics and forwards telemetry, map data, and state over WebSockets to the RoboNav backend.

The RoboNav backend and web interface do not need any ROS 2 installation.

## Topics Mapping

| ROS 2 Topic | WebSocket Message Type | Direction |
|-------------|------------------------|-----------|
| `/scan` | `lidar_scan` | Pi -> Server |
| `/tf` | `position_update` | Pi -> Server |
| `/odom` | `robot_status` (velocity) | Pi -> Server |
| `/map` | `map_update` | Pi -> Server |
| `/cmd_vel` | `manual_command` | Server -> Pi |
| `/goal_pose` | `navigation_goal` | Server -> Pi |

## Recommended Packages
- `ros2_ws` (core ROS 2 workspace)
- `nav2` (Navigation 2 stack)
- `slam_toolbox` (SLAM and mapping)
- `rclpy` (Python ROS 2 client library for our bridge script)

## Example Bridge Node Pseudocode

```python
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import LaserScan
from geometry_msgs.msg import Twist

class WebSocketBridgeNode(Node):
    def __init__(self, ws_client):
        super().__init__('websocket_bridge')
        self.ws_client = ws_client
        self.subscription = self.create_subscription(
            LaserScan,
            '/scan',
            self.scan_callback,
            10
        )
        self.publisher = self.create_publisher(Twist, '/cmd_vel', 10)

    def scan_callback(self, msg):
        # Convert LaserScan to list of rays and forward over WebSocket
        rays = [{"angle": i, "distance": d} for i, d in enumerate(msg.ranges)]
        self.ws_client.send_lidar_scan(rays)

    def send_cmd_vel(self, linear, angular):
        twist = Twist()
        twist.linear.x = linear
        twist.angular.z = angular
        self.publisher.publish(twist)
```
