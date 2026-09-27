import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, Scan, Gamepad2, MapPin, Navigation as NavIcon, Radio, Wifi, ScrollText, Settings as SettingsIcon, LogOut, Video } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { MapCanvas } from '../components/MapCanvas';
import { RobotStatus } from '../components/RobotStatus';
import { ManualControl } from '../components/ManualControl';
import { EmergencyStop } from '../components/EmergencyStop';
import { DestinationList } from '../components/DestinationList';
import { NavigationPanel } from '../components/NavigationPanel';
import { Mapping } from './Mapping';
import { Navigation } from './Navigation';
import { Settings } from './Settings';
import { Sensors } from './Sensors';
import { RobotConnection } from './RobotConnection';
import { ApiDocs } from './ApiDocs';
import { VideoTutorials } from './VideoTutorials';
import { SystemLog } from '../components/SystemLog';

const SidebarLink = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname === to + '/';
  return (
    <Link to={to} className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-slate-800 hover:text-white'}`}>
      <Icon size={20} /> <span className="font-medium">{label}</span>
    </Link>
  );
};

const DashboardHome = () => (
  <div className="h-full flex gap-4">
    <div className="flex-1 h-full"><MapCanvas /></div>
    <div className="w-80 flex flex-col gap-4 overflow-y-auto pr-2">
      <RobotStatus />
      <ManualControl />
      <EmergencyStop />
    </div>
  </div>
);

export const AdminDashboard = () => {
  const { logout, isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/user" replace />;

  return (
    <div className="h-screen flex bg-dark-bg text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-dark-card border-r border-dark-border flex flex-col z-20">
        <div className="p-6 border-b border-dark-border">
          <h1 className="text-2xl font-bold text-blue-500">RoboNav</h1>
          <div className="text-xs text-gray-500 mt-1">Admin Panel</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <SidebarLink to="/admin" icon={LayoutDashboard} label="Dashboard" />
          <SidebarLink to="/admin/map" icon={MapIcon} label="Live Map" />
          <SidebarLink to="/admin/mapping" icon={Scan} label="Mapping" />
          <SidebarLink to="/admin/control" icon={Gamepad2} label="Robot Control" />
          <SidebarLink to="/admin/destinations" icon={MapPin} label="Destinations" />
          <SidebarLink to="/admin/navigation" icon={NavIcon} label="Navigation" />
          <SidebarLink to="/admin/sensors" icon={Radio} label="Sensors" />
          <SidebarLink to="/admin/connection" icon={Wifi} label="Connection" />
          <SidebarLink to="/admin/logs" icon={ScrollText} label="Logs" />
          <SidebarLink to="/admin/tutorials" icon={Video} label="Video Guides" />
          <SidebarLink to="/admin/settings" icon={SettingsIcon} label="Settings" />
          <SidebarLink to="/admin/api-docs" icon={ScrollText} label="API Docs" />
        </div>
        <div className="p-4 border-t border-dark-border">
          <button onClick={logout} className="flex items-center gap-3 p-3 w-full rounded-lg text-red-400 hover:bg-red-900/20 transition-colors">
            <LogOut size={20} /> <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <div className="h-16 bg-dark-card border-b border-dark-border flex items-center px-6 justify-between shadow-sm z-10">
          <div className="flex items-center gap-2">
            <Link
              to="/admin/tutorials"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600/20 text-purple-300 border border-purple-600/40 hover:bg-purple-600/30 rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Video size={14} /> ▶ Watch Video Guides
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="px-3 py-1 bg-blue-900/30 text-blue-400 rounded-full text-xs font-bold border border-blue-900">SIMULATION MODE</span>
          </div>
        </div>
        <div className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/map" element={<div className="h-[calc(100vh-8rem)]"><MapCanvas /></div>} />
            <Route path="/mapping" element={<Mapping />} />
            <Route path="/control" element={<div className="max-w-md"><ManualControl /><EmergencyStop /></div>} />
            <Route path="/destinations" element={<div className="max-w-2xl"><DestinationList /></div>} />
            <Route path="/navigation" element={<div className="max-w-4xl flex gap-4"><div className="flex-1"><Navigation /></div><div className="w-80"><NavigationPanel /></div></div>} />
            <Route path="/sensors" element={<Sensors />} />
            <Route path="/connection" element={<RobotConnection />} />
            <Route path="/logs" element={<div className="h-[calc(100vh-8rem)]"><SystemLog /></div>} />
            <Route path="/tutorials" element={<VideoTutorials />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/api-docs" element={<ApiDocs />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
