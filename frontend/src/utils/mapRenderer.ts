/**
 * RoboNav 2D SLAM Occupancy Grid Map Renderer
 * Professional 2D SLAM visualization engine inspired by architectural house floor plans.
 * 
 * Features:
 * - Fixed world coordinates: The environment stays 100% FIXED when the robot moves.
 * - Dynamic ROS 2 SLAM Toolbox origin & resolution support.
 * - 3-Layer Rendering Architecture:
 *     Layer 1: Fixed Occupancy Grid (red walls, charcoal free floor, obsidian unknown) + Room Labels
 *     Layer 2: Live LiDAR Scan (faint sweep rays + neon red reflection points, zero residue)
 *     Layer 3: Robot icon, directional heading arrow, HOME (0,0) marker, Loop Closures (LC1, LC2, ...), Trajectory
 * - 0, 5, 10m graduated metric scale ruler matching reference design.
 * - Top title & legend matching reference design.
 */

export const RESOLUTION = 0.05; // Default 5 cm per grid cell
export const ORIGIN_X = 0.0;     // Fallback world origin X
export const ORIGIN_Y = 0.0;     // Fallback world origin Y
export const BASE_PIXELS_PER_METER = 40.0; // At scale 1.0, 1 meter = 40 pixels

/**
 * Convert World coordinates (meters) to Canvas coordinates (pixels).
 * Convention: +X is East/Right, +Y is North/Up.
 */
export const worldToCanvas = (
  wx: number, 
  wy: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
) => {
  const ppm = BASE_PIXELS_PER_METER * scale;
  return {
    x: offsetX + wx * ppm,
    y: offsetY - wy * ppm
  };
};

/**
 * Convert Canvas coordinates (pixels) to World coordinates (meters).
 */
export const canvasToWorld = (
  cx: number, 
  cy: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
) => {
  const ppm = BASE_PIXELS_PER_METER * scale;
  return {
    x: Number(((cx - offsetX) / ppm).toFixed(3)),
    y: Number(((offsetY - cy) / ppm).toFixed(3))
  };
};

// Cached offscreen canvas for hardware-accelerated 2D SLAM Occupancy Grid
let offscreenCanvas: HTMLCanvasElement | null = null;
let offscreenCtx: CanvasRenderingContext2D | null = null;
let cachedGridRef: number[] | null = null;

export const ensureOffscreenCanvas = (width: number = 600, height: number = 600) => {
  if (typeof document === 'undefined') return;
  if (!offscreenCanvas || offscreenCanvas.width !== width || offscreenCanvas.height !== height) {
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    offscreenCtx = offscreenCanvas.getContext('2d');
    cachedGridRef = null;
  }
};

export const resetOccupancyCanvas = (width: number = 600, height: number = 600) => {
  ensureOffscreenCanvas(width, height);
  if (offscreenCtx) {
    offscreenCtx.clearRect(0, 0, width, height);
  }
  cachedGridRef = null;
};

export const invalidateGridCache = () => {
  cachedGridRef = null;
};

/**
 * Ingests flat occupancy grid into offscreen hardware canvas.
 * Inverts row order so row 0 (Y_min) is at bottom and row H-1 (Y_max) is at top.
 */
export const initOccupancyCanvas = (
  grid: number[],
  width: number = 600,
  height: number = 600
) => {
  if (typeof document === 'undefined') return;
  ensureOffscreenCanvas(width, height);
  if (!offscreenCtx) return;

  offscreenCtx.clearRect(0, 0, width, height);
  const imgData = offscreenCtx.createImageData(width, height);
  const data = imgData.data;

  // Tri-state occupancy mapping matching reference design
  // Invert Y so North is up: canvas y=0 corresponds to grid row (height - 1)
  for (let cy = 0; cy < height; cy++) {
    const gy = (height - 1) - cy;
    const rowOffset = gy * width;
    const cRowOffset = cy * width;

    for (let cx = 0; cx < width; cx++) {
      const val = grid[rowOffset + cx];
      const p = (cRowOffset + cx) * 4;

      if (val >= 50) {
        // Walls & obstacles: High-contrast solid red (#ef4444)
        data[p] = 239;     // R
        data[p + 1] = 68;  // G
        data[p + 2] = 68;  // B
        data[p + 3] = 255; // A
      } else if (val === 0) {
        // Explored free floor: Sleek dark charcoal floor (#141824)
        data[p] = 20;      // R
        data[p + 1] = 24;  // G
        data[p + 2] = 36;  // B
        data[p + 3] = 255; // A
      } else {
        // Unknown / Unexplored (-1): Dark obsidian (#06080e)
        data[p] = 6;       // R
        data[p + 1] = 8;   // G
        data[p + 2] = 14;  // B
        data[p + 3] = 255; // A
      }
    }
  }

  offscreenCtx.putImageData(imgData, 0, 0);
  cachedGridRef = grid;
};

