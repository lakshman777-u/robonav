import { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Gamepad2, Zap, ShieldAlert, Sparkles, HelpCircle } from 'lucide-react';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { DirectionalRobotEyes } from './DirectionalRobotEyes';

export const ManualControl = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  const { config } = useCarTrim();
  const [boostActive, setBoostActive] = useState(false);
  const [speedLevel, setSpeedLevel] = useState(0.10);
  const [showHelp, setShowHelp] = useState(false);

  // Sync initial speed mode from backend telemetry
  useEffect(() => {
    if (robotStatus?.speed_control?.boost_active !== undefined) {
      setBoostActive(robotStatus.speed_control.boost_active);
      setSpeedLevel(robotStatus.speed_control.speed || 0.10);
    }
  }, [robotStatus?.speed_control]);

  const toggleBoost = async () => {
    const nextBoost = !boostActive;
    setBoostActive(nextBoost);
    const newSpeed = nextBoost ? 0.12 : 0.10;
    setSpeedLevel(newSpeed);

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

  const handleCommand = (cmd: string) => {
    if (cmd === 'INCREASE_SPEED') {
      if (!boostActive) toggleBoost();
      return;
    }
    if (cmd === 'DECREASE_SPEED') {
      if (boostActive) toggleBoost();
      return;
    }
    if (cmd === 'EMERGENCY_STOP') {
      fetch('/api/robot/emergency-stop', { method: 'POST' }).catch(() => {});
      return;
    }

    // Send driving command with speed and mode
    sendCommand(cmd, speedLevel, { speed_mode: boostActive ? 'BOOST' : 'TURTLE' });
  };

  useKeyboard(handleCommand, true);

  const currentDirection = robotStatus?.direction || robotStatus?.speed_control?.current_direction || 'STOPPED';
  const currentExpression = robotStatus?.oled_expression || (boostActive ? 'FORWARD' : 'HAPPY');

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Gamepad2 size={16} style={{ color: config.primaryColor }} />
          <span>Cockpit Manual Drive</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            title="Keyboard Shortcuts"
          >
            <HelpCircle size={15} />
          </button>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
            W A S D / ARROWS
          </span>
        </div>
      </div>

      {/* Directional Robot Eyes Mini Preview */}
      <div className="relative z-10 scale-75 -my-3">
        <DirectionalRobotEyes
          expression={currentExpression}
          direction={currentDirection}
          speedMode={boostActive ? 'BOOST' : 'TURTLE'}
          size="sm"
          showLabel={false}
          showOledBezel={true}
        />
      </div>

      {/* ACCELERATION BOOST BUTTON */}
      <div className="w-full relative z-10">
        <button
          onClick={toggleBoost}
          className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-between transition-all shadow-lg active:scale-98 ${
            boostActive
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black border-amber-300 font-black shadow-[0_0_20px_rgba(245,158,11,0.4)] animate-pulse'
              : 'bg-slate-900/80 hover:bg-slate-800 text-gray-200 border-cyan-500/30 hover:border-cyan-400'
          }`}
        >
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider">
            <Zap size={16} className={boostActive ? 'fill-black' : 'text-cyan-400'} />
            <span>ACCELERATION BOOST</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                boostActive ? 'bg-black text-amber-300' : 'bg-white/10 text-cyan-300'
              }`}
            >
              {boostActive ? '⚡ BOOST ACTIVE (~1 cm/s)' : '🐢 TURTLE MODE (SLOW)'}
            </span>
          </div>
        </button>
        <p className="text-[10px] text-gray-400 text-center mt-1 font-mono">
          Calibration target: 5 cm in 5 seconds (~1 cm/s linear delta)
        </p>
      </div>

      {/* Futuristic D-Pad */}
      <div className="relative z-10 grid grid-cols-3 gap-2.5 my-1">
        <div />
        <button
          onMouseDown={() => handleCommand('MOVE_FORWARD')}
          onMouseUp={() => handleCommand('STOP')}
          onTouchStart={() => handleCommand('MOVE_FORWARD')}
          onTouchEnd={() => handleCommand('STOP')}
          className="w-14 h-14 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg group"
          title="Forward (W or Up Arrow)"
        >
          <ArrowUp size={22} className="group-hover:text-cyan-400 transition-colors" />
        </button>
        <div />

        <button
          onMouseDown={() => handleCommand('TURN_LEFT')}
          onMouseUp={() => handleCommand('STOP')}
          onTouchStart={() => handleCommand('TURN_LEFT')}
          onTouchEnd={() => handleCommand('STOP')}
          className="w-14 h-14 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg group"
          title="Steer Left (A or Left Arrow)"
        >
          <ArrowLeft size={22} className="group-hover:text-cyan-400 transition-colors" />
        </button>

        <button
          onMouseDown={() => handleCommand('MOVE_BACKWARD')}
          onMouseUp={() => handleCommand('STOP')}
          onTouchStart={() => handleCommand('MOVE_BACKWARD')}
          onTouchEnd={() => handleCommand('STOP')}
          className="w-14 h-14 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg group"
          title="Reverse (S or Down Arrow)"
        >
          <ArrowDown size={22} className="group-hover:text-cyan-400 transition-colors" />
        </button>

        <button
          onMouseDown={() => handleCommand('TURN_RIGHT')}
          onMouseUp={() => handleCommand('STOP')}
          onTouchStart={() => handleCommand('TURN_RIGHT')}
          onTouchEnd={() => handleCommand('STOP')}
          className="w-14 h-14 bg-slate-900/90 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/50 rounded-xl flex items-center justify-center text-white active:scale-95 transition-all shadow-lg group"
          title="Steer Right (D or Right Arrow)"
        >
          <ArrowRight size={22} className="group-hover:text-cyan-400 transition-colors" />
        </button>
      </div>

      {/* Stop Brake Button */}
      <button
        onClick={() => handleCommand('STOP')}
        className="relative z-10 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs tracking-wider uppercase rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg active:scale-98"
      >
        <Square className="fill-black" size={14} /> ALL MOTORS BRAKE / IDLE
      </button>

      {/* Keyboard Shortcuts Guide Modal / Accordion */}
      {showHelp && (
        <div className="relative z-10 w-full bg-slate-950/90 border border-white/10 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold text-cyan-300">
            <span>Laptop Keyboard Guide</span>
            <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono text-gray-300">
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">W / ↑</kbd> Forward</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">S / ↓</kbd> Reverse</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">A / ←</kbd> Turn Left</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">D / →</kbd> Turn Right</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">Space</kbd> Stop Motors</div>
            <div><kbd className="bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded">E</kbd> Emergency Stop</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">+</kbd> Boost Mode</div>
            <div><kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">-</kbd> Turtle Mode</div>
          </div>
        </div>
      )}
    </div>
  );
};
