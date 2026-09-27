import { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, Volume2, VolumeX, Flag, Zap, 
  ArrowLeft, ArrowRight, Home, 
  AlertTriangle, Sofa, Bed, Utensils, Laptop, 
  Eye, Layers, Trees, ShieldAlert, Navigation, Sparkles, Crosshair
} from 'lucide-react';
import { useCarTrim, CarTrim } from '../context/CarTrimContext';

// Wall Segments for Raycasting & Physical Avoidance (Canvas: 920 x 560)
// Generous 110px-130px Doorways ensure zero clipping
export interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const HOUSE_WALLS: WallSegment[] = [
  // Outer perimeter boundary walls
  { x1: 20, y1: 20, x2: 900, y2: 20 },
  { x1: 900, y1: 20, x2: 900, y2: 540 },
  { x1: 900, y1: 540, x2: 20, y2: 540 },
  { x1: 20, y1: 540, x2: 20, y2: 20 },

  // Left vertical partition wall (x = 330)
  // Top segment (leaves Living Room door gap: y 160 - 270)
  { x1: 330, y1: 20, x2: 330, y2: 160 },
  // Middle segment (between Living Room and Kitchen doors)
  { x1: 330, y1: 270, x2: 330, y2: 340 },
  // Bottom segment (leaves Kitchen door gap: y 340 - 450)
  { x1: 330, y1: 450, x2: 330, y2: 540 },

  // Right vertical partition wall (x = 590)
  // Top segment (leaves Bedroom door gap: y 160 - 270)
  { x1: 590, y1: 20, x2: 590, y2: 160 },
  // Middle segment (between Bedroom and Office doors)
  { x1: 590, y1: 270, x2: 590, y2: 340 },
  // Bottom segment (leaves Office door gap: y 340 - 450)
  { x1: 590, y1: 450, x2: 590, y2: 540 },

  // Horizontal wall left (y = 300, dividing Living Room and Kitchen)
  // with internal door gap at x: 130 to 230
  { x1: 20, y1: 300, x2: 130, y2: 300 },
  { x1: 230, y1: 300, x2: 330, y2: 300 },

  // Horizontal wall right (y = 300, dividing Bedroom and Office)
  // with internal door gap at x: 690 to 790
  { x1: 590, y1: 300, x2: 690, y2: 300 },
  { x1: 790, y1: 300, x2: 900, y2: 300 },

  // Garden glass wall partition (y = 150)
  // Wide 130px sliding glass door at x: 395 to 525
  { x1: 330, y1: 150, x2: 395, y2: 150 },
  { x1: 525, y1: 150, x2: 590, y2: 150 }
];

// Helper: Ray to Line Segment intersection
function getRayLineIntersection(
  rx: number, ry: number, dx: number, dy: number,
  x1: number, y1: number, x2: number, y2: number
): number | null {
  const wx = x2 - x1;
  const wy = y2 - y1;
  const denom = dx * wy - dy * wx;
  if (Math.abs(denom) < 1e-6) return null;

  const t = ((x1 - rx) * wy - (y1 - ry) * wx) / denom;
  const u = ((x1 - rx) * dy - (y1 - ry) * dx) / denom;

  if (t > 0 && u >= 0 && u <= 1) {
    return t;
  }
  return null;
}

// Helper: Point projection on line segment for smooth wall buffer
function projectPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: x1, y: y1, dist: Math.hypot(px - x1, py - y1), nx: 0, ny: 0 };
  
  let u = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  u = Math.max(0, Math.min(1, u));
  const projX = x1 + u * dx;
  const projY = y1 + u * dy;
  const dist = Math.hypot(px - projX, py - projY);
  return { 
    x: projX, 
    y: projY, 
    dist, 
    nx: dist > 0 ? (px - projX) / dist : 0, 
    ny: dist > 0 ? (py - projY) / dist : 0 
  };
}

// Spacious 5+ Room Destinations with Outdoor Zen Garden & Corridor
export interface RoomDestination {
  id: number;
  name: string;
  roomType: string;
  x: number;
  y: number;
  color: string;
  description: string;
  doorwayNode: { x: number; y: number };
  icon: 'sofa' | 'bed' | 'utensils' | 'laptop' | 'trees' | 'battery';
}

export const HOUSE_ROOMS: RoomDestination[] = [
  { 
    id: 1, 
    name: 'Grand Living Room Lounge', 
    roomType: 'Social & Entertainment', 
    x: 170, 
    y: 150, 
    color: '#38bdf8', 
    description: 'Spacious sectional sofa, coffee table & 85" OLED TV console',
    doorwayNode: { x: 330, y: 215 },
    icon: 'sofa'
  },
  { 
    id: 2, 
    name: 'Master Bedroom Suite', 
    roomType: 'Private Quarters', 
    x: 750, 
    y: 150, 
    color: '#818cf8', 
    description: 'King platform bed, glowing nightstands & luxury wardrobe',
    doorwayNode: { x: 590, y: 215 },
    icon: 'bed'
  },
  { 
    id: 3, 
    name: 'Gourmet Kitchen & Dining', 
    roomType: 'Culinary Bay', 
    x: 170, 
    y: 420, 
    color: '#10b981', 
    description: 'Marble kitchen island, gas range & 6-seat dining table',
    doorwayNode: { x: 330, y: 395 },
    icon: 'utensils'
  },
  { 
    id: 4, 
    name: 'Tech Office / Study Lab', 
    roomType: 'Workstation & Research', 
    x: 750, 
    y: 420, 
    color: '#f59e0b', 
    description: 'Executive L-desk, dual monitors & library bookshelf',
    doorwayNode: { x: 590, y: 395 },
    icon: 'laptop'
  },
  { 
    id: 5, 
    name: 'Botanical Zen Garden & Patio', 
    roomType: 'Outdoor Sanctuary', 
    x: 460, 
    y: 90, 
    color: '#22c55e', 
    description: 'Emerald lawn, stone walkway, outdoor teak lounge & trees',
    doorwayNode: { x: 460, y: 150 },
    icon: 'trees'
  },
  { 
    id: 6, 
    name: 'Charging Garage Dock', 
    roomType: 'Energy Docking Station', 
    x: 460, 
    y: 310, 
    color: '#ec4899', 
    description: 'Central corridor wireless fast-charging pad & tool bench',
    doorwayNode: { x: 460, y: 310 },
    icon: 'battery'
  }
];

// Moving Obstacles for Live Avoidance & Safe Navigation
interface MovingObstacle {
  id: string;
  name: string;
  type: 'roomba' | 'person' | 'dog' | 'cart';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  angle: number;
}

