import { AlertOctagon, Play, ShieldAlert } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { emergencyStop } from '../services/api';

export const EmergencyStop = () => {
  const { robotStatus, sendCommand } = useRobotStatus();
  const isEstop = robotStatus?.state === 'EMERGENCY_STOP';

  const handleEstop = async () => {
    if (robotStatus?.robot_id) {
      await emergencyStop(robotStatus.robot_id);
    }
  };

  const handleResume = () => {
    sendCommand('RESUME');
  };

  return (
    <div className="glass-panel p-4 rounded-2xl border border-red-500/30 relative overflow-hidden shadow-2xl">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      <div className="relative z-10 flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-bold tracking-widest text-red-400 flex items-center gap-1.5">
          <ShieldAlert size={14} /> SAFETY INTERLOCK
        </span>
        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
          HARDWARE KILLSWITCH
        </span>
      </div>

      <div className="relative z-10">
        {!isEstop ? (
          <button
            onClick={handleEstop}
            className="w-full py-4 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-black text-sm tracking-wider uppercase rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.5)] border border-red-400/50 flex flex-col items-center justify-center gap-1 transition-all active:scale-98 animate-pulse"
          >
            <AlertOctagon size={28} className="text-white" />
            <span>EMERGENCY STOP (KILL MOTORS)</span>
          </button>
        ) : (
          <button
            onClick={handleResume}
            className="w-full py-4 bg-gradient-to-b from-green-600 to-green-800 hover:from-green-500 hover:to-green-700 text-white font-black text-sm tracking-wider uppercase rounded-xl shadow-[0_0_30px_rgba(16,185,129,0.5)] border border-green-400/50 flex flex-col items-center justify-center gap-1 transition-all active:scale-98"
          >
            <Play size={28} className="text-white" />
            <span>DISENGAGE SAFETY & RESUME</span>
          </button>
        )}
      </div>
    </div>
  );
};
