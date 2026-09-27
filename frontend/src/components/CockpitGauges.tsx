import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { Gauge, Zap, Compass, Activity, Disc } from 'lucide-react';

export const CockpitGauges = () => {
  const { robotStatus } = useRobotStatus();
  const { config, trim } = useCarTrim();

  const speed = robotStatus?.velocity || 0; // m/s
  // Convert 0-0.5m/s into scaled RPM: 0 to 8,500 RPM
  const rpm = Math.min(8500, Math.floor(Math.abs(speed) * 17000));
  const battery = robotStatus?.battery !== undefined ? robotStatus.battery : 100;
  const orientation = robotStatus?.orientation || 0;
  const isMoving = Math.abs(speed) > 0.05;

  // Tachometer angle calculation (-120deg to +120deg)
  const maxSpeed = 0.6; // m/s
  const speedPct = Math.min(1, Math.abs(speed) / maxSpeed);
  const needleAngle = -120 + speedPct * 240;

  // Battery gauge angle calculation
  const batteryPct = battery / 100;
  const batteryNeedleAngle = -120 + batteryPct * 240;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/10 shadow-2xl relative overflow-hidden space-y-5">
      {/* Background carbon pattern overlay */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-40 pointer-events-none" />

      {/* Cockpit Header with Hypercar Badge */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-slate-900 border border-white/10" style={{ color: config.primaryColor }}>
            <Gauge size={22} className={isMoving ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-black" style={{ color: config.primaryColor }}>
                {config.badge}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono">
                {config.hpOutput}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Cockpit Telemetry Cluster
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: isMoving ? '#10b981' : config.primaryColor }} />
            </h4>
          </div>
        </div>

        <div className="text-right font-mono">
          <div className="text-[11px] text-gray-400">TELEMETRY LINK</div>
          <div className="text-xs font-bold text-green-400">ONLINE (10 Hz)</div>
        </div>
      </div>

      {/* Dual Circular Cockpit Dials */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dial 1: Speedometer / Tachometer */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-2 left-3 text-[10px] font-bold text-gray-400 tracking-wider">
            SPEED / TACHOMETER
          </div>

          <div className="relative w-44 h-44 flex items-center justify-center mt-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Outer track */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#1e293b"
                strokeWidth="7"
                strokeDasharray="188 62"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              {/* Redline zone */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#ef4444"
                strokeWidth="7"
                strokeDasharray="40 210"
                strokeDashoffset="-148"
                strokeLinecap="round"
                opacity="0.4"
              />
              {/* Active speed arc */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={config.primaryColor}
                strokeWidth="7"
                strokeDasharray={`${speedPct * 188} 250`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 6px ${config.primaryColor})` }}
              />
            </svg>

            {/* Dial Center Info */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {Math.abs(speed).toFixed(2)}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">m / s</span>
              <div className="mt-1 text-[11px] font-mono font-bold" style={{ color: speedPct > 0.8 ? '#ef4444' : config.primaryColor }}>
                {rpm.toLocaleString()} <span className="text-[9px] text-gray-400">RPM</span>
              </div>
            </div>

            {/* Needle */}
            <div
              className="absolute w-1 h-20 origin-bottom rounded-full transition-transform duration-100 ease-out"
              style={{
                bottom: '50%',
                transform: `rotate(${needleAngle}deg)`,
                backgroundColor: speedPct > 0.8 ? '#ef4444' : config.accentColor,
                boxShadow: `0 0 8px ${speedPct > 0.8 ? '#ef4444' : config.accentColor}`
              }}
            />
          </div>

          <div className="w-full flex justify-between text-[10px] font-mono text-gray-500 px-3 mt-1">
            <span>0.0</span>
            <span>0.2</span>
            <span>0.4</span>
            <span className="text-red-500 font-bold">0.6 REDLINE</span>
          </div>
        </div>

        {/* Dial 2: High Voltage Battery & Supercharged Energy */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-white/5 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-2 left-3 text-[10px] font-bold text-gray-400 tracking-wider flex items-center gap-1">
            <Zap size={11} className="text-amber-400" /> BATTERY / POWER CELL
          </div>

          <div className="relative w-44 h-44 flex items-center justify-center mt-2">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#1e293b"
                strokeWidth="7"
                strokeDasharray="188 62"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={battery > 50 ? '#10b981' : battery > 20 ? '#f59e0b' : '#ef4444'}
                strokeWidth="7"
                strokeDasharray={`${batteryPct * 188} 250`}
                strokeDashoffset="0"
                strokeLinecap="round"
                style={{
                  filter: `drop-shadow(0 0 6px ${battery > 50 ? '#10b981' : battery > 20 ? '#f59e0b' : '#ef4444'})`
                }}
              />
            </svg>

            {/* Dial Center Info */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {battery.toFixed(0)}<span className="text-sm font-normal text-gray-400">%</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                {robotStatus?.state === 'CHARGING' ? '⚡ CHARGING' : 'LIPO 24.8V'}
              </span>
              <div className="mt-1 text-[11px] font-mono text-gray-400">
                4.8 kWh <span className="text-green-400">READY</span>
              </div>
            </div>

            {/* Needle */}
            <div
              className="absolute w-1 h-20 origin-bottom rounded-full transition-transform duration-300"
              style={{
                bottom: '50%',
                transform: `rotate(${batteryNeedleAngle}deg)`,
                backgroundColor: battery > 20 ? '#10b981' : '#ef4444',
                boxShadow: `0 0 8px ${battery > 20 ? '#10b981' : '#ef4444'}`
              }}
            />
          </div>

          <div className="w-full flex justify-between text-[10px] font-mono text-gray-500 px-3 mt-1">
            <span className="text-red-500 font-bold">EMPTY</span>
            <span>25%</span>
            <span>50%</span>
            <span className="text-green-400 font-bold">100% FULL</span>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Strip: 4-Wheel AWD Torque & Orientation HUD */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* 4-Wheel Torque Vectoring Schematic */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
              <Disc size={12} style={{ color: config.primaryColor }} /> 4-Wheel AWD Traction
            </div>
            <div className="text-xs font-mono font-bold text-white">
              {isMoving ? 'DYNAMIC TORQUE 4WD' : 'STANDBY LOCK'}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Slip Ratio: 0.02% | High Grip
            </div>
          </div>

          {/* Mini Chassis Graphic */}
          <div className="w-14 h-16 border-2 border-slate-700 rounded-lg relative flex items-center justify-center bg-slate-900/60">
            {/* Front Left */}
            <div className={`absolute -top-1.5 -left-1.5 w-3 h-5 rounded-sm ${isMoving ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            {/* Front Right */}
            <div className={`absolute -top-1.5 -right-1.5 w-3 h-5 rounded-sm ${isMoving ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            {/* Rear Left */}
            <div className={`absolute -bottom-1.5 -left-1.5 w-3 h-5 rounded-sm ${isMoving ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            {/* Rear Right */}
            <div className={`absolute -bottom-1.5 -right-1.5 w-3 h-5 rounded-sm ${isMoving ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-bold text-gray-400">AWD</span>
          </div>
        </div>

        {/* Gyro Heading & Coordinates */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
              <Compass size={12} className="text-blue-400" /> Gyro Heading & Pos
            </div>
            <div className="text-xs font-mono font-bold text-white">
              θ: {orientation.toFixed(1)}° DEG
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              X: {robotStatus?.position?.x?.toFixed(2) || '0.00'}m | Y: {robotStatus?.position?.y?.toFixed(2) || '0.00'}m
            </div>
          </div>

          {/* Compass Rose */}
          <div className="w-12 h-12 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center relative">
            <div
              className="w-1 h-8 bg-gradient-to-t from-transparent via-blue-400 to-red-500 rounded-full transition-transform duration-200"
              style={{ transform: `rotate(${orientation}deg)` }}
            />
            <span className="absolute top-0.5 text-[8px] font-bold text-red-500">N</span>
          </div>
        </div>

        {/* Drive Mode & Chassis Trim */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
            <Activity size={12} style={{ color: config.primaryColor }} /> Active Drive Mode
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="px-2.5 py-1 rounded-md text-xs font-black tracking-wider uppercase"
              style={{ backgroundColor: `${config.primaryColor}25`, color: config.primaryColor }}
            >
              {trim === 'hellcat' ? '🔥 HELLCAT TRACK' : trim === 'pagani' ? '⚡ CORSA V12' : '🏁 SHELBY SPORT'}
            </span>
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-1">
            Aero Wing: Active Auto-Level
          </div>
        </div>
      </div>
    </div>
  );
};
