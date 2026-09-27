import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Square, Gamepad2 } from 'lucide-react';
import { useKeyboard } from '../hooks/useKeyboard';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';

export const ManualControl = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  const { config } = useCarTrim();

  const handleCommand = (cmd: string) => {
    // Send command to drive
    sendCommand(cmd);
  };

  useKeyboard(handleCommand, true);

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col items-center space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="w-full flex items-center justify-between border-b border-white/10 pb-3 relative z-10">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Gamepad2 size={16} style={{ color: config.primaryColor }} />
          <span>Cockpit Manual Drive</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
          W A S D / ARROWS
        </span>
      </div>

      {/* Futuristic D-Pad */}
      <div className="relative z-10 grid grid-cols-3 gap-2.5 my-2">
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
        className="relative z-10 w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-black text-xs tracking-wider uppercase rounded-xl flex justify-center items-center gap-2 transition-all shadow-lg active:scale-98"
      >
        <Square className="fill-black" size={14} /> ALL MOTORS BRAKE / IDLE
      </button>
    </div>
  );
};
