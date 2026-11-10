#!/usr/bin/env python3
"""
RoboNav ROS 2 /cmd_vel to ESP32 Differential Drive Movement Bridge
Subscribes to Nav2 /cmd_vel velocity commands (Twist / TwistStamped),
computes differential-drive left/right wheel speeds, transmits authenticated
setpoints to the ESP32 hardware via laptop backend WebSocket, and publishes
an integrated open-loop Odometry TF (odom -> base_link) to maintain valid
transforms for SLAM Toolbox and Nav2.
"""

import sys
import os
import time
import math
import json
import threading
from urllib import request as url_request

# ROS 2 Imports
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist, TransformStamped, PoseStamped
from nav_msgs.msg import Odometry, OccupancyGrid
from sensor_msgs.msg import Range
from tf2_ros import TransformBroadcaster, Buffer, TransformListener
from tf2_ros import LookupException, ConnectivityException, ExtrapolationException

# Try importing TwistStamped for ROS 2 distributions using stamped cmd_vel
try:
    from geometry_msgs.msg import TwistStamped
    HAS_TWIST_STAMPED = True
except ImportError:
    HAS_TWIST_STAMPED = False

# ==============================================================================
# DIFFERENTIAL DRIVE ROBOT CALIBRATION CONSTANTS (TURTLE MODE DEFAULT)
# ==============================================================================
WHEEL_SEPARATION = 0.160   # meters (track width between left & right wheels)
WHEEL_RADIUS     = 0.033   # meters (standard 65mm robot wheel)
MAX_LINEAR_VEL   = 0.12    # m/s (TURTLE MODE safe slow speed)
MAX_ANGULAR_VEL  = 0.60    # rad/s

# PWM Calibration mapping:
# Gentle slow-motion motor PWM limits
PWM_MIN = 60
PWM_MAX = 110

BACKEND_COMMAND_URL = "http://127.0.0.1:8000/api/robot/command"
BACKEND_DEVICE_KEY  = "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"


