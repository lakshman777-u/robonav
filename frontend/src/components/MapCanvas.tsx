import { useRef, useEffect, MouseEvent } from 'react';
import { useMap } from '../hooks/useMap';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { drawGrid, drawRobot, drawDestination, drawPath, canvasToWorld } from '../utils/mapRenderer';
import { createDestination } from '../services/api';
import toast from 'react-hot-toast';
import { Crosshair, ZoomIn, ZoomOut, RotateCcw, Scan } from 'lucide-react';

export const MapCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scale, offset, handleWheel, handleMouseDown, handleMouseMove, handleMouseUp } = useMap();
  const { mapData, robotStatus, destinations, navigationPath } = useRobotStatus();
  const { config } = useCarTrim();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (mapData && mapData.occupancy_grid) {
        drawGrid(ctx, mapData.occupancy_grid, mapData.width, mapData.height, scale, offset);
      } else {
        // Deep obsidian background
        ctx.fillStyle = '#050814';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Subtle radar sweep circle
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 120, 0, Math.PI * 2);
        ctx.arc(cx, cy, 240, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#334155';
        ctx.beginPath();
        ctx.moveTo(cx - 260, cy);
        ctx.lineTo(cx + 260, cy);
        ctx.moveTo(cx, cy - 260);
        ctx.lineTo(cx, cy + 260);
        ctx.stroke();
      }

      if (navigationPath) {
        drawPath(ctx, navigationPath, scale, offset);
      }

      if (destinations) {
        destinations.forEach((d: any) => drawDestination(ctx, d.x, d.y, scale, offset));
      }

      if (robotStatus) {
        drawRobot(ctx, robotStatus.position.x, robotStatus.position.y, robotStatus.orientation, scale, offset);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mapData, robotStatus, scale, offset, destinations, navigationPath]);

  const onCanvasDoubleClick = async (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldPos = canvasToWorld(cx, cy, scale, offset.x, offset.y);

    try {
      await createDestination({
        name: `Dest_${Math.floor(Date.now() / 1000).toString().slice(-4)}`,
        x: Number(worldPos.x.toFixed(2)),
        y: Number(worldPos.y.toFixed(2))
      });
      toast.success('Destination mapped on 2D grid');
    } catch (err) {
      console.error('Failed to add destination', err);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950/80 rounded-2xl border border-white/10 shadow-2xl">
      {/* Top HUD Telemetry Overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-mono shadow-lg">
          <Scan size={14} style={{ color: config.primaryColor }} />
          <span className="font-bold text-white tracking-wider">HUD 2D OCCUPANCY SLAM</span>
          <span className="text-[10px] text-gray-400">| 0.05m RES</span>
        </div>
      </div>

      {/* Top Right Coordinate & Zoom Info */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 pointer-events-none">
        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-gray-300 shadow-lg">
          ZOOM: {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Bottom Left Double Click Hint */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
        <div className="px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-white/5 text-[10px] font-mono text-gray-400">
          TIP: Double-click to drop destination pin • Click & drag to pan
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={900}
        height={650}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={onCanvasDoubleClick}
      />
    </div>
  );
};
