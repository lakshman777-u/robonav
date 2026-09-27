import abc
import math
import random
import time

class RadarSensor(abc.ABC):
    """Abstract LiDAR/Radar sensor interface."""
    @abc.abstractmethod
    def scan(self) -> list[dict]:
        """Returns list of {angle, distance} readings."""
        pass
    
    @abc.abstractmethod
    def get_status(self) -> dict:
        pass

class CameraSensor(abc.ABC):
    """Abstract camera sensor interface."""
    @abc.abstractmethod
    def detect_obstacles(self) -> list[dict]:
        """Returns list of detected obstacles with type and distance."""
        pass
    
    @abc.abstractmethod
    def get_status(self) -> dict:
        pass

class UltrasonicSensor(abc.ABC):
    """Abstract ultrasonic sensor interface."""
    @abc.abstractmethod
    def measure_distance(self) -> float:
        """Returns distance in meters."""
        pass
    
    @abc.abstractmethod
    def get_status(self) -> dict:
        pass

class SimulatedRadarSensor(RadarSensor):
    def scan(self) -> list[dict]:
        readings = []
        for angle in range(0, 360, 5):
            distance = 5.0 + random.uniform(-0.5, 0.5)
            readings.append({"angle": angle, "distance": distance})
        return readings
        
    def get_status(self) -> dict:
        return {"active": True, "scan_rate": 10, "range": 8.0}

class SimulatedCameraSensor(CameraSensor):
    def detect_obstacles(self) -> list[dict]:
        if random.random() < 0.1:
            return [{"type": "person", "distance": random.uniform(1.0, 5.0)}]
        return []
        
    def get_status(self) -> dict:
        return {"active": True, "scan_rate": 10, "range": 8.0}

class SimulatedUltrasonicSensor(UltrasonicSensor):
    def measure_distance(self) -> float:
        return random.uniform(0.1, 4.0)
        
    def get_status(self) -> dict:
        return {"active": True, "range": 4.0}

class RealRadarSensor(RadarSensor):
    def scan(self) -> list[dict]:
        # TODO: Implement with real hardware, e.g., RPLiDAR library
        raise NotImplementedError("Real hardware not implemented yet")
        
    def get_status(self) -> dict:
        raise NotImplementedError("Real hardware not implemented yet")

class RealCameraSensor(CameraSensor):
    def detect_obstacles(self) -> list[dict]:
        # TODO: Implement with real hardware, e.g., picamera2 + object detection model
        raise NotImplementedError("Real hardware not implemented yet")
        
    def get_status(self) -> dict:
        raise NotImplementedError("Real hardware not implemented yet")

class RealUltrasonicSensor(UltrasonicSensor):
    def measure_distance(self) -> float:
        # TODO: Implement with real hardware, e.g., RPi.GPIO for HC-SR04
        raise NotImplementedError("Real hardware not implemented yet")
        
    def get_status(self) -> dict:
        raise NotImplementedError("Real hardware not implemented yet")