export const PaganiSimulatorGame = () => {
  const { trim, setTrim, config } = useCarTrim();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active Simulation Mode & Feature Toggles
  const [activeCar, setActiveCar] = useState<CarTrim>(trim || 'pagani');
  const [showObstacles, setShowObstacles] = useState<boolean>(activeCar === 'hellcat');
  const [showFurniture, setShowFurniture] = useState<boolean>(activeCar === 'mustang');

  // Sync mode changes
  const handleCarSwitch = (newTrim: CarTrim) => {
    setActiveCar(newTrim);
    setTrim(newTrim);
    if (newTrim === 'hellcat') {
      setShowObstacles(true);
      setShowFurniture(false);
    } else if (newTrim === 'mustang') {
      setShowObstacles(false);
      setShowFurniture(true);
    } else {
      setShowObstacles(false);
      setShowFurniture(false);
    }
  };

  // Car Physics State
  const carRef = useRef({
    x: 460,
    y: 310,
    angle: -Math.PI / 2, // Facing north towards garden
    speed: 0,
    steerAngle: 0,
    maxSpeed: 5.0,
    accel: 0.14,
    friction: 0.95,
    brakeForce: 0.42,
    battery: 98,
    isBraking: false,
    isAccelerating: false,
    skidMarks: [] as { x: number; y: number; alpha: number }[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    lidarRays: [] as { startX: number; startY: number; endX: number; endY: number; hit: boolean; dist: number; isWall: boolean }[]
  });

  // Dynamic Moving Obstacles
  const obstaclesRef = useRef<MovingObstacle[]>([
    {
      id: 'obs-1',
      name: 'Autonomous Vacuum Bot',
      type: 'roomba',
      x: 170,
      y: 190,
      vx: 1.0,
      vy: 0.5,
      radius: 17,
      color: '#38bdf8',
      minX: 70,
      maxX: 280,
      minY: 80,
      maxY: 240,
      angle: 0
    },
    {
      id: 'obs-2',
      name: 'Walking Family Member',
      type: 'person',
      x: 740,
      y: 190,
      vx: -0.8,
      vy: 0.2,
      radius: 16,
      color: '#fbbf24',
      minX: 630,
      maxX: 840,
      minY: 100,
      maxY: 250,
      angle: 0
    },
    {
      id: 'obs-3',
      name: 'Playful Pet Dog',
      type: 'dog',
      x: 230,
      y: 420,
      vx: 1.2,
      vy: -0.9,
      radius: 15,
      color: '#f97316',
      minX: 70,
      maxX: 280,
      minY: 340,
      maxY: 490,
      angle: 0
    },
    {
      id: 'obs-4',
      name: 'Rolling Delivery Cart',
      type: 'cart',
      x: 460,
      y: 220,
      vx: 0,
      vy: 1.0,
      radius: 19,
      color: '#ec4899',
      minX: 420,
      maxX: 500,
      minY: 180,
      maxY: 440,
      angle: 0
    }
  ]);

  // Multi-Node Waypoint Route Planner
  const waypointQueueRef = useRef<{ x: number; y: number }[]>([]);
  const [navStatus, setNavStatus] = useState<string>('IDLE');
  const [proximityAlert, setProximityAlert] = useState<string | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [speedKmh, setSpeedKmh] = useState(0);
  const [batteryDisplay, setBatteryDisplay] = useState(98);
  const [selectedDest, setSelectedDest] = useState<RoomDestination | null>(null);
  const [isAutopilot, setIsAutopilot] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [distanceDriven, setDistanceDriven] = useState(0);

  // Audio Context for Engine Sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Audio Engine Synthesizer
  const toggleSound = () => {
    if (soundMuted) {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        if (activeCar === 'pagani') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(65, ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
        } else if (activeCar === 'hellcat') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(45, ctx.currentTime);
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(55, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
        }

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        audioCtxRef.current = ctx;
        oscRef.current = osc;
        gainRef.current = gain;
        setSoundMuted(false);
      } catch (e) {
        console.error('Audio init failed', e);
      }
    } else {
      if (oscRef.current) {
        try {
          oscRef.current.stop();
        } catch (e) {}
      }
      setSoundMuted(true);
    }
  };

  // ==========================================
  // TOPOLOGICAL 26-NODE NAVIGATION GRAPH
  // Guaranteed >50px clearance from all walls & perpendicular doorway crossings
  // ==========================================
  interface GraphNode {
    id: string;
    x: number;
    y: number;
    neighbors: string[];
  }

  const NAV_GRAPH: Record<string, GraphNode> = {
    // Botanical Zen Garden & Patio (North)
    'garden_center': { id: 'garden_center', x: 460, y: 90, neighbors: ['garden_door'] },
    'garden_door': { id: 'garden_door', x: 460, y: 150, neighbors: ['garden_center', 'corridor_north'] },

    // Central Grand Corridor Highway
    'corridor_north': { id: 'corridor_north', x: 460, y: 215, neighbors: ['garden_door', 'corridor_dock', 'corridor_west_n', 'corridor_east_n'] },
    'corridor_west_n': { id: 'corridor_west_n', x: 385, y: 215, neighbors: ['corridor_north', 'living_door_mid', 'corridor_west_mid'] },
    'corridor_east_n': { id: 'corridor_east_n', x: 535, y: 215, neighbors: ['corridor_north', 'bedroom_door_mid', 'corridor_east_mid'] },

    'corridor_dock': { id: 'corridor_dock', x: 460, y: 310, neighbors: ['corridor_north', 'corridor_south', 'corridor_west_mid', 'corridor_east_mid'] },
    'corridor_west_mid': { id: 'corridor_west_mid', x: 385, y: 310, neighbors: ['corridor_west_n', 'corridor_west_s', 'corridor_dock'] },
    'corridor_east_mid': { id: 'corridor_east_mid', x: 535, y: 310, neighbors: ['corridor_east_n', 'corridor_east_s', 'corridor_dock'] },

    'corridor_south': { id: 'corridor_south', x: 460, y: 395, neighbors: ['corridor_dock', 'corridor_west_s', 'corridor_east_s'] },
    'corridor_west_s': { id: 'corridor_west_s', x: 385, y: 395, neighbors: ['corridor_south', 'kitchen_door_mid', 'corridor_west_mid'] },
    'corridor_east_s': { id: 'corridor_east_s', x: 535, y: 395, neighbors: ['corridor_south', 'office_door_mid', 'corridor_east_mid'] },

    // Room 1: Living Room Lounge (North-West)
    'living_door_mid': { id: 'living_door_mid', x: 330, y: 215, neighbors: ['corridor_west_n', 'living_door_in'] },
    'living_door_in': { id: 'living_door_in', x: 270, y: 215, neighbors: ['living_door_mid', 'living_hub'] },
    'living_hub': { id: 'living_hub', x: 210, y: 215, neighbors: ['living_door_in', 'living_dest'] },
    'living_dest': { id: 'living_dest', x: 170, y: 150, neighbors: ['living_hub'] },

    // Room 2: Master Bedroom Suite (North-East)
    'bedroom_door_mid': { id: 'bedroom_door_mid', x: 590, y: 215, neighbors: ['corridor_east_n', 'bedroom_door_in'] },
    'bedroom_door_in': { id: 'bedroom_door_in', x: 650, y: 215, neighbors: ['bedroom_door_mid', 'bedroom_hub'] },
    'bedroom_hub': { id: 'bedroom_hub', x: 710, y: 215, neighbors: ['bedroom_door_in', 'bedroom_dest'] },
    'bedroom_dest': { id: 'bedroom_dest', x: 750, y: 150, neighbors: ['bedroom_hub'] },

    // Room 3: Gourmet Kitchen & Dining (South-West)
    'kitchen_door_mid': { id: 'kitchen_door_mid', x: 330, y: 395, neighbors: ['corridor_west_s', 'kitchen_door_in'] },
    'kitchen_door_in': { id: 'kitchen_door_in', x: 270, y: 395, neighbors: ['kitchen_door_mid', 'kitchen_hub'] },
    'kitchen_hub': { id: 'kitchen_hub', x: 210, y: 395, neighbors: ['kitchen_door_in', 'kitchen_dest'] },
    'kitchen_dest': { id: 'kitchen_dest', x: 170, y: 420, neighbors: ['kitchen_hub'] },

    // Room 4: Tech Office / Study Lab (South-East)
    'office_door_mid': { id: 'office_door_mid', x: 590, y: 395, neighbors: ['corridor_east_s', 'office_door_in'] },
    'office_door_in': { id: 'office_door_in', x: 650, y: 395, neighbors: ['office_door_mid', 'office_hub'] },
    'office_hub': { id: 'office_hub', x: 710, y: 395, neighbors: ['office_door_in', 'office_dest'] },
    'office_dest': { id: 'office_dest', x: 750, y: 420, neighbors: ['office_hub'] }
  };

  // Find nearest valid graph node for current vehicle coordinates
  const getNearestGraphNode = (x: number, y: number): string => {
    if (x < 330) {
      if (y < 300) {
        if (x > 250) return 'living_door_in';
        if (y < 180) return 'living_dest';
        return 'living_hub';
      } else {
        if (x > 250) return 'kitchen_door_in';
        if (y > 410) return 'kitchen_dest';
        return 'kitchen_hub';
      }
    } else if (x > 590) {
      if (y < 300) {
        if (x < 670) return 'bedroom_door_in';
        if (y < 180) return 'bedroom_dest';
        return 'bedroom_hub';
      } else {
        if (x < 670) return 'office_door_in';
        if (y > 410) return 'office_dest';
        return 'office_hub';
      }
    } else if (y < 150) {
      return y > 120 ? 'garden_door' : 'garden_center';
    } else {
      if (y < 250) {
        if (x < 420) return 'corridor_west_n';
        if (x > 500) return 'corridor_east_n';
        return 'corridor_north';
      } else if (y > 360) {
        if (x < 420) return 'corridor_west_s';
        if (x > 500) return 'corridor_east_s';
        return 'corridor_south';
      } else {
        if (x < 420) return 'corridor_west_mid';
        if (x > 500) return 'corridor_east_mid';
        return 'corridor_dock';
      }
    }
  };

  // Dijkstra Shortest Path Finder with Live Moving Obstacle Penalty
  const findGraphPath = (
    startNodeId: string,
    endNodeId: string,
    obstacles: MovingObstacle[],
    isObstaclesActive: boolean
  ): { x: number; y: number }[] => {
    if (startNodeId === endNodeId) {
      const node = NAV_GRAPH[endNodeId];
      return [{ x: node.x, y: node.y }];
    }

    const dists: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const unvisited = new Set<string>();

    for (const key of Object.keys(NAV_GRAPH)) {
      dists[key] = Infinity;
      prev[key] = null;
      unvisited.add(key);
    }
    dists[startNodeId] = 0;

    while (unvisited.size > 0) {
      let u: string | null = null;
      let minD = Infinity;

      for (const node of unvisited) {
        if (dists[node] < minD) {
          minD = dists[node];
          u = node;
        }
      }

      if (!u || minD === Infinity) break;
      if (u === endNodeId) break;

      unvisited.delete(u);
      const curr = NAV_GRAPH[u];

      for (const v of curr.neighbors) {
        if (!unvisited.has(v)) continue;
        const neighbor = NAV_GRAPH[v];
        const segDist = Math.hypot(neighbor.x - curr.x, neighbor.y - curr.y);

        // Add dynamic obstacle cost penalty if obstacle is near the corridor segment
        let obstaclePenalty = 0;
        if (isObstaclesActive) {
          for (const obs of obstacles) {
            const p = projectPointOnSegment(obs.x, obs.y, curr.x, curr.y, neighbor.x, neighbor.y);
            if (p.dist < obs.radius + 32) {
              obstaclePenalty += 3000; // Heavily penalize blocked corridor!
            }
          }
        }

        const alt = dists[u] + segDist + obstaclePenalty;
        if (alt < dists[v]) {
          dists[v] = alt;
          prev[v] = u;
        }
      }
    }

    const path: { x: number; y: number }[] = [];
    let cur: string | null = endNodeId;
    while (cur) {
      path.unshift({ x: NAV_GRAPH[cur].x, y: NAV_GRAPH[cur].y });
      cur = prev[cur];
    }
    return path;
  };

  // Convert RoomDestination to Safe Multi-Node Waypoints
  const planSafeGraphRoute = (currX: number, currY: number, dest: RoomDestination) => {
    let targetNodeId = 'corridor_dock';
    if (dest.id === 1) targetNodeId = 'living_dest';
    else if (dest.id === 2) targetNodeId = 'bedroom_dest';
    else if (dest.id === 3) targetNodeId = 'kitchen_dest';
    else if (dest.id === 4) targetNodeId = 'office_dest';
    else if (dest.id === 5) targetNodeId = 'garden_center';
    else if (dest.id === 6) targetNodeId = 'corridor_dock';

    const startNodeId = getNearestGraphNode(currX, currY);
    const graphPath = findGraphPath(startNodeId, targetNodeId, obstaclesRef.current, showObstacles);

    // Prune starting nodes that are very close to current position
    const finalRoute: { x: number; y: number }[] = [];
    for (const pt of graphPath) {
      if (Math.hypot(pt.x - currX, pt.y - currY) > 16) {
        finalRoute.push(pt);
      }
    }

    if (finalRoute.length === 0) {
      finalRoute.push({ x: dest.x, y: dest.y });
    }
    return finalRoute;
  };

  // 60 FPS Physics, Autonomous Obstacle & Wall Avoidance Loop
  useEffect(() => {
    let animId: number;
    let distCounter = distanceDriven;
    let stuckFrames = 0;

    const gameLoop = () => {
      const car = carRef.current;
      const keys = keysPressed.current;

      // 1. UPDATE LIVE MOVING OBSTACLES
      if (showObstacles) {
        obstaclesRef.current.forEach((obs) => {
          obs.x += obs.vx;
          obs.y += obs.vy;

          if (obs.x <= obs.minX || obs.x >= obs.maxX) {
            obs.vx *= -1;
            obs.angle = obs.vx > 0 ? 0 : Math.PI;
          }
          if (obs.y <= obs.minY || obs.y >= obs.maxY) {
            obs.vy *= -1;
          }
        });
      }

      // 2. FORWARD SENSOR SCAN (LiDAR / ULTRASONIC RAYS)
      const rays: typeof car.lidarRays = [];
      const numRays = 9;
      const rayMaxDist = 120;
      let obstacleDetectedInCone = false;
      let wallDetectedInCone = false;
      let nearestObstacleDist = 999;
      let nearestWallDist = 999;
      let detectedObstacle: MovingObstacle | null = null;

      const baseAngle = car.angle;
      const angleOffsets = [-0.55, -0.38, -0.22, -0.10, 0, 0.10, 0.22, 0.38, 0.55];

      const startX = car.x + Math.cos(car.angle) * 16;
      const startY = car.y + Math.sin(car.angle) * 16;

      for (let i = 0; i < numRays; i++) {
        const rayAngle = baseAngle + angleOffsets[i];
        const rayDirX = Math.cos(rayAngle);
        const rayDirY = Math.sin(rayAngle);
        let rayDist = rayMaxDist;
        let hasHit = false;
        let isWallHit = false;

        // Check intersection with all house walls
        for (const wall of HOUSE_WALLS) {
          const hitDist = getRayLineIntersection(
            startX, startY, rayDirX * rayMaxDist, rayDirY * rayMaxDist,
            wall.x1, wall.y1, wall.x2, wall.y2
          );
          if (hitDist !== null && hitDist * rayMaxDist < rayDist) {
            rayDist = hitDist * rayMaxDist;
            hasHit = true;
            isWallHit = true;
            wallDetectedInCone = true;
            if (rayDist < nearestWallDist) {
              nearestWallDist = rayDist;
            }
          }
        }

        // Check intersection with moving obstacles
        if (showObstacles) {
          for (const obs of obstaclesRef.current) {
            const toObsX = obs.x - startX;
            const toObsY = obs.y - startY;
            const proj = toObsX * rayDirX + toObsY * rayDirY;

            if (proj > 0 && proj < rayDist) {
              const perpX = toObsX - proj * rayDirX;
              const perpY = toObsY - proj * rayDirY;
              const perpDist = Math.hypot(perpX, perpY);

              if (perpDist < obs.radius + 15) {
                rayDist = proj;
                hasHit = true;
                isWallHit = false;
                obstacleDetectedInCone = true;
                if (proj < nearestObstacleDist) {
                  nearestObstacleDist = proj;
                  detectedObstacle = obs;
                }
              }
            }
          }
        }

        const endX = startX + rayDirX * rayDist;
        const endY = startY + rayDirY * rayDist;

        rays.push({ startX, startY, endX, endY, hit: hasHit, dist: rayDist, isWall: isWallHit });
      }
      car.lidarRays = rays;

      // Proximity Alert Banner
      if (obstacleDetectedInCone && detectedObstacle) {
        setProximityAlert(`MOVING ${detectedObstacle.name.toUpperCase()} (${Math.round(nearestObstacleDist)}cm)`);
      } else if (wallDetectedInCone && nearestWallDist < 50) {
        setProximityAlert(`WALL BUFFER (${Math.round(nearestWallDist)}cm)`);
      } else {
        setProximityAlert(null);
      }

      // 3. ZERO-COLLISION AUTOPILOT NAVIGATION
      if (isAutopilot && selectedDest) {
        const queue = waypointQueueRef.current;

        if (queue.length === 0) {
          // Reached destination!
          car.speed *= 0.70;
          if (Math.abs(car.speed) < 0.1) {
            car.speed = 0;
            setIsAutopilot(false);
            setNavStatus(`ARRIVED SAFELY AT ${selectedDest.name.toUpperCase()}`);
          }
        } else {
          const currentTarget = queue[0];
          const distToTarget = Math.hypot(currentTarget.x - car.x, currentTarget.y - car.y);

          // Advance waypoint when reached
          if (distToTarget < 20) {
            queue.shift();
            stuckFrames = 0;
          } else {
            const targetAngle = Math.atan2(currentTarget.y - car.y, currentTarget.x - car.x);
            let angleDiff = targetAngle - car.angle;

            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // SAFETY CRITERIA 1: MOVING OBSTACLE DIRECTLY IN PATH (within 48px)
            if (obstacleDetectedInCone && nearestObstacleDist < 48) {
              // YIELD AND WAIT FOR MOVING OBSTACLE TO PASS!
              car.isBraking = true;
              car.speed = 0; // ZERO SPEED - WAIT FOR OBSTACLE!
              setNavStatus(`🛑 YIELDING: WAITING FOR MOVING OBSTACLE TO PASS`);
              stuckFrames++;

              // If blocked for more than 1.5 seconds, dynamically reroute via alternate corridor!
              if (stuckFrames > 90) {
                const rerouted = planSafeGraphRoute(car.x, car.y, selectedDest);
                if (rerouted.length > 0) {
                  waypointQueueRef.current = rerouted;
                  setNavStatus(`🔀 DYNAMIC REROUTE: BYPASSING OBSTACLE`);
                }
                stuckFrames = 0;
              }
            } 
            // SAFETY CRITERIA 2: SENSOR WALL BRAKE (within 35px in forward cone)
            else if (wallDetectedInCone && nearestWallDist < 35) {
              car.isBraking = true;
              car.speed = 0; // HARD BRAKE - NEVER DASH INTO WALL!
              setNavStatus(`🛡️ SENSOR BRAKE: WALL PROXIMITY (${Math.round(nearestWallDist)}cm)`);

              // Turn in place away from wall towards current target
              const turnRate = 0.085;
              car.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
              car.steerAngle = Math.sign(angleDiff) * 0.35;
            } 
            // SAFETY CRITERIA 3: PURE PIVOT TURN IN PLACE (> 6 degrees)
            // Car NEVER accelerates forward while rotating! Eliminates all corner and wall drifting!
            else if (Math.abs(angleDiff) > 0.10) {
              car.isBraking = true;
              car.speed = 0; // ZERO FORWARD DRIFT!
              const turnRate = 0.085;
              car.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
              car.steerAngle = Math.sign(angleDiff) * 0.35;
              setNavStatus(`🔄 PIVOTING: ALIGNING HEADING (${Math.round(angleDiff * 180 / Math.PI)}°)`);
            } 
            // SAFETY CRITERIA 4: ALIGNED DIRECTLY ALONG OPEN PATHWAY
            else {
              car.isBraking = false;
              car.steerAngle = 0;
              stuckFrames = 0;

              // Determine safe, smooth cruising speed
              let targetSpeed = 1.6; // Controlled safe cruising speed
              if (obstacleDetectedInCone && nearestObstacleDist < 75) {
                targetSpeed = 0.6; // Cautious crawl
                setNavStatus(`⚡ CAUTIOUS CRAWL: OBSTACLE NEARBY`);
              } else if (wallDetectedInCone && nearestWallDist < 55) {
                targetSpeed = 0.8; // Cautious crawl near walls
                setNavStatus(`🛡️ SENSOR CRAWL: WALL PROXIMITY`);
              } else {
                setNavStatus(`NAVIGATING TO ${selectedDest.name.toUpperCase()}`);
              }

              if (car.speed < targetSpeed && car.battery > 0) {
                car.speed = Math.min(targetSpeed, car.speed + 0.10);
                car.battery = Math.max(0, car.battery - 0.01);
              } else if (car.speed > targetSpeed) {
                car.speed = Math.max(targetSpeed, car.speed - 0.15);
              }
            }
          }
        }
      } else {
        // MANUAL DRIVER CONTROLS
        const gas = keys['w'] || keys['arrowup'];
        const brake = keys['s'] || keys['arrowdown'];
        const left = keys['a'] || keys['arrowleft'];
        const right = keys['d'] || keys['arrowright'];
        const handbrake = keys[' '];

        car.isAccelerating = !!gas;
        car.isBraking = !!brake || !!handbrake;

        // Active Emergency Braking Assist for manual driving
        if (nearestWallDist < 32 && gas) {
          car.speed = 0;
          car.isBraking = true;
          setProximityAlert(`🚨 ACTIVE BRAKE ASSIST: WALL DETECTED`);
        } else if (nearestObstacleDist < 35 && gas) {
          car.speed = 0;
          car.isBraking = true;
          setProximityAlert(`🚨 ACTIVE BRAKE ASSIST: OBSTACLE DETECTED`);
        } else if (gas && car.battery > 0) {
          if (car.speed < car.maxSpeed) {
            car.speed += car.accel;
          }
          car.battery = Math.max(0, car.battery - 0.022);
        }

        if (brake) {
          if (car.speed > 0) {
            car.speed -= car.brakeForce;
            if (car.speed < 0) car.speed = 0;
          } else {
            if (car.speed > -car.maxSpeed * 0.45) {
              car.speed -= car.accel * 0.6;
            }
          }
        }

        if (handbrake) {
          car.speed *= 0.88;
        }

        car.speed *= car.friction;

        const turnSpeed = 0.052;
        if (left) {
          car.angle -= turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.35) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = -0.35;
        } else if (right) {
          car.angle += turnSpeed * (Math.abs(car.speed) / car.maxSpeed + 0.35) * (car.speed >= 0 ? 1 : -1);
          car.steerAngle = 0.35;
        } else {
          car.steerAngle = 0;
        }
      }

      // Update position
      car.x += Math.cos(car.angle) * car.speed;
      car.y += Math.sin(car.angle) * car.speed;

      // 4. PRECISE WALL COLLISION DEFENSE BUFFER (HARD REPULSION FIELD)
      // Generous 27px buffer ensures complete clearance including wall stroke and bumper
      for (const wall of HOUSE_WALLS) {
        const proj = projectPointOnSegment(car.x, car.y, wall.x1, wall.y1, wall.x2, wall.y2);
        const safeMargin = 27;
        if (proj.dist < safeMargin) {
          const penetration = safeMargin - proj.dist;
          car.x += proj.nx * penetration;
          car.y += proj.ny * penetration;

          // Velocity component directed into wall
          const velX = Math.cos(car.angle) * car.speed;
          const velY = Math.sin(car.angle) * car.speed;
          const velDotNormal = velX * proj.nx + velY * proj.ny;
          if (velDotNormal < 0) {
            car.speed = 0; // ZERO SPEED - NEVER PUSH INTO WALL!
          }
        }
      }

      // 5. MOVING OBSTACLE PHYSICAL DEFENSE
      if (showObstacles) {
        for (const obs of obstaclesRef.current) {
          const dist = Math.hypot(car.x - obs.x, car.y - obs.y);
          const minDist = obs.radius + 24;
          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dist > 0 ? (car.x - obs.x) / dist : 1;
            const ny = dist > 0 ? (car.y - obs.y) / dist : 0;
            car.x += nx * overlap;
            car.y += ny * overlap;
            car.speed = 0;
          }
        }
      }

      // Central Corridor Wireless Charging Dock (at 460, 310)
      const distToDock = Math.hypot(car.x - 460, car.y - 310);
      if (distToDock < 48 && Math.abs(car.speed) < 0.8) {
        car.battery = Math.min(100, car.battery + 0.12);
      }

      // Tire Skid Marks
      if ((car.isBraking && Math.abs(car.speed) > 1.3) || (Math.abs(car.steerAngle) > 0.22 && Math.abs(car.speed) > 3.8)) {
        car.skidMarks.push({ x: car.x, y: car.y, alpha: 0.5 });
        if (car.skidMarks.length > 110) car.skidMarks.shift();

        const particleColor = activeCar === 'hellcat' 
          ? 'rgba(239, 68, 68, 0.4)' 
          : activeCar === 'mustang' 
            ? 'rgba(59, 130, 246, 0.4)' 
            : 'rgba(6, 182, 212, 0.4)';

        car.particles.push({
          x: car.x - Math.cos(car.angle) * 16,
          y: car.y - Math.sin(car.angle) * 16,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          color: particleColor
        });
      }

      car.particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.035;
      });
      car.particles = car.particles.filter((p) => p.life > 0);

      distCounter += Math.abs(car.speed) * 0.04;
      setDistanceDriven(Math.floor(distCounter));

      const currentKmh = Math.floor(Math.abs(car.speed) * 18);
      setSpeedKmh(currentKmh);
      setBatteryDisplay(Math.floor(car.battery));

      if (!soundMuted && oscRef.current && audioCtxRef.current) {
        const baseFreq = activeCar === 'hellcat' ? 45 : activeCar === 'mustang' ? 55 : 65;
        const targetFreq = baseFreq + Math.abs(car.speed) * 55;
        oscRef.current.frequency.setTargetAtTime(targetFreq, audioCtxRef.current.currentTime, 0.05);
      }

      renderCanvas();
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      if (oscRef.current) {
        try {
          oscRef.current.stop();
        } catch (e) {}
      }
    };
  }, [isAutopilot, selectedDest, soundMuted, activeCar, showObstacles, showFurniture]);

  // Main Canvas Rendering Routine
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const car = carRef.current;

    // 1. BASE BACKGROUND
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);

    // 2. ROOM FLOORING TEXTURES (Large, Spacious Architecture)
    // Room 1: Grand Living Room Lounge (x: 20-330, y: 20-300) - Parquet Dark Oak Planks
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(20, 20, 310, 280);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let py = 20; py < 300; py += 22) {
      ctx.beginPath();
      ctx.moveTo(20, py);
      ctx.lineTo(330, py);
      ctx.stroke();
    }

    // Room 2: Master Bedroom Suite (x: 590-900, y: 20-300) - Plush Slate-Indigo Carpet
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(590, 20, 310, 280);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1;
    for (let px = 590; px < 900; px += 26) {
      ctx.beginPath();
      ctx.moveTo(px, 20);
      ctx.lineTo(px, 280);
      ctx.stroke();
    }

    // Room 3: Gourmet Kitchen & Dining (x: 20-330, y: 300-540) - Checkered Porcelain Tiles
    ctx.fillStyle = '#08171d';
    ctx.fillRect(20, 300, 310, 240);
    ctx.strokeStyle = '#0f2f3d';
    ctx.lineWidth = 1;
    for (let tx = 20; tx < 330; tx += 32) {
      for (let ty = 300; ty < 540; ty += 32) {
        ctx.strokeRect(tx, ty, 32, 32);
      }
    }

    // Room 4: Tech Office / Study Lab (x: 590-900, y: 300-540) - Cyber Blueprint Grid
    ctx.fillStyle = '#140f07';
    ctx.fillRect(590, 300, 310, 240);
    ctx.strokeStyle = '#291e0a';
    ctx.lineWidth = 1;
    for (let ox = 590; ox < 900; ox += 26) {
      ctx.beginPath();
      ctx.moveTo(ox, 300);
      ctx.lineTo(ox, 540);
      ctx.stroke();
    }

    // Room 5: OUTDOOR BOTANICAL ZEN GARDEN & PATIO (x: 330-590, y: 20-150)
    ctx.fillStyle = '#042f20';
    ctx.fillRect(330, 20, 260, 130);
    // Stone stepping pavers in garden
    ctx.fillStyle = '#334155';
    for (let gx = 360; gx <= 560; gx += 40) {
      ctx.beginPath();
      ctx.arc(gx, 85, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Trees & flowering shrubs in Garden
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(360, 45, 16, 0, Math.PI * 2);
    ctx.arc(560, 45, 16, 0, Math.PI * 2);
    ctx.arc(360, 125, 14, 0, Math.PI * 2);
    ctx.arc(560, 125, 14, 0, Math.PI * 2);
    ctx.fill();

    // Outdoor Garden Lounge Patio Decking
    ctx.fillStyle = '#78350f';
    ctx.fillRect(430, 40, 60, 30);
    ctx.strokeStyle = '#92400e';
    ctx.strokeRect(430, 40, 60, 30);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('PATIO LOUNGE', 436, 58);

    // Room 6: Central Grand Corridor & Charging Garage (x: 330-590, y: 150-540)
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(330, 150, 260, 390);

    // Hazard Stripes in Corridor
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.strokeRect(340, 160, 240, 370);
    ctx.setLineDash([]);

    // 3. ARCHITECTURAL PARTITION WALLS & DOORWAYS (RENDER ALL WALLS)
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#334155';
    ctx.lineCap = 'round';

    HOUSE_WALLS.forEach((wall) => {
      ctx.beginPath();
      ctx.moveTo(wall.x1, wall.y1);
      ctx.lineTo(wall.x2, wall.y2);
      ctx.stroke();
    });

    // Garden Glass Sliding Door Indicator
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(395, 150);
    ctx.lineTo(525, 150);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. CENTRAL INDUCTIVE CHARGING DOCK (x: 460, y: 310)
    const isDocked = Math.hypot(car.x - 460, car.y - 310) < 48;
    ctx.fillStyle = isDocked ? 'rgba(16, 185, 129, 0.3)' : 'rgba(30, 41, 59, 0.6)';
    ctx.beginPath();
    ctx.arc(460, 310, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDocked ? '#10b981' : '#ec4899';
    ctx.lineWidth = isDocked ? 3 : 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(460, 310, 28, 0, Math.PI * 2);
    ctx.strokeStyle = isDocked ? 'rgba(16, 185, 129, 0.6)' : 'rgba(236, 72, 153, 0.4)';
    ctx.stroke();

    ctx.fillStyle = isDocked ? '#10b981' : '#ec4899';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('⚡ CHARGING GARAGE DOCK', 395, 305);
    ctx.font = '8px sans-serif';
    ctx.fillText(isDocked ? 'WIRELESS RECHARGING (100W)' : 'Corridor Docking Bay', 395, 320);

    // 5. FULL FURNITURE DETAILS (Mustang Mode or Furniture Toggle)
    if (showFurniture) {
      // Room 1: Living Room Lounge Furniture
      ctx.fillStyle = '#334155';
      ctx.fillRect(50, 45, 140, 48);
      ctx.fillRect(50, 93, 48, 65);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(50, 45, 140, 48);
      ctx.strokeRect(50, 93, 48, 65);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.fillRect(115, 110, 60, 35);
      ctx.strokeStyle = '#38bdf8';
      ctx.strokeRect(115, 110, 60, 35);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(220, 30, 80, 16);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(220, 30, 80, 16);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('85" 4K OLED', 235, 42);

      // Room 2: Master Bedroom Furniture
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(720, 45, 110, 85);
      ctx.strokeStyle = '#6366f1';
      ctx.strokeRect(720, 45, 110, 85);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(730, 50, 38, 20);
      ctx.fillRect(780, 50, 38, 20);
      ctx.fillStyle = '#312e81';
      ctx.fillRect(720, 80, 110, 50);

      ctx.fillStyle = '#4338ca';
      ctx.fillRect(685, 50, 28, 28);
      ctx.fillRect(838, 50, 28, 28);

      // Room 3: Gourmet Kitchen & Dining Furniture
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(60, 330, 110, 50);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(60, 330, 110, 50);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(200, 410, 95, 50);
      ctx.strokeStyle = '#34d399';
      ctx.strokeRect(200, 410, 95, 50);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('DINING TABLE', 218, 438);

      // Room 4: Tech Office / Study Furniture
      ctx.fillStyle = '#451a03';
      ctx.fillRect(740, 430, 100, 48);
      ctx.fillRect(805, 380, 35, 50);
      ctx.strokeStyle = '#d97706';
      ctx.strokeRect(740, 430, 100, 48);
      ctx.strokeRect(805, 380, 35, 50);

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(755, 434, 35, 5);
      ctx.fillRect(795, 434, 30, 5);

      ctx.fillStyle = '#1c1917';
      ctx.fillRect(610, 475, 120, 24);
      ctx.strokeStyle = '#b45309';
      ctx.strokeRect(610, 475, 120, 24);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '7px sans-serif';
      ctx.fillText('📚 RESEARCH LIBRARY', 625, 490);
    }

    // 6. ROOM BLUEPRINT LABELS
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('ROOM 1: LIVING ROOM LOUNGE', 35, 40);
    ctx.fillText('ROOM 2: MASTER BEDROOM SUITE', 610, 40);
    ctx.fillText('ROOM 3: GOURMET KITCHEN & DINING', 35, 320);
    ctx.fillText('ROOM 4: TECH OFFICE / STUDY LAB', 610, 320);
    ctx.fillStyle = '#4ade80';
    ctx.fillText('🌿 ROOM 5: BOTANICAL ZEN GARDEN & PATIO', 345, 35);
    ctx.fillStyle = '#64748b';
    ctx.fillText('CENTRAL GRAND CORRIDOR', 395, 185);

    // 7. RENDER 5+ ROOM DESTINATION BEACONS
    HOUSE_ROOMS.forEach((room) => {
      const isSelected = selectedDest?.id === room.id;
      ctx.strokeStyle = room.color;
      ctx.lineWidth = isSelected ? 3 : 1.5;

      ctx.beginPath();
      ctx.arc(room.x, room.y, isSelected ? 24 : 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = room.color;
      ctx.beginPath();
      ctx.arc(room.x, room.y, isSelected ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = 'bold 9px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(room.name, room.x - 45, room.y + (isSelected ? 38 : 30));
    });

    // 8. RENDER SAFE MULTI-NODE AUTOPILOT BREADCRUMB ROUTE
    if (isAutopilot && waypointQueueRef.current.length > 0) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      for (const pt of waypointQueueRef.current) {
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      waypointQueueRef.current.forEach((pt, idx) => {
        ctx.fillStyle = idx === 0 ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, idx === 0 ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 9. RENDER LIVE MOVING OBSTACLES (SRT Hellcat Mode or if enabled)
    if (showObstacles) {
      obstaclesRef.current.forEach((obs) => {
        ctx.save();
        ctx.translate(obs.x, obs.y);

        if (obs.type === 'roomba') {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(0, 0, obs.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(0, 0, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('ROOMBA', -14, -22);
        } else if (obs.type === 'person') {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, -6, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(-6, 2, 12, 14);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('🚶 PERSON', -16, -18);
        } else if (obs.type === 'dog') {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(11, -4, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('🐕 PET DOG', -16, -16);
        } else {
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(-12, -12, 24, 24);
          ctx.strokeStyle = '#a5b4fc';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(-12, -12, 24, 24);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 7px sans-serif';
          ctx.fillText('📦 POD', -10, -16);
        }

        ctx.restore();

        const d = Math.hypot(car.x - obs.x, car.y - obs.y);
        if (d < 70) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius + 8, 0, Math.PI * 2);
          ctx.stroke();
        }
      });
    }

    // 10. RENDER FORWARD SENSOR SCAN (LiDAR / ULTRASONIC RAYS HITTING WALLS & OBSTACLES)
    car.lidarRays.forEach((ray) => {
      ctx.strokeStyle = ray.hit ? (ray.isWall ? 'rgba(234, 179, 8, 0.85)' : 'rgba(239, 68, 68, 0.9)') : 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = ray.hit ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(ray.startX, ray.startY);
      ctx.lineTo(ray.endX, ray.endY);
      ctx.stroke();

      if (ray.hit) {
        ctx.fillStyle = ray.isWall ? '#eab308' : '#ef4444';
        ctx.beginPath();
        ctx.arc(ray.endX, ray.endY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 11. RENDER SKID MARKS
    car.skidMarks.forEach((m) => {
      ctx.fillStyle = `rgba(15, 23, 42, ${m.alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
      ctx.fill();
      m.alpha -= 0.003;
    });

    // 12. RENDER SMOKE / EXHAUST PARTICLES
    car.particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1 - p.life) * 8 + 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 13. RENDER ACTIVE VEHICLE MODEL (Pagani, Hellcat, or Mustang)
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Headlight Beams
    const beamColor = activeCar === 'hellcat' 
      ? 'rgba(239, 68, 68, 0.18)' 
      : activeCar === 'mustang' 
        ? 'rgba(59, 130, 246, 0.18)' 
        : 'rgba(56, 189, 248, 0.22)';

    ctx.fillStyle = beamColor;
    ctx.beginPath();
    ctx.moveTo(22, -10);
    ctx.lineTo(140, -60);
    ctx.lineTo(140, 60);
    ctx.lineTo(22, 10);
    ctx.closePath();
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;

    ctx.fillRect(-18, -19, 11, 6);
    ctx.strokeRect(-18, -19, 11, 6);
    ctx.fillRect(-18, 13, 11, 6);
    ctx.strokeRect(-18, 13, 11, 6);

    ctx.save();
    ctx.translate(14, -16);
    ctx.rotate(car.steerAngle);
    ctx.fillRect(-5, -3, 11, 6);
    ctx.strokeRect(-5, -3, 11, 6);
    ctx.restore();

    ctx.save();
    ctx.translate(14, 16);
    ctx.rotate(car.steerAngle);
    ctx.fillRect(-5, -3, 11, 6);
    ctx.strokeRect(-5, -3, 11, 6);
    ctx.restore();

    // BODYWORK
    if (activeCar === 'pagani') {
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(18, -14);
      ctx.lineTo(27, 0);
      ctx.lineTo(18, 14);
      ctx.fill();

      ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.beginPath();
      ctx.ellipse(2, 0, 13, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(-22, -2.5, 1.8, 0, Math.PI * 2);
      ctx.arc(-22, 2.5, 1.8, 0, Math.PI * 2);
      ctx.arc(-24, -1.2, 1.8, 0, Math.PI * 2);
      ctx.arc(-24, 1.2, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#020617';
      ctx.fillRect(-26, -16, 4, 32);
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(-26, -16, 4, 32);

    } else if (activeCar === 'hellcat') {
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(-22, -15, 46, 30);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-22, -15, 46, 30);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, -11, 16, 22);
      ctx.fillStyle = '#f87171';
      ctx.fillRect(8, -7, 5, 4);
      ctx.fillRect(8, 3, 5, 4);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(-10, -10, 12, 20);

      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(24, -9, 2.5, 0, Math.PI * 2);
      ctx.arc(24, 9, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-25, -11, 4, 4);
      ctx.fillRect(-25, 7, 4, 4);

    } else {
      ctx.fillStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-22, -14, 46, 28, 5) : ctx.rect(-22, -14, 46, 28);
      ctx.fill();
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-22, -4, 46, 3);
      ctx.fillRect(-22, 1, 46, 3);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, -14, 4, 28);

      ctx.fillStyle = '#020617';
      ctx.fillRect(-26, -17, 4, 34);
      ctx.strokeStyle = '#3b82f6';
      ctx.strokeRect(-26, -17, 4, 34);
    }

    // Active Brake Lights
    if (car.isBraking || car.speed < 0) {
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillRect(-24, -13, 3, 6);
      ctx.fillRect(-24, 7, 3, 6);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  };

  const handleSelectDest = (dest: RoomDestination) => {
    setSelectedDest(dest);
    const plannedWaypoints = planSafeGraphRoute(carRef.current.x, carRef.current.y, dest);
    waypointQueueRef.current = plannedWaypoints;
    setIsAutopilot(true);
    setNavStatus(`PLANNED PRECISION ROUTE TO ${dest.name.toUpperCase()}`);
  };

  const sendKey = (key: string, state: boolean) => {
    keysPressed.current[key] = state;
  };

  const handleEmergencyBrake = () => {
    carRef.current.speed = 0;
    carRef.current.isBraking = true;
    setIsAutopilot(false);
    setNavStatus('EMERGENCY BRAKE ENGAGED');
  };

  const handleAccelerate = () => {
    carRef.current.isBraking = false;
    carRef.current.speed = 2.0;
    setNavStatus('THROTTLE RESUMED');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Vehicle Selection Bar */}
      <div className="bg-dark-card border border-white/10 p-6 rounded-2xl glass-panel shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Home size={16} /> Autonomous Indoor House Architecture & Garden Simulator
            </div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <span>{config.name.toUpperCase()}</span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                ZERO-COLLISION SMART WALL & OBSTACLE AVOIDANCE
              </span>
            </h2>
            <p className="text-xs text-gray-400 font-mono mt-1">
              Equipped with 360° Wall Detection and Forward LiDAR raycasting. Plans collision-free paths strictly through doorways and corridors, yielding to moving obstacles and steering around walls automatically.
            </p>
          </div>

          {/* Quick Sound & Reset Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSound}
              className={`p-2.5 rounded-xl border transition-all ${
                soundMuted
                  ? 'bg-slate-900 border-white/10 text-gray-400 hover:text-white'
                  : 'bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
              }`}
              title="Toggle Engine Sound"
            >
              {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            <button
              onClick={() => {
                carRef.current.x = 460;
                carRef.current.y = 310;
                carRef.current.speed = 0;
                carRef.current.angle = -Math.PI / 2;
                carRef.current.battery = 100;
                waypointQueueRef.current = [];
                setIsAutopilot(false);
                setNavStatus('RESET TO DOCK');
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw size={15} /> Reset to Garage Dock
            </button>
          </div>
        </div>

        {/* 3-WAY CAR & ENVIRONMENT SELECTOR */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-wider mr-1">
              Select Vehicle & Mode:
            </span>

            {/* Pagani Button */}
            <button
              onClick={() => handleCarSwitch('pagani')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'pagani'
                  ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🏎️ PAGANI HUAYRA R</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300">
                Architectural House & Garden
              </span>
            </button>

            {/* SRT Hellcat Button */}
            <button
              onClick={() => handleCarSwitch('hellcat')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'hellcat'
                  ? 'bg-red-500/25 border-red-400 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🔥 SRT HELLCAT</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-300">
                Live Moving Obstacles & Escape
              </span>
            </button>

            {/* Mustang Shelby Button */}
            <button
              onClick={() => handleCarSwitch('mustang')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                activeCar === 'mustang'
                  ? 'bg-blue-500/25 border-blue-400 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-gray-400 border-white/10'
              }`}
            >
              <span>🐎 MUSTANG SHELBY GT500</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300">
                Fully Furnished Interior
              </span>
            </button>
          </div>

          {/* Environmental Feature Toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowObstacles(!showObstacles)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                showObstacles
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                  : 'bg-slate-900 border-white/10 text-gray-400'
              }`}
            >
              <Eye size={13} /> Moving Obstacles: {showObstacles ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowFurniture(!showFurniture)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
                showFurniture
                  ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                  : 'bg-slate-900 border-white/10 text-gray-400'
              }`}
            >
              <Layers size={13} /> Full Furniture: {showFurniture ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Simulation Screen & Right Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left 3 Columns: Interactive House Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl glass-panel aspect-[920/560]">
            {/* HUD Telemetry Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">SPEED:</span>{' '}
                <span className="text-cyan-400 font-bold">{speedKmh} KM/H</span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">BATTERY:</span>{' '}
                <span className={batteryDisplay > 25 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {batteryDisplay}%
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-white/10 text-xs font-mono">
                <span className="text-gray-400">DISTANCE:</span>{' '}
                <span className="text-white font-bold">{distanceDriven}m</span>
              </div>
            </div>

            {/* Obstacle Avoidance & Navigation Status Banner */}
            <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-1.5 pointer-events-none">
              {proximityAlert && (
                <div className="px-3.5 py-1.5 rounded-xl bg-amber-950/90 border border-amber-500 text-amber-300 text-xs font-mono font-bold animate-pulse flex items-center gap-1.5 shadow-lg">
                  <ShieldAlert size={15} /> ⚠️ SENSOR ALERT: {proximityAlert}
                </div>
              )}

              {isAutopilot && (
                <div className="px-3.5 py-1.5 rounded-xl bg-cyan-950/90 border border-cyan-500 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5">
                  <Navigation size={14} className="animate-spin text-cyan-400" /> {navStatus}
                </div>
              )}
            </div>

            {/* Canvas */}
            <canvas
              ref={canvasRef}
              width={920}
              height={560}
              className="w-full h-full object-contain cursor-crosshair"
            />
          </div>

          {/* On-screen Pedals, Emergency Brake & Keyboard Driving Controls */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs font-mono text-gray-400 space-y-1">
              <div>
                <span className="text-white font-bold">SMART AVOIDANCE:</span> Kinematic alignment turns vehicle before accelerating through doorways, eliminating wall collisions!
              </div>
              <div className="text-[10px] text-gray-500">
                Manual: W/Up (Gas) • S/Down (Brake) • A/Left • D/Right • Space (Handbrake)
              </div>
            </div>

            {/* Emergency Brake & Accelerate Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleEmergencyBrake}
                className="px-3 py-2.5 bg-red-600/90 hover:bg-red-600 text-white font-black text-xs rounded-xl flex items-center gap-1.5 border border-red-400/50 shadow-md active:scale-95"
              >
                🛑 EMERGENCY BRAKE
              </button>

              <button
                onClick={handleAccelerate}
                className="px-3 py-2.5 bg-cyan-600/90 hover:bg-cyan-500 text-white font-black text-xs rounded-xl flex items-center gap-1.5 border border-cyan-400/50 shadow-md active:scale-95"
              >
                ⚡ ACCELERATE
              </button>
            </div>

            {/* On-screen touch buttons */}
            <div className="flex items-center gap-2">
              <button
                onMouseDown={() => sendKey('a', true)}
                onMouseUp={() => sendKey('a', false)}
                onTouchStart={() => sendKey('a', true)}
                onTouchEnd={() => sendKey('a', false)}
                className="w-11 h-11 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowLeft size={18} />
              </button>

              <button
                onMouseDown={() => sendKey('s', true)}
                onMouseUp={() => sendKey('s', false)}
                onTouchStart={() => sendKey('s', true)}
                onTouchEnd={() => sendKey('s', false)}
                className="w-12 h-11 bg-red-600/80 hover:bg-red-600 text-white font-bold text-xs rounded-xl flex items-center justify-center active:scale-95 border border-red-400/40"
              >
                BRAKE
              </button>

              <button
                onMouseDown={() => sendKey('w', true)}
                onMouseUp={() => sendKey('w', false)}
                onTouchStart={() => sendKey('w', true)}
                onTouchEnd={() => sendKey('w', false)}
                className="w-14 h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs tracking-wider rounded-xl flex items-center justify-center active:scale-95 border border-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
              >
                GAS ▲
              </button>

              <button
                onMouseDown={() => sendKey('d', true)}
                onMouseUp={() => sendKey('d', false)}
                onTouchStart={() => sendKey('d', true)}
                onTouchEnd={() => sendKey('d', false)}
                className="w-11 h-11 bg-slate-900 border border-white/10 rounded-xl text-white flex items-center justify-center active:bg-slate-700"
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: 5+ Room Destinations, Garden & Battery HUD */}
        <div className="space-y-5">
          {/* Destination Selector */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Flag size={16} className="text-cyan-400" /> House & Garden Destinations
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-cyan-300">
                5 ROOMS + GARDEN
              </span>
            </div>

            <p className="text-xs text-gray-400 font-mono">
              Click any room to navigate through doorways and corridors with zero wall collisions:
            </p>

            <div className="space-y-2.5">
              {HOUSE_ROOMS.map((dest) => {
                const isCurrent = selectedDest?.id === dest.id;
                return (
                  <button
                    key={dest.id}
                    onClick={() => handleSelectDest(dest)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-slate-800 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-slate-950/70 hover:bg-slate-900 border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dest.color, boxShadow: `0 0 10px ${dest.color}` }}
                      />
                      <div>
                        <div className="font-bold text-xs text-white">{dest.name}</div>
                        <div className="text-[10px] text-gray-400">{dest.description}</div>
                      </div>
                    </div>

                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0"
                      style={{ backgroundColor: `${dest.color}25`, color: dest.color }}
                    >
                      {isCurrent ? 'ACTIVE' : 'GO'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Voltage Battery Pack & Dock Status */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" /> Battery & Garage Dock
              </span>
              <span className="text-xs font-mono font-bold text-green-400">{batteryDisplay}%</span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  batteryDisplay > 30 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-red-500 animate-pulse'
                }`}
                style={{ width: `${batteryDisplay}%` }}
              />
            </div>

            <div className="text-[10px] text-gray-400 font-mono leading-relaxed">
              Drive into <span className="text-pink-400 font-bold">Room 6: Charging Garage Dock</span> (center hall) for 100W wireless inductive fast charging!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
