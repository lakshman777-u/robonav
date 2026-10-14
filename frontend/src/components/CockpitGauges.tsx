import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { Gauge, Zap, Compass, Activity, Disc, Waves, ShieldAlert, Cpu, Smile, Eye } from 'lucide-react';

export const CockpitGauges = () => {
  const { robotStatus, sensorData } = useRobotStatus();
  const { config, trim } = useCarTrim();

  const speed = robotStatus?.velocity || 0; // m/s
  // Convert 0-0.5m/s into scaled RPM: 0 to 8,500 RPM
  const rpm = Math.min(8500, Math.floor(Math.abs(speed) * 17000));
  const battery = robotStatus?.battery !== undefined ? robotStatus.battery : 100;
  const orientation = robotStatus?.orientation || 0;
  const isMoving = Math.abs(speed) > 0.05;

  // Dual Ultrasonic Data (Front & Side)
  const frontDist = sensorData?.ultrasonic?.front ?? 1.25;
  const sideDist = sensorData?.ultrasonic?.side ?? (sensorData?.ultrasonic?.left ?? 2.10);
  const frontDistCm = Math.round(frontDist * 100);
  const sideDistCm = Math.round(sideDist * 100);

  // OLED Expression
  const oledExpr = (robotStatus?.oled_expression || sensorData?.oled_expression || 'ONLINE').toUpperCase();

  // L298N Motors Data
  const motorData = robotStatus?.motors || {
    state: isMoving ? 'DRIVING' : 'STOPPED',
    left_speed: isMoving ? 180 : 0,
    right_speed: isMoving ? 180 : 0
  };

  // Tachometer angle calculation (-120deg to +120deg)
  const maxSpeed = 0.6; // m/s
  const speedPct = Math.min(1, Math.abs(speed) / maxSpeed);
  const needleAngle = -120 + speedPct * 240;

  // Battery gauge angle calculation
  const batteryPct = battery / 100;
  const batteryNeedleAngle = -120 + batteryPct * 240;

  // Helper for Ultrasonic status color
  const getSonarStatus = (cm: number) => {
    if (cm <= 15) return { label: 'CRITICAL (<15cm)', color: 'text-red-400 bg-red-950/60 border-red-500/50', bar: 'bg-red-500' };
    if (cm <= 30) return { label: 'SLOW (15-30cm)', color: 'text-amber-400 bg-amber-950/60 border-amber-500/50', bar: 'bg-amber-400' };
    return { label: 'CLEAR (>30cm)', color: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30', bar: 'bg-emerald-400' };
  };

  const frontStatus = getSonarStatus(frontDistCm);
  const sideStatus = getSonarStatus(sideDistCm);

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
          <div className="text-[11px] text-gray-400">ESP32 + ROS 2 LINK</div>
          <div className="text-xs font-bold text-green-400">AUTHENTICATED (10 Hz)</div>
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

      {/* Middle Section: Dual Ultrasonic Sensors + 1.3" OLED Robot Face Mirror */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dual HC-SR04 Ultrasonic Sonar Module */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-white/5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Waves size={15} className="text-cyan-400 animate-pulse" />
              <span>DUAL HC-SR04 ULTRASONIC RADAR</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              10 Hz FILTERED
            </span>
          </div>

          {/* Front Sonar Meter */}
          <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-gray-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                FRONT SONAR (GPIO 4/18)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${frontStatus.color}`}>
                {frontDistCm} cm • {frontStatus.label}
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-300 rounded-full ${frontStatus.bar}`}
                style={{ width: `${Math.min(100, (frontDistCm / 200) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>0 cm</span>
              <span className="text-red-400 font-bold">15cm STOP</span>
              <span className="text-amber-400">30cm SLOW</span>
              <span>200+ cm</span>
            </div>
          </div>

          {/* Side Sonar Meter */}
          <div className="space-y-1.5 bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-gray-300 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                SIDE SONAR (GPIO 5/19)
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${sideStatus.color}`}>
                {sideDistCm} cm • {sideStatus.label}
              </span>
            </div>
            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-300 rounded-full ${sideStatus.bar}`}
                style={{ width: `${Math.min(100, (sideDistCm / 200) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>0 cm</span>
              <span className="text-red-400 font-bold">15cm STOP</span>
              <span className="text-amber-400">30cm SLOW</span>
              <span>200+ cm</span>
            </div>
          </div>
        </div>

        {/* 1.3" OLED Robot Face Mirror */}
        <div className="bg-slate-950/80 rounded-xl p-4 border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Smile size={15} style={{ color: config.primaryColor }} />
              <span>1.3" I2C OLED FACE (GPIO 13/14)</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-300">
              ADDR 0x3C
            </span>
          </div>

          {/* Virtual OLED Screen Bezels */}
          <div className="my-2 p-3 bg-black rounded-lg border-2 border-slate-800 flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
            {/* Scanlines effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent pointer-events-none" />

            {/* Expressive Pixel Eyes */}
            <div className="flex items-center gap-8 my-2">
              {/* Left Eye */}
              <div className="relative">
                {oledExpr === 'SLEEPING' ? (
                  <div className="w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                ) : oledExpr === 'DANGER' || oledExpr === 'ERROR' ? (
                  <div className="w-8 h-6 border-4 border-red-500 rotate-12 rounded-sm shadow-[0_0_8px_#ef4444]" />
                ) : oledExpr === 'HAPPY' || oledExpr === 'CELEBRATE' ? (
                  <div className="w-8 h-5 border-t-4 border-l-4 border-r-4 border-cyan-400 rounded-t-full shadow-[0_0_8px_#22d3ee]" />
                ) : (
                  <div className="w-8 h-7 bg-cyan-400 rounded-lg shadow-[0_0_10px_#22d3ee] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-black rounded-full" />
                  </div>
                )}
              </div>

              {/* Right Eye */}
              <div className="relative">
                {oledExpr === 'WINK' ? (
                  <div className="w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                ) : oledExpr === 'SLEEPING' ? (
                  <div className="w-8 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#22d3ee]" />
                ) : oledExpr === 'DANGER' || oledExpr === 'ERROR' ? (
                  <div className="w-8 h-6 border-4 border-red-500 -rotate-12 rounded-sm shadow-[0_0_8px_#ef4444]" />
                ) : oledExpr === 'HAPPY' || oledExpr === 'CELEBRATE' ? (
                  <div className="w-8 h-5 border-t-4 border-l-4 border-r-4 border-cyan-400 rounded-t-full shadow-[0_0_8px_#22d3ee]" />
                ) : (
                  <div className="w-8 h-7 bg-cyan-400 rounded-lg shadow-[0_0_10px_#22d3ee] flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-black rounded-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Mouth / Smile */}
            <div className="my-1">
              {oledExpr === 'HAPPY' || oledExpr === 'CELEBRATE' ? (
                <div className="w-12 h-3 border-b-4 border-cyan-400 rounded-b-full shadow-[0_0_6px_#22d3ee]" />
              ) : oledExpr === 'DANGER' || oledExpr === 'ERROR' ? (
                <div className="w-12 h-3 border-t-4 border-red-500 rounded-t-full shadow-[0_0_6px_#ef4444]" />
              ) : (
                <div className="w-10 h-1 bg-cyan-400/80 rounded-full shadow-[0_0_6px_#22d3ee]" />
              )}
            </div>

            <div className="mt-2 text-[10px] font-mono text-cyan-400 font-black tracking-widest uppercase">
              [{oledExpr}]
            </div>
          </div>

          {/* L298N Differential Motor Speeds Bar */}
          <div className="bg-slate-900/60 p-2.5 rounded-lg border border-white/5 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Cpu size={14} className="text-purple-400" />
              <span>L298N MOTORS:</span>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-white/10 text-white font-bold">
                L: {motorData.left_speed}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-white/10 text-white font-bold">
                R: {motorData.right_speed}
              </span>
              <span className={`px-2 py-0.5 rounded font-bold border ${motorData.state === 'EMERGENCY_STOP' ? 'text-red-400 border-red-500/40 bg-red-950/40' : 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40'}`}>
                {motorData.state}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Telemetry Strip: 4-Wheel AWD Torque & Orientation HUD */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Differential Drive Kinematics Schematic */}
        <div className="bg-slate-950/80 rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-bold uppercase flex items-center gap-1">
              <Disc size={12} style={{ color: config.primaryColor }} /> L298N Diff Drive
            </div>
            <div className="text-xs font-mono font-bold text-white">
              {isMoving ? 'ACTIVE PWM DRIVE' : 'WATCHDOG BRAKE'}
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Track: 160mm | 65mm Wheels
            </div>
          </div>

          {/* Mini Chassis Graphic */}
          <div className="w-14 h-16 border-2 border-slate-700 rounded-lg relative flex items-center justify-center bg-slate-900/60">
            {/* Left Wheel */}
            <div className={`absolute top-2 -left-2 w-3 h-10 rounded-sm ${isMoving ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            {/* Right Wheel */}
            <div className={`absolute top-2 -right-2 w-3 h-10 rounded-sm ${isMoving ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            <span className="text-[9px] font-bold text-gray-400">DIFF</span>
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
            Watchdog Timeout: 500ms
          </div>
        </div>
      </div>
    </div>
  );
};