export const updateOccupancyPixels = (
  updates: { x: number; y: number; val: number }[],
  width: number = 600,
  height: number = 600
) => {
  if (typeof document === 'undefined') return;
  ensureOffscreenCanvas(width, height);
  if (!offscreenCtx) return;

  for (let i = 0; i < updates.length; i++) {
    const u = updates[i];
    if (u.x < 0 || u.x >= width || u.y < 0 || u.y >= height) continue;
    
    // Invert Y: canvas Y = (height - 1) - grid Y
    const cy = (height - 1) - u.y;
    if (u.val >= 50) {
      offscreenCtx.fillStyle = '#ef4444'; // Red wall
    } else if (u.val === 0) {
      offscreenCtx.fillStyle = '#141824'; // Explored charcoal floor
    } else {
      offscreenCtx.fillStyle = '#06080e'; // Unknown dark obsidian
    }
    offscreenCtx.fillRect(u.x, cy, 1, 1);
  }
};

export const getOccupancyCanvas = (
  grid: number[],
  width: number,
  height: number
): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  ensureOffscreenCanvas(width, height);

  if (cachedGridRef !== grid && grid && grid.length > 0) {
    initOccupancyCanvas(grid, width, height);
  }

  return offscreenCanvas;
};

/**
 * LAYER 1: Draw Permanent SLAM Occupancy Grid
 * Fixed at physical world coordinates.
 */
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  grid: number[],
  width: number,
  height: number,
  scale: number,
  offset: { x: number; y: number },
  originX: number = -10.0,
  originY: number = -10.0,
  resolution: number = RESOLUTION
) => {
  const ppm = BASE_PIXELS_PER_METER * scale;
  const worldW = width * resolution;
  const worldH = height * resolution;

  // The top-left corner of the grid in world space is (originX, originY + worldH)
  const topLeft = worldToCanvas(originX, originY + worldH, scale, offset.x, offset.y);
  const totalW = worldW * ppm;
  const totalH = worldH * ppm;

  // 1. Draw base obsidian container
  ctx.fillStyle = '#06080e';
  ctx.fillRect(topLeft.x, topLeft.y, totalW, totalH);

  // 2. Hardware blit of offscreen canvas
  const oCanvas = getOccupancyCanvas(grid, width, height);
  if (oCanvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(oCanvas, topLeft.x, topLeft.y, totalW, totalH);
  }

  // Subtle boundary border
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.20)';
  ctx.lineWidth = 1;
  ctx.strokeRect(topLeft.x, topLeft.y, totalW, totalH);
};

/**
 * LAYER 2: Live LiDAR Scan Rays & Reflection Hit Points
 * Shifts and rotates dynamically with the robot's real-time pose. Leaves NO permanent residue.
 */
