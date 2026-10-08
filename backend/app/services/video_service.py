import asyncio
import io
import time
from typing import Optional, Dict, Any
from datetime import datetime

# Attempt to import cv2 and PIL for image generation/processing
try:
    import cv2
    import numpy as np
    HAVE_CV2 = True
except ImportError:
    HAVE_CV2 = False

try:
    from PIL import Image, ImageDraw, ImageFont
    HAVE_PIL = True
except ImportError:
    HAVE_PIL = False

class VideoService:
    def __init__(self):
        self.latest_frame: Optional[bytes] = None
        self.latest_frame_time: float = 0
        self.frame_count: int = 0
        self.fps: float = 0.0
        self.resolution: str = "640x480"
        self.camera_status: str = "STANDBY"
        self.is_real_robot_connected: bool = False
        self.simulation_mode: bool = True
        
        # Computer Vision obstacle detection results
        self.cv_obstacle_detected: bool = False
        self.cv_obstacle_type: Optional[str] = None
        self.cv_obstacle_distance: Optional[float] = None
        
        self._fps_timer = time.time()
        self._fps_frames = 0
        self._sim_heading = 0.0
        self._sim_speed = 0.0

    def update_real_frame(self, frame_bytes: bytes):
        """Called when ESP32-CAM pushes a new JPEG frame."""
        self.latest_frame = frame_bytes
        self.latest_frame_time = time.time()
        self.is_real_robot_connected = True
        self.camera_status = "STREAMING"
        
        # Calculate real FPS
        self._fps_frames += 1
        now = time.time()
        dt = now - self._fps_timer
        if dt >= 1.0:
            self.fps = round(self._fps_frames / dt, 1)
            self._fps_frames = 0
            self._fps_timer = now
            
        # Run computer vision processing if OpenCV is available
        self._process_frame_for_obstacles(frame_bytes)

    def set_real_robot_status(self, connected: bool):
        self.is_real_robot_connected = connected
        if not connected:
            self.camera_status = "OFFLINE"
            self.fps = 0.0

    def set_sim_context(self, heading: float, speed: float, sim_mode: bool = True):
        self._sim_heading = heading
        self._sim_speed = speed
        self.simulation_mode = sim_mode

    def _process_frame_for_obstacles(self, frame_bytes: bytes):
        """PC-side Computer Vision obstacle analysis."""
        if not HAVE_CV2:
            return
        try:
            nparr = np.frombuffer(frame_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                return
            h, w = img.shape[:2]
            self.resolution = f"{w}x{h}"
            
            # Center region of interest (path directly ahead of robot)
            roi_y1 = int(h * 0.45)
            roi_y2 = int(h * 0.95)
            roi_x1 = int(w * 0.25)
            roi_x2 = int(w * 0.75)
            roi = img[roi_y1:roi_y2, roi_x1:roi_x2]
            
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 50, 150)
            
            edge_density = np.sum(edges > 0) / float(edges.size)
            if edge_density > 0.12:
                self.cv_obstacle_detected = True
                self.cv_obstacle_type = "HAZARD / OBJECT"
                self.cv_obstacle_distance = round(max(0.3, 1.8 - edge_density * 4.0), 2)
            else:
                self.cv_obstacle_detected = False
                self.cv_obstacle_type = None
                self.cv_obstacle_distance = None
        except Exception:
            pass

    def get_status(self) -> Dict[str, Any]:
        is_live = self.is_real_robot_connected or self.simulation_mode
        status = "STREAMING" if is_live else "OFFLINE"
        return {
            "status": status,
            "camera_status": "ACTIVE" if is_live else "OFFLINE",
            "connection_status": "ONLINE" if self.is_real_robot_connected else ("SIMULATED" if self.simulation_mode else "OFFLINE"),
            "fps": self.fps if self.is_real_robot_connected else (24.0 if self.simulation_mode else 0.0),
            "resolution": self.resolution,
            "latency_ms": 28 if self.is_real_robot_connected else (5 if self.simulation_mode else 0),
            "obstacle_detected": self.cv_obstacle_detected,
            "obstacle_type": self.cv_obstacle_type,
            "obstacle_distance": self.cv_obstacle_distance,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    def generate_simulated_frame(self) -> bytes:
        """Generates synthetic perspective camera frame for simulation mode."""
        width, height = 640, 480
        t = time.time()
        
        if HAVE_CV2:
            frame = np.zeros((height, width, 3), dtype=np.uint8)
            # Ceiling / Upper walls (Deep slate gradient)
            frame[0:int(height*0.5)] = [18, 14, 28]
            # Horizon line
            cv2.line(frame, (0, int(height*0.5)), (width, int(height*0.5)), (60, 50, 90), 2)
            
            # Floor (Carbon slate ground with perspective grid lines)
            frame[int(height*0.5):height] = [12, 10, 18]
            
            # Perspective grid converging to vanishing point
            vp_x = int(width * 0.5 + np.sin(self._sim_heading * np.pi / 180.0) * 80.0)
            vp_y = int(height * 0.5)
            
            for offset_x in range(-300, 301, 100):
                base_x = int(width * 0.5 + offset_x * 1.8)
                cv2.line(frame, (vp_x, vp_y), (base_x, height), (35, 45, 65), 1)
                
            # Moving corridor floor horizontal lines
            speed_phase = int((t * max(10, self._sim_speed * 120)) % 40)
            for y_off in range(int(height*0.5), height, 25):
                cur_y = y_off + speed_phase // 2
                if cur_y < height:
                    cv2.line(frame, (0, cur_y), (width, cur_y), (25, 35, 50), 1)
                    
            # Hypercar hood / front bumper perspective overlay at bottom
            hood_pts = np.array([
                [int(width*0.25), height],
                [int(width*0.35), int(height*0.82)],
                [int(width*0.65), int(height*0.82)],
                [int(width*0.75), height]
            ], np.int32)
            cv2.fillPoly(frame, [hood_pts], (20, 20, 30))
            cv2.polylines(frame, [hood_pts], True, (0, 200, 255), 2)
            
            # Cockpit crosshair HUD
            cv2.drawMarker(frame, (vp_x, vp_y), (0, 220, 255), cv2.MARKER_CROSS, 20, 1)
            
            # HUD text
            cv2.putText(frame, "ESP32-CAM [SIMULATED POV]", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 240, 255), 2)
            cv2.putText(frame, f"FPS: 24.0 | RES: 640x480 | SPEED: {abs(self._sim_speed):.2f} m/s", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 200), 1)
            cv2.putText(frame, f"HEADING: {self._sim_heading:.1f} DEG", (20, 85), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (180, 180, 200), 1)
            
            # Live timestamp
            ts_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%f")[:-4]
            cv2.putText(frame, ts_str, (width - 240, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 120), 1)
            
            _, jpeg = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            return jpeg.tobytes()
        elif HAVE_PIL:
            img = Image.new('RGB', (width, height), color=(10, 12, 20))
            draw = ImageDraw.Draw(img)
            draw.text((20, 30), "ESP32-CAM [SIMULATED POV]", fill=(0, 240, 255))
            draw.text((20, 60), f"FPS: 24.0 | RES: 640x480", fill=(180, 180, 200))
            draw.text((20, 90), f"TIMESTAMP: {datetime.utcnow().isoformat()}", fill=(0, 255, 120))
            buf = io.BytesIO()
            img.save(buf, format='JPEG')
            return buf.getvalue()
        else:
            return self._make_fallback_jpeg(width, height)

    def _make_fallback_jpeg(self, width: int = 640, height: int = 480) -> bytes:
        """Pure Python fallback baseline JPEG frame."""
        q_table = bytes([
            16, 11, 10, 16, 24, 40, 51, 61,
            12, 12, 14, 19, 26, 58, 60, 55,
            14, 13, 16, 24, 40, 57, 69, 56,
            14, 17, 22, 29, 51, 87, 80, 62,
            18, 22, 37, 56, 68, 109, 103, 77,
            24, 35, 55, 64, 81, 104, 113, 92,
            49, 64, 78, 87, 103, 121, 120, 101,
            72, 92, 95, 98, 112, 100, 103, 99
        ])
        dc_bits = bytes([0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
        dc_vals = bytes([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
        header = bytearray(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00')
        header += b'\xff\xdb\x00\x43\x00' + q_table
        header += b'\xff\xc0\x00\x0b\x08' + height.to_bytes(2, 'big') + width.to_bytes(2, 'big') + b'\x01\x01\x11\x00'
        header += b'\xff\xc4' + (len(dc_bits) + len(dc_vals) + 3).to_bytes(2, 'big') + b'\x00' + dc_bits + dc_vals
        header += b'\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\x7f\x00\xff\xd9'
        return bytes(header)

    async def mjpeg_frame_generator(self):
        """Yields multipart/x-mixed-replace MJPEG stream frames."""
        while True:
            now = time.time()
            if self.is_real_robot_connected and self.latest_frame and (now - self.latest_frame_time < 3.0):
                frame_data = self.latest_frame
            elif self.simulation_mode:
                frame_data = self.generate_simulated_frame()
            else:
                frame_data = self.generate_offline_frame()

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + frame_data + b"\r\n"
            )
            await asyncio.sleep(0.066) # ~15 FPS stream

video_service = VideoService()
