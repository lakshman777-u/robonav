#!/usr/bin/env python3
"""
RoboNav Direct USB YDLIDAR X2 ROS 2 Driver Node
Connects to YDLIDAR X2 via USB-to-Serial adapter (/dev/ttyUSB0 @ 115200 baud),
parses raw binary telemetry packets, publishes standard sensor_msgs/msg/LaserScan
on topic /scan, broadcasts static TF (base_link -> laser_frame), and forwards
real-time scan telemetry to the RoboNav FastAPI backend.
"""

import sys
import os
import time
import math
import glob
import struct
import json
import threading
from urllib import request as url_request

# ROS 2 Imports
ROS2_AVAILABLE = False
try:
    import rclpy
    from rclpy.node import Node
    from sensor_msgs.msg import LaserScan
    from geometry_msgs.msg import TransformStamped
    from tf2_ros.static_transform_broadcaster import StaticTransformBroadcaster
    ROS2_AVAILABLE = True
except ImportError:
    pass

# Serial Import
try:
    import serial
except ImportError:
    serial = None

# ==============================================================================
# CONFIGURATION CONSTANTS
# ==============================================================================
DEFAULT_SERIAL_PORT = "/dev/ttyUSB0"
LIDAR_BAUD_RATE = 115200
LASER_FRAME_ID = "laser_frame"
BASE_FRAME_ID = "base_link"

RANGE_MIN_METERS = 0.12
RANGE_MAX_METERS = 8.00
NUM_SCAN_BINS = 360  # 1-degree resolution

BACKEND_API_URL = "http://127.0.0.1:8000/api/bridge/scan"
DEVICE_API_KEY = "rb_live_Quwl_PxT5rgl8I-IGQquU2JaKSuQDPMq"


class LidarScanAccumulator:
    """Accumulates raw YDLIDAR X2 packets into full 360-degree scans."""
    def __init__(self, num_bins=360):
        self.num_bins = num_bins
        self.current_scan = [float('inf')] * num_bins
        self.last_fsa = None
        self.scan_start_time = time.time()
        self.total_scans_completed = 0

    def add_packet(self, ct, lsn, fsa_deg, lsa_deg, samples_m):
        completed_scan = None
        is_new_rev = False

        if ct == 0x01:
            is_new_rev = True
        elif self.last_fsa is not None and fsa_deg < (self.last_fsa - 180.0):
            is_new_rev = True

        self.last_fsa = fsa_deg

        if is_new_rev and self.total_scans_completed > 0:
            now = time.time()
            scan_duration = max(0.05, now - self.scan_start_time)

            # Fill single-bin gaps between consistent adjacent wall measurements
            filled_ranges = list(self.current_scan)
            for b in range(self.num_bins):
                if filled_ranges[b] == float('inf'):
                    prev_b = (b - 1) % self.num_bins
                    next_b = (b + 1) % self.num_bins
                    d_prev = self.current_scan[prev_b]
                    d_next = self.current_scan[next_b]
                    if d_prev != float('inf') and d_next != float('inf'):
                        if abs(d_prev - d_next) < 0.30:
                            filled_ranges[b] = round((d_prev + d_next) / 2.0, 3)

            completed_scan = {
                "ranges": filled_ranges,
                "scan_time": scan_duration,
                "timestamp": now
            }
            self.current_scan = [float('inf')] * self.num_bins
            self.scan_start_time = now

        angle_diff = lsa_deg - fsa_deg
        if angle_diff < 0:
            angle_diff += 360.0

        if lsn > 1:
            step = angle_diff / (lsn - 1)
            for i in range(lsn):
                angle = (fsa_deg + i * step) % 360.0
                bin_idx = int(angle) % self.num_bins
                dist = samples_m[i]
                if RANGE_MIN_METERS <= dist <= RANGE_MAX_METERS:
                    if self.current_scan[bin_idx] == float('inf') or dist < self.current_scan[bin_idx]:
                        self.current_scan[bin_idx] = dist

        if completed_scan is not None:
            self.total_scans_completed += 1
            return completed_scan

        if self.total_scans_completed == 0 and is_new_rev:
            self.total_scans_completed = 1

        return None


