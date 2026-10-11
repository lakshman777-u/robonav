#!/usr/bin/env python3
"""
RoboNav Laptop UDP Receiver & ROS 2 LaserScan Publisher
Binds to UDP port 4210, receives YDLIDAR X2 packets from ESP32,
decodes 360-degree range scans, publishes to ROS 2 /scan (laser_frame),
and forwards real-time telemetry to the RoboNav web application.
"""

import sys
import os
import time
import socket
import struct
import math
import json
import signal
import threading
from urllib import request as url_request

# Try importing ROS 2 libraries
ROS2_AVAILABLE = False
try:
    import rclpy
    from rclpy.node import Node
    from sensor_msgs.msg import LaserScan
    ROS2_AVAILABLE = True
except ImportError:
    pass

# ==============================================================================
# CONFIGURATION CONSTANTS
# ==============================================================================
UDP_BIND_HOST = "0.0.0.0"
UDP_BIND_PORT = 4210
EXPECTED_MAGIC = b"YD"
LASER_FRAME_ID = "laser_frame"

# YDLIDAR X2 Specifications
RANGE_MIN_METERS = 0.10
RANGE_MAX_METERS = 8.0
NUM_SCAN_BINS = 360  # 1-degree resolution across 360 degrees

# Backend Web API Integration
BACKEND_API_URL = "http://127.0.0.1:8000/api/bridge/scan"
DEVICE_API_KEY = "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"

# Binary Header Format (packed):
# 2 bytes magic ('YD'), 1 byte ver, 1 byte type, 4 bytes seq, 4 bytes ts, 16 bytes device_id, 2 bytes payload_len = 30 bytes
HEADER_FORMAT = "<2sBBII16sH"
HEADER_SIZE = struct.calcsize(HEADER_FORMAT)

# Diagnostic Payload Format:
# 4 bytes bytes_rx, 4 bytes valid_pkts, 4 bytes crc_errs, 4 bytes udp_sent, 4 bytes rssi, 4 bytes uptime = 24 bytes
DIAG_FORMAT = "<IIIIiI"
DIAG_SIZE = struct.calcsize(DIAG_FORMAT)


class LidarScanAccumulator:
    """Accumulates raw YDLIDAR X2 packets into full 360-degree scans."""
    def __init__(self, num_bins=360):
        self.num_bins = num_bins
        self.bins = [float('inf')] * num_bins
        self.sample_counts = [0] * num_bins
        self.last_fsa_deg = -1.0
        self.scan_start_time = time.time()
        self.total_scans_completed = 0

    def add_packet(self, ct, lsn, fsa_deg, lsa_deg, samples_m):
        completed_scan = None

        # Detect start of new revolution:
        # Either zero-angle packet (ct == 0x01) or angle wraparound (fsa < last_fsa - 180)
        is_new_rev = (ct == 0x01) or (self.last_fsa_deg >= 0 and fsa_deg < (self.last_fsa_deg - 180.0))

        if is_new_rev and self.total_scans_completed > 0:
            now = time.time()
            scan_time = max(0.001, now - self.scan_start_time)
            # Create copy of current scan
            completed_scan = {
                "ranges": list(self.bins),
                "scan_time": scan_time,
                "timestamp": now
            }
            # Reset bins for next revolution
            self.bins = [float('inf')] * self.num_bins
            self.sample_counts = [0] * self.num_bins
            self.scan_start_time = now

        self.last_fsa_deg = fsa_deg

        # Interpolate angles for each sample in this packet
        diff = lsa_deg - fsa_deg
        if diff < 0:
            diff += 360.0

        for i, dist in enumerate(samples_m):
            if lsn > 1:
                angle_deg = fsa_deg + (diff / (lsn - 1)) * i
            else:
                angle_deg = fsa_deg

            angle_deg = angle_deg % 360.0

            if RANGE_MIN_METERS <= dist <= RANGE_MAX_METERS:
                bin_idx = int(angle_deg / (360.0 / self.num_bins)) % self.num_bins
                # Store closest valid return in this bin
                if self.bins[bin_idx] == float('inf') or dist < self.bins[bin_idx]:
                    self.bins[bin_idx] = dist
                    self.sample_counts[bin_idx] += 1

        if completed_scan is not None:
            self.total_scans_completed += 1
            return completed_scan

        if self.total_scans_completed == 0 and is_new_rev:
            self.total_scans_completed = 1

        return None


