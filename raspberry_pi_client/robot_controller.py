import abc

class MotorController(abc.ABC):
    @abc.abstractmethod
    def move_forward(self, speed: float = 0.3) -> None: pass
    
    @abc.abstractmethod
    def move_backward(self, speed: float = 0.15) -> None: pass
    
    @abc.abstractmethod
    def turn_left(self, angle: float = 5.0) -> None: pass
    
    @abc.abstractmethod
    def turn_right(self, angle: float = 5.0) -> None: pass
    
    @abc.abstractmethod
    def stop(self) -> None: pass
    
    @abc.abstractmethod
    def emergency_stop(self) -> None: pass
    
    @abc.abstractmethod
    def get_status(self) -> dict: pass

class SimulatedMotorController(MotorController):
    def __init__(self):
        self.state = "stopped"
        self.speed = 0.0
        
    def move_forward(self, speed: float = 0.3) -> None:
        self.state = "moving_forward"
        self.speed = speed
        
    def move_backward(self, speed: float = 0.15) -> None:
        self.state = "moving_backward"
        self.speed = speed
        
    def turn_left(self, angle: float = 5.0) -> None:
        self.state = "turning_left"
        self.speed = 0.1
        
    def turn_right(self, angle: float = 5.0) -> None:
        self.state = "turning_right"
        self.speed = 0.1
        
    def stop(self) -> None:
        self.state = "stopped"
        self.speed = 0.0
        
    def emergency_stop(self) -> None:
        self.state = "emergency_stopped"
        self.speed = 0.0
        
    def get_status(self) -> dict:
        return {"state": self.state, "speed": self.speed}

class RealMotorController(MotorController):
    def __init__(self):
        # TODO: Initialize L298N or similar motor driver via RPi.GPIO or gpiozero
        pass

    def move_forward(self, speed: float = 0.3) -> None:
        # TODO: Send PWM signals to move forward
        raise NotImplementedError()
    
    def move_backward(self, speed: float = 0.15) -> None:
        raise NotImplementedError()
    
    def turn_left(self, angle: float = 5.0) -> None:
        raise NotImplementedError()
    
    def turn_right(self, angle: float = 5.0) -> None:
        raise NotImplementedError()
    
    def stop(self) -> None:
        raise NotImplementedError()
    
    def emergency_stop(self) -> None:
        raise NotImplementedError()
    
    def get_status(self) -> dict:
        raise NotImplementedError()
