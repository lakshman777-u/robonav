export const RESOLUTION = 0.05; // 5 cm per grid cell
export const ORIGIN_X = -15.0;  // 30m x 30m grid centered at (-15.0, -15.0)
export const ORIGIN_Y = -15.0;

// Convert World (meters) to Canvas (pixels)
export const worldToCanvas = (
  wx: number, 
  wy: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
) => {
  const cellPixelSize = 2.0 * scale;
  const gx = (wx - ORIGIN_X) / RESOLUTION;
  const gy = (wy - ORIGIN_Y) / RESOLUTION;
  return {
    x: offsetX + gx * cellPixelSize,
    y: offsetY + gy * cellPixelSize
  };
};

// Convert Canvas (pixels) to World (meters)
export const canvasToWorld = (
  cx: number, 
  cy: number, 
  scale: number, 
  offsetX: number, 
  offsetY: number
) => {
  const cellPixelSize = 2.0 * scale;
  const gx = (cx - offsetX) / cellPixelSize;
  const gy = (cy - offsetY) / cellPixelSize;
  return {
    x: Number((gx * RESOLUTION + ORIGIN_X).toFixed(2)),
    y: Number((gy * RESOLUTION + ORIGIN_Y).toFixed(2))
  };
};

// Cached offscreen canvas for 2D SLAM Occupancy Grid
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

  // Tri-state occupancy mapping
  for (let i = 0; i < grid.length; i++) {
    const val = grid[i];
    const p = i * 4;

    if (val >= 50) {
      // Occupied walls & obstacles: High-contrast neon red (#ef4444)
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
      // Unknown / Unexplored (-1): Distinct dark obsidian (#06080e)
      data[p] = 6;       // R
      data[p + 1] = 8;   // G
      data[p + 2] = 14;  // B
      data[p + 3] = 255; // A
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
    
    if (u.val >= 50) {
      offscreenCtx.fillStyle = '#ef4444'; // Red wall
    } else if (u.val === 0) {
      offscreenCtx.fillStyle = '#141824'; // Explored charcoal floor
    } else {
      offscreenCtx.fillStyle = '#06080e'; // Unknown dark obsidian
    }
    offscreenCtx.fillRect(u.x, u.y, 1, 1);
  }
};

export const getOccupancyCanvas = (
  grid: number[],
  width: number,
  height: number
): HTMLCanvasElement | null => {
  if (typeof document === 'undefined') return null;
  ensureOffscreenCanvas(width, height);

  // If cached grid reference changed from a map load
  if (cachedGridRef !== grid && grid && grid.length > 0) {
    initOccupancyCanvas(grid, width, height);
  }

  return offscreenCanvas;
};

// Draw Occupancy Grid with hardware-accelerated offscreen canvas
// The 2D diagram stays completely STILL at the same position.
export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  grid: number[],
  width: number,
  height: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const cellPixelSize = 2.0 * scale;
  const totalW = width * cellPixelSize;
  const totalH = height * cellPixelSize;

  // 1. Draw SLAM map background (unexplored dark obsidian #06080e)
  ctx.fillStyle = '#06080e';
  ctx.fillRect(offset.x, offset.y, totalW, totalH);

  // 2. Hardware-accelerated GPU draw of the STILL 2D diagram in 1 single blit (0.02ms)
  const oCanvas = getOccupancyCanvas(grid, width, height);
  if (oCanvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(oCanvas, offset.x, offset.y, totalW, totalH);
  }

  // Subtle red perimeter border
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(offset.x, offset.y, totalW, totalH);
};