if ROS2_AVAILABLE:
    BaseNode = Node
else:
    BaseNode = object


class YdlidarDirectNode(BaseNode):
    def __init__(self, port=DEFAULT_SERIAL_PORT, baud=LIDAR_BAUD_RATE, is_mock=False):
        if ROS2_AVAILABLE:
            super().__init__("ydlidar_direct_driver")
            self.scan_pub = self.create_publisher(LaserScan, "/scan", 10)
            try:
                self.tf_broadcaster = StaticTransformBroadcaster(self)
                self._broadcast_static_tf()
            except Exception as e:
                print(f"[TF2] Warning: Could not setup StaticTransformBroadcaster: {e}")
        else:
            self.scan_pub = None
            self.tf_broadcaster = None

        self.port = port
        self.baud = baud
        self.is_mock = is_mock
        self.accumulator = LidarScanAccumulator(NUM_SCAN_BINS)
        self.running = True

        self.ser = None
        self.total_bytes_rx = 0
        self.valid_packets_rx = 0
        self.crc_errors = 0
        self.scans_published = 0
        self.current_scan_hz = 0.0
        self.scans_in_last_interval = 0
        self.last_hz_calc_time = time.time()

        # Background thread for pushing to FastAPI backend
        self.latest_web_payload = None
        self.payload_lock = threading.Lock()
        self.web_push_thread = threading.Thread(target=self._web_push_worker, daemon=True)
        self.web_push_thread.start()

    def _broadcast_static_tf(self):
        if not (ROS2_AVAILABLE and self.tf_broadcaster):
            return
        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = BASE_FRAME_ID
        t.child_frame_id = LASER_FRAME_ID
        t.transform.translation.x = 0.08  # Mounted 8cm forward of chassis center
        t.transform.translation.y = 0.0
        t.transform.translation.z = 0.12  # Mounted 12cm above ground
        t.transform.rotation.w = 1.0
        self.tf_broadcaster.sendTransform(t)


    def open_serial(self):
        # Auto-detect USB serial port if specified port doesn't exist
        target_port = self.port
        if not os.path.exists(target_port):
            available = glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")
            if available:
                target_port = available[0]
                self.port = target_port
                print(f"[SERIAL] Target port not found at original path. Auto-detected available port: {target_port}")
            else:
                print(f"[SERIAL] Error: No USB serial device found at {self.port} or /dev/ttyUSB*")
                return False

        try:
            self.ser = serial.Serial(
                port=target_port,
                baudrate=self.baud,
                timeout=0.5,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            self.ser.flushInput()
            print(f"[SERIAL] Successfully opened {target_port} @ {self.baud} baud.")
            return True
        except Exception as e:
            print(f"[SERIAL] Failed to open {target_port}: {e}")
            return False

    def run(self):
        if not self.open_serial():
            print("[YDLIDAR] Exiting. Ensure LiDAR is plugged in or run with --mock.")
            return

        print("==================================================================")
        print(f" ROBONAV DIRECT USB YDLIDAR X2 ROS 2 DRIVER RUNNING")
        print(f" Port: {self.ser.port}  |  Baud: {self.baud}")
        print(f" ROS 2 /scan Topic:  {'ACTIVE (/scan)' if self.scan_pub else 'DISABLED'}")
        print(f" Frame ID: {LASER_FRAME_ID}  |  TF: {BASE_FRAME_ID} -> {LASER_FRAME_ID}")
        print("==================================================================")

        while self.running:
            try:
                # 1. Sync on 0xAA 0x55
                b1 = self.ser.read(1)
                if not b1 or b1[0] != 0xAA:
                    continue
                b2 = self.ser.read(1)
                if not b2 or b2[0] != 0x55:
                    continue

                # 2. Read 8-byte header (CT, LSN, FSA, LSA, CS)
                hdr = self.ser.read(8)
                if len(hdr) < 8:
                    continue

                ct = hdr[0]
                lsn = hdr[1]
                fsa_raw = hdr[2] | (hdr[3] << 8)
                lsa_raw = hdr[4] | (hdr[5] << 8)
                cs_expected = hdr[6] | (hdr[7] << 8)

                fsa_deg = (fsa_raw >> 1) / 64.0
                lsa_deg = (lsa_raw >> 1) / 64.0

                # 3. Read distance samples (LSN * 2 bytes)
                sample_bytes_len = lsn * 2
                raw_samples = self.ser.read(sample_bytes_len)
                if len(raw_samples) < sample_bytes_len:
                    continue

                self.total_bytes_rx += 10 + sample_bytes_len

                # 4. XOR Checksum verification
                calc_cs = 0x55AA
                calc_cs ^= (ct | (lsn << 8))
                calc_cs ^= fsa_raw
                calc_cs ^= lsa_raw
                samples_m = []
                for i in range(lsn):
                    s_raw = raw_samples[i*2] | (raw_samples[i*2 + 1] << 8)
                    calc_cs ^= s_raw
                    dist_mm = s_raw / 4.0
                    samples_m.append(dist_mm / 1000.0)

                if calc_cs != cs_expected:
                    self.crc_errors += 1
                    continue

                self.valid_packets_rx += 1

                # 5. Accumulate into 360-degree scan
                completed_scan = self.accumulator.add_packet(ct, lsn, fsa_deg, lsa_deg, samples_m)
                if completed_scan:
                    self._publish_scan(completed_scan)

                if time.time() - self.last_hz_calc_time >= 1.0:
                    self._update_hz_and_log()

            except Exception as e:
                print(f"[YDLIDAR] Serial read loop error: {e}")
                time.sleep(1.0)
                try:
                    if self.ser:
                        self.ser.close()
                except Exception:
                    pass
                available = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
                if available:
                    self.port = available[0]
                self.open_serial()

    def run_mock_loop(self):
        """Generates simulated 10 Hz 360-degree room scans for instant verification."""
        print("==================================================================")
        print(" ROBONAV YDLIDAR X2 SIMULATION MODE (TESTING PIPELINE)")
        print(" ROS 2 /scan Topic:  ACTIVE (/scan @ 10.0 Hz)")
        print(f" Web Backend Link:   {BACKEND_API_URL}")
        print("==================================================================")
        while self.running:
            now = time.time()
            ranges = []
            for i in range(NUM_SCAN_BINS):
                rad = (i * 2.0 * math.pi) / NUM_SCAN_BINS
                cos_a = math.cos(rad)
                sin_a = math.sin(rad)
                cand = []
                if cos_a > 0.01: cand.append(2.5 / cos_a)
                elif cos_a < -0.01: cand.append(-2.5 / cos_a)
                if sin_a > 0.01: cand.append(2.0 / sin_a)
                elif sin_a < -0.01: cand.append(-2.0 / sin_a)
                dist = min(cand) if cand else 2.0
                dist = max(0.12, min(7.5, dist + 0.02 * math.sin(i * 0.2)))
                ranges.append(round(dist, 3))

            self.total_bytes_rx += 16 * 118
            self.valid_packets_rx += 16
            self._publish_scan({"ranges": ranges, "scan_time": 0.10, "timestamp": now})
            self._broadcast_static_tf()

            if now - self.last_hz_calc_time >= 1.0:
                self._update_hz_and_log()

            time.sleep(0.10)

    def _publish_scan(self, scan_data):
        self.scans_published += 1
        self.scans_in_last_interval += 1
        ranges = scan_data["ranges"]
        scan_time = scan_data["scan_time"]

        # 1. Publish ROS 2 LaserScan message
        if ROS2_AVAILABLE and self.scan_pub:
            msg = LaserScan()
            msg.header.stamp = self.get_clock().now().to_msg()
            msg.header.frame_id = LASER_FRAME_ID
            msg.angle_min = 0.0
            msg.angle_max = 2.0 * math.pi
            msg.angle_increment = (2.0 * math.pi) / NUM_SCAN_BINS
            msg.time_increment = scan_time / NUM_SCAN_BINS
            msg.scan_time = scan_time
            msg.range_min = RANGE_MIN_METERS
            msg.range_max = RANGE_MAX_METERS
            msg.ranges = ranges
            msg.intensities = [15.0 if r != float('inf') else 0.0 for r in ranges]
            self.scan_pub.publish(msg)

        # 2. Prepare dense 360-degree ray sample for Web Dashboard
        web_points = []
        for i in range(len(ranges)):
            r = ranges[i]
            dist = r if (r != float('inf') and not math.isnan(r)) else 0.0
            if dist > 0.08:
                web_points.append({"angle": float(i), "distance": round(dist, 3)})

        with self.payload_lock:
            self.latest_web_payload = {
                "robot_id": "ESP32-ROBOT-001",
                "api_key": DEVICE_API_KEY,
                "udp_packets_rx": self.valid_packets_rx,
                "udp_bytes_rx": self.total_bytes_rx,
                "dropped_packets": self.crc_errors,
                "scans_published": self.scans_published,
                "scan_hz": self.current_scan_hz,
                "wifi_rssi": -30,
                "esp32_crc_errors": self.crc_errors,
                "esp32_lidar_rx_bytes": self.total_bytes_rx,
                "esp32_lidar_packets": self.valid_packets_rx,
                "sender_ip": "127.0.0.1 (USB-Serial)",
                "points": web_points
            }

    def _web_push_worker(self):
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
                    pass

            time.sleep(0.10)

    def _update_hz_and_log(self):
        now = time.time()
        elapsed = now - self.last_hz_calc_time
        if elapsed > 0:
            self.current_scan_hz = round(self.scans_in_last_interval / elapsed, 1)
        self.scans_in_last_interval = 0
        self.last_hz_calc_time = now
        print(f"[YDLIDAR DIRECT] Scans: {self.scans_published:<5} ({self.current_scan_hz:>4.1f} Hz) | "
              f"Bytes: {self.total_bytes_rx:<8} | Valid Pkts: {self.valid_packets_rx:<6} | CRC Errs: {self.crc_errors}")


def main(args=None):
    port = DEFAULT_SERIAL_PORT
    for i, a in enumerate(sys.argv):
        if a == "--port" and i + 1 < len(sys.argv):
            port = sys.argv[i + 1]

    is_mock = ("--mock" in sys.argv or "--demo" in sys.argv)

    if ROS2_AVAILABLE:
        try:
            rclpy.init(args=args)
            driver = YdlidarDirectNode(port=port, is_mock=is_mock)
            worker = threading.Thread(target=driver.run_mock_loop if is_mock else driver.run, daemon=True)
            worker.start()
            print("[ROS 2] Initialized node 'ydlidar_direct_driver' publishing on /scan")
            try:
                rclpy.spin(driver)
            except (KeyboardInterrupt, Exception):
                pass
        except Exception as e:
            print(f"[ROS 2] Notice: {e}")
        finally:
            try:
                if 'driver' in locals():
                    driver.running = False
                    driver.destroy_node()
                if rclpy.ok():
                    rclpy.shutdown()
            except Exception:
                pass

    else:
        driver = YdlidarDirectNode(port=port, is_mock=is_mock)
        if is_mock:
            driver.run_mock_loop()
        else:
            driver.run()


if __name__ == "__main__":
    main()

