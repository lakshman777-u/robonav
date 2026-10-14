import { useRef, useEffect, MouseEvent } from 'react';
import { useMap } from '../hooks/useMap';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { 
  drawGrid, drawRobot, drawDestination, drawPath, 
  canvasToWorld, drawLidarRays, drawRoomContour, drawMetricGuides,
  drawTrajectoryTrail
} from '../utils/mapRenderer';
import { createDestination } from '../services/api';
import toast from 'react-hot-toast';
import { Crosshair, ZoomIn, ZoomOut, RotateCcw, Scan, Compass } from 'lucide-react';

export const MapCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animPoseRef = useRef({ x: 0.0, y: 0.0, heading: 0.0, initialized: false });
  const { 
    scale, offset, handleWheel, handleMouseDown, 
    handleMouseMove, handleMouseUp, resetView, 
    centerOnRobot, zoomIn, zoomOut 
  } = useMap();
  const { mapData, robotStatus, destinations, navigationPath, sensorData } = useRobotStatus();
  const { config } = useCarTrim();

  const rx = robotStatus?.position?.x ?? 0.0;
  const ry = robotStatus?.position?.y ?? 0.0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep dark floor background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Smooth slider interpolation (0.18 per frame) for fluid gliding animation
      const targetX = robotStatus?.position?.x ?? 0.0;
      const targetY = robotStatus?.position?.y ?? 0.0;
      const targetHeading = robotStatus?.orientation ?? 0.0;

      if (!animPoseRef.current.initialized) {
        animPoseRef.current = { x: targetX, y: targetY, heading: targetHeading, initialized: true };
      } else {
        animPoseRef.current.x += (targetX - animPoseRef.current.x) * 0.18;
        animPoseRef.current.y += (targetY - animPoseRef.current.y) * 0.18;

        let dHeading = (targetHeading - animPoseRef.current.heading + 180) % 360 - 180;
        if (dHeading < -180) dHeading += 360;
        animPoseRef.current.heading = (animPoseRef.current.heading + dHeading * 0.18 + 360) % 360;
      }

      const smoothX = animPoseRef.current.x;
      const smoothY = animPoseRef.current.y;
      const smoothHeading = animPoseRef.current.heading;

      // 1. Draw Metric 1-meter distance grid lines
      drawMetricGuides(ctx, canvas.width, canvas.height, scale, offset);

      // 2. Draw 2D SLAM Occupancy Grid if available
      if (mapData && mapData.occupancy_grid) {
        drawGrid(ctx, mapData.occupancy_grid, mapData.width, mapData.height, scale, offset);
      } else {
        // Subtle background grid radar guides
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 140, 0, Math.PI * 2);
        ctx.arc(cx, cy, 280, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.beginPath();
        ctx.moveTo(cx - 300, cy);
        ctx.lineTo(cx + 300, cy);
        ctx.moveTo(cx, cy - 300);
        ctx.lineTo(cx, cy + 300);
        ctx.stroke();
      }

      // 3. Draw real-time travel trajectory breadcrumb trail
      if (robotStatus?.trajectory && robotStatus.trajectory.length > 1) {
        drawTrajectoryTrail(ctx, robotStatus.trajectory, scale, offset);
      }

      // 4. Draw continuous 360° LiDAR solid room walls & floor ambient fill
      if (sensorData?.lidar?.rays && sensorData.lidar.rays.length > 0) {
        drawRoomContour(ctx, smoothX, smoothY, sensorData.lidar.rays, scale, offset);
        drawLidarRays(ctx, smoothX, smoothY, sensorData.lidar.rays, scale, offset);
      }

      // 5. Draw planned autonomous navigation path
      if (navigationPath) {
        drawPath(ctx, navigationPath, scale, offset);
      }

      // 6. Draw destination pins
      if (destinations) {
        destinations.forEach((d: any) => drawDestination(ctx, d.x, d.y, scale, offset, d.name));
      }

      // 7. Draw robot chassis, wheels, heading arrow, and LiDAR turret with smooth pose
      if (robotStatus) {
        drawRobot(ctx, smoothX, smoothY, smoothHeading, scale, offset);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [mapData, robotStatus, scale, offset, destinations, navigationPath, sensorData, rx, ry]);

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
      toast.success('Destination pin placed on 2D room map');
    } catch (err) {
      console.error('Failed to add destination', err);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-950 rounded-3xl border border-white/10 shadow-2xl">
      {/* Top Left HUD Telemetry Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/30 flex items-center gap-2 text-xs font-mono shadow-xl">
          <Scan size={15} style={{ color: config.primaryColor }} />
          <span className="font-bold text-white tracking-wider">2D ROOM OCCUPANCY SLAM</span>
          <span className="text-[10px] text-cyan-400">| 0.05m RES</span>
        </div>
      </div>

      {/* Top Right Zoom & Pan HUD Tools */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5">
        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-gray-300 shadow-xl flex items-center gap-2">
          <span>ZOOM: {Math.round(scale * 100)}%</span>
        </div>

        <button
          onClick={zoomIn}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-cyan-400 border border-white/10 transition-colors shadow-lg"
          title="Zoom In"
        >
          <ZoomIn size={15} />
        </button>

        <button
          onClick={zoomOut}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-cyan-400 border border-white/10 transition-colors shadow-lg"
          title="Zoom Out"
        >
          <ZoomOut size={15} />
        </button>

        <button
          onClick={() => centerOnRobot(rx, ry, 900, 650)}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-cyan-400 border border-white/10 transition-colors shadow-lg"
          title="Center on Robot"
        >
          <Crosshair size={15} />
        </button>

        <button
          onClick={() => resetView(900, 650)}
          className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-cyan-400 border border-white/10 transition-colors shadow-lg"
          title="Reset Room View"
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Bottom Left Double Click Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-white/5 text-[10px] font-mono text-gray-400">
          TIP: Double-click to set goal • Drag to pan • Scroll to zoom
        </div>
      </div>

      {/* Main High-Performance Canvas */}
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
