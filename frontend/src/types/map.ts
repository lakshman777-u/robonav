export interface MapData {
  map_id: string;
  name: string;
  resolution: number;
  width: number;
  height: number;
  origin: { x: number; y: number };
  occupancy_grid: number[];  // flat array, -1=unknown, 0=free, 100=occupied
  start_position: { x: number; y: number };
  status: 'building' | 'ready';
}

export interface MapUpdate {
  type: 'map_update';
  cells: Array<{ x: number; y: number; value: number }>;
  coverage: number;
}
