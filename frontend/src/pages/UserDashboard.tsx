import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MapCanvas } from '../components/MapCanvas';
import { DestinationList } from '../components/DestinationList';
import { RobotStatus } from '../components/RobotStatus';
import { NavigationPanel } from '../components/NavigationPanel';
import { WaitingTimer } from '../components/WaitingTimer';
import { UserVideoGuide } from '../components/UserVideoGuide';
import { LogOut, Video, X } from 'lucide-react';

export const UserDashboard = () => {
  const { logout } = useAuth();
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-dark-bg text-slate-100">
      <header className="h-16 bg-dark-card border-b border-dark-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-blue-500">RoboNav</h1>
          <span className="text-xs px-2.5 py-1 bg-slate-800 text-gray-400 rounded-full border border-slate-700">
            User Workspace
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowVideoModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-600/40 rounded-lg text-xs font-bold transition-all shadow-sm"
          >
            <Video size={16} /> ▶ Watch Video Guide: How to Navigate
          </button>

          <button onClick={logout} className="flex items-center gap-2 text-gray-400 hover:text-white text-xs">
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Video Guide Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-slate-800 rounded-full"
            >
              <X size={20} />
            </button>
            <UserVideoGuide />
          </div>
        </div>
      )}
      
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
