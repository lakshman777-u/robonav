import { useRobotStatus } from '../hooks/useRobotStatus';
import { useAuth } from '../hooks/useAuth';
import { useCarTrim } from '../context/CarTrimContext';
import { MapPin, Navigation, Send } from 'lucide-react';
import { requestNavigation } from '../services/api';
import toast from 'react-hot-toast';

export const DestinationList = () => {
  const { destinations } = useRobotStatus();
  const { isAdmin } = useAuth();
  const { config } = useCarTrim();

  const handleRequest = async (id: string | number, name: string) => {
    try {
      await requestNavigation(Number(id));
      toast.success(`Navigating to ${name}`);
    } catch (e) {
      toast.error(`Failed to dispatch to ${name}`);
    }
  };

  const getDestinationColor = (index: number) => {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
    return colors[index % colors.length];
  };

  return (
    <div className="glass-panel rounded-2xl border border-white/10 p-5 shadow-2xl relative overflow-hidden space-y-4">
      <div className="absolute inset-0 bg-carbon-pattern opacity-30 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <MapPin size={16} style={{ color: config.primaryColor }} /> Indoor Destinations
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-gray-400">
          {destinations.length} TARGETS
        </span>
      </div>

      {/* Destination Cards */}
      <div className="relative z-10 space-y-2.5 max-h-72 overflow-y-auto pr-1">
        {destinations.map((dest, i) => {
          const color = getDestinationColor(i);
          return (
            <div
              key={dest.id}
              className="bg-slate-950/70 hover:bg-slate-900/90 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-all flex justify-between items-center group shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                />
                <div>
                  <div className="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
                    {dest.name}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono capitalize">
                    {dest.type} • ({dest.x.toFixed(1)}m, {dest.y.toFixed(1)}m)
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleRequest(dest.id, dest.name)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
                style={{
                  backgroundColor: `${config.primaryColor}20`,
                  color: config.primaryColor,
                  border: `1px solid ${config.primaryColor}40`
                }}
              >
                <Navigation size={12} /> {isAdmin ? 'Test' : 'Go'}
              </button>
            </div>
          );
        })}

        {destinations.length === 0 && (
          <div className="text-gray-500 text-center py-6 text-xs font-mono">
            No destinations mapped yet.
          </div>
        )}
      </div>
    </div>
  );
};
