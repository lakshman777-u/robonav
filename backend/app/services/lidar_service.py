import os
import glob
import time
import signal
import subprocess
from typing import Dict, Any, Optional

lidar_process: Optional[subprocess.Popen] = None
process_start_time: float = 0.0

def detect_lidar_port() -> Optional[str]:
    """Finds active USB serial port for YDLIDAR X2."""
    for pattern in ["/dev/ttyUSB*", "/dev/ttyACM*"]:
        matches = glob.glob(pattern)
        if matches:
            return matches[0]
    return None

def is_driver_running() -> bool:
    """Checks if the YDLIDAR X2 direct driver is currently running."""
    global lidar_process
    if lidar_process is not None:
        if lidar_process.poll() is None:
            return True
        else:
            lidar_process = None

    # Check via pgrep
    try:
        out = subprocess.check_output(["pgrep", "-f", "ydlidar_direct_driver.py"]).decode().strip()
        return len(out) > 0
    except Exception:
        return False

def start_driver(mock: bool = False, port: Optional[str] = None) -> Dict[str, Any]:
    """Starts the YDLIDAR direct driver in background."""
    global lidar_process, process_start_time

    if is_driver_running():
        return {
            "status": "already_running",
            "message": "YDLIDAR driver is already running.",
            "port": detect_lidar_port() or "unknown"
        }

    detected_port = port or detect_lidar_port()
    driver_script = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../../ros2_bridge/ydlidar_direct_driver.py")
    )

    if not os.path.exists(driver_script):
        return {"status": "error", "message": f"Driver script not found at {driver_script}"}

    cmd = ["python3", driver_script]
    if mock or (not detected_port):
        cmd.append("--mock")
    elif detected_port:
        cmd.extend(["--port", detected_port])

    try:
        lidar_process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid
        )
        process_start_time = time.time()
        return {
            "status": "started",
            "pid": lidar_process.pid,
            "port": detected_port if not mock else "MOCK_SIMULATOR",
            "mode": "mock" if (mock or not detected_port) else "hardware"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def stop_driver() -> Dict[str, Any]:
    """Stops the YDLIDAR driver cleanly."""
    global lidar_process

    # Kill managed process
    if lidar_process is not None:
        try:
            os.killpg(os.getpgid(lidar_process.pid), signal.SIGTERM)
        except Exception:
            try:
                lidar_process.terminate()
            except Exception:
                pass
        lidar_process = None

    # Also kill any orphan processes
    try:
        subprocess.run(["pkill", "-f", "ydlidar_direct_driver.py"], timeout=2)
    except Exception:
        pass

    return {"status": "stopped", "message": "YDLIDAR driver stopped."}

def get_lidar_status() -> Dict[str, Any]:
    """Returns combined hardware detection, process, and telemetry status."""
    from app.api.robot import bridge_metrics
    from app.simulation.robot_simulator import simulator
    running = is_driver_running()
    detected_port = detect_lidar_port()
    now = time.time()
    last_seen = bridge_metrics.get("last_seen", 0.0)
    is_hw_streaming = (now - last_seen < 2.5) if last_seen > 0 else False
    is_streaming = is_hw_streaming or (simulator.is_running and len(simulator.lidar_rays) > 0)

    return {
        "hardware_detected": detected_port is not None,
        "port": detected_port or "None (Plug in USB)",
        "driver_running": running or simulator.is_running,
        "is_streaming": is_streaming,
        "scan_hz": bridge_metrics.get("scan_hz", 0.0) if is_hw_streaming else (10.0 if simulator.is_running else 0.0),
        "scans_published": bridge_metrics.get("scans_published", 0) if is_hw_streaming else (len(simulator.lidar_rays) * 10),
        "packets_rx": bridge_metrics.get("udp_packets_rx", 0),
        "bytes_rx": bridge_metrics.get("udp_bytes_rx", 0),
        "crc_errors": bridge_metrics.get("dropped_packets", 0),
        "last_seen_sec": round(now - last_seen, 1) if is_hw_streaming else (0.1 if simulator.is_running else -1)
    }
