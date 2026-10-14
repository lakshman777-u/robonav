import { Server, Wifi, Camera, Radar, Cpu, AlertTriangle, Radio } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const HardwareIndicators = () => {
  const { robotStatus, wsConnected, simulationMode } = useRobotStatus();

  const isBridgeStreaming = robotStatus?.hardware?.udp_bridge === 'STREAMING' || Boolean(robotStatus?.bridge?.active);
  const isRealOnline = (robotStatus?.connection_status === 'ONLINE' || isBridgeStreaming) && !simulationMode;
  const isOnline = isRealOnline || simulationMode;

  const indicators = [
    {
      label: 'UBUNTU PC',
      status: 'ONLINE',
      active: true,
      icon: Server,
      color: 'text-green-400 bg-green-500/10 border-green-500/30'
    },
    {
      label: 'ESP32 DEVKIT',
      status: isRealOnline ? 'ONLINE' : (isBridgeStreaming ? 'STREAMING' : (simulationMode ? 'SIMULATED' : 'OFFLINE')),
      active: isOnline,
      icon: Wifi,
      color: isRealOnline ? 'text-green-400 bg-green-500/10 border-green-500/30' : (simulationMode ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30')
    },
    {
      label: 'WEBSOCKET',
      status: wsConnected ? 'CONNECTED' : 'DISCONNECTED',
      active: wsConnected,
      icon: Wifi,
      color: wsConnected ? 'text-green-400 bg-green-500/10 border-green-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'
    },
    {
      label: 'YDLIDAR X2',
      status: (isBridgeStreaming || isOnline) ? 'ACTIVE' : 'INACTIVE',
      active: isBridgeStreaming || isOnline,
      icon: Radar,
      color: (isBridgeStreaming || isOnline) ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    },
    {
      label: 'L298N MOTORS',
      status: isOnline ? (robotStatus?.state === 'EMERGENCY_STOP' ? 'ESTOP' : (robotStatus?.motors?.state || 'READY')) : 'STANDBY',
      active: isOnline && robotStatus?.state !== 'EMERGENCY_STOP',
      icon: Cpu,
      color: (isOnline && robotStatus?.state !== 'EMERGENCY_STOP') ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' : 'text-red-400 bg-red-500/10 border-red-500/30'
    },
    {
      label: 'ULTRASONIC x2',
      status: isOnline ? 'ACTIVE' : 'OFFLINE',
      active: isOnline,
      icon: Radio,
      color: isOnline ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    },
    {
      label: '1.3" OLED FACE',
      status: isOnline ? (robotStatus?.oled_expression || 'ONLINE') : 'STANDBY',
      active: isOnline,
      icon: Cpu,
      color: isOnline ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    },
    {
      label: 'NAV2 / SLAM',
      status: (isOnline || isBridgeStreaming) ? 'READY' : 'OFFLINE',
      active: isOnline || isBridgeStreaming,
      icon: Radio,
      color: (isOnline || isBridgeStreaming) ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' : 'text-gray-400 bg-gray-500/10 border-gray-500/30'
    }
  ];


  return (
    <div className="space-y-2">
      {/* Warning banner if real robot is disconnected and not in simulation */}
      {!isOnline && (
        <div className="px-4 py-2 rounded-xl bg-red-950/70 border border-red-500/50 flex items-center justify-between text-xs font-mono font-bold text-red-300 shadow-lg animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <span>⚠ ROBOT CONNECTION LOST — ESP32 OFFLINE</span>
          </div>
          <span className="text-[10px] text-red-400/80 uppercase">Waiting for UDP / Wi-Fi packets</span>
        </div>
      )}

      {/* Grid of hardware status pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {indicators.map((ind) => {
          const Icon = ind.icon;
          return (
            <div
              key={ind.label}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center justify-between gap-1.5 font-mono text-[10px] ${ind.color}`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Icon size={12} />
                <span className="font-bold truncate">{ind.label}</span>
              </div>
              <span className="font-black text-[9px] tracking-wider">{ind.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
