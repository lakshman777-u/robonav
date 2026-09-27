import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { Navigation, XOctagon, Flag, Compass } from 'lucide-react';
import { cancelNavigation } from '../services/api';
import toast from 'react-hot-toast';

export const NavigationPanel = () => {
  const { robotStatus } = useRobotStatus();
  const { config } = useCarTrim();

  if (!robotStatus || robotStatus.state !== 'NAVIGATING') return null;

  const handleCancel = async () => {
    try {
      await cancelNavigation();
      toast.success('Autonomous navigation aborted. Motors stopped.');
    } catch (e) {
      toast.error('Failed to cancel navigation');
    }
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-blue-500/40 shadow-2xl relative overflow-hidden space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Navigation size={16} className="text-blue-400 animate-pulse" />
          Autonomous Trajectory Guidance
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
          A* PATH ACTIVE
        </span>
      </div>

      <div className="relative z-10 space-y-3.5">
        <div className="bg-slate-950/70 p-3 rounded-xl border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flag size={14} style={{ color: config.primaryColor }} />
            <span className="text-xs text-gray-400">Target Waypoint</span>
          </div>
          <span className="font-bold text-sm text-white">
            {robotStatus.current_destination || 'Target Sector'}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-gray-400">Trajectory Completion</span>
            <span className="font-bold text-cyan-400">{robotStatus.navigation_progress}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
              style={{
                width: `${robotStatus.navigation_progress}%`,
                boxShadow: '0 0 10px rgba(6,182,212,0.5)'
              }}
            />
          </div>
        </div>

        {/* Dynamic Telemetry stats */}
        <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase">Dist. To Target</div>
            <div className="font-bold text-white text-sm mt-0.5">{robotStatus.distance_remaining.toFixed(1)} m</div>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
            <div className="text-[10px] text-gray-500 uppercase">Estimated ETA</div>
            <div className="font-bold text-white text-sm mt-0.5">{robotStatus.estimated_time_remaining}s</div>
          </div>
        </div>

        <button
          onClick={handleCancel}
          className="w-full py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-bold text-xs tracking-wider uppercase rounded-xl flex justify-center items-center gap-2 border border-red-500/40 transition-all shadow-md active:scale-98"
        >
          <XOctagon size={16} /> Disengage Navigation
        </button>
      </div>
    </div>
  );
};
