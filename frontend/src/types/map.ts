export interface MapData {
  map_id: string;
  name: string;
  resolution: number;
  width: number;
  height: number;
  origin: { x: number; y: number };
  origin_x?: number;
  origin_y?: number;
  occupancy_grid: number[];  // flat array, -1=unknown, 0=free, 100=occupied
  start_position: { x: number; y: number };
  status: 'building' | 'ready';
  loop_closures?: Array<{ id: string; x: number; y: number; label?: string }>;
  rooms?: Array<{ name: string; x: number; y: number }>;
}

export interface MapUpdate {
  type: 'map_update';
  cells: Array<{ x: number; y: number; value: number }>;
  coverage: number;
}
