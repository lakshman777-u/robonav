export type RobotState = 'OFFLINE' | 'CONNECTING' | 'IDLE' | 'MAPPING' | 'MANUAL_CONTROL' | 'MAP_READY' | 'WAITING_FOR_DESTINATION' | 'NAVIGATING' | 'OBSTACLE_DETECTED' | 'WAITING_AT_DESTINATION' | 'RETURNING_HOME' | 'CHARGING' | 'EMERGENCY_STOP' | 'ERROR';

export interface HardwareStatus {
  pc_server: string;
  esp32: string;
  websocket: string;
  camera: string;
  lidar: string;
  ultrasonic: string;
  motor_controller: string;
  udp_bridge?: string;
}

export interface BridgeMetrics {
  active: boolean;
  last_seen: number;
  robot_id: string;
  udp_packets_rx: number;
  udp_bytes_rx: number;
  dropped_packets: number;
  scans_published: number;
  scan_hz: number;
  wifi_rssi: number;
  esp32_crc_errors: number;
  esp32_lidar_rx_bytes?: number;
  esp32_lidar_packets?: number;
  sender_ip: string;
}

export interface RobotStatus {
  robot_id: string;
  name: string;
  robot_type?: string;
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
  last_heartbeat?: string;
  hardware?: HardwareStatus;
  bridge?: BridgeMetrics;
  trajectory?: Array<{ x: number; y: number }>;
  oled_expression?: string;
  motors?: {
    state: string;
    left_speed: number;
    right_speed: number;
  };
}

export interface SensorData {
  lidar: { 
    active: boolean; 
    scan_rate: number; 
    points: number; 
    range: number; 
    rays: Array<{angle: number; distance: number}>;
    status?: string;
    packets?: number;
  };
  camera: { 
    connected: boolean; 
    status?: string;
    fps?: number;
    resolution?: string;
    obstacle_detected: boolean; 
    obstacle_type: string | null; 
    distance: number | null;
  };
  ultrasonic: { 
    front: number; 
    side?: number;
    left?: number; 
    right?: number; 
    rear?: number; 
    status?: string;
  };
  oled_expression?: string;
  glass_detected: boolean;
  bridge?: BridgeMetrics;
}

