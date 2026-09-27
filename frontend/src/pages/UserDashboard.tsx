import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { MapCanvas } from '../components/MapCanvas';
import { DestinationList } from '../components/DestinationList';
import { RobotStatus } from '../components/RobotStatus';
import { NavigationPanel } from '../components/NavigationPanel';
import { WaitingTimer } from '../components/WaitingTimer';
import { LogOut } from 'lucide-react';

export const UserDashboard = () => {
  const { logout } = useAuth();

  return (
    <div className="h-screen flex flex-col bg-dark-bg text-slate-100">
      <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
        <h1 className="text-xl font-bold text-blue-500">RoboNav</h1>
        <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white">
          <LogOut size={18} /> Logout
        </button>
      </header>
      
      <div className="flex-1 p-4 flex gap-4 overflow-hidden">
        <div className="flex-1 h-full rounded-lg overflow-hidden border border-dark-border">
          <MapCanvas />
        </div>
        
        <div className="w-80 flex flex-col h-full overflow-y-auto pr-2 pb-4">
          <RobotStatus />
          <NavigationPanel />
          <WaitingTimer />
          <DestinationList />
        </div>
      </div>
    </div>
  );
};
