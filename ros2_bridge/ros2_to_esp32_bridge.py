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
from nav_msgs.msg import Odometry
from tf2_ros import TransformBroadcaster

# Try importing TwistStamped for ROS 2 distributions using stamped cmd_vel
try:
    from geometry_msgs.msg import TwistStamped
    HAS_TWIST_STAMPED = True
except ImportError:
    HAS_TWIST_STAMPED = False

# ==============================================================================
# DIFFERENTIAL DRIVE ROBOT CALIBRATION CONSTANTS
# ==============================================================================
WHEEL_SEPARATION = 0.160   # meters (track width between left & right wheels)
WHEEL_RADIUS     = 0.033   # meters (standard 65mm robot wheel)
MAX_LINEAR_VEL   = 0.40    # m/s
MAX_ANGULAR_VEL  = 1.50    # rad/s

# PWM Calibration mapping:
# 0.40 m/s corresponds to 255 PWM; deadband minimum is 60 PWM
PWM_MIN = 60
PWM_MAX = 255

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

        # Current Robot Pose for Open-Loop Odometry
        self.x = 0.0
        self.y = 0.0
        self.th = 0.0
        self.vx = 0.0
        self.vth = 0.0
        self.last_odom_time = self.get_clock().now()

        # Timer for odometry update loop (20 Hz)
        self.create_timer(0.05, self.update_and_publish_odometry)

        # Timer for checking pending Nav2 goals from web dashboard (1 Hz)
        self.create_timer(1.0, self.check_navigation_goal)

        # Rate limiter for sending commands to ESP32 (10 Hz max)
        self.last_cmd_send_time = 0.0
        self.pending_left_pwm = 0
        self.pending_right_pwm = 0
        self.cmd_lock = threading.Lock()

        # Background worker for dispatching commands to FastAPI
        self.worker_thread = threading.Thread(target=self._dispatch_worker, daemon=True)
        self.worker_thread.start()

        self.get_logger().info("ROS 2 to ESP32 Differential Drive Bridge INITIALIZED.")
        self.get_logger().info(f"Subscribing: /cmd_vel -> Differential Drive (Track: {WHEEL_SEPARATION}m)")
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

        with self.cmd_lock:
            self.pending_left_pwm = pwm_left
            self.pending_right_pwm = pwm_right

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

    def check_navigation_goal(self):
        try:
            req = url_request.Request(
                "http://127.0.0.1:8000/api/navigation/goal",
                headers={"Content-Type": "application/json"}
            )
            with url_request.urlopen(req, timeout=0.5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                goal = data.get("goal")
                if goal and goal.get("timestamp") != self.last_goal_ts:
                    self.last_goal_ts = goal.get("timestamp")
                    self.current_target = goal
                    self.get_logger().info(f"Nav2 Goal Received from Web: {goal.get('name')} at ({goal.get('x')}, {goal.get('y')})")

                    msg = PoseStamped()
                    msg.header.stamp = self.get_clock().now().to_msg()
                    msg.header.frame_id = "map"
                    msg.pose.position.x = float(goal["x"])
                    msg.pose.position.y = float(goal["y"])
                    msg.pose.position.z = 0.0
                    msg.pose.orientation.w = 1.0
                    self.goal_pub.publish(msg)
        except Exception:
            pass

    def _dispatch_worker(self):
        while rclpy.ok():
            left = 0
            right = 0
            with self.cmd_lock:
                left = self.pending_left_pwm
                right = self.pending_right_pwm

            # Send SET_WHEEL_SPEEDS command to FastAPI backend
            payload = {
                "command": "SET_WHEEL_SPEEDS",
                "speed": max(abs(left), abs(right)) / 255.0,
                "parameters": {
                    "left": left,
                    "right": right
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

            time.sleep(0.10)  # Rate limit to 10 Hz


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