export const drawLiveLidarHits = (
  ctx: CanvasRenderingContext2D,
  robotX: number,
  robotY: number,
  robotHeading: number,
  rays: { angle: number; distance: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!rays || rays.length === 0) return;

  const rPos = worldToCanvas(robotX, robotY, scale, offset.x, offset.y);

  ctx.save();
  // 1. Faint laser sweep rays
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.06)';
  ctx.lineWidth = 0.5;

  // 2. Vivid neon red bounce-back reflection dots (#ff2222) with red glow
  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 5;

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    if (ray.distance < 0.12 || ray.distance > 8.0) continue;

    // Angle in world space: robotHeading + ray.angle (North = 90° or forward)
    const rad = ((robotHeading + ray.angle) * Math.PI) / 180;
    const wx = robotX + ray.distance * Math.cos(rad);
    const wy = robotY + ray.distance * Math.sin(rad);

    const hitPos = worldToCanvas(wx, wy, scale, offset.x, offset.y);

    // Faint ray line
    ctx.beginPath();
    ctx.moveTo(rPos.x, rPos.y);
    ctx.lineTo(hitPos.x, hitPos.y);
    ctx.stroke();

    // Crisp neon red point (2.4px)
    ctx.beginPath();
    ctx.arc(hitPos.x, hitPos.y, 2.4, 0, 2 * Math.PI);
    ctx.fill();
  }

  ctx.restore();
};

export const drawLidarScanRays = (
  ctx: CanvasRenderingContext2D,
  robotX: number,
  robotY: number,
  robotHeading: number,
  _sweepAngleDeg: number,
  rays: { angle: number; distance: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  drawLiveLidarHits(ctx, robotX, robotY, robotHeading, rays, scale, offset);
};

export const drawLidarRays = (
  ctx: CanvasRenderingContext2D,
  robotX: number,
  robotY: number,
  rays: { angle: number; distance: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  drawLiveLidarHits(ctx, robotX, robotY, 0.0, rays, scale, offset);
};

/**
 * LAYER 3: Autonomous Robot Icon
 * Draws at center of actual position with heading arrow and center ruby laser diode.
 */
export const drawRobot = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);
  // In canvas coordinates where +Y is up, rotating counterclockwise corresponds to negative rotation
  const rad = (-orientation * Math.PI) / 180;
  
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rad);

  // Active LiDAR scanning fan cone in front of robot (+X body forward)
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
  grad.addColorStop(0.65, 'rgba(239, 68, 68, 0.08)');
  grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 46, -Math.PI / 4, Math.PI / 4);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Sleek circular LiDAR puck body (dark obsidian with glowing red bezel)
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, 2 * Math.PI);
  ctx.fillStyle = '#0f1117';
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Left & Right Drive Wheel assemblies
  ctx.fillStyle = '#1c1f2b';
  ctx.fillRect(-8, -16, 16, 4);
  ctx.fillRect(-8, 12, 16, 4);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(-8, -16, 16, 4);
  ctx.strokeRect(-8, 12, 16, 4);

  // Forward Heading Pointer (LiDAR arrow pointing forward +X)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(24, 0);
  ctx.strokeStyle = '#ff3344';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Arrowhead pointing forward
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(16, -6);
  ctx.lineTo(16, 6);
  ctx.closePath();
  ctx.fillStyle = '#ff3344';
  ctx.fill();

  // Center YDLIDAR Turret with illuminated ruby diode core
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ff0033';
  ctx.shadowColor = '#ff0033';
  ctx.shadowBlur = 8;
  ctx.fill();
  
  ctx.restore();
};

/**
 * LAYER 3: HOME (0,0) Marker
 * Matches uploaded floor plan reference: Green circular bullseye with "HOME (0,0)" label.
 */
export const drawHomeMarker = (
  ctx: CanvasRenderingContext2D,
  scale: number,
  offset: { x: number; y: number }
) => {
  const pos = worldToCanvas(0.0, 0.0, scale, offset.x, offset.y);

  ctx.save();
  // Glowing green outer halo
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 10;

  // Outer green circle
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 7, 0, 2 * Math.PI);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Center white core
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Text label: HOME (0,0)
  ctx.shadowBlur = 0;
  ctx.font = 'bold 11px Inter, monospace';
  ctx.fillStyle = '#4ade80';
  ctx.textAlign = 'center';
  ctx.fillText('HOME (0,0)', pos.x, pos.y - 12);

  ctx.restore();
};

/**
 * LAYER 3: Loop Closure Markers (Blue Dots: LC1, LC2, LC3)
 * Matches uploaded floor plan reference.
 */
