export type WSMessageType = 'robot_status' | 'sensor_data' | 'lidar_scan' | 'map_update' | 'obstacle_detected' | 'navigation_status' | 'destination_reached' | 'battery_update' | 'heartbeat' | 'error' | 'command_ack' | 'log_event' | 'navigation_path' | 'mapping_progress';

export interface WSMessage {
  type: WSMessageType;
  [key: string]: any;
}
