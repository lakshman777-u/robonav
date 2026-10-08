import { Radar, Camera, Waves, ShieldAlert, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const SensorPanel = () => {
  const { sensorData } = useRobotStatus();

  if (!sensorData) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-white/10 text-center font-mono text-xs text-gray-400">
        Acquiring Sensor Telemetry...
      </div>
    );
  }

  const { lidar, camera, ultrasonic, glass_detected } = sensorData;

  const getDistanceColor = (dist: number) => {
    if (dist < 0.35) return 'text-red-400 bg-red-950/40 border-red-500/50';
    if (dist < 0.8) return 'text-amber-400 bg-amber-950/40 border-amber-500/50';
    return 'text-green-400 bg-slate-900 border-white/10';
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
          <Waves size={16} className="text-cyan-400" />
          <span>Sensor Diagnostics</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
          PC FUSION CORE
        </span>
      </div>

      <div className="relative z-10 space-y-3 font-mono text-xs">
        {/* LiDAR Status */}
        <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
          <span className="text-gray-400 flex items-center gap-2">
            <Radar size={15} className="text-cyan-400" /> 2D LiDAR (360° SLAM)
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${lidar.active ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
            {lidar.active ? 'ACTIVE (10 Hz)' : 'INACTIVE'}
          </span>
        </div>

        {/* Camera Vision Status */}
        <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
          <span className="text-gray-400 flex items-center gap-2">
            <Camera size={15} className="text-purple-400" /> ESP32-CAM Vision
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${camera.obstacle_detected ? 'text-red-400 bg-red-500/20 border-red-500 animate-pulse' : 'text-green-400 bg-green-500/10 border-green-500/30'}`}>
            {camera.obstacle_detected ? `OBSTACLE (${camera.obstacle_type || 'HAZARD'})` : 'CLEAR PATH'}
          </span>
        </div>

        {/* 4-Way Ultrasonic Grid */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-gray-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <Waves size={13} className="text-emerald-400" /> 4-Way Ultrasonic Grid:
            </span>
            <span className="text-[10px] text-gray-500">Echo Range: 0.02 - 4.0m</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.front)}`}>
              <span className="text-gray-400">FRONT</span>
              <span className="font-bold">{ultrasonic.front.toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.rear)}`}>
              <span className="text-gray-400">REAR</span>
              <span className="font-bold">{ultrasonic.rear.toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.left)}`}>
              <span className="text-gray-400">LEFT</span>
              <span className="font-bold">{ultrasonic.left.toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.right)}`}>
              <span className="text-gray-400">RIGHT</span>
              <span className="font-bold">{ultrasonic.right.toFixed(2)} m</span>
            </div>
          </div>
        </div>

        {/* Glass / Transparent Obstacle Alert (Requirement #24) */}
        {glass_detected ? (
          <div className="bg-amber-500/20 text-amber-300 p-2.5 rounded-xl flex items-center gap-2 border border-amber-500/40 text-xs font-bold animate-pulse">
            <ShieldAlert size={16} className="text-amber-400" />
            <span>GLASS OBSTACLE DETECTED (Ultrasonic Echo Reroute)</span>
          </div>
        ) : (
          <div className="bg-slate-950/40 text-gray-400 p-2 rounded-xl flex items-center justify-between border border-white/5 text-[10px]">
            <span className="flex items-center gap-1.5">
              <Eye size={12} className="text-blue-400" /> Glass Obstacle Sensor:
            </span>
            <span className="text-green-400 font-bold">CLEAR</span>
          </div>
        )}
      </div>
    </div>
  );
};
