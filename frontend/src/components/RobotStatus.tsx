import { Battery, Wifi, WifiOff, Activity, Navigation as NavIcon } from 'lucide-react';
import { useRobotStatus } from '../hooks/useRobotStatus';

export const RobotStatus = () => {
  const { robotStatus, wsConnected } = useRobotStatus();

  if (!robotStatus) return <div className="p-4 bg-dark-card rounded-lg border border-dark-border text-center">Loading status...</div>;

  const getBadgeColor = (state: string) => {
    switch (state) {
      case 'ERROR': return 'bg-red-500';
      case 'IDLE': return 'bg-gray-500';
      case 'NAVIGATING': return 'bg-blue-500';
      case 'MAPPING': return 'bg-purple-500';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="p-4 bg-dark-card rounded-lg border border-dark-border">
      <h3 className="text-lg font-bold mb-4 border-b border-dark-border pb-2 flex items-center justify-between">
        Robot Status
        {wsConnected ? <span className="text-green-500"><Wifi size={20} /></span> : <span className="text-red-500"><WifiOff size={20} /></span>}
      </h3>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">State</span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${getBadgeColor(robotStatus.state)}`}>
            {robotStatus.state}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-gray-400 flex items-center gap-2"><Battery size={16}/> Battery</span>
          <div className="w-1/2 flex items-center gap-2">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${robotStatus.battery > 50 ? 'bg-green-500' : robotStatus.battery > 20 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${robotStatus.battery}%` }}></div>
            </div>
            <span className="text-xs">{robotStatus.battery}%</span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 flex items-center gap-2"><NavIcon size={16}/> Position</span>
          <span className="text-sm font-mono">({robotStatus.position.x.toFixed(2)}, {robotStatus.position.y.toFixed(2)}) θ: {robotStatus.orientation.toFixed(1)}°</span>
        </div>
      </div>
    </div>
  );
};
