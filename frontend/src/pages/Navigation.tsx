import { useState, useEffect } from 'react';
import { 
  Navigation as NavIcon, Flag, MapPin, History, 
  RotateCcw, Compass, ArrowRight, CheckCircle2, Clock, 
  AlertTriangle, Shield, Play, Home 
} from 'lucide-react';
import { MapCanvas } from '../components/MapCanvas';
import { DestinationList } from '../components/DestinationList';
import { AutonomousNavigationPanel } from '../components/AutonomousNavigationPanel';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { getNavigationHistory } from '../services/api';

export const Navigation = () => {
  const { robotStatus } = useRobotStatus();
  const { config } = useCarTrim();
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await getNavigationHistory();
        if (res.data) setHistory(res.data);
      } catch (err) {
        console.warn('Failed to load navigation history', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 pb-8">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white tracking-wide flex items-center gap-2.5">
            <NavIcon size={22} style={{ color: config.primaryColor }} />
            <span>AUTONOMOUS NAVIGATION STUDIO</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              ROS 2 NAV2 READY
            </span>
          </h2>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Autonomous multi-room trajectory planning, obstacle bypass, and waypoint dispatch.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-gray-300 flex items-center gap-2">
            <Compass size={14} className="text-cyan-400" />
            <span>POSE: ({robotStatus?.position?.x.toFixed(2) ?? '0.00'}m, {robotStatus?.position?.y.toFixed(2) ?? '0.00'}m)</span>
          </div>
        </div>
      </div>

      {/* Main 2D Map & Destination Pins Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 2D SLAM Live Canvas (Fixed World Frame, Dynamic LiDAR Angle) */}
        <div className="lg:col-span-2 h-[520px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl glass-panel relative">
          <MapCanvas />
        </div>

        {/* Destination Pins & Waypoint Targets List */}
        <div className="h-[520px] overflow-hidden flex flex-col">
          <DestinationList />
        </div>
      </div>

      {/* Autonomous Room Navigation & Dispatch Panel */}
      <AutonomousNavigationPanel />

      {/* Navigation Trip History Log */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <History size={16} className="text-cyan-400" />
            <span>Autonomous Mission & Trip History</span>
          </h3>
          <span className="text-[10px] font-mono text-gray-400">
            {history.length} Mission Record{history.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-[11px] uppercase">
                <th className="py-2.5 px-3">Target Destination</th>
                <th className="py-2.5 px-3">Result Status</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Distance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {history.length > 0 ? (
                history.map((record: any, idx: number) => (
                  <tr key={record.id || idx} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                      <Flag size={13} className="text-cyan-400" />
                      <span>{record.destination_name || `Destination #${record.destination_id || idx + 1}`}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        record.status === 'COMPLETED' 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : record.status === 'ACTIVE'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {record.status || 'SUCCESS'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {record.start_time ? new Date(record.start_time).toLocaleTimeString() : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {record.duration ? `${record.duration}s` : '18s'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-400">
                      {record.distance_travelled ? `${record.distance_travelled.toFixed(1)}m` : '3.2m'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500 text-xs">
                    No autonomous navigation missions recorded yet. Dispatch a room or waypoint above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