class Ros2ToEsp32Bridge(Node):
    def __init__(self):
        super().__init__("ros2_to_esp32_bridge")

        # 1. Subscribers for /cmd_vel
        self.sub_twist = self.create_subscription(
            Twist,
            "/cmd_vel",
            self.on_twist_received,
            10
        )

        if HAS_TWIST_STAMPED:
            try:
                self.sub_twist_stamped = self.create_subscription(
                    TwistStamped,
                    "/cmd_vel_stamped",
                    self.on_twist_stamped_received,
                    10
                )
            except Exception:
                pass

        # 2. Odometry Publisher & TF Broadcaster
        self.odom_pub = self.create_publisher(Odometry, "/odom", 10)
        self.tf_broadcaster = TransformBroadcaster(self)

        # 3. Nav2 Goal Publisher
        self.goal_pub = self.create_publisher(PoseStamped, "/goal_pose", 10)
        self.last_goal_ts = ""
        self.current_target = None

        # 4. Front Ultrasonic Range Publisher
        self.range_pub = self.create_publisher(Range, "/ultrasonic/range", 10)
        self.create_timer(0.10, self.poll_and_publish_ultrasonic)

        # 5. SLAM Toolbox 2D Occupancy Grid Map Subscriber (Syncs with Web Dashboard)
        self.map_sync_url = "http://127.0.0.1:8000/api/maps/sync_ros2"
        self.last_map_sync_time = 0.0
        self.sub_map = self.create_subscription(
            OccupancyGrid,
            "/map",
            self.on_map_received,
            1
        )

        # 6. TF Buffer & Listener for True SLAM Robot Pose (map -> base_link)
        self.tf_buffer = Buffer()
        self.tf_listener = TransformListener(self.tf_buffer, self)
        self.pose_sync_url = "http://127.0.0.1:8000/api/robot/pose"
        self.last_pose_sync_time = 0.0
        self.slam_localized = False
        self.slam_pose_x = 0.0
        self.slam_pose_y = 0.0
        self.slam_pose_yaw = 0.0

        # Current Robot Pose for Open-Loop Odometry
        self.x = 0.0
        self.y = 0.0
        self.th = 0.0
        self.vx = 0.0
        self.vth = 0.0
        self.last_odom_time = self.get_clock().now()

        # Timer for odometry update loop (20 Hz)
        self.create_timer(0.05, self.update_and_publish_odometry)

        # Timer for SLAM pose polling and sync (20 Hz)
        self.create_timer(0.05, self.poll_and_sync_slam_pose)

        # Timer for checking pending Nav2 goals from web dashboard (1 Hz)
        self.create_timer(1.0, self.check_navigation_goal)

        # Rate limiter for sending commands to ESP32 (10 Hz max)
        self.last_cmd_send_time = 0.0
        self.pending_left_pwm = 0
        self.pending_right_pwm = 0
        self.pending_direction = "STOPPED"
        self.pending_eye_expression = "HAPPY"
        self.cmd_lock = threading.Lock()

        # Background worker for dispatching commands to FastAPI
        self.worker_thread = threading.Thread(target=self._dispatch_worker, daemon=True)
        self.worker_thread.start()

        self.get_logger().info("ROS 2 to ESP32 Differential Drive Bridge INITIALIZED in TURTLE MODE.")
        self.get_logger().info(f"Subscribing: /cmd_vel (Max: {MAX_LINEAR_VEL} m/s) -> Differential Drive (Track: {WHEEL_SEPARATION}m)")
        self.get_logger().info("Ultrasonic: Publishing /ultrasonic/range at 10 Hz")
        self.get_logger().info("Nav2 Goal Dispatcher: Listening for goals from Web Dashboard on /goal_pose")


    def on_twist_received(self, msg: Twist):
        self.process_velocity(msg.linear.x, msg.angular.z)

    def on_twist_stamped_received(self, msg: TwistStamped):
        self.process_velocity(msg.twist.linear.x, msg.twist.angular.z)

    def process_velocity(self, linear_x: float, angular_z: float):
        # Clamp velocity
        linear_x = max(-MAX_LINEAR_VEL, min(MAX_LINEAR_VEL, linear_x))
        angular_z = max(-MAX_ANGULAR_VEL, min(MAX_ANGULAR_VEL, angular_z))

        self.vx = linear_x
        self.vth = angular_z

        # Differential drive kinematic equations:
        # v_left  = v - (omega * L / 2)
        # v_right = v + (omega * L / 2)
        v_left = linear_x - (angular_z * WHEEL_SEPARATION / 2.0)
        v_right = linear_x + (angular_z * WHEEL_SEPARATION / 2.0)

        # Convert linear wheel velocities (m/s) to PWM (-255 to 255)
        pwm_left = self._vel_to_pwm(v_left)
        pwm_right = self._vel_to_pwm(v_right)

        # Determine motion direction and OLED eye expression
        direction = "STOPPED"
        eye_expression = "HAPPY"
        if abs(linear_x) < 0.01 and abs(angular_z) < 0.05:
            direction = "STOPPED"
            eye_expression = "HAPPY"
        elif abs(linear_x) >= 0.02 and abs(angular_z) < 0.15:
            if linear_x > 0:
                direction = "FORWARD"
                eye_expression = "MOVING FORWARD"
            else:
                direction = "REVERSE"
                eye_expression = "LOOKING BACK"
        elif angular_z > 0.40:
            direction = "U_TURN_LEFT"
            eye_expression = "U-TURN LEFT"
        elif angular_z < -0.40:
            direction = "U_TURN_RIGHT"
            eye_expression = "U-TURN RIGHT"
        elif angular_z > 0.10:
            direction = "TURN_LEFT"
            eye_expression = "TURNING LEFT"
        elif angular_z < -0.10:
            direction = "TURN_RIGHT"
            eye_expression = "TURNING RIGHT"
        else:
            direction = "FORWARD"
            eye_expression = "MOVING FORWARD"

        with self.cmd_lock:
            self.pending_left_pwm = pwm_left
            self.pending_right_pwm = pwm_right
            self.pending_direction = direction
            self.pending_eye_expression = eye_expression


    def _vel_to_pwm(self, vel_m_s: float) -> int:
        if abs(vel_m_s) < 0.01:
            return 0
        sign = 1 if vel_m_s > 0 else -1
        # Proportional scale
        fraction = min(1.0, abs(vel_m_s) / MAX_LINEAR_VEL)
        pwm = int(PWM_MIN + fraction * (PWM_MAX - PWM_MIN))
        return sign * min(PWM_MAX, max(PWM_MIN, pwm))

    def update_and_publish_odometry(self):
        now = self.get_clock().now()
        dt = (now - self.last_odom_time).nanoseconds / 1e9
        self.last_odom_time = now

        if dt > 0.5 or dt <= 0:
            return

        # Integrate pose
        delta_x = (self.vx * math.cos(self.th)) * dt
        delta_y = (self.vx * math.sin(self.th)) * dt
        delta_th = self.vth * dt

        self.x += delta_x
        self.y += delta_y
        self.th += delta_th

        # Quaternion from yaw
        qz = math.sin(self.th / 2.0)
        qw = math.cos(self.th / 2.0)

        # 1. Broadcast TF: odom -> base_link
        t = TransformStamped()
        t.header.stamp = now.to_msg()
        t.header.frame_id = "odom"
        t.child_frame_id = "base_link"
        t.transform.translation.x = self.x
        t.transform.translation.y = self.y
        t.transform.translation.z = 0.0
        t.transform.rotation.z = qz
        t.transform.rotation.w = qw
        self.tf_broadcaster.sendTransform(t)

        # 2. Publish /odom
        odom = Odometry()
        odom.header.stamp = now.to_msg()
        odom.header.frame_id = "odom"
        odom.child_frame_id = "base_link"
        odom.pose.pose.position.x = self.x
        odom.pose.pose.position.y = self.y
        odom.pose.pose.position.z = 0.0
        odom.pose.pose.orientation.z = qz
        odom.pose.pose.orientation.w = qw
        odom.twist.twist.linear.x = self.vx
        odom.twist.twist.angular.z = self.vth
        self.odom_pub.publish(odom)

        # 3. Check target arrival if actively navigating
        if self.current_target:
            dist = math.hypot(self.x - self.current_target["x"], self.y - self.current_target["y"])
            if dist < 0.25:
                self.get_logger().info(f"Target '{self.current_target.get('name')}' ARRIVED! (dist: {dist:.2f}m)")
                self.current_target = None
                try:
                    req = url_request.Request(
                        "http://127.0.0.1:8000/api/navigation/reached",
                        data=b"{}",
                        headers={"Content-Type": "application/json"}
                    )
                    url_request.urlopen(req, timeout=0.5)
                except Exception:
                    pass

    def poll_and_publish_ultrasonic(self):
        try:
            req = url_request.Request("http://127.0.0.1:8000/api/sensors/ultrasonic")
            with url_request.urlopen(req, timeout=0.2) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                dist_m = float(data.get("distance_m", 1.25))

                msg = Range()
                msg.header.stamp = self.get_clock().now().to_msg()
                msg.header.frame_id = "base_link"
                msg.radiation_type = Range.ULTRASOUND
                msg.field_of_view = 0.26  # ~15 degrees
                msg.min_range = 0.02
                msg.max_range = 4.00
                msg.range = dist_m
                self.range_pub.publish(msg)
        except Exception:
            pass

    def poll_and_sync_slam_pose(self):
        """
        Queries TF tree for map -> base_link (authoritative SLAM pose).
        When available, synchronizes true robot coordinates with FastAPI and web clients.
        """
        now_time = time.time()
        try:
            # Query the latest available transform from map to base_link
            t = self.tf_buffer.lookup_transform(
                "map", 
                "base_link", 
                rclpy.time.Time()
            )

            tx = t.transform.translation.x
            ty = t.transform.translation.y
            rx = t.transform.rotation.x
            ry = t.transform.rotation.y
            rz = t.transform.rotation.z
            rw = t.transform.rotation.w

            # Compute Euler yaw from quaternion
            siny_cosp = 2.0 * (rw * rz + rx * ry)
            cosy_cosp = 1.0 - 2.0 * (ry * ry + rz * rz)
            yaw_rad = math.atan2(siny_cosp, cosy_cosp)
            yaw_deg = (math.degrees(yaw_rad) % 360.0 + 360.0) % 360.0

            self.slam_localized = True
            self.slam_pose_x = tx
            self.slam_pose_y = ty
            self.slam_pose_yaw = yaw_deg

            # Keep internal open-loop reference aligned with true SLAM pose to prevent divergence
            self.x = tx
            self.y = ty
            self.th = yaw_rad

            # Throttle pose forwarding to 10 Hz
            if now_time - self.last_pose_sync_time >= 0.10:
                self.last_pose_sync_time = now_time
                payload = {
                    "x": round(float(tx), 4),
                    "y": round(float(ty), 4),
                    "orientation": round(float(yaw_deg), 2),
                    "localized": True,
                    "frame_id": "map",
                    "status": "SLAM_ACTIVE",
                    "timestamp": now_time
                }
                req = url_request.Request(
                    self.pose_sync_url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "User-Agent": "ROS2Bridge"}
                )
                url_request.urlopen(req, timeout=0.2)

        except (LookupException, ConnectivityException, ExtrapolationException):
            # SLAM is initializing or transform temporarily unavailable
            self.slam_localized = False
            if now_time - self.last_pose_sync_time >= 1.0:
                self.last_pose_sync_time = now_time
                payload = {
                    "x": round(float(self.x), 4),
                    "y": round(float(self.y), 4),
                    "orientation": round(float((math.degrees(self.th) % 360.0 + 360.0) % 360.0), 2),
                    "localized": False,
                    "frame_id": "odom",
                    "status": "WAITING_FOR_SLAM_TF",
                    "timestamp": now_time
                }
                try:
                    req = url_request.Request(
                        self.pose_sync_url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers={"Content-Type": "application/json", "User-Agent": "ROS2Bridge"}
                    )
                    url_request.urlopen(req, timeout=0.2)
                except Exception:
                    pass
        except Exception:
            pass

    def check_navigation_goal(self):
        try:
            req = url_request.Request(
                "http://127.0.0.1:8000/api/navigation/active-goal",
                headers={"Content-Type": "application/json"}
            )
            with url_request.urlopen(req, timeout=0.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("active") and data.get("target"):
                    target = data.get("target")
                    ts = str(data.get("timestamp", ""))
                    if ts != self.last_goal_ts:
                        self.last_goal_ts = ts
                        self.current_target = target
                        self.get_logger().info(f"Nav2 Goal Received from Web: {target.get('name')} at ({target.get('x')}, {target.get('y')})")

                        msg = PoseStamped()
                        msg.header.stamp = self.get_clock().now().to_msg()
                        msg.header.frame_id = "map"
                        msg.pose.position.x = float(target["x"])
                        msg.pose.position.y = float(target["y"])
                        msg.pose.position.z = 0.0
                        msg.pose.orientation.w = 1.0
                        self.goal_pub.publish(msg)
        except Exception:
            pass

    def _dispatch_worker(self):
        while rclpy.ok():
            left = 0
            right = 0
            direction = "STOPPED"
            eye_expression = "HAPPY"
            with self.cmd_lock:
                left = self.pending_left_pwm
                right = self.pending_right_pwm
                direction = self.pending_direction
                eye_expression = self.pending_eye_expression

            # Send SET_WHEEL_SPEEDS command to FastAPI backend
            payload = {
                "command": "SET_WHEEL_SPEEDS",
                "speed": max(abs(left), abs(right)) / 255.0,
                "speed_mode": "TURTLE",
                "direction": direction,
                "oled_expression": eye_expression,
                "parameters": {
                    "left": left,
                    "right": right,
                    "direction": direction
                }
            }

            try:
                data_bytes = json.dumps(payload).encode("utf-8")
                req = url_request.Request(
                    BACKEND_COMMAND_URL,
                    data=data_bytes,
                    headers={
                        "Content-Type": "application/json",
                        "X-Robot-Key": BACKEND_DEVICE_KEY
                    }
                )
                url_request.urlopen(req, timeout=0.4)
            except Exception:
                pass

    def on_map_received(self, msg: OccupancyGrid):
        """Forwards SLAM Toolbox 2D occupancy grid map updates to RoboNav Web Dashboard."""
        now = time.time()
        if now - self.last_map_sync_time < 0.75:
            return  # Throttle to max ~1.3 Hz to preserve web socket bandwidth
        self.last_map_sync_time = now

        try:
            # Map values in nav_msgs/OccupancyGrid: -1=unknown, 0=free, 100=occupied
            grid_list = list(msg.data)
            payload = {
                "name": "ROS 2 SLAM Toolbox Map",
                "width": int(msg.info.width),
                "height": int(msg.info.height),
                "resolution": float(msg.info.resolution),
                "origin_x": float(msg.info.origin.position.x),
                "origin_y": float(msg.info.origin.position.y),
                "data": grid_list
            }
            req = url_request.Request(
                self.map_sync_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "ROS2Bridge"}
            )
            url_request.urlopen(req, timeout=0.5)
        except Exception:
            pass


def main(args=None):
    try:
        rclpy.init(args=args)
        node = Ros2ToEsp32Bridge()
        try:
            rclpy.spin(node)
        except (KeyboardInterrupt, Exception):
            pass
    except Exception as e:
        print(f"[ROS 2 Bridge] Notice: {e}")
    finally:
        try:
            if 'node' in locals():
                node.destroy_node()
            if rclpy.ok():
                rclpy.shutdown()
        except Exception:
            pass


if __name__ == "__main__":
    main()