export const drawLoopClosureMarkers = (
  ctx: CanvasRenderingContext2D,
  loopClosures: Array<{ id: string; x: number; y: number; label?: string }>,
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!loopClosures || loopClosures.length === 0) return;

  ctx.save();
  loopClosures.forEach((lc, idx) => {
    const pos = worldToCanvas(lc.x, lc.y, scale, offset.x, offset.y);
    const label = lc.label || lc.id || `LC${idx + 1}`;

    // Glowing blue dot
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Center white dot
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 2, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Label: LC1, LC2, etc.
    ctx.shadowBlur = 0;
    ctx.font = 'bold 10px Inter, monospace';
    ctx.fillStyle = '#60a5fa';
    ctx.textAlign = 'center';
    ctx.fillText(label, pos.x, pos.y + 14);
  });
  ctx.restore();
};

/**
 * Architectural House Room Labels
 * Matches uploaded reference: Living Room, Dining Area, Kitchen, Hallway, Bedroom 2, Bathroom, Master Bedroom, Closet, Utility Room, Entryway.
 */
export const drawRoomLabels = (
  ctx: CanvasRenderingContext2D,
  rooms: Array<{ name: string; x: number; y: number }>,
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!rooms || rooms.length === 0) return;

  ctx.save();
  ctx.font = '600 11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  rooms.forEach(room => {
    const pos = worldToCanvas(room.x, room.y, scale, offset.x, offset.y);
    const label = room.name.toUpperCase();
    const textW = ctx.measureText(label).width;

    // Subtle dark translucent backing pill for maximum legibility
    ctx.fillStyle = 'rgba(15, 23, 42, 0.70)';
    ctx.fillRect(pos.x - textW / 2 - 6, pos.y - 9, textW + 12, 18);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pos.x - textW / 2 - 6, pos.y - 9, textW + 12, 18);

    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(label, pos.x, pos.y);
  });
  ctx.restore();
};

/**
 * Default Reference House Room Waypoints
 */
export const DEFAULT_HOUSE_ROOMS = [
  { name: 'Living Room', x: -6.0, y: -2.5 },
  { name: 'Dining Area', x: -2.5, y: 3.5 },
  { name: 'Kitchen', x: 2.5, y: 4.5 },
  { name: 'Hallway', x: 4.0, y: 0.0 },
  { name: 'Entryway', x: -1.0, y: -4.0 },
  { name: 'Bedroom 2', x: 2.0, y: -3.5 },
  { name: 'Bathroom', x: 5.5, y: -3.5 },
  { name: 'Master Bedroom', x: 9.5, y: 3.0 },
  { name: 'Closet', x: 9.5, y: -1.5 },
  { name: 'Utility Room', x: 9.5, y: -4.5 },
  { name: 'Bedroom 2 (North)', x: -6.5, y: 3.5 },
  { name: 'Shower', x: -4.0, y: 4.5 },
];

/**
 * Real-time continuous travel trajectory (Crimson/Red)
 * Matches reference image red exploration path.
 */
export const drawTrajectoryTrail = (
  ctx: CanvasRenderingContext2D,
  trajectory: { x: number; y: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!trajectory || trajectory.length < 2) return;
  ctx.save();
  ctx.beginPath();
  const startPos = worldToCanvas(trajectory[0].x, trajectory[0].y, scale, offset.x, offset.y);
  ctx.moveTo(startPos.x, startPos.y);
  for (let i = 1; i < trajectory.length; i++) {
    const pos = worldToCanvas(trajectory[i].x, trajectory[i].y, scale, offset.x, offset.y);
    ctx.lineTo(pos.x, pos.y);
  }
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.85)';
  ctx.lineWidth = 2.0;
  ctx.shadowColor = '#b91c1c';
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.restore();
};

/**
 * Planned autonomous navigation path (Dashed Neon Red Ribbon)
 */
