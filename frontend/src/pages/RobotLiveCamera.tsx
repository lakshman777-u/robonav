import React, { useState, useEffect } from 'react';
import { Camera, Compass, Wifi, Zap, AlertTriangle, ShieldCheck, Gauge, Eye, RefreshCw, Maximize2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, RotateCcw, RotateCw } from 'lucide-react';
import { LiveCamera } from '../components/LiveCamera';
import { MapCanvas } from '../components/MapCanvas';
import { DirectionalRobotEyes } from '../components/DirectionalRobotEyes';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { useRobot } from '../context/RobotContext';

export const RobotLiveCamera: React.FC = () => {
  const { robotStatus, emergencyStop } = useRobotStatus();
  const { sendCommand } = useRobot();
  const { config } = useCarTrim();
  const [boostActive, setBoostActive] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(0.10);

  useEffect(() => {
    if (robotStatus?.speed_control?.boost_active !== undefined) {
      setBoostActive(robotStatus.speed_control.boost_active);
      setSpeedLevel(robotStatus.speed_control.speed || 0.10);
    }
  }, [robotStatus?.speed_control]);

  const toggleBoost = async () => {
    const nextBoost = !boostActive;
    setBoostActive(nextBoost);
    try {
      await fetch('/api/speed/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextBoost ? 'BOOST' : 'TURTLE' }),
      });
    } catch (e) {
      console.error('Failed to toggle speed mode:', e);
    }
  };

  const currentDirection = robotStatus?.direction || robotStatus?.speed_control?.current_direction || 'STOPPED';
  const currentExpression = robotStatus?.oled_expression || (boostActive ? 'FORWARD' : 'HAPPY');
  const isOnline = robotStatus?.connection_status === 'ONLINE';

  // Wireless keyboard navigation controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        sendCommand('MOVE_FORWARD');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        sendCommand('MOVE_BACKWARD');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        sendCommand('TURN_LEFT');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        sendCommand('TURN_RIGHT');
      } else if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        sendCommand('STOP');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sendCommand]);

  return (
    <div className="h-full flex flex-col space-y-4 p-1">
      {/* Top Telemetry Strip */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              <span>ROBOT LIVE CAMERA & DUAL 2D SLAM</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold">
                ESP32-S3 + ROS 2
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Synchronized Low-Latency Video, 2D SLAM Mapping, and Directional Eyes
            </p>
          </div>
        </div>

        {/* Quick Speed & E-Stop Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleBoost}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              boostActive
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-900/80 text-gray-200 border-cyan-500/40 hover:border-cyan-300'
            }`}
          >
            <Zap size={15} className={boostActive ? 'fill-black' : 'text-cyan-400'} />
            <span>{boostActive ? '⚡ BOOST ACTIVE (~1 cm/s)' : '🐢 TURTLE MODE (SLOW)'}</span>
          </button>

          <button
            onClick={emergencyStop}
            className="px-3.5 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg shadow-red-900/30 active:scale-95"
          >
            <AlertTriangle size={15} />
            <span>EMERGENCY STOP</span>
          </button>
        </div>
      </div>

      {/* Main Dual Grid: Left Live Camera | Right 2D ROS SLAM Map */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-5 min-h-[500px]">
        {/* Left Panel: Camera Stream with Telemetry Overlay */}
        <div className="h-[460px] lg:h-full rounded-2xl overflow-hidden shadow-2xl relative border border-white/10 glass-panel">
          <LiveCamera />
        </div>

        {/* Right Panel: 2D Live ROS SLAM Map */}
        <div className="h-[460px] lg:h-full rounded-2xl overflow-hidden shadow-2xl relative border border-white/10 glass-panel">
          <MapCanvas />
        </div>
      </div>

      {/* Bottom Panel: Direction, Speed Mode, Directional Eyes, and Sensor Metrics */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Left Col: Direction and Speed Status */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center gap-2">
            <Compass size={15} style={{ color: config.primaryColor }} />
            <span>Active Motion & Heading</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Current Direction</span>
              <span className="text-sm font-black text-cyan-400 font-mono">{currentDirection}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Speed Setting</span>
              <span className="text-xs font-bold text-white font-mono">
                {boostActive ? '0.12 m/s (Boost Active)' : '0.10 m/s (Turtle Mode)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Calibration Target</span>
              <span className="text-[10px] text-gray-400 font-mono">5 cm in 5s (~1 cm/s)</span>
            </div>
          </div>
        </div>

        {/* Center Col: Directional AI Robot Eyes Preview */}
        <div className="flex flex-col items-center justify-center -my-2">
          <DirectionalRobotEyes
            expression={currentExpression}
            direction={currentDirection}
            speedMode={boostActive ? 'BOOST' : 'TURTLE'}
            size="md"
            showLabel={true}
            showOledBezel={true}
          />
        </div>

        {/* Right Col: Wireless Motor Controls (Forward, Reverse, Left, Right, Stop) */}
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Compass size={15} className="text-cyan-400" />
              <span>Wireless Motor Drive</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">WASD / Keys</span>
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col items-center justify-center gap-1.5 shadow-inner">
            {/* Forward */}
            <button
              onClick={() => sendCommand('MOVE_FORWARD')}
              className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/50 text-cyan-400 active:scale-95 transition-all shadow-md"
              title="Move Forward (W / ↑)"
            >
              <ArrowUp size={18} />
            </button>

            {/* Middle Row: Left, Stop, Right */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendCommand('TURN_LEFT')}
                className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/50 text-cyan-400 active:scale-95 transition-all shadow-md"
                title="Turn Left (A / ←)"
              >
                <ArrowLeft size={18} />
              </button>

              <button
                onClick={() => sendCommand('STOP')}
                className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/40 hover:bg-red-900/70 text-red-400 active:scale-95 transition-all shadow-md"
                title="Stop Motors (Space / X)"
              >
                <Square size={18} className="fill-red-400" />
              </button>

              <button
                onClick={() => sendCommand('TURN_RIGHT')}
                className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/50 text-cyan-400 active:scale-95 transition-all shadow-md"
                title="Turn Right (D / →)"
              >
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Bottom Row: U-Turns & Reverse */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => sendCommand('U_TURN_LEFT')}
                className="p-1.5 px-2 rounded-lg bg-slate-900/80 border border-white/10 hover:border-amber-400 text-amber-400 text-[10px] font-mono flex items-center gap-1 active:scale-95"
                title="U-Turn Left"
              >
                <RotateCcw size={12} />
              </button>

              <button
                onClick={() => sendCommand('MOVE_BACKWARD')}
                className="p-2.5 rounded-xl bg-slate-900 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-950/50 text-cyan-400 active:scale-95 transition-all shadow-md"
                title="Move Backward (S / ↓)"
              >
                <ArrowDown size={18} />
              </button>

              <button
                onClick={() => sendCommand('U_TURN_RIGHT')}
                className="p-1.5 px-2 rounded-lg bg-slate-900/80 border border-white/10 hover:border-amber-400 text-amber-400 text-[10px] font-mono flex items-center gap-1 active:scale-95"
                title="U-Turn Right"
              >
                <RotateCw size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotLiveCamera;
