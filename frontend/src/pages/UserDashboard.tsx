import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCarTrim } from '../context/CarTrimContext';
import { CarTrimSelector } from '../components/CarTrimSelector';
import { MapCanvas } from '../components/MapCanvas';
import { DestinationList } from '../components/DestinationList';
import { RobotStatus } from '../components/RobotStatus';
import { NavigationPanel } from '../components/NavigationPanel';
import { WaitingTimer } from '../components/WaitingTimer';
import { UserVideoGuide } from '../components/UserVideoGuide';
import { LogOut, Video, X, Cpu } from 'lucide-react';

export const UserDashboard = () => {
  const { logout } = useAuth();
  const { config } = useCarTrim();
  const [showVideoModal, setShowVideoModal] = useState(false);

  return (
    <div className="h-screen flex flex-col text-slate-100 overflow-hidden relative">
      {/* Supercar Header */}
      <header className="h-16 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 z-20 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Cpu size={18} style={{ color: config.primaryColor }} />
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span>ROBONAV</span>
              <span
                className="text-[10px] px-2 py-0.5 rounded uppercase font-mono font-black"
                style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
              >
                V12
              </span>
            </h1>
          </div>

          {/* Car Trim Switcher */}
          <CarTrimSelector />
        </div>

        <div className="flex items-center gap-4">
          {/* Video Guide Modal Trigger */}
          <button
            onClick={() => setShowVideoModal(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Video size={15} /> ▶ Watch Video Guide: How to Navigate
          </button>

          <button
            onClick={logout}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-xs font-bold transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* Video Guide Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950/95 border border-white/15 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-y-auto p-6 relative shadow-2xl">
            <button
              onClick={() => setShowVideoModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-slate-800/80 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
            <UserVideoGuide />
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div className="flex-1 p-5 flex flex-col lg:flex-row gap-5 overflow-hidden relative z-10">
        <div className="flex-1 h-full rounded-2xl overflow-hidden glass-panel border border-white/10 shadow-2xl relative">
          <MapCanvas />
        </div>

        <div className="w-full lg:w-84 flex flex-col h-full overflow-y-auto pr-1 pb-4 space-y-4">
          <RobotStatus />
          <NavigationPanel />
          <WaitingTimer />
          <DestinationList />
        </div>
      </div>
    </div>
  );
};