export const drawPath = (
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!path || path.length === 0) return;
  
  ctx.save();
  ctx.beginPath();
  const startPos = worldToCanvas(path[0].x, path[0].y, scale, offset.x, offset.y);
  ctx.moveTo(startPos.x, startPos.y);
  
  for (let i = 1; i < path.length; i++) {
    const pos = worldToCanvas(path[i].x, path[i].y, scale, offset.x, offset.y);
    ctx.lineTo(pos.x, pos.y);
  }
  
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 6;
  ctx.setLineDash([5, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
};

export const getFlagNumber = (d: { name?: string; dest_id?: string; type?: string }): number | null => {
  if (d.dest_id) {
    const match = d.dest_id.match(/FLAG-(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  if (d.name) {
    const matchFlag = d.name.match(/flag\s*(\d+)/i);
    if (matchFlag) return parseInt(matchFlag[1], 10);
    const matchRoom = d.name.match(/room\s*(\d+)/i);
    if (matchRoom) return parseInt(matchRoom[1], 10);
  }
  return null;
};

export const drawRoomFlag = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  offset: { x: number; y: number },
  name: string,
  flagNum: number
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);

  const palettes = [
    { fill: '#10b981', border: '#059669', glow: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7' },
    { fill: '#06b6d4', border: '#0891b2', glow: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9' },
    { fill: '#a855f7', border: '#9333ea', glow: 'rgba(168, 85, 247, 0.5)', text: '#d8b4fe' },
    { fill: '#f59e0b', border: '#d97706', glow: 'rgba(245, 158, 11, 0.5)', text: '#fcd34d' },
  ];
  const c = palettes[(flagNum - 1) % palettes.length] || palettes[0];

  ctx.save();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 10;

  // Ground target circle
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 7, 0, 2 * Math.PI);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flag Pole
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(pos.x, pos.y - 28);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pennant Banner
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 28);
  ctx.lineTo(pos.x + 20, pos.y - 20);
  ctx.lineTo(pos.x, pos.y - 12);
  ctx.closePath();
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Label Badge
  ctx.shadowBlur = 0;
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(String(flagNum), pos.x + 8, pos.y - 20);

  const label = name || `Room ${flagNum}`;
  ctx.font = 'bold 10px Inter, sans-serif';
  const textW = ctx.measureText(label).width;
  const pillW = Math.max(textW + 12, 54);
  const pillH = 18;
  const pillX = pos.x - pillW / 2;
  const pillY = pos.y - 48;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
  ctx.fillRect(pillX, pillY, pillW, pillH);
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1;
  ctx.strokeRect(pillX, pillY, pillW, pillH);

  ctx.fillStyle = c.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pos.x, pillY + pillH / 2);

  ctx.restore();
};

export const drawRoomFlags = (
  ctx: CanvasRenderingContext2D,
  destinations: any[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!destinations || destinations.length === 0) return;

  destinations.forEach((d: any) => {
    const flagNum = getFlagNumber(d);
    if (flagNum && flagNum >= 1 && flagNum <= 4) {
      drawRoomFlag(ctx, d.x, d.y, scale, offset, d.name, flagNum);
    } else {
      drawDestination(ctx, d.x, d.y, scale, offset, d.name);
    }
  });
};

export const drawDestination = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  offset: { x: number; y: number },
  name?: string
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 6.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ef4444';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (name) {
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#fca5a5';
    ctx.textAlign = 'center';
    ctx.fillText(name, pos.x, pos.y - 12);
    ctx.restore();
  }
};

/**
 * 1-Meter & 5-Meter Metric Grid Lines
 */
export const drawMetricGuides = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const ppm = BASE_PIXELS_PER_METER * scale;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  // Determine visible world boundaries
  const leftM = Math.floor((-offset.x) / ppm) - 1;
  const rightM = Math.ceil((canvasW - offset.x) / ppm) + 1;
  const bottomM = Math.floor(-(canvasH - offset.y) / ppm) - 1;
  const topM = Math.ceil((offset.y) / ppm) + 1;

  for (let m = leftM; m <= rightM; m += 1) {
    const pos = worldToCanvas(m, 0, scale, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.lineTo(pos.x, canvasH);
    ctx.stroke();
  }

  for (let m = bottomM; m <= topM; m += 1) {
    const pos = worldToCanvas(0, m, scale, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(0, pos.y);
    ctx.lineTo(canvasW, pos.y);
    ctx.stroke();
  }

  // Draw Major X and Y Origin Axes in subtle red
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)';
  ctx.lineWidth = 1.5;

  const originPos = worldToCanvas(0, 0, scale, offset.x, offset.y);
  ctx.beginPath();
  ctx.moveTo(0, originPos.y);
  ctx.lineTo(canvasW, originPos.y);
  ctx.moveTo(originPos.x, 0);
  ctx.lineTo(originPos.x, canvasH);
  ctx.stroke();

  ctx.restore();
};

