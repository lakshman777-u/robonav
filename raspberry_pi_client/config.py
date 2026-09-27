import os
from dotenv import load_dotenv

load_dotenv()

ROBOT_ID = os.getenv("ROBOT_ID")
ROBOT_API_KEY = os.getenv("ROBOT_API_KEY")
SERVER_URL = os.getenv("SERVER_URL", "http://localhost:8000")
WS_URL = os.getenv("WS_URL", "ws://localhost:8000")

if not ROBOT_ID or not ROBOT_API_KEY:
    raise ValueError("ROBOT_ID and ROBOT_API_KEY environment variables must be set.")
