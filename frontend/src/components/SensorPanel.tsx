import { Radar, Camera, Waves, ShieldAlert, AlertTriangle, Eye, Radio } from 'lucide-react';
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

  const { lidar, camera, ultrasonic, glass_detected, bridge } = sensorData;

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
            <Radar size={15} className="text-cyan-400" /> YDLIDAR X2 (360° SLAM)
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${lidar.active ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'}`}>
            {lidar.active ? `ACTIVE (${lidar.scan_rate ? lidar.scan_rate.toFixed(1) : '10'} Hz)` : 'INACTIVE'}
          </span>
        </div>

        {/* Wireless UDP Bridge Telemetry */}
        {bridge && (
          <div className="bg-slate-950/70 p-3 rounded-xl border border-cyan-500/20 space-y-2">
            <div className="flex justify-between items-center text-[11px] text-cyan-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Radio size={13} className="text-cyan-400 animate-pulse" /> ESP32 UDP Telemetry
              </span>
              <span className="text-[10px] text-cyan-400/80">
                {bridge.sender_ip !== 'none' ? bridge.sender_ip : 'Port 4210'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5">
                <div className="text-gray-400 text-[9px]">RX PACKETS</div>
                <div className="font-bold text-white">{bridge.udp_packets_rx.toLocaleString()}</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5">
                <div className="text-gray-400 text-[9px]">SCAN RATE</div>
                <div className="font-bold text-cyan-400">{bridge.scan_hz.toFixed(1)} Hz</div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5">
                <div className="text-gray-400 text-[9px]">DROPPED</div>
                <div className={`font-bold ${bridge.dropped_packets > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {bridge.dropped_packets}
                </div>
              </div>
              <div className="bg-slate-900/80 p-1.5 rounded-lg border border-white/5">
                <div className="text-gray-400 text-[9px]">WIFI RSSI</div>
                <div className="font-bold text-emerald-400">{bridge.wifi_rssi} dBm</div>
              </div>
            </div>
          </div>
        )}

        {/* Camera Vision Status */}
        <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
          <span className="text-gray-400 flex items-center gap-2">
            <Camera size={15} className="text-purple-400" /> ESP32-CAM Vision
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${camera.obstacle_detected ? 'text-red-400 bg-red-500/20 border-red-500 animate-pulse' : 'text-green-400 bg-green-500/10 border-green-500/30'}`}>
            {camera.obstacle_detected ? `OBSTACLE (${camera.obstacle_type || 'HAZARD'})` : 'CLEAR PATH'}
          </span>
        </div>

        {/* Dual HC-SR04 Ultrasonic Sonar */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-gray-400 text-[11px]">
            <span className="flex items-center gap-1.5">
              <Waves size={13} className="text-emerald-400" /> Dual Ultrasonic Sonar:
            </span>
            <span className="text-[10px] text-gray-500">Range: 0.02 - 4.0m</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.front ?? 1.25)}`}>
              <span className="text-gray-400">FRONT (GPIO 4/18)</span>
              <span className="font-bold">{(ultrasonic.front ?? 1.25).toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.side ?? ultrasonic.left ?? 2.10)}`}>
              <span className="text-gray-400">SIDE (GPIO 5/19)</span>
              <span className="font-bold">{(ultrasonic.side ?? ultrasonic.left ?? 2.10).toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.left ?? 2.10)}`}>
              <span className="text-gray-400">LEFT</span>
              <span className="font-bold">{(ultrasonic.left ?? 2.10).toFixed(2)} m</span>
            </div>

            <div className={`p-2.5 rounded-xl border flex justify-between items-center ${getDistanceColor(ultrasonic.right ?? ultrasonic.rear ?? 1.70)}`}>
              <span className="text-gray-400">RIGHT</span>
              <span className="font-bold">{(ultrasonic.right ?? ultrasonic.rear ?? 1.70).toFixed(2)} m</span>
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
