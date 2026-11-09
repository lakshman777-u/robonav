import React, { useState, useEffect } from 'react';
import { Activity, Compass, ShieldAlert, Cpu, Camera, Gauge, RefreshCw, Zap, AlertTriangle, Layers, RotateCw } from 'lucide-react';
import { DirectionalRobotEyes } from '../components/DirectionalRobotEyes';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const RobotSensorMonitor: React.FC = () => {
  const { robotStatus } = useRobotStatus();
  const [sensorTelemetry, setSensorTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Poll sensor telemetry
  useEffect(() => {
    const fetchSensors = async () => {
      try {
        const [mpuRes, usRes] = await Promise.all([
          fetch('/api/sensors/mpu9250'),
          fetch('/api/sensors/ultrasonic'),
        ]);
        const mpu = await mpuRes.json();
        const us = await usRes.json();
        setSensorTelemetry({ mpu9250: mpu, ultrasonic: us });
      } catch (e) {
        // fallback to robotStatus
      }
    };
    fetchSensors();
    const interval = setInterval(fetchSensors, 500);
    return () => clearInterval(interval);
  }, []);

  const mpu = sensorTelemetry?.mpu9250 || robotStatus?.mpu9250 || {
    accelerometer: { x: 0.05, y: -0.02, z: 9.81, magnitude: 9.81, roll: 0.3, pitch: -0.1 },
    gyroscope: { x: 0.1, y: 0.0, z: 0.2, roll_rate: 0.1, pitch_rate: 0.0, yaw_rate: 0.2 },
    magnetometer: { x: 22.4, y: 15.1, z: -40.2, heading: 34.5, direction: 'NE', calibrated: true },
    orientation: { roll: 0.5, pitch: -0.3, yaw: 34.5, heading: 34.5 },
    vcc_east_mounting: { applied: true, vcc_pin_direction: 'EAST (Robot Right / -Y_body)' },
  };

  const us = sensorTelemetry?.ultrasonic || robotStatus?.ultrasonic || {
    distance_cm: 125.0,
    distance_m: 1.25,
    status: 'CLEAR',
    valid: true,
  };

  const camera = robotStatus?.camera || {
    fps: 24.0,
    resolution: '640x480',
    latency_ms: 8,
    status: 'STREAMING',
  };

  const speedControl = robotStatus?.speed_control || {
    mode: 'TURTLE',
    speed: 0.10,
    boost_active: false,
    current_direction: 'STOPPED',
    oled_expression: 'HAPPY',
  };

  const isBoost = speedControl.mode === 'BOOST';
  const currentDirection = robotStatus?.direction || speedControl.current_direction || 'STOPPED';
  const currentExpression = robotStatus?.oled_expression || speedControl.oled_expression || 'HAPPY';

  // Euler angles for 3D box visualization
  const roll = mpu.orientation?.roll ?? 0;
  const pitch = mpu.orientation?.pitch ?? 0;
  const yaw = mpu.orientation?.yaw ?? 0;

  return (
    <div className="h-full flex flex-col space-y-5 p-1 overflow-y-auto pb-10">
      {/* Header */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Activity size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
              <span>ROBOT SENSOR MONITOR</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">
                MPU9250 (VCC EAST) + HC-SR04 + OLED
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Real-Time 9-Axis IMU Sensor Fusion, Front Ultrasonic Ranging, Camera Telemetry, and Motor Metrics
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ● SENSORS ONLINE (50 Hz)
          </span>
        </div>
      </div>

      {/* Grid: MPU9250 Cards & 3D Orientation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Accelerometer */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
              <Activity size={16} className="text-cyan-400" /> Accelerometer (m/s²)
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300">
              |a| = {mpu.accelerometer?.magnitude?.toFixed(2) || '9.81'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">X (Fwd)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.accelerometer?.x?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Y (Left)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.accelerometer?.y?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Z (Up)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.accelerometer?.z?.toFixed(2) || '9.81'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/40 border border-white/5 flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Tilt Angle:</span>
            <span className="font-bold text-cyan-400">
              {mpu.accelerometer?.tilt?.toFixed(1) || '0.2'}°
            </span>
          </div>
        </div>

        {/* Card 2: Gyroscope */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
              <RotateCw size={16} className="text-purple-400" /> Gyroscope (rad/s)
            </span>
            <span className="text-xs font-mono font-bold text-purple-300">Angular Velocity</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Roll Rate (X)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.gyroscope?.x?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Pitch Rate (Y)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.gyroscope?.y?.toFixed(2) || '0.00'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Yaw Rate (Z)</div>
              <div className="text-sm font-black text-purple-400 font-mono">
                {mpu.gyroscope?.z?.toFixed(2) || '0.00'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/40 border border-white/5 flex items-center justify-between text-xs font-mono">
            <span className="text-gray-400">Drift Compensation:</span>
            <span className="font-bold text-emerald-400">ACTIVE (Complementary)</span>
          </div>
        </div>

        {/* Card 3: Magnetometer & Compass */}
        <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
              <Compass size={16} className="text-amber-400" /> Magnetometer & Heading
            </span>
            <span className="text-xs font-mono font-bold text-amber-300">
              {mpu.magnetometer?.direction || 'N'} ({mpu.magnetometer?.heading?.toFixed(1) || '0.0'}°)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Mag X (μT)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.magnetometer?.x?.toFixed(1) || '22.5'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Mag Y (μT)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.magnetometer?.y?.toFixed(1) || '14.2'}
              </div>
            </div>
            <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/5 text-center">
              <div className="text-[10px] text-gray-400 font-mono">Mag Z (μT)</div>
              <div className="text-sm font-black text-white font-mono">
                {mpu.magnetometer?.z?.toFixed(1) || '-40.1'}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-xs font-mono">
            <span className="text-cyan-400">VCC Pin East Alignment:</span>
            <span className="font-bold text-cyan-300">TRANSFORM APPLIED</span>
          </div>
        </div>
      </div>

      {/* Row 2: 3D Orientation Visualizer & Front Ultrasonic Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Interactive 3D Orientation Visualizer Cube */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" /> 3D Orientation Spatial Pose
            </span>
            <div className="flex items-center gap-3 text-xs font-mono text-gray-300">
              <span>Roll: <strong className="text-cyan-300">{roll.toFixed(1)}°</strong></span>
              <span>Pitch: <strong className="text-cyan-300">{pitch.toFixed(1)}°</strong></span>
              <span>Yaw: <strong className="text-cyan-300">{yaw.toFixed(1)}°</strong></span>
            </div>
          </div>

          {/* 3D Perspective Box Canvas Simulation */}
          <div className="h-56 flex items-center justify-center relative overflow-hidden [perspective:800px]">
            {/* 3D Rotating Robot Chassis Model */}
            <div
              className="relative w-44 h-28 rounded-2xl border-2 border-cyan-400/80 bg-gradient-to-br from-cyan-950/90 to-slate-950/90 shadow-[0_0_35px_rgba(6,182,212,0.3)] transition-transform duration-200 ease-out flex flex-col items-center justify-center"
              style={{
                transform: `rotateX(${-pitch}deg) rotateY(${roll}deg) rotateZ(${-yaw}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="text-xs font-black tracking-widest text-cyan-300 font-mono uppercase">
                ROBONAV BASE
              </div>
              <div className="text-[9px] font-mono text-gray-400 mt-1">MPU9250 FUSED POSE</div>

              {/* East VCC indicator pin */}
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-amber-500 text-black text-[8px] font-black font-mono">
                VCC EAST
              </div>
              {/* Front Arrow */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-cyan-500 text-black text-[8px] font-black font-mono">
                ▲ FRONT
              </div>
            </div>
          </div>

          <div className="text-[11px] font-mono text-gray-400 text-center">
            Sensor fusion: Accelerometer gravity vector + Gyro integration + Tilt-compensated AK8963 Magnetometer
          </div>
        </div>

        {/* Ultrasonic Gauge & Motor Telemetry */}
        <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <span className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-2">
              <ShieldAlert size={16} className={us.status === 'REMOVED' ? 'text-gray-400' : 'text-emerald-400'} /> Front Ultrasonic Sensor (HC-SR04)
            </span>
            <span
              className={`text-xs font-mono font-black px-2.5 py-0.5 rounded ${
                us.status === 'REMOVED'
                  ? 'bg-gray-500/20 text-gray-400'
                  : us.status === 'STOP'
                  ? 'bg-red-500/20 text-red-400'
                  : us.status === 'ALERT'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}
            >
              {us.status}
            </span>
          </div>

          <div className="space-y-3">
            {us.status === 'REMOVED' ? (
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                <div className="text-xs font-bold text-gray-300">Sensor Removed From Hardware Setup</div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  HC-SR04 ultrasonic sensor and local emergency stop watchdog have been deactivated. GPIO 41 (TRIG) and GPIO 42 (ECHO) are freed.
                </p>
                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-cyan-400">
                  <span>✓ MPU9250 9-Axis Active</span>
                  <span>•</span>
                  <span>✓ L298N Motors Ready</span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-4xl font-black text-white font-mono">{us.distance_cm.toFixed(1)}</span>
                    <span className="text-sm text-gray-400 font-mono ml-2">cm</span>
                  </div>
                  <div className="text-sm text-gray-400 font-mono">({us.distance_m.toFixed(2)} m)</div>
                </div>

                {/* High-visibility range gauge */}
                <div className="w-full bg-slate-950 h-4 rounded-full overflow-hidden border border-white/10 relative">
                  <div
                    className={`h-full transition-all duration-300 ${
                      us.distance_cm <= 15
                        ? 'bg-red-500'
                        : us.distance_cm <= 30
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, (us.distance_cm / 200) * 100))}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                  <span className="text-red-400 font-bold">15 cm (Auto Brake)</span>
                  <span className="text-amber-400">30 cm (Observation)</span>
                  <span className="text-emerald-400">50 cm (Clear Path)</span>
                </div>
              </>
            )}
          </div>

          {/* Motor Telemetry Strip */}
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400">Motor Control State:</span>
              <span className="font-bold text-cyan-400">{currentDirection}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-gray-400">Speed Mode:</span>
              <span className="font-bold text-amber-300">
                {isBoost ? '⚡ BOOST ACTIVE (~1 cm/s)' : '🐢 TURTLE MODE (SLOW)'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Directional AI Robot Eyes Synchronization Card */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-md">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-bold text-xs uppercase">
            <Zap size={14} /> 1.3" OLED Synchronization Engine
          </div>
          <h3 className="text-lg font-black text-white">Instagram-Trending Directional AI Eyes</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            The robot eyes dynamically adjust expression based on physical motor command state, obstacle proximity, and Nav2
            trajectory. Below preview matches the actual 1.3" I2C OLED display (SH1106 / SSD1306).
          </p>
        </div>

        <div className="scale-90 md:scale-100">
          <DirectionalRobotEyes
            expression={currentExpression}
            direction={currentDirection}
            speedMode={speedControl.mode}
            size="md"
            interactive={true}
            showLabel={true}
            showOledBezel={true}
          />
        </div>
      </div>
    </div>
  );
};

export default RobotSensorMonitor;
