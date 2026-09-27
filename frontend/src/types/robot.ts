export type RobotState = 'OFFLINE' | 'CONNECTING' | 'IDLE' | 'MAPPING' | 'MANUAL_CONTROL' | 'MAP_READY' | 'WAITING_FOR_DESTINATION' | 'NAVIGATING' | 'OBSTACLE_DETECTED' | 'WAITING_AT_DESTINATION' | 'RETURNING_HOME' | 'CHARGING' | 'EMERGENCY_STOP' | 'ERROR';

export interface RobotStatus {
  robot_id: string;
  name: string;
  state: RobotState;
  connection_status: 'ONLINE' | 'OFFLINE';
  battery: number;
  charging: boolean;
  position: { x: number; y: number };
  orientation: number;
  velocity: number;
  current_destination: string | null;
  navigation_progress: number;
  distance_remaining: number;
  estimated_time_remaining: number;
  last_heartbeat: string;
}

export interface SensorData {
  lidar: { active: boolean; scan_rate: number; points: number; range: number; rays: Array<{angle: number; distance: number}> };
  camera: { connected: boolean; obstacle_detected: boolean; obstacle_type: string | null; distance: number | null };
  ultrasonic: { front: number; left: number; right: number; rear: number };
  glass_detected: boolean;
}
