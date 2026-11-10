import { useRef, useEffect, useState, MouseEvent } from 'react';
import { useMap } from '../hooks/useMap';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { 
  drawGrid, drawRobot, drawDestination, drawRoomFlags, drawPath, 
  canvasToWorld, drawLiveLidarHits, drawMetricGuides,
  drawTrajectoryTrail, drawHomeMarker, drawLoopClosureMarkers,
  drawRoomLabels, drawReferenceMetricScale, drawMapTitleAndLegend,
  DEFAULT_HOUSE_ROOMS
} from '../utils/mapRenderer';
import { Navigation3DView } from './Navigation3DView';
import { createDestination } from '../services/api';
import toast from 'react-hot-toast';
import { Crosshair, ZoomIn, ZoomOut, RotateCcw, Scan, Layers, Flag, X, Box } from 'lucide-react';

interface MapCanvasProps {
  flagPlacementMode?: number | null;
  onFlagPlaced?: (flagNumber: number, x: number, y: number) => void;
  onCancelFlagPlacement?: () => void;
}

export const MapCanvas = ({ flagPlacementMode = null, onFlagPlaced, onCancelFlagPlacement }: MapCanvasProps) => {
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
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
    if (viewMode !== '2D') return;
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

      // Deep dark floor background (Obsidian #06080e)
      ctx.fillStyle = '#06080e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Smooth anti-shaking filter with deadband
      const targetX = curRobot?.position?.x ?? 0.0;
      const targetY = curRobot?.position?.y ?? 0.0;
      const targetHeading = curRobot?.orientation ?? 0.0;

      if (!animPoseRef.current.initialized) {
        animPoseRef.current = { x: targetX, y: targetY, heading: targetHeading, initialized: true };
      } else {
        const dx = targetX - animPoseRef.current.x;
        const dy = targetY - animPoseRef.current.y;
        if (Math.abs(dx) > 0.003 || Math.abs(dy) > 0.003) {
          animPoseRef.current.x += dx * 0.16;
          animPoseRef.current.y += dy * 0.16;
        }

        let dHeading = (targetHeading - animPoseRef.current.heading + 180) % 360 - 180;
        if (dHeading < -180) dHeading += 360;
        if (Math.abs(dHeading) > 0.2) {
          animPoseRef.current.heading = (animPoseRef.current.heading + dHeading * 0.16 + 360) % 360;
        }
      }

      const smoothX = animPoseRef.current.x;
      const smoothY = animPoseRef.current.y;
      const smoothHeading = animPoseRef.current.heading;

      // 1. Draw Metric 1-meter and 5-meter coordinate grid lines
      drawMetricGuides(ctx, canvas.width, canvas.height, curScale, curOffset);

      // -------------------------------------------------------------
      // LAYER 1: PERMANENT SLAM OCCUPANCY MAP (Fixed physical world)
      // -------------------------------------------------------------
      if (curMap && curMap.occupancy_grid) {
        const originX = curMap.origin_x ?? (curMap.origin?.x ?? -10.0);
        const originY = curMap.origin_y ?? (curMap.origin?.y ?? -10.0);
        const res = curMap.resolution ?? 0.05;
        drawGrid(
          ctx, 
          curMap.occupancy_grid, 
          curMap.width, 
          curMap.height, 
          curScale, 
          curOffset, 
          originX, 
          originY, 
          res
        );
      }

      // Draw fixed architectural room labels (Living Room, Kitchen, Dining Area, etc.)
      const roomList = curMap?.rooms && curMap.rooms.length > 0 ? curMap.rooms : DEFAULT_HOUSE_ROOMS;
      drawRoomLabels(ctx, roomList, curScale, curOffset);

      // -------------------------------------------------------------
      // LAYER 2: LIVE LIDAR SCAN (Current frame reflection points)
      // Dynamic live points shift with robot and leave ZERO residue on map
      // -------------------------------------------------------------
      const currentRays = curSensor?.lidar?.rays || (curRobot as any)?.lidar?.rays || [];
      if (currentRays.length > 0) {
        drawLiveLidarHits(
          ctx, 
          smoothX, 
          smoothY, 
          smoothHeading, 
          currentRays, 
          curScale, 
          curOffset
        );
      }

      // -------------------------------------------------------------
      // LAYER 3: ROBOT, HOME (0,0), LOOP CLOSURES & NAVIGATION
      // -------------------------------------------------------------
      // HOME (0,0) green bullseye marker matching reference image
      drawHomeMarker(ctx, curScale, curOffset);

      // Loop Closure blue markers (LC1, LC2, LC3) matching reference image
      const loopClosures = curMap?.loop_closures || (curRobot as any)?.loop_closures || [];
      if (loopClosures.length > 0) {
        drawLoopClosureMarkers(ctx, loopClosures, curScale, curOffset);
      }

      // Real-time travel trajectory continuous red path
      if (curRobot?.trajectory && curRobot.trajectory.length > 1) {
        drawTrajectoryTrail(ctx, curRobot.trajectory, curScale, curOffset);
      }

      // Planned autonomous navigation path (High-Tech Red Ribbon)
      if (curNav && curNav.length > 0) {
        drawPath(ctx, curNav, curScale, curOffset);
      }

      // Destination pins and custom room flags
      if (curDests) {
        drawRoomFlags(ctx, curDests, curScale, curOffset);
      }

      // Robot chassis, wheels, forward heading pointer, and ruby laser diode
      if (curRobot) {
        drawRobot(ctx, smoothX, smoothY, smoothHeading, curScale, curOffset);
      }

      // -------------------------------------------------------------
      // OVERLAYS: Metric Scale Ruler & Header Legend Bar
      // -------------------------------------------------------------
      drawReferenceMetricScale(ctx, canvas.width, canvas.height, curScale);
      drawMapTitleAndLegend(ctx, canvas.width);

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [viewMode]);

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
    <div className="w-full h-full relative overflow-hidden bg-slate-950 rounded-3xl border border-red-500/20 shadow-2xl">
      {/* Top Left HUD Telemetry Overlay (Cockpit Style) */}
      <div className="absolute top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-red-500/40 flex items-center gap-2 text-xs font-mono shadow-xl">
          <Scan size={15} className="text-red-400" />
          <span className="font-bold text-white tracking-wider">
            {viewMode === '2D' ? '2D ROOM OCCUPANCY SLAM' : '3D NAVIGATION COCKPIT'}
          </span>
          <span className="text-[10px] text-red-400 font-bold">| 0.05m RES</span>
        </div>

        {/* Live LiDAR Stream Status Badge */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 flex items-center gap-2 text-[10px] font-mono shadow-xl">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="text-gray-400 font-bold">LIDAR:</span>
          <span className="text-red-400 font-bold">
            {(sensorData?.lidar?.scan_rate ?? robotStatus?.bridge?.scan_hz ?? 9.3).toFixed(1)} Hz
          </span>
          <span className="text-gray-400">
            ({sensorData?.lidar?.rays?.length ?? (robotStatus as any)?.lidar?.rays?.length ?? 360} rays)
          </span>
        </div>
      </div>

      {/* Top Center: MODE A (2D SLAM) vs MODE B (3D VIEW) Switcher */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center p-1 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-red-500/30 shadow-2xl gap-1">
        <button
          onClick={() => setViewMode('2D')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-black tracking-wider flex items-center gap-1.5 transition-all ${
            viewMode === '2D'
              ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : 'text-gray-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Switch to 2D Live SLAM Map"
        >
          <Scan size={14} />
          <span>MODE A: 2D SLAM</span>
        </button>

        <button
          onClick={() => setViewMode('3D')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-black tracking-wider flex items-center gap-1.5 transition-all ${
            viewMode === '3D'
              ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : 'text-gray-400 hover:text-white hover:bg-slate-900'
          }`}
          title="Switch to 3D Navigation View"
        >
          <Box size={14} />
          <span>MODE B: 3D VIEW</span>
        </button>
      </div>

      {/* Top Right Zoom & Pan HUD Tools (2D Mode only) */}
      {viewMode === '2D' && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/90 backdrop-blur-md border border-white/10 text-[11px] font-mono text-gray-300 shadow-xl flex items-center gap-2">
            <span>ZOOM: {Math.round(scale * 100)}%</span>
          </div>

          <button
            onClick={zoomIn}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-red-400 border border-white/10 transition-colors shadow-lg"
            title="Zoom In"
          >
            <ZoomIn size={15} />
          </button>

          <button
            onClick={zoomOut}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-red-400 border border-white/10 transition-colors shadow-lg"
            title="Zoom Out"
          >
            <ZoomOut size={15} />
          </button>

          <button
            onClick={() => centerOnRobot(rx, ry, 900, 650)}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-red-400 border border-white/10 transition-colors shadow-lg"
            title="Center on Robot"
          >
            <Crosshair size={15} />
          </button>

          <button
            onClick={() => resetView(900, 650)}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-300 hover:text-red-400 border border-white/10 transition-colors shadow-lg"
            title="Reset Room View"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}

      {/* Flag Placement Active Mode HUD Banner */}
      {flagPlacementMode && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-950/95 border border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)] animate-pulse font-mono">
          <Flag size={18} className="text-red-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Click anywhere on map to fix <span className="text-red-300 font-black">Flag {flagPlacementMode} (Room {flagPlacementMode})</span>
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

      {/* View Mode Switching Body */}
      {viewMode === '3D' ? (
        <Navigation3DView
          mapData={mapData}
          robotStatus={robotStatus}
          sensorData={sensorData}
          destinations={destinations}
          navigationPath={navigationPath}
        />
      ) : (
        <>
          {/* Bottom Left Double Click Hint */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="px-3 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-red-500/10 text-[10px] font-mono text-gray-400">
              {flagPlacementMode 
                ? `AIMING: Click on map to place Flag ${flagPlacementMode}` 
                : 'TIP: Double-click to set goal • Drag to pan • Scroll to zoom'}
            </div>
          </div>

          {/* Main High-Performance 2D Canvas */}
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
        </>
      )}
    </div>
  );
};