class YdLidarUdpRosBridge:
    def __init__(self, ros_node=None):
        self.ros_node = ros_node
        self.scan_pub = None
        if self.ros_node:
            self.scan_pub = self.ros_node.create_publisher(LaserScan, "/scan", 10)

        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.sock.bind((UDP_BIND_HOST, UDP_BIND_PORT))
        self.sock.settimeout(0.5)

        self.accumulator = LidarScanAccumulator(NUM_SCAN_BINS)
        self.running = True

        # Metrics & Health Tracking
        self.last_seq = None
        self.dropped_packets = 0
        self.total_packets_rx = 0
        self.total_bytes_rx = 0
        self.last_sender = None
        self.last_rx_time = None
        self.esp32_rssi = 0
        self.esp32_uptime = 0
        self.esp32_crc_errors = 0
        self.scans_published = 0
        self.last_hz_calc_time = time.time()
        self.scans_in_last_interval = 0
        self.current_scan_hz = 0.0

        # Background thread for pushing to web backend
        self.web_push_thread = threading.Thread(target=self._web_push_worker, daemon=True)
        self.latest_web_payload = None
        self.payload_lock = threading.Lock()
        self.web_push_thread.start()

    def run(self):
        print("==================================================================")
        print(" ROBONAV YDLIDAR X2 UDP RECEIVER & ROS 2 BRIDGE")
        print(f" UDP Listening on:   {UDP_BIND_HOST}:{UDP_BIND_PORT}")
        print(f" ROS 2 /scan Topic:  {'ACTIVE (/scan)' if self.scan_pub else 'DISABLED (rclpy not active)'}")
        print(f" Web Backend Link:   {BACKEND_API_URL}")
        print("==================================================================")

        last_log_time = time.time()

        while self.running:
            try:
                data, addr = self.sock.recvfrom(2048)
            except socket.timeout:
                if time.time() - last_log_time > 2.0:
                    self._print_status_line()
                    last_log_time = time.time()
                continue
            except Exception as e:
                if self.running:
                    print(f"[UDP] Receive error: {e}")
                continue

            self.total_bytes_rx += len(data)
            self.total_packets_rx += 1
            self.last_sender = addr
            self.last_rx_time = time.time()

            self._process_incoming_datagram(data)

            if time.time() - last_log_time > 1.0:
                self._update_hz_and_log()
                last_log_time = time.time()

    def _process_incoming_datagram(self, data):
        if len(data) < HEADER_SIZE:
            return  # Truncated datagram

        magic, version, pkt_type, seq_num, ts_ms, dev_id_raw, payload_len = struct.unpack_from(HEADER_FORMAT, data, 0)

        if magic != EXPECTED_MAGIC:
            return  # Invalid magic bytes

        # Check sequence number for packet drops
        if self.last_seq is not None:
            expected_seq = (self.last_seq + 1) & 0xFFFFFFFF
            if seq_num > expected_seq:
                self.dropped_packets += (seq_num - expected_seq)
        self.last_seq = seq_num

        payload = data[HEADER_SIZE : HEADER_SIZE + payload_len]

        if pkt_type == 0x01:
            # Type 0x01: Validated YDLIDAR X2 binary packet
            self._decode_ydlidar_packet(payload)
        elif pkt_type == 0x02:
            # Type 0x02: ESP32 Diagnostic Heartbeat
            self._decode_diagnostic_payload(payload)

    def _decode_ydlidar_packet(self, payload):
        # YDLIDAR X2 packet: 10 bytes header + (LSN * 2) bytes
        if len(payload) < 10:
            return

        sync = payload[0:2]
        if sync != b"\xAA\x55":
            return

        ct = payload[2]
        lsn = payload[3]
        fsa_raw = struct.unpack_from("<H", payload, 4)[0]
        lsa_raw = struct.unpack_from("<H", payload, 6)[0]
        cs_raw = struct.unpack_from("<H", payload, 8)[0]

        expected_len = 10 + (lsn * 2)
        if len(payload) < expected_len:
            return

        fsa_deg = (fsa_raw >> 1) / 64.0
        lsa_deg = (lsa_raw >> 1) / 64.0

        samples_m = []
        for i in range(lsn):
            dist_raw = struct.unpack_from("<H", payload, 10 + 2 * i)[0]
            dist_m = dist_raw / 4000.0  # mm to meters
            samples_m.append(dist_m)

        # Feed to 360-degree scan accumulator
        completed_scan = self.accumulator.add_packet(ct, lsn, fsa_deg, lsa_deg, samples_m)
        if completed_scan:
            self._publish_scan(completed_scan)

    def _decode_diagnostic_payload(self, payload):
        if len(payload) < DIAG_SIZE:
            return
        rx_bytes, val_pkts, crc_errs, udp_sent, rssi, uptime = struct.unpack_from(DIAG_FORMAT, payload, 0)
        self.esp32_rssi = rssi
        self.esp32_uptime = uptime
        self.esp32_crc_errors = crc_errs

    def _publish_scan(self, scan_data):
        self.scans_published += 1
        self.scans_in_last_interval += 1
        ranges = scan_data["ranges"]
        scan_time = scan_data["scan_time"]

        # 1. Publish ROS 2 LaserScan message if node is active
        if self.ros_node and self.scan_pub:
            msg = LaserScan()
            msg.header.stamp = self.ros_node.get_clock().now().to_msg()
            msg.header.frame_id = LASER_FRAME_ID
            msg.angle_min = 0.0
            msg.angle_max = 2.0 * math.pi
            msg.angle_increment = (2.0 * math.pi) / NUM_SCAN_BINS
            msg.time_increment = scan_time / NUM_SCAN_BINS
            msg.scan_time = scan_time
            msg.range_min = RANGE_MIN_METERS
            msg.range_max = RANGE_MAX_METERS
            msg.ranges = ranges
            # Intensities (optional, default 0.0 for X2)
            msg.intensities = [15.0 if r != float('inf') else 0.0 for r in ranges]

            self.scan_pub.publish(msg)

        # 2. Prepare compressed 36-point ray sample for Web Dashboard
        web_points = []
        step = max(1, len(ranges) // 36)
        for i in range(36):
            idx = (i * step) % len(ranges)
            r = ranges[idx]
            dist = r if r != float('inf') else 0.0
            web_points.append({"angle": float(i * 10), "distance": round(dist, 2)})

        with self.payload_lock:
            self.latest_web_payload = {
                "robot_id": "ESP32DEVKIT-001",
                "api_key": DEVICE_API_KEY,
                "udp_packets_rx": self.total_packets_rx,
                "udp_bytes_rx": self.total_bytes_rx,
                "dropped_packets": self.dropped_packets,
                "scans_published": self.scans_published,
                "scan_hz": self.current_scan_hz,
                "wifi_rssi": self.esp32_rssi,
                "esp32_crc_errors": self.esp32_crc_errors,
                "sender_ip": self.last_sender[0] if self.last_sender else "unknown",
                "points": web_points
            }

    def _web_push_worker(self):
        """Pushes real-time scan points and telemetry to the FastAPI backend."""
        while self.running:
            payload = None
            with self.payload_lock:
                if self.latest_web_payload:
                    payload = self.latest_web_payload
                    self.latest_web_payload = None

            if payload:
                try:
                    data_bytes = json.dumps(payload).encode('utf-8')
                    req = url_request.Request(
                        BACKEND_API_URL,
                        data=data_bytes,
                        headers={"Content-Type": "application/json"}
                    )
                    url_request.urlopen(req, timeout=0.8)
                except Exception:
                    pass  # Backend not yet started or endpoint busy

            time.sleep(0.10)  # Rate limit web updates to 10 Hz

    def _update_hz_and_log(self):
        now = time.time()
        elapsed = now - self.last_hz_calc_time
        if elapsed > 0:
            self.current_scan_hz = round(self.scans_in_last_interval / elapsed, 1)
        self.scans_in_last_interval = 0
        self.last_hz_calc_time = now
        self._print_status_line()

    def _print_status_line(self):
        sender_str = f"{self.last_sender[0]}:{self.last_sender[1]}" if self.last_sender else "No Sender Yet"
        time_since_rx = f"{time.time() - self.last_rx_time:.1f}s ago" if self.last_rx_time else "NEVER"
        print(f"[UDP BRIDGE] Pkts: {self.total_packets_rx:<6} | Drops: {self.dropped_packets:<3} | "
              f"Scans: {self.scans_published:<5} ({self.current_scan_hz:>4.1f} Hz) | "
              f"From: {sender_str} ({time_since_rx}) | RSSI: {self.esp32_rssi} dBm")

    def stop(self):
        self.running = False
        try:
            self.sock.close()
        except Exception:
            pass


def main(args=None):
    ros_node = None
    ros_executor_thread = None

    if ROS2_AVAILABLE:
        try:
            rclpy.init(args=args)
            ros_node = Node("ydlidar_udp_bridge")
            ros_executor_thread = threading.Thread(target=lambda: rclpy.spin(ros_node), daemon=True)
            ros_executor_thread.start()
            print("[ROS 2] Initialized ROS 2 node 'ydlidar_udp_bridge' publishing on /scan")
        except Exception as e:
            print(f"[ROS 2] Warning: Failed to init rclpy: {e}. Running in UDP-only bridge mode.")

    bridge = YdLidarUdpRosBridge(ros_node=ros_node)

    def signal_handler(sig, frame):
        print("\n[SHUTDOWN] Stopping YDLIDAR UDP Receiver Bridge...")
        bridge.stop()
        if ROS2_AVAILABLE and ros_node:
            try:
                ros_node.destroy_node()
                rclpy.shutdown()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    bridge.run()


if __name__ == "__main__":
    main()
