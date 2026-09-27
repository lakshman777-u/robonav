import { Battery, Wifi, WifiOff, Activity, Navigation as NavIcon, Zap, Gauge } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';

export const RobotStatus = () => {
  const { robotStatus, wsConnected } = useRobotStatus();
  const { config, trim } = useCarTrim();

  if (!robotStatus) {
    return (
      <div className="glass-panel p-5 rounded-2xl border border-white/10 text-center font-mono text-xs text-gray-400">
        Acquiring Telemetry Stream...
      </div>
    );
  }

  const getBadgeStyle = (state: string) => {
    switch (state) {
      case 'NAVIGATING':
        return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/40' };
      case 'MAPPING':
        return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/40' };
      case 'MANUAL_CONTROL':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/40' };
      case 'EMERGENCY_STOP':
      case 'ERROR':
        return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/40' };
      case 'CHARGING':
        return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/40' };
      default:
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/40' };
    }
  };

  const badgeStyle = getBadgeStyle(robotStatus.state);
  const speed = robotStatus.velocity || 0;
  const battery = robotStatus.battery || 100;

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest font-mono" style={{ color: config.primaryColor }}>
            {config.name.toUpperCase()}
          </div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            Chassis Telemetry
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {wsConnected ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[10px] font-mono font-bold">
              <Wifi size={12} /> LINKED
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-mono font-bold">
              <WifiOff size={12} /> OFFLINE
            </span>
          )}
        </div>
      </div>

      {/* Telemetry Metrics */}
      <div className="relative z-10 space-y-3">
        {/* State Badge */}
        <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
          <span className="text-xs text-gray-400 font-medium">State Machine</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wider uppercase border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
            {robotStatus.state}
          </span>
        </div>

        {/* Speed / Throttle */}
        <div className="flex justify-between items-center bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
          <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
            <Gauge size={14} style={{ color: config.primaryColor }} /> Speed Output
          </span>
          <div className="text-right font-mono">
            <span className="text-sm font-bold text-white">{Math.abs(speed).toFixed(2)}</span>
            <span className="text-[10px] text-gray-400 ml-1">m/s</span>
          </div>
        </div>

        {/* Battery Power Bar */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
              <Zap size={14} className="text-amber-400" /> Battery Cell
            </span>
            <span className="text-xs font-mono font-bold text-white">
              {battery.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                battery > 50 ? 'bg-green-500' : battery > 20 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{
                width: `${battery}%`,
                boxShadow: `0 0 8px ${battery > 50 ? '#10b981' : battery > 20 ? '#f59e0b' : '#ef4444'}`
              }}
            />
          </div>
        </div>

        {/* Position & Yaw */}
        <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-400 flex items-center gap-1.5">
              <NavIcon size={14} className="text-blue-400" /> Position Coordinates
            </span>
            <span className="text-[10px] font-mono text-gray-400">θ: {robotStatus.orientation.toFixed(1)}°</span>
          </div>
          <div className="font-mono text-xs font-bold text-cyan-300">
            X: {robotStatus.position.x.toFixed(2)}m | Y: {robotStatus.position.y.toFixed(2)}m
          </div>
        </div>
      </div>
    </div>
  );
};
