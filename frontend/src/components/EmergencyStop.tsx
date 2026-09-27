import { AlertOctagon, Play, Zap, ShieldAlert, Disc } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { emergencyStop } from '../services/api';
import toast from 'react-hot-toast';

export const EmergencyStop = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  const isBraked = robotStatus?.state === 'EMERGENCY_STOP';

  const handleBrake = async () => {
    if (robotStatus?.robot_id) {
      await emergencyStop(robotStatus.robot_id);
      toast.error('Emergency Brake Applied! All motors halted.');
    }
  };

  const handleAccelerateResume = () => {
    if (isBraked) {
      sendCommand('RESUME');
      toast.success('Brakes Disengaged! Ready to accelerate.');
    } else {
      sendCommand('MOVE_FORWARD');
      toast.success('Throttle Applied! Motors accelerating forward.');
    }
  };

  return (
    <div className="glass-panel p-4 rounded-2xl border border-white/10 relative overflow-hidden shadow-2xl space-y-3">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-[10px] font-mono font-bold tracking-widest text-gray-300 flex items-center gap-1.5">
          <Disc size={14} className={isBraked ? 'text-red-400 animate-pulse' : 'text-cyan-400'} />
          MOTOR BRAKE & THROTTLE CONTROL
        </span>
        <span
          className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
            isBraked
              ? 'bg-red-950 text-red-300 border border-red-800 animate-pulse'
              : 'bg-green-950 text-green-300 border border-green-800'
          }`}
        >
          {isBraked ? 'BRAKES LOCKED' : 'READY TO DRIVE'}
        </span>
      </div>

      {/* Dual Controls: Emergency Brake & Accelerate Buttons */}
      <div className="relative z-10 grid grid-cols-1 gap-2.5">
        {/* Emergency Brake Button */}
        <button
          onClick={handleBrake}
          className={`w-full py-3.5 px-4 font-black text-xs tracking-wider uppercase rounded-xl flex items-center justify-center gap-2 transition-all active:scale-98 shadow-lg ${
            isBraked
              ? 'bg-red-950/80 border-2 border-red-500 text-red-200'
              : 'bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-500 hover:to-red-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-400/40'
          }`}
        >
          <AlertOctagon size={20} className={isBraked ? 'text-red-400' : 'text-white'} />
          <span>🛑 EMERGENCY BRAKE (STOP ALL MOTORS)</span>
        </button>

        {/* Accelerate / Resume Button */}
        <button
          onClick={handleAccelerateResume}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs tracking-wider uppercase rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/40 flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          {isBraked ? (
            <>
              <Play size={18} className="fill-white" />
              <span>⚡ RELEASE BRAKE & RESUME MOTORS</span>
            </>
          ) : (
            <>
              <Zap size={18} className="text-amber-300" />
              <span>⚡ ACCELERATE / ENGAGE THROTTLE</span>
            </>
          )}
        </button>
      </div>

      <div className="relative z-10 text-[10px] text-gray-500 font-mono text-center">
        Press Emergency Brake to lock chassis • Press Accelerate to release & drive
      </div>
    </div>
  );
};
