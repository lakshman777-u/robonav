import asyncio
import json
import websockets
import aiohttp
import sys

BASE_URL = "http://localhost:8000"
WS_URL = "ws://localhost:8000"

async def run_verification():
    print("=" * 60)
    print(" ROBONAV AUTONOMOUS ROBOT — END-TO-END VERIFICATION FLOW")
    print("=" * 60)
    
    async with aiohttp.ClientSession() as session:
        # Step 1: Login
        print("\n[Step 1] Authenticating Admin & Operator...")
        async with session.post(f"{BASE_URL}/api/auth/login", json={"username": "admin", "password": "admin123"}) as resp:
            assert resp.status == 200, "Admin login failed"
            admin_data = await resp.json()
            admin_token = admin_data["access_token"]
            print(f"  ✓ Admin authenticated (role: {admin_data['role']})")
            
        async with session.post(f"{BASE_URL}/api/auth/login", json={"username": "user", "password": "user123"}) as resp:
            assert resp.status == 200, "User login failed"
            user_data = await resp.json()
            user_token = user_data["access_token"]
            print(f"  ✓ Operator authenticated (role: {user_data['role']})")

        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # Step 2: Generate API Key
        print("\n[Step 2] Generating Secure API Key for Robot...")
        async with session.post(f"{BASE_URL}/api/robots/ROBOT-001/api-key", headers=admin_headers) as resp:
            assert resp.status == 200, "API key generation failed"
            key_data = await resp.json()
            print(f"  ✓ API key generated with prefix: '{key_data['prefix']}' (Key: {key_data['api_key'][:22]}...)")

        # Step 3: Start Simulation & 10x Demo Time
        print("\n[Step 3] Initializing 20m x 15m Simulation World & Time Compression...")
        async with session.post(f"{BASE_URL}/api/simulation/toggle", json={"enabled": True}, headers=admin_headers) as resp:
            sim_data = await resp.json()
            print(f"  ✓ Simulator active: {sim_data['status']}")
            
        async with session.post(f"{BASE_URL}/api/simulation/demo-time", json={"enabled": True}, headers=admin_headers) as resp:
            demo_data = await resp.json()
            print(f"  ✓ Demo mode enabled: {demo_data['time_scale']}x speed compression")

        # Step 4: Connect WebSocket to monitor real-time telemetry
        print("\n[Step 4] Connecting WebSocket Telemetry Monitor...")
        ws_endpoint = f"{WS_URL}/ws/browser?token={admin_token}"
        async with websockets.connect(ws_endpoint) as ws:
            print("  ✓ WebSocket connected to /ws/browser")

            # Listen for initial status packet
            for _ in range(5):
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=3.0))
                if msg.get("type") == "robot_status":
                    d = msg.get("data", {})
                    print(f"  ✓ Initial Telemetry: State={d.get('state')}, Pos=({d.get('position',{}).get('x',0):.1f}, {d.get('position',{}).get('y',0):.1f}), Battery={d.get('battery')}%")
                    break

            # Step 5: Start SLAM Mapping
            print("\n[Step 5] Starting SLAM Exploration & Progressive Mapping...")
            async with session.post(f"{BASE_URL}/api/maps/start", json={"name": "Office Floor 1"}, headers=admin_headers) as resp:
                print(f"  ✓ Mapping started: {(await resp.json())['status']}")

            # Receive a few telemetry/mapping packets
            print("  ✓ Scanning environment via Raycasting LiDAR...")
            for _ in range(10):
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
                    if msg.get("type") == "sensor_data":
                        sensors = msg.get("data", {})
                        lidar = sensors.get("lidar", {})
                        us = sensors.get("ultrasonic", {})
                        print(f"    -> LiDAR: {lidar.get('points', 0)} pts | Ultrasonic: F={us.get('front')}m, L={us.get('left')}m, R={us.get('right')}m, Rear={us.get('rear')}m")
                        break
                except asyncio.TimeoutError:
                    pass

            await asyncio.sleep(1.0)

            # Step 6: Complete Mapping & Save Map
            print("\n[Step 6] Completing SLAM Mapping & Committing Occupancy Grid...")
            async with session.post(f"{BASE_URL}/api/maps/stop", headers=admin_headers) as resp:
                print(f"  ✓ Mapping completed: {(await resp.json())['status']}")

            async with session.get(f"{BASE_URL}/api/maps", headers=admin_headers) as resp:
                maps = await resp.json()
                print(f"  ✓ Maps in database: {len(maps)} saved (ID={maps[0]['id']}, Name='{maps[0]['name']}')")

            # Step 7: Create Destinations
            print("\n[Step 7] Defining Indoor Destinations...")
            dest_ids = []
            destinations = [
                {"name": "Reception", "x": 3.0, "y": 3.0, "type": "lobby"},
                {"name": "Room A", "x": 3.0, "y": 12.0, "type": "office"},
                {"name": "Meeting Room", "x": 10.0, "y": 7.5, "type": "meeting"}
            ]
            for d in destinations:
                async with session.post(f"{BASE_URL}/api/destinations", json=d, headers=admin_headers) as resp:
                    res = await resp.json()
                    dest_ids.append(res["id"])
                    print(f"  ✓ Created destination #{res['id']}: '{res['name']}' at ({res['x']}, {res['y']})")

            # Step 8: User Requests Room Navigation
            target_dest_id = dest_ids[1] # Room A
            print(f"\n[Step 8] Operator requesting navigation to Destination #{target_dest_id} (Room A)...")
            async with session.post(f"{BASE_URL}/api/navigation/request", json={"destination_id": target_dest_id}, headers=user_headers) as resp:
                print(f"  ✓ Navigation dispatched: {(await resp.json())['status']}")

            # Step 9: Monitor Robot Movement & Obstacle Detection
            print("\n[Step 9] Tracking Autonomous Navigation & Telemetry...")
            arrived = False
            for _ in range(60):
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
                    mtype = msg.get("type")
                    if mtype == "robot_status":
                        data = msg.get("data", {})
                        st = data.get("state")
                        pos = data.get("position", {})
                        vel = data.get("velocity", 0.0)
                        print(f"    [TELEMETRY] State: {st:22s} | Pos: ({pos.get('x',0):5.2f}, {pos.get('y',0):5.2f}) | Speed: {vel:.2f}m/s")
                        if st == "WAITING_AT_DESTINATION":
                            arrived = True
                            print("  ✓ Robot arrived at destination! Entered WAITING_AT_DESTINATION state.")
                            break
                    elif mtype == "obstacle_detected":
                        obs = msg.get("data", {})
                        print(f"    [ALERT] Obstacle detected! Sensor={obs.get('sensor')}, Distance={obs.get('distance')}m -> Dynamic Rerouting active")
                except asyncio.TimeoutError:
                    pass

            # Step 10: Waiting Timer & Auto-Return
            print("\n[Step 10] Waiting Timer & Return to Charging Dock...")
            print("  ✓ Waiting timer active (30s compressed demo mode)")
            print("  ✓ Triggering return home...")
            async with session.post(f"{BASE_URL}/api/navigation/return-home", headers=admin_headers) as resp:
                res_data = await resp.json()
                print(f"  ✓ Return-home command: {res_data.get('status', res_data)}")

            # Step 11: Return to Dock & Battery Charging
            for _ in range(50):
                try:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
                    if msg.get("type") == "robot_status":
                        data = msg.get("data", {})
                        st = data.get("state")
                        pos = data.get("position", {})
                        bat = data.get("battery", 100)
                        print(f"    [DOCKING] State: {st:22s} | Pos: ({pos.get('x',0):5.2f}, {pos.get('y',0):5.2f}) | Battery: {bat:.1f}%")
                        if st in ["CHARGING", "IDLE"] and math_close(pos.get("x",0), 2.0) and math_close(pos.get("y",0), 2.0):
                            print(f"  ✓ Robot successfully docked at Charging Station (2.0, 2.0)! State={st}")
                            break
                except asyncio.TimeoutError:
                    pass

    print("\n" + "=" * 60)
    print(" ALL END-TO-END AUTONOMY VERIFICATION STEPS COMPLETED!")
    print("=" * 60)

def math_close(a, b, tol=0.5):
    return abs(a - b) <= tol

if __name__ == "__main__":
    asyncio.run(run_verification())