// Draw Live LiDAR Scan Reflection Dots for the CURRENT frame only.
// Red neon points shift dynamically with robot pose and never burn into the map.
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
  // 1. Subtle, faint red laser sweep lines
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
  ctx.lineWidth = 0.5;

  // 2. Vivid Neon Red hit points (#ff2222) with red glow
  ctx.fillStyle = '#ff2222';
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 4;

  for (let i = 0; i < rays.length; i++) {
    const ray = rays[i];
    if (ray.distance < 0.12 || ray.distance > 8.0) continue;

    // Angle in world space: robotHeading + ray.angle (with motor facing north)
    const rad = ((robotHeading + ray.angle) * Math.PI) / 180;
    const wx = robotX + ray.distance * Math.cos(rad);
    const wy = robotY + ray.distance * Math.sin(rad);

    const hitPos = worldToCanvas(wx, wy, scale, offset.x, offset.y);

    // Faint laser ray
    ctx.beginPath();
    ctx.moveTo(rPos.x, rPos.y);
    ctx.lineTo(hitPos.x, hitPos.y);
    ctx.stroke();

    // Crisp bounce-back reflection dot (2.2px)
    ctx.beginPath();
    ctx.arc(hitPos.x, hitPos.y, 2.2, 0, 2 * Math.PI);
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

// Draw Autonomous Robot Chassis / LiDAR Puck, Turret, and Forward Heading Pointer
export const drawRobot = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  orientation: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);
  const rad = (orientation * Math.PI) / 180;
  
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(rad);

  // Subtle active LiDAR scanning fan cone in front of the robot (glowing red)
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, 42);
  grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
  grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.10)');
  grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, 42, -Math.PI / 4, Math.PI / 4);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Sleek circular LiDAR puck body (dark obsidian with glowing red bezel)
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, 2 * Math.PI);
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
  ctx.fillRect(-7, -15, 14, 3.5);
  ctx.fillRect(-7, 11.5, 14, 3.5);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1;
  ctx.strokeRect(-7, -15, 14, 3.5);
  ctx.strokeRect(-7, 11.5, 14, 3.5);

  // Forward Heading Pointer (LiDAR angle arrow pointing forward +X)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(22, 0);
  ctx.strokeStyle = '#ff3344';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Arrowhead pointing forward
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(14, -6);
  ctx.lineTo(14, 6);
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

  // Flag color palette
  const palettes = [
    { fill: '#10b981', border: '#059669', glow: 'rgba(16, 185, 129, 0.5)', text: '#6ee7b7' }, // Flag 1 (Emerald)
    { fill: '#06b6d4', border: '#0891b2', glow: 'rgba(6, 182, 212, 0.5)', text: '#67e8f9' },  // Flag 2 (Cyan)
    { fill: '#a855f7', border: '#9333ea', glow: 'rgba(168, 85, 247, 0.5)', text: '#d8b4fe' }, // Flag 3 (Purple)
    { fill: '#f59e0b', border: '#d97706', glow: 'rgba(245, 158, 11, 0.5)', text: '#fcd34d' }, // Flag 4 (Amber)
  ];
  const c = palettes[(flagNum - 1) % palettes.length] || palettes[0];

  ctx.save();

  // 1. Glowing ground target circle
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 12;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 8, 0, 2 * Math.PI);
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Bullseye inner dot
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 2. Vertical Flag Pole
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
  ctx.lineTo(pos.x, pos.y - 32);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pole Top Finial Sphere
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - 33, 2.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 3. Pennant Flag Banner (Triangle)
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 32);
  ctx.lineTo(pos.x + 24, pos.y - 23);
  ctx.lineTo(pos.x, pos.y - 14);
  ctx.closePath();
  ctx.fillStyle = c.fill;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flag Number inside Banner
  ctx.shadowBlur = 0;
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(flagNum), pos.x + 9, pos.y - 23);

  // 4. Room Label Badge above the flag
  const label = name || `Room ${flagNum}`;
  ctx.font = 'bold 11px monospace';
  const textW = ctx.measureText(label).width;
  const pillW = Math.max(textW + 16, 60);
  const pillH = 20;
  const pillX = pos.x - pillW / 2;
  const pillY = pos.y - 56;

  // Badge background
  ctx.fillStyle = 'rgba(2, 6, 23, 0.90)';
  ctx.strokeStyle = c.border;
  ctx.lineWidth = 1.5;
  if ((ctx as any).roundRect) {
    ctx.beginPath();
    (ctx as any).roundRect(pillX, pillY, pillW, pillH, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.strokeRect(pillX, pillY, pillW, pillH);
  }

  // Badge text
  ctx.fillStyle = c.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pos.x, pillY + pillH / 2);

  // 5. World Coordinate subtick: (X.X, Y.Y)m
  ctx.font = '9px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.fillText(`(${x.toFixed(2)}, ${y.toFixed(2)})m`, pos.x, pos.y + 18);

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

// Planned autonomous navigation path (High-tech red ribbon)
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

// Real-time travel trajectory breadcrumb trail (Dark crimson dash)
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
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.65)';
  ctx.lineWidth = 2.0;
  ctx.shadowColor = '#b91c1c';
  ctx.shadowBlur = 6;
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.restore();
};

export const drawLidarRays = (
  ctx: CanvasRenderingContext2D,
  robotX: number,
  robotY: number,
  rays: { angle: number, distance: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  const startPos = worldToCanvas(robotX, robotY, scale, offset.x, offset.y);

  ctx.strokeStyle = 'rgba(239, 68, 68, 0.08)';
  ctx.lineWidth = 0.5;

  rays.forEach(ray => {
    if (ray.distance < 0.12 || ray.distance > 8.0) return;
    const angleDeg = ((ray.angle % 360) + 360) % 360;
    const angleRad = (angleDeg * Math.PI) / 180;
    const endX = robotX + ray.distance * Math.cos(angleRad);
    const endY = robotY + ray.distance * Math.sin(angleRad);
    const endPos = worldToCanvas(endX, endY, scale, offset.x, offset.y);

    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();
  });
};

// Draw 1-Meter Grid Scale Guides and Room Dimensions on Canvas (Subtle Red Grid)
export const drawMetricGuides = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const cellPixelSize = 2.0 * scale;
  const pixelsPerMeter = (1.0 / RESOLUTION) * cellPixelSize;

  ctx.save();
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.06)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  // Meter grid lines across 30m building grid (-14m to +14m)
  for (let m = -14; m <= 14; m += 2) {
    if (m === 0) continue;
    const pos = worldToCanvas(m, 0, scale, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.lineTo(pos.x, canvasH);
    ctx.stroke();

    const posY = worldToCanvas(0, m, scale, offset.x, offset.y);
    ctx.beginPath();
    ctx.moveTo(0, posY.y);
    ctx.lineTo(canvasW, posY.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Draw 1.0 Meter scale ruler in bottom-left corner
  const rulerX = 24;
  const rulerY = canvasH - 24;
  const rulerLen = pixelsPerMeter;

  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(rulerX, rulerY);
  ctx.lineTo(rulerX + rulerLen, rulerY);
  // End ticks
  ctx.moveTo(rulerX, rulerY - 4);
  ctx.lineTo(rulerX, rulerY + 4);
  ctx.moveTo(rulerX + rulerLen, rulerY - 4);
  ctx.lineTo(rulerX + rulerLen, rulerY + 4);
  ctx.stroke();

  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#d1d5db'; // light grey labels
  ctx.textAlign = 'center';
  ctx.fillText('1.0 METER', rulerX + rulerLen / 2, rulerY - 6);
  ctx.restore();
};
