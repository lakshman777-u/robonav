export interface Destination {
  id: string;
  dest_id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  status: 'active' | 'inactive';
}

export interface NavigationPath {
  path: Array<{ x: number; y: number }>;
  distance: number;
  estimated_time: number;
}

export interface NavigationHistory {
  id: string;
  timestamp: string;
  username: string;
  destination_name: string;
  distance: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'failed';
}
