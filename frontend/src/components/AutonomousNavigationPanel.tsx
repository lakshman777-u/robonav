import { useState } from 'react';
import { 
  Navigation, Flag, Play, XOctagon, Home, MapPin, 
  ArrowRight, Compass, CheckCircle2, AlertTriangle, Sparkles 
} from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { requestNavigation, cancelNavigation, returnHome } from '../services/api';
import toast from 'react-hot-toast';

export const AutonomousNavigationPanel = () => {
  const { robotStatus, destinations, reloadDestinations } = useRobotStatus();
  const { config } = useCarTrim();

  const [selectedDestinationId, setSelectedDestinationId] = useState<number | ''>('');
  const [isDispatching, setIsDispatching] = useState(false);

  const isNavigating = robotStatus?.state === 'NAVIGATING' || robotStatus?.state === 'RETURNING_HOME';
  const rx = robotStatus?.position?.x ?? 0.0;
  const ry = robotStatus?.position?.y ?? 0.0;
  const heading = robotStatus?.orientation ?? 0.0;

  // Helper to locate Flag 1..4 destination
  const getFlagDest = (flagNum: number) => {
    if (!destinations) return null;
    return destinations.find((d: any) => {
      if (d.dest_id === `FLAG-${flagNum}`) return true;
      if (d.name && (new RegExp(`flag\\s*${flagNum}`, 'i').test(d.name) || new RegExp(`room\\s*${flagNum}`, 'i').test(d.name))) return true;
      return false;
    });
  };

  const handleDispatchToDestination = async (destId: number, destName: string) => {
    setIsDispatching(true);
    try {
      await requestNavigation(destId);
      toast.success(`Autonomous navigation engaged! Robot heading to "${destName}".`, { icon: '🚀' });
      await reloadDestinations();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || `Failed to dispatch navigation to ${destName}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancelNavigation = async () => {
    setIsDispatching(true);
    try {
      await cancelNavigation();
      toast.success('Autonomous navigation stopped. Motors locked.', { icon: '🛑' });
    } catch (err: any) {
      toast.error('Failed to cancel navigation');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleReturnHome = async () => {
    setIsDispatching(true);
    try {
      await returnHome();
      toast.success('Robot returning to Base Station (0.0, 0.0)!', { icon: '🏠' });
    } catch (err: any) {
      toast.error('Failed to command return home');
    } finally {
      setIsDispatching(false);
    }
  };

  const flagConfigs = [
    { num: 1, name: 'Room 1', color: '#10b981', border: 'border-emerald-500/40', bg: 'bg-emerald-950/40', text: 'text-emerald-400' },
    { num: 2, name: 'Room 2', color: '#06b6d4', border: 'border-cyan-500/40', bg: 'bg-cyan-950/40', text: 'text-cyan-400' },
    { num: 3, name: 'Room 3', color: '#a855f7', border: 'border-purple-500/40', bg: 'bg-purple-950/40', text: 'text-purple-400' },
    { num: 4, name: 'Room 4', color: '#f59e0b', border: 'border-amber-500/40', bg: 'bg-amber-950/40', text: 'text-amber-400' },
  ];

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden space-y-5">
      {/* Carbon Texture Backdrop */}
      <div className="absolute inset-0 bg-carbon-pattern opacity-25 pointer-events-none" />

      {/* Header with Live Navigation Status */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div 
            className="p-2.5 rounded-xl border flex items-center justify-center shadow-lg"
            style={{ 
              backgroundColor: `${config.primaryColor}20`, 
              borderColor: `${config.primaryColor}50`,
              color: config.primaryColor 
            }}
          >
            <Navigation size={18} className={isNavigating ? 'animate-spin' : ''} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white tracking-wide flex items-center gap-2">
              AUTONOMOUS ROOM NAVIGATION
              <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                A* PATHFINDING
              </span>
            </h3>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
              Pose: ({rx.toFixed(2)}m, {ry.toFixed(2)}m) • Heading: {Math.round(heading)}° • State: <span className="font-bold text-white">{robotStatus?.state || 'IDLE'}</span>
            </p>
          </div>
        </div>

        {/* Global Return Home Button */}
        <button
          onClick={handleReturnHome}
          disabled={isDispatching}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-gray-200 hover:text-white border border-white/10 hover:border-cyan-500/40 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
          title="Return to base (0, 0)"
        >
          <Home size={14} className="text-cyan-400" />
          <span>Return Base (0, 0)</span>
        </button>
      </div>

      {/* ACTIVE NAVIGATION TRAJECTORY HUD (When robot is actively navigating) */}
      {isNavigating && (
        <div className="relative z-10 p-4 rounded-xl bg-slate-950/90 border border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.25)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                Active Trajectory: {robotStatus?.current_destination || 'Target Sector'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {robotStatus?.navigation_progress ?? 0}%
            </span>
          </div>

          {/* Glowing Progress bar */}
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-300"
              style={{
                width: `${robotStatus?.navigation_progress ?? 0}%`,
                boxShadow: '0 0 12px rgba(6,182,212,0.6)'
              }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs font-mono pt-1">
            <div className="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">Distance Left</div>
              <div className="font-bold text-white text-xs mt-0.5">
                {(robotStatus?.distance_remaining ?? 0).toFixed(1)} m
              </div>
            </div>
            <div className="bg-slate-900/80 p-2 rounded-lg border border-white/5">
              <div className="text-[10px] text-gray-500 uppercase">Estimated ETA</div>
              <div className="font-bold text-white text-xs mt-0.5">
                {robotStatus?.estimated_time_remaining ?? 0}s
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1 flex items-center">
              <button
                onClick={handleCancelNavigation}
                disabled={isDispatching}
                className="w-full py-2 bg-red-600/30 hover:bg-red-600/40 text-red-300 hover:text-white font-bold text-xs uppercase rounded-lg border border-red-500/50 flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <XOctagon size={14} /> Abort Navigation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1-CLICK QUICK ROOM DISPATCH (Flag 1, Flag 2, Flag 3, Flag 4) */}
      <div className="relative z-10 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-bold text-gray-300">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-gray-400 font-mono">
            <Flag size={13} style={{ color: config.primaryColor }} /> 1-Click Room Dispatch (Flags 1 - 4)
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Select any room to navigate autonomously</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {flagConfigs.map(cfg => {
            const dest = getFlagDest(cfg.num);
            const isAssigned = Boolean(dest);

            return (
              <div
                key={cfg.num}
                className={`p-3.5 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col justify-between gap-3 shadow-lg transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-7 h-7 rounded-lg flex items-center justify-center font-bold font-mono text-xs shadow-md"
                      style={{ backgroundColor: `${cfg.color}30`, color: cfg.color, border: `1px solid ${cfg.color}60` }}
                    >
                      {cfg.num}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-white">
                        {dest?.name || cfg.name}
                      </div>
                      <div className="text-[10px] font-mono text-gray-400">
                        {isAssigned && dest ? `(${dest.x.toFixed(2)}, ${dest.y.toFixed(2)})m` : 'Not placed on map'}
                      </div>
                    </div>
                  </div>

                  {isAssigned && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      FIXED
                    </span>
                  )}
                </div>

                {isAssigned && dest ? (
                  <button
                    onClick={() => handleDispatchToDestination(Number(dest.id), dest.name)}
                    disabled={isDispatching || isNavigating}
                    className="w-full py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-40"
                    style={{
                      backgroundColor: `${cfg.color}25`,
                      border: `1px solid ${cfg.color}70`,
                      color: '#ffffff'
                    }}
                  >
                    <Play size={12} fill="currentColor" />
                    <span>Go to {cfg.name}</span>
                  </button>
                ) : (
                  <div className="py-2 text-center rounded-lg bg-black/30 border border-white/5 text-[10px] font-mono text-gray-500">
                    Fix flag in Mapping studio
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* POINT-TO-POINT ROUTE DISPATCHER */}
      <div className="relative z-10 pt-1 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-gray-300">
          <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-gray-400 font-mono">
            <Compass size={13} style={{ color: config.primaryColor }} /> Point-to-Point Route Instruction
          </span>
          <span className="text-[10px] text-gray-500 font-mono">Move between any scanned locations</span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Origin: Current Robot Pose */}
          <div className="w-full sm:w-1/2 p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <MapPin size={14} />
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="text-[10px] text-gray-500 uppercase font-mono">Current Origin Point</div>
              <div className="text-xs font-bold text-white truncate">
                Robot Pose ({rx.toFixed(2)}, {ry.toFixed(2)})m
              </div>
            </div>
          </div>

          <div className="hidden sm:block text-gray-500">
            <ArrowRight size={16} />
          </div>

          {/* Destination Selector */}
          <div className="w-full sm:w-1/2 p-2.5 rounded-xl bg-slate-950/80 border border-white/10 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Flag size={14} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 uppercase font-mono">Target Destination</div>
              <select
                value={selectedDestinationId}
                onChange={e => setSelectedDestinationId(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
              >
                <option value="" className="bg-slate-900 text-gray-400">Select Room or Destination...</option>
                {destinations && destinations.map((d: any) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.name} ({d.x.toFixed(2)}m, {d.y.toFixed(2)}m)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Launch Autonomous Navigation Button */}
          <button
            onClick={() => {
              if (!selectedDestinationId) {
                toast.error('Please select a target destination');
                return;
              }
              const d = destinations.find((item: any) => item.id === selectedDestinationId);
              if (d) handleDispatchToDestination(Number(d.id), d.name);
            }}
            disabled={!selectedDestinationId || isDispatching || isNavigating}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2"
          >
            <Play size={14} fill="currentColor" />
            <span>Start Autonomous Nav</span>
          </button>
        </div>
      </div>
    </div>
  );
};
