export const RESOLUTION = 0.05; // 5 cm per grid cell
export const ORIGIN_X = -10.0;  // 20m x 15m grid centered at (-10.0, -7.5)
export const ORIGIN_Y = -7.5;

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

// Draw Occupancy Grid with high performance and neon highlights
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

  // 1. Draw subtle boundary bounds
  ctx.fillStyle = '#030812';
  ctx.fillRect(offset.x, offset.y, totalW, totalH);

  // Subtle grid room border
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(offset.x, offset.y, totalW, totalH);

  // 2. Render Explored Free Space and Obstacle Walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = grid[idx];
      if (val === -1) continue; // Skip unexplored (handled by background)

      if (val === 0) {
        // Free explored floor
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(offset.x + x * cellPixelSize, offset.y + y * cellPixelSize, cellPixelSize, cellPixelSize);
      } else if (val >= 100) {
        // Solid wall obstacle (neon cyan)
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(offset.x + x * cellPixelSize, offset.y + y * cellPixelSize, cellPixelSize, cellPixelSize);
      }
    }
  }
};

// Draw Continuous Solid Wall Contours and Ambient Explored Room Interior
export const drawRoomContour = (
  ctx: CanvasRenderingContext2D,
  robotX: number,
  robotY: number,
  rays: { angle: number; distance: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!rays || rays.length < 8) return;

  interface ProcessedPoint {
    wx: number;
    wy: number;
    cx: number;
    cy: number;
    dist: number;
    angle: number;
  }

  const validPoints: ProcessedPoint[] = [];

  // 1. Process valid rays with proper degree to radian conversion
  rays.forEach(ray => {
    if (ray.distance < 0.12 || ray.distance > 8.0) return;
    const angleDeg = ((ray.angle % 360) + 360) % 360;
    const rad = (angleDeg * Math.PI) / 180;
    const wx = robotX + ray.distance * Math.cos(rad);
    const wy = robotY + ray.distance * Math.sin(rad);
    const pos = worldToCanvas(wx, wy, scale, offset.x, offset.y);
    validPoints.push({
      wx, wy,
      cx: pos.x,
      cy: pos.y,
      dist: ray.distance,
      angle: angleDeg
    });
  });

  if (validPoints.length < 4) return;

  // 2. Sort points strictly by angle around the robot (0 to 360)
  validPoints.sort((a, b) => a.angle - b.angle);

  // 3. Fill explored room interior floor polygon with soft ambient tint
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(validPoints[0].cx, validPoints[0].cy);
  for (let i = 1; i < validPoints.length; i++) {
    ctx.lineTo(validPoints[i].cx, validPoints[i].cy);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(6, 182, 212, 0.09)';
  ctx.fill();
  ctx.restore();

  // 4. Partition adjacent points into continuous wall chains
  // A wall segment continues if adjacent points have small angular step (<= 4.0°)
  // AND small Euclidean distance in world meters (<= 0.45m).
  const wallChains: ProcessedPoint[][] = [];
  let currentChain: ProcessedPoint[] = [validPoints[0]];

  for (let i = 1; i < validPoints.length; i++) {
    const prev = validPoints[i - 1];
    const curr = validPoints[i];
    const angleDiff = curr.angle - prev.angle;
    const distEuclid = Math.hypot(curr.wx - prev.wx, curr.wy - prev.wy);

    if (angleDiff <= 4.0 && distEuclid <= 0.45) {
      currentChain.push(curr);
    } else {
      if (currentChain.length >= 2) {
        wallChains.push(currentChain);
      }
      currentChain = [curr];
    }
  }

  // Check wrap-around between last point (near 360°) and first point (near 0°)
  if (currentChain.length >= 2) {
    const first = validPoints[0];
    const last = currentChain[currentChain.length - 1];
    const wrapAngle = (first.angle + 360) - last.angle;
    const wrapEuclid = Math.hypot(first.wx - last.wx, first.wy - last.wy);
    if (wrapAngle <= 4.0 && wrapEuclid <= 0.45 && wallChains.length > 0) {
      wallChains[0] = [...currentChain, ...wallChains[0]];
    } else {
      wallChains.push(currentChain);
    }
  }

  // 5. Render continuous solid glowing wall segments
  wallChains.forEach(chain => {
    if (chain.length < 2) return;

    // Pass A: Outer luminous cyan neon glow
    ctx.save();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(chain[0].cx, chain[0].cy);
    for (let i = 1; i < chain.length; i++) {
      ctx.lineTo(chain[i].cx, chain[i].cy);
    }
    ctx.stroke();

    // Pass B: Crisp white inner wall core
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  });

  // 6. Draw subtle wall reflection nodes
  ctx.save();
  validPoints.forEach(pt => {
    ctx.fillStyle = pt.dist < 0.45 ? '#ef4444' : (pt.dist < 1.0 ? '#f59e0b' : '#38bdf8');
    ctx.beginPath();
    ctx.arc(pt.cx, pt.cy, pt.dist < 0.45 ? 2.5 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
};

// Draw Robot Chassis and Turret Heading
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
  
  // Robot chassis body
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, 2 * Math.PI);
  ctx.fillStyle = '#0284c7';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Left & Right Wheels
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-7, -16, 14, 4);
  ctx.fillRect(-7, 12, 14, 4);

  // Forward Heading Pointer
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(20, 0);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(13, -5);
  ctx.lineTo(13, 5);
  ctx.closePath();
  ctx.fillStyle = '#38bdf8';
  ctx.fill();

  // Center YDLIDAR Turret
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, 2 * Math.PI);
  ctx.fillStyle = '#f43f5e';
  ctx.fill();
  
  ctx.restore();
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
  ctx.arc(pos.x, pos.y, 6, 0, 2 * Math.PI);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (name) {
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#67e8f9';
    ctx.textAlign = 'center';
    ctx.fillText(name, pos.x, pos.y - 10);
    ctx.restore();
  }
};

export const drawPath = (
  ctx: CanvasRenderingContext2D,
  path: { x: number; y: number }[],
  scale: number,
  offset: { x: number; y: number }
) => {
  if (!path || path.length === 0) return;
  
  ctx.beginPath();
  const startPos = worldToCanvas(path[0].x, path[0].y, scale, offset.x, offset.y);
  ctx.moveTo(startPos.x, startPos.y);
  
  for (let i = 1; i < path.length; i++) {
    const pos = worldToCanvas(path[i].x, path[i].y, scale, offset.x, offset.y);
    ctx.lineTo(pos.x, pos.y);
  }
  
  ctx.strokeStyle = '#a855f7';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
};

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
  ctx.strokeStyle = '#c084fc';
  ctx.lineWidth = 2.2;
  ctx.shadowColor = '#c084fc';
  ctx.shadowBlur = 8;
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

  ctx.strokeStyle = 'rgba(6, 182, 212, 0.08)';
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

// Draw 1-Meter Grid Scale Guides and Room Dimensions on Canvas
export const drawMetricGuides = (
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const cellPixelSize = 2.0 * scale;
  const pixelsPerMeter = (1.0 / RESOLUTION) * cellPixelSize; // 40px at scale 1.0

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  // Meter grid lines (-8m to +8m)
  for (let m = -8; m <= 8; m++) {
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

  ctx.strokeStyle = '#00f0ff';
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
  ctx.fillStyle = '#67e8f9';
  ctx.textAlign = 'center';
  ctx.fillText('1.0 METER', rulerX + rulerLen / 2, rulerY - 6);
  ctx.restore();
};
