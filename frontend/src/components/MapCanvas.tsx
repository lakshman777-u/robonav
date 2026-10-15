import { useRef, useEffect, MouseEvent } from 'react';
import { useMap } from '../hooks/useMap';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { 
  drawGrid, drawRobot, drawDestination, drawRoomFlags, drawPath, 
  canvasToWorld, drawLiveLidarHits, drawMetricGuides,
  drawTrajectoryTrail
} from '../utils/mapRenderer';
import { createDestination } from '../services/api';
import toast from 'react-hot-toast';
import { Crosshair, ZoomIn, ZoomOut, RotateCcw, Scan, Compass, Flag, X } from 'lucide-react';

interface MapCanvasProps {
  flagPlacementMode?: number | null;
  onFlagPlaced?: (flagNumber: number, x: number, y: number) => void;
  onCancelFlagPlacement?: () => void;
}

export const MapCanvas = ({ flagPlacementMode = null, onFlagPlaced, onCancelFlagPlacement }: MapCanvasProps) => {
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

  // Keep latest state in ref to avoid tearing down 60 FPS animation loop on every incoming sensor packet
  const stateRef = useRef({
    mapData,
    robotStatus,
    destinations,
    navigationPath,
    sensorData,
    scale,
    offset
  });

  useEffect(() => {
    stateRef.current = {
      mapData,
      robotStatus,
      destinations,
      navigationPath,
      sensorData,
      scale,
      offset
    };
  });

  useEffect(() => {
    if (canvasRef.current) {
      centerOnRobot(rx, ry, canvasRef.current.width || 900, canvasRef.current.height || 650);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const {
        mapData: curMap,
        robotStatus: curRobot,
        destinations: curDests,
        navigationPath: curNav,
        sensorData: curSensor,
        scale: curScale,
        offset: curOffset
      } = stateRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Deep dark floor background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Smooth slider interpolation (0.18 per frame) for fluid gliding animation
      const targetX = curRobot?.position?.x ?? 0.0;
      const targetY = curRobot?.position?.y ?? 0.0;
      const targetHeading = curRobot?.orientation ?? 0.0;

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
      drawMetricGuides(ctx, canvas.width, canvas.height, curScale, curOffset);

      // 2. Draw 2D SLAM Occupancy Grid if available (using 0.02ms hardware offscreen canvas)
      if (curMap && curMap.occupancy_grid) {
        drawGrid(ctx, curMap.occupancy_grid, curMap.width, curMap.height, curScale, curOffset);
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
      if (curRobot?.trajectory && curRobot.trajectory.length > 1) {
        drawTrajectoryTrail(ctx, curRobot.trajectory, curScale, curOffset);
      }

      // 4. Draw Live LiDAR bounce-backed reflection dots for the current frame
      // When the robot moves from Point A to Point B, the dots shift continuously and never remain behind!
      if (curSensor?.lidar?.rays && curSensor.lidar.rays.length > 0) {
        drawLiveLidarHits(
          ctx, 
          smoothX, 
          smoothY, 
          smoothHeading, 
          curSensor.lidar.rays, 
          curScale, 
          curOffset
        );
      }

      // 5. Draw planned autonomous navigation path
      if (curNav) {
        drawPath(ctx, curNav, curScale, curOffset);
      }

      // 6. Draw destination pins and custom room flags
      if (curDests) {
        drawRoomFlags(ctx, curDests, curScale, curOffset);
      }

      // 7. Draw robot chassis, wheels, heading arrow, and LiDAR turret with smooth pose
      if (curRobot) {
        drawRobot(ctx, smoothX, smoothY, smoothHeading, curScale, curOffset);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const onCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!flagPlacementMode || !onFlagPlaced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldPos = canvasToWorld(cx, cy, scale, offset.x, offset.y);
    onFlagPlaced(flagPlacementMode, worldPos.x, worldPos.y);
  };

  const onCanvasDoubleClick = async (e: MouseEvent<HTMLCanvasElement>) => {
    if (flagPlacementMode) return;
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

      {/* Flag Placement Active Mode HUD Banner */}
      {flagPlacementMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-950/95 border border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse font-mono">
          <Flag size={18} className="text-cyan-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Click anywhere on 2D map to fix <span className="text-cyan-300 font-black">Flag {flagPlacementMode} (Room {flagPlacementMode})</span>
          </span>
          {onCancelFlagPlacement && (
            <button
              onClick={onCancelFlagPlacement}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-white transition-colors"
              title="Cancel flag placement"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Bottom Left Double Click Hint */}
      <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
        <div className="px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-white/5 text-[10px] font-mono text-gray-400">
          {flagPlacementMode 
            ? `AIMING: Click on map to place Flag ${flagPlacementMode}` 
            : 'TIP: Double-click to set goal • Drag to pan • Scroll to zoom'}
        </div>
      </div>

      {/* Main High-Performance Canvas */}
      <canvas
        ref={canvasRef}
        width={900}
        height={650}
        className={`w-full h-full ${flagPlacementMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
        onWheel={handleWheel}
        onClick={onCanvasClick}
        onMouseDown={flagPlacementMode ? undefined : handleMouseDown}
        onMouseMove={flagPlacementMode ? undefined : handleMouseMove}
        onMouseUp={flagPlacementMode ? undefined : handleMouseUp}
        onMouseLeave={flagPlacementMode ? undefined : handleMouseUp}
        onDoubleClick={onCanvasDoubleClick}
      />
    </div>
  );
};
