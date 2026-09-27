import React from 'react';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useAuth } from '../hooks/useAuth';
import { MapPin, Navigation } from 'lucide-react';
import { requestNavigation } from '../services/api';

export const DestinationList = () => {
  const { destinations } = useRobotStatus();
  const { isAdmin } = useAuth();

  const handleRequest = async (id: string | number) => {
    try {
      await requestNavigation(Number(id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-dark-card rounded-lg border border-dark-border p-4 mt-4">
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MapPin size={20} /> Destinations</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {destinations.map(dest => (
          <div key={dest.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
            <div>
              <div className="font-bold">{dest.name}</div>
              <div className="text-xs text-gray-400 capitalize">{dest.type}</div>
            </div>
            {!isAdmin && (
              <button 
                onClick={() => handleRequest(dest.id)}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded text-xs font-bold flex items-center gap-1"
              >
                <Navigation size={14} /> Request
              </button>
            )}
            {isAdmin && (
              <div className="text-xs text-gray-400 font-mono">
                ({dest.x.toFixed(1)}, {dest.y.toFixed(1)})
              </div>
            )}
          </div>
        ))}
        {destinations.length === 0 && <div className="text-gray-500 text-center text-sm">No destinations available.</div>}
      </div>
    </div>
  );
};
