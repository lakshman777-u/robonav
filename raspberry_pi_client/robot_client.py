#!/usr/bin/env python3
"""
RoboNav - Raspberry Pi Robot Client
Main entry point for the robot control software.
"""

import asyncio
import aiohttp
import logging
import signal
import sys
import time

from config import ROBOT_ID, ROBOT_API_KEY, SERVER_URL, WS_URL
from sensors import SimulatedRadarSensor, SimulatedCameraSensor, SimulatedUltrasonicSensor
from robot_controller import SimulatedMotorController
from websocket_client import RobotWebSocketClient

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RobotApp:
    def __init__(self):
        self.access_token = None
        self.ws_client = None
        
        self.radar = SimulatedRadarSensor()
        self.camera = SimulatedCameraSensor()
        self.ultrasonic = SimulatedUltrasonicSensor()
        self.motor = SimulatedMotorController()
        
        self.running = True
        self.mapping = False
        self.navigating = False

    async def authenticate(self):
        auth_url = f"{SERVER_URL}/api/robot/auth"
        payload = {"robot_id": ROBOT_ID, "api_key": ROBOT_API_KEY}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(auth_url, json=payload) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.access_token = data.get("access_token")
                        logger.info("Successfully authenticated with the backend.")
                        return True
                    else:
                        logger.error(f"Authentication failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"Failed to connect to backend for auth: {e}")
            return False

    async def telemetry_loop(self):
        while self.running:
            if self.ws_client and self.ws_client.is_connected:
                # Send telemetry data at 10Hz
                battery = 85.0
                state = self.motor.get_status()["state"]
                
                await self.ws_client.send_status({
                    "robot_id": ROBOT_ID,
                    "battery": battery,
                    "state": state,
                    "position": {"x": 0.0, "y": 0.0},
                    "orientation": 0.0,
                    "velocity": self.motor.get_status()["speed"],
                    "destination": None
                })
                
                # Send sensor data
                await self.ws_client.send_sensor_data({
                    "lidar": self.radar.get_status(),
                    "camera": self.camera.get_status(),
                    "ultrasonic": self.ultrasonic.get_status()
                })
                
            await asyncio.sleep(0.1)

    async def handle_command(self, msg):
        cmd_type = msg.get("type")
        logger.info(f"Received command: {cmd_type}")
        
        if cmd_type == "manual_command":
            action = msg.get("command")
            if action == "MOVE_FORWARD":
                self.motor.move_forward()
            elif action == "MOVE_BACKWARD":
                self.motor.move_backward()
            elif action == "TURN_LEFT":
                self.motor.turn_left()
            elif action == "TURN_RIGHT":
                self.motor.turn_right()
            elif action == "STOP":
                self.motor.stop()
        elif cmd_type == "emergency_stop":
            self.motor.emergency_stop()
            await self.ws_client.send_status({"state": "emergency_stopped"})
        elif cmd_type == "start_mapping":
            self.mapping = True
        elif cmd_type == "stop_mapping":
            self.mapping = False
        elif cmd_type == "navigation_goal":
            self.navigating = True
        elif cmd_type == "cancel_navigation":
            self.navigating = False
            self.motor.stop()
        elif cmd_type == "return_home":
            self.navigating = True
        elif cmd_type == "pause":
            self.motor.stop()
        elif cmd_type == "resume":
            pass # Implement resume logic

    async def run(self):
        logger.info("Starting RoboNav Client...")
        auth_success = await self.authenticate()
        if not auth_success:
            logger.error("Exiting due to authentication failure.")
            return

        self.ws_client = RobotWebSocketClient(WS_URL, self.access_token)
        await self.ws_client.connect()

        # Start tasks
        telemetry_task = asyncio.create_task(self.telemetry_loop())
        cmd_receive_task = asyncio.create_task(self.ws_client.receive_commands(self.handle_command))

        try:
            while self.running:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            pass
        finally:
            self.running = False
            telemetry_task.cancel()
            cmd_receive_task.cancel()
            await self.ws_client.disconnect()
            logger.info("RoboNav Client shutdown complete.")

    def shutdown(self):
        logger.info("Shutdown signal received.")
        self.running = False
        self.motor.stop()

def main():
    app = RobotApp()
    
    def signal_handler(sig, frame):
        app.shutdown()
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    asyncio.run(app.run())

if __name__ == "__main__":
    main()