/**
 * Metric Scale Ruler matching reference image: 0, 5, 10m
 */
export const drawReferenceMetricScale = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scale: number
) => {
  const ppm = BASE_PIXELS_PER_METER * scale;
  const rulerX = 28;
  const rulerY = canvasH - 28;
  const m10_px = 10.0 * ppm;
  const m5_px = 5.0 * ppm;

  ctx.save();
  // Alternating black & white scale block segments
  const blockH = 6;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(rulerX, rulerY, m10_px, blockH);

  // 0 to 5m block
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(rulerX, rulerY, m5_px, blockH);
  // 5m to 10m block
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(rulerX + m5_px, rulerY, m5_px, blockH);

  // Border outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(rulerX, rulerY, m10_px, blockH);

  // Ticks & Labels
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  // 0 tick
  ctx.fillText('0', rulerX, rulerY - 3);
  // 5m tick
  ctx.fillText('5', rulerX + m5_px, rulerY - 3);
  // 10m tick
  ctx.fillText('10m', rulerX + m10_px, rulerY - 3);

  ctx.restore();
};

/**
 * Top Legend Bar matching reference design:
 * "2D SLAM Mapping: House Floor Plan (Occupancy Grid Map)"
 * Grid: 1m | Path: Robot Trajectory | Loop Closures: Blue Dots | HOME (0,0): Green | Walls: Red | Free Space: Charcoal
 */
export const drawMapTitleAndLegend = (
  ctx: CanvasRenderingContext2D,
  canvasW: number
) => {
  ctx.save();

  // Translucent backdrop bar
  ctx.fillStyle = 'rgba(6, 8, 14, 0.85)';
  ctx.fillRect(0, 0, canvasW, 46);
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(canvasW, 46);
  ctx.stroke();

  // Title
  ctx.font = '700 13px Inter, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('2D SLAM Mapping: Entire House Floor Plan (Occupancy Grid Map)', 16, 7);

  // Legend Items
  let curX = 16;
  const legendY = 27;
  ctx.font = '500 10.5px Inter, sans-serif';

  // 1. Grid: 1m
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Grid: 1m', curX, legendY);
  curX += ctx.measureText('Grid: 1m').width + 14;

  // 2. Path: Robot Trajectory
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(curX, legendY + 5);
  ctx.lineTo(curX + 14, legendY + 5);
  ctx.stroke();
  curX += 18;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Path: Robot Trajectory', curX, legendY);
  curX += ctx.measureText('Path: Robot Trajectory').width + 14;

  // 3. Loop Closures: Blue Dots
  ctx.beginPath();
  ctx.arc(curX + 4, legendY + 5, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  curX += 12;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Loop Closures: Blue Dots', curX, legendY);
  curX += ctx.measureText('Loop Closures: Blue Dots').width + 14;

  // 4. HOME (0,0)
  ctx.beginPath();
  ctx.arc(curX + 4, legendY + 5, 4, 0, 2 * Math.PI);
  ctx.fillStyle = '#22c55e';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
  curX += 12;
  ctx.fillStyle = '#4ade80';
  ctx.fillText('HOME (0,0)', curX, legendY);
  curX += ctx.measureText('HOME (0,0)').width + 14;

  // 5. Walls
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(curX, legendY + 1, 10, 8);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(curX, legendY + 1, 10, 8);
  curX += 14;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Walls', curX, legendY);
  curX += ctx.measureText('Walls').width + 14;

  // 6. Free Space
  ctx.fillStyle = '#141824';
  ctx.fillRect(curX, legendY + 1, 10, 8);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(curX, legendY + 1, 10, 8);
  curX += 14;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Free Space', curX, legendY);
  curX += ctx.measureText('Free Space').width + 14;

  // 7. Unknown
  ctx.fillStyle = '#06080e';
  ctx.fillRect(curX, legendY + 1, 10, 8);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(curX, legendY + 1, 10, 8);
  curX += 14;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Unknown', curX, legendY);

  ctx.restore();
};


