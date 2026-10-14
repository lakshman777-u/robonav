import math
import time
from typing import List, Dict, Any, Tuple, Optional

class LidarOdometry:
    """
    2D LiDAR Odometry & Scan Matcher using Closed-Form ICP.
    Tracks robot/laptop displacement (x, y, orientation) in real-time as the user
    walks or drives from room to room, matching consecutive 360-degree scans.
    """
    def __init__(self):
        self.x = 0.0
        self.y = 0.0
        self.orientation = 0.0  # in degrees (0 = forward, counter-clockwise)
        self.is_tracking = False
        self.ref_points: List[Tuple[float, float]] = []  # Reference keyframe points (local frame)
        self.trajectory: List[Dict[str, float]] = [{"x": 0.0, "y": 0.0}]
        self.last_update_time = time.time()
        self.last_keyframe_time = time.time()
        self.keyframe_x = 0.0
        self.keyframe_y = 0.0
        self.keyframe_ori = 0.0

    def start(self, x: float = 0.0, y: float = 0.0, orientation: float = 0.0):
        self.x = float(x)
        self.y = float(y)
        self.orientation = float(orientation)
        self.is_tracking = True
        self.ref_points = []
        self.trajectory = [{"x": round(self.x, 2), "y": round(self.y, 2)}]
        self.keyframe_x = self.x
        self.keyframe_y = self.y
        self.keyframe_ori = self.orientation
        self.last_update_time = time.time()
        self.last_keyframe_time = time.time()

    def stop(self):
        self.is_tracking = False

    def reset(self, x: float = 0.0, y: float = 0.0, orientation: float = 0.0):
        self.start(x, y, orientation)

    def update(self, rays: List[Dict[str, float]]) -> Tuple[float, float, float]:
        """
        Takes raw 360-degree rays from YDLIDAR X2, computes (dx, dy, dtheta)
        using fast 2D rigid ICP alignment, and updates global pose.
        Returns (x, y, orientation_degrees).
        """
        now = time.time()
        dt = max(0.01, now - self.last_update_time)
        self.last_update_time = now

        # Convert valid rays (0.15m to 7.5m) to local 2D cartesian points (meters)
        current_pts: List[Tuple[float, float]] = []
        for r in rays:
            dist = r.get("distance", 0.0)
            if dist < 0.15 or dist > 7.5:
                continue
            deg = r.get("angle", 0.0)
            rad = math.radians(deg)
            # Local sensor coordinate (x: forward, y: left)
            px = dist * math.cos(rad)
            py = dist * math.sin(rad)
            current_pts.append((px, py))

        if len(current_pts) < 15:
            return self.x, self.y, self.orientation

        # Subsample: every 2nd point provides ~180 points, optimal speed & accuracy
        pts_sample = current_pts[::2]

        # Initialize reference keyframe on first scan
        if not self.ref_points:
            self.ref_points = pts_sample
            self.keyframe_x = self.x
            self.keyframe_y = self.y
            self.keyframe_ori = self.orientation
            return self.x, self.y, self.orientation

        # Fast 2D Closed-Form ICP Match against reference keyframe
        # Solves for translation (tx, ty) and rotation dth in local sensor frame
        tx, ty, dth_rad = 0.0, 0.0, 0.0
        max_correspondence_dist_sq = 0.45 ** 2  # 45 cm search radius

        for _ in range(5):  # 5 iterations converges to high precision in ~1ms
            cos_t = math.cos(dth_rad)
            sin_t = math.sin(dth_rad)
            matched_src: List[Tuple[float, float]] = []
            matched_ref: List[Tuple[float, float]] = []

            for px, py in pts_sample:
                # Transform point by candidate estimate
                qx = px * cos_t - py * sin_t + tx
                qy = px * sin_t + py * cos_t + ty

                # Find closest neighbor in reference keyframe
                best_d2 = max_correspondence_dist_sq
                best_ref = None
                for rx, ry in self.ref_points:
                    d2 = (qx - rx) ** 2 + (qy - ry) ** 2
                    if d2 < best_d2:
                        best_d2 = d2
                        best_ref = (rx, ry)

                if best_ref is not None:
                    matched_src.append((px, py))
                    matched_ref.append(best_ref)

            if len(matched_src) < 12:
                break

            n = len(matched_src)
            mx = sum(p[0] for p in matched_src) / n
            my = sum(p[1] for p in matched_src) / n
            mrx = sum(r[0] for r in matched_ref) / n
            mry = sum(r[1] for r in matched_ref) / n

            # Closed-form 2D cross-covariance alignment
            s_xy = sum((p[0] - mx) * (r[1] - mry) - (p[1] - my) * (r[0] - mrx) for p, r in zip(matched_src, matched_ref))
            c_xy = sum((p[0] - mx) * (r[0] - mrx) + (p[1] - my) * (r[1] - mry) for p, r in zip(matched_src, matched_ref))
            dth_rad = math.atan2(s_xy, c_xy)
            tx = mrx - (mx * math.cos(dth_rad) - my * math.sin(dth_rad))
            ty = mry - (mx * math.sin(dth_rad) + my * math.cos(dth_rad))

        dth_deg = math.degrees(dth_rad)

        # Sanity check: walking / driving limits (max 0.40m per scan, max 25 deg per scan)
        step_len = math.hypot(tx, ty)
        if step_len > 0.40 or abs(dth_deg) > 25.0:
            # Out of bounds jump: ignore this frame's delta to avoid wild glitch
            return self.x, self.y, self.orientation

        # Project displacement from keyframe into global world coordinates
        rad_key = math.radians(self.keyframe_ori)
        global_step_x = tx * math.cos(rad_key) - ty * math.sin(rad_key)
        global_step_y = tx * math.sin(rad_key) + ty * math.cos(rad_key)

        new_x = self.keyframe_x + global_step_x
        new_y = self.keyframe_y + global_step_y
        new_ori = (self.keyframe_ori + dth_deg + 360.0) % 360.0

        # Update pose
        self.x = round(new_x, 3)
        self.y = round(new_y, 3)
        self.orientation = round(new_ori, 1)

        # Record trajectory breadcrumbs if moved by at least 4 cm
        last_traj = self.trajectory[-1]
        if math.hypot(self.x - last_traj["x"], self.y - last_traj["y"]) >= 0.04:
            self.trajectory.append({"x": self.x, "y": self.y})
            if len(self.trajectory) > 600:
                self.trajectory = self.trajectory[-600:]

        # Keyframe transition: if moved > 0.20m or rotated > 12 deg from keyframe,
        # update keyframe to current points
        dist_from_key = math.hypot(self.x - self.keyframe_x, self.y - self.keyframe_y)
        angle_from_key = abs(self.orientation - self.keyframe_ori)
        if angle_from_key > 180:
            angle_from_key = 360 - angle_from_key

        if dist_from_key >= 0.20 or angle_from_key >= 12.0 or (now - self.last_keyframe_time > 1.5):
            self.ref_points = pts_sample
            self.keyframe_x = self.x
            self.keyframe_y = self.y
            self.keyframe_ori = self.orientation
            self.last_keyframe_time = now

        return self.x, self.y, self.orientation

lidar_odometry = LidarOdometry()
