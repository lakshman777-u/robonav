import { useState } from 'react';
import { UserVideoGuide } from '../components/UserVideoGuide';
import { AdminVideoGuide } from '../components/AdminVideoGuide';
import { Video, User, Shield, Info, CheckCircle2 } from 'lucide-react';

export const VideoTutorials = () => {
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="bg-dark-card border border-dark-border p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Video size={16} /> Reference & Video Guides
          </div>
          <h2 className="text-2xl font-bold text-white">Interactive Video Tutorials & Operation Reference</h2>
          <p className="text-sm text-gray-400 mt-1">
            Visual demonstrations for User navigation requests and Admin robot control, SLAM mapping, and destination configuration.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab('user')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'user' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <User size={16} /> User Guide (Destination & Navigation)
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'admin' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield size={16} /> Admin Guide (Control, SLAM & Map Upload)
          </button>
        </div>
      </div>

      {/* Video Guide Player */}
      {activeTab === 'user' ? (
        <div className="space-y-6">
          <UserVideoGuide />

          <div className="bg-dark-card border border-dark-border p-6 rounded-xl space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="text-blue-400" size={20} />
              User Workflow Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-blue-400 font-bold">1. Select Destination</span>
                <p className="text-gray-400">
                  Pick from the 4 pre-mapped rooms (Reception, Meeting Room, Room A, Room B) displayed on the live dashboard.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-blue-400 font-bold">2. Request Navigation</span>
                <p className="text-gray-400">
                  Click &quot;Request Robot Guide&quot;. The backend calculates an optimal A* collision-free path across the 2D grid.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-blue-400 font-bold">3. Follow the Robot</span>
                <p className="text-gray-400">
                  The robot guides the user at 0.3 m/s, using 360° LiDAR and ultrasonic sensors to dynamically steer around obstacles.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-blue-400 font-bold">4. Arrival & Auto-Return</span>
                <p className="text-gray-400">
                  Upon arrival, a 5-minute countdown starts. When finished or timed out, the robot automatically docks at the charger.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <AdminVideoGuide />

          <div className="bg-dark-card border border-dark-border p-6 rounded-xl space-y-4">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <Info className="text-purple-400" size={20} />
              Admin Workflow Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-purple-400 font-bold">1. Manual Controls</span>
                <p className="text-gray-400">
                  Use the virtual D-Pad or arrow keys to steer the physical chassis or simulated robot. Use E-Stop for instant shutdown.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-purple-400 font-bold">2. Run SLAM Mapping</span>
                <p className="text-gray-400">
                  Click &quot;START MAPPING&quot;. The robot records LiDAR point clouds, building an occupancy grid at 0.05m resolution.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-purple-400 font-bold">3. Upload & Save Map</span>
                <p className="text-gray-400">
                  Click &quot;STOP MAPPING&quot; to commit the map to the SQLite database. The map is compressed and stored with ready status.
                </p>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-purple-400 font-bold">4. Define Destinations</span>
                <p className="text-gray-400">
                  Click the map to add Reception, Meeting Room, Room A, and Room B with coordinates. Users will immediately see them.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
