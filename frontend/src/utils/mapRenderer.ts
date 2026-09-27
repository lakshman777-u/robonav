export const worldToCanvas = (wx: number, wy: number, scale: number, offsetX: number, offsetY: number) => {
  return { x: wx * scale + offsetX, y: wy * scale + offsetY };
};

export const canvasToWorld = (cx: number, cy: number, scale: number, offsetX: number, offsetY: number) => {
  return { x: (cx - offsetX) / scale, y: (cy - offsetY) / scale };
};

export const drawGrid = (
  ctx: CanvasRenderingContext2D,
  grid: number[],
  width: number,
  height: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = grid[idx];
      if (val === -1) {
        ctx.fillStyle = '#1e293b'; // Unknown
      } else if (val === 0) {
        ctx.fillStyle = '#ffffff'; // Free
      } else if (val >= 100) {
        ctx.fillStyle = '#000000'; // Occupied
      } else {
        ctx.fillStyle = `rgb(${255 - val}, ${255 - val}, ${255 - val})`; // Probabilistic
      }
      ctx.fillRect(offset.x + x * scale, offset.y + y * scale, scale, scale);
    }
  }
};

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
  
  ctx.beginPath();
  ctx.arc(0, 0, 10 * scale, 0, 2 * Math.PI);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(15 * scale, 0);
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  
  ctx.restore();
};

export const drawDestination = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 5 * scale, 0, 2 * Math.PI);
  ctx.fillStyle = '#10b981';
  ctx.fill();
  ctx.strokeStyle = '#047857';
  ctx.stroke();
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
  
  ctx.strokeStyle = '#8b5cf6';
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
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
  
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
  ctx.lineWidth = 1;
  
  rays.forEach(ray => {
    const endX = robotX + ray.distance * Math.cos(ray.angle);
    const endY = robotY + ray.distance * Math.sin(ray.angle);
    const endPos = worldToCanvas(endX, endY, scale, offset.x, offset.y);
    
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(endPos.x, endPos.y);
    ctx.stroke();
  });
};

export const drawObstacle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  scale: number,
  offset: { x: number; y: number }
) => {
  const pos = worldToCanvas(x, y, scale, offset.x, offset.y);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius * scale, 0, 2 * Math.PI);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
};
