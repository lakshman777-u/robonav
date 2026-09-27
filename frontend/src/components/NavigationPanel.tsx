import React from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { Navigation, XOctagon } from 'lucide-react';
import { cancelNavigation } from '../services/api';

export const NavigationPanel = () => {
  const { robotStatus } = useRobotStatus();

  if (!robotStatus || robotStatus.state !== 'NAVIGATING') return null;

  return (
    <div className="p-4 bg-dark-card rounded-lg border border-blue-500 shadow-lg shadow-blue-500/20 mt-4">
      <h3 className="text-lg font-bold flex items-center gap-2 text-blue-400 mb-4">
        <Navigation size={20} className="animate-pulse" /> Navigating
      </h3>
      
      <div className="space-y-3">
        <div>
          <div className="text-sm text-gray-400">Destination</div>
          <div className="font-bold text-lg">{robotStatus.current_destination || 'Unknown'}</div>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Progress</span>
            <span>{robotStatus.navigation_progress}%</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <div className="bg-blue-500 h-2 rounded-full transition-all duration-500" style={{ width: `${robotStatus.navigation_progress}%` }}></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-2">
          <div>
            <div className="text-gray-400">Distance</div>
            <div>{robotStatus.distance_remaining.toFixed(1)} m</div>
          </div>
          <div>
            <div className="text-gray-400">Est. Time</div>
            <div>{robotStatus.estimated_time_remaining} s</div>
          </div>
        </div>

        <button 
          onClick={() => cancelNavigation()} 
          className="w-full mt-4 py-2 bg-red-600/20 text-red-500 hover:bg-red-600/40 font-bold rounded flex justify-center items-center gap-2 border border-red-500/50"
        >
          <XOctagon size={18} /> Cancel Navigation
        </button>
      </div>
    </div>
  );
};
