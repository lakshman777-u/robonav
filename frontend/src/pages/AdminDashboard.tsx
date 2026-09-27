import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, Scan, Gamepad2, MapPin, Navigation as NavIcon, Radio, Wifi, ScrollText, Settings as SettingsIcon, LogOut, Video, Cpu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCarTrim } from '../context/CarTrimContext';
import { CarTrimSelector } from '../components/CarTrimSelector';
import { CockpitGauges } from '../components/CockpitGauges';
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
import { PaganiSimulatorGame } from './PaganiSimulatorGame';
import { SystemLog } from '../components/SystemLog';

const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const { config } = useCarTrim();
  const isActive = location.pathname === to || location.pathname === to + '/';

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-xs font-bold ${
        isActive
          ? 'text-white shadow-lg border border-white/20'
          : 'text-gray-400 hover:bg-slate-900/60 hover:text-white'
      }`}
      style={{
        backgroundColor: isActive ? `${config.primaryColor}25` : undefined,
        borderColor: isActive ? `${config.primaryColor}60` : undefined,
        color: isActive ? '#ffffff' : undefined,
        boxShadow: isActive ? `0 0 16px ${config.primaryColor}30` : undefined
      }}
    >
      <Icon size={18} style={{ color: isActive ? config.primaryColor : undefined }} />
      <span>{label}</span>
    </Link>
  );
};

const DashboardHome = () => (
  <div className="space-y-5 pb-6">
    {/* Supercar Instrument Cluster (Tachometer, Battery, 4-Wheel AWD Torque) */}
    <CockpitGauges />

    {/* Map Canvas and Control Columns */}
    <div className="flex flex-col lg:flex-row gap-5">
      <div className="flex-1 h-[520px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl glass-panel relative">
        <MapCanvas />
      </div>

      <div className="w-full lg:w-84 flex flex-col gap-4">
        <RobotStatus />
        <ManualControl />
        <EmergencyStop />
      </div>
    </div>
  </div>
);

export const AdminDashboard = () => {
  const { logout, isAdmin } = useAuth();
  const { config } = useCarTrim();

  if (!isAdmin) return <Navigate to="/user" replace />;

  return (
    <div className="h-screen flex text-slate-100 overflow-hidden relative">
      {/* Sidebar with Glassmorphic Carbon Texture */}
      <div className="w-64 bg-slate-950/85 backdrop-blur-2xl border-r border-white/10 flex flex-col z-20 shadow-2xl">
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <Cpu size={16} style={{ color: config.primaryColor }} />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
              {config.badge}
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span>ROBONAV</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded uppercase font-mono font-black"
              style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
            >
              V12
            </span>
          </h1>

          <div className="text-[10px] text-gray-400 font-mono mt-1">
            {config.name}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <SidebarLink to="/admin" icon={LayoutDashboard} label="Cockpit Dashboard" />
          <SidebarLink to="/admin/simulator-game" icon={Gamepad2} label="🎮 Pagani Practice Sim" />
          <SidebarLink to="/admin/map" icon={MapIcon} label="2D Live Map" />
          <SidebarLink to="/admin/mapping" icon={Scan} label="SLAM Mapping" />
          <SidebarLink to="/admin/control" icon={NavIcon} label="Chassis Drive" />
          <SidebarLink to="/admin/destinations" icon={MapPin} label="Destinations" />
          <SidebarLink to="/admin/navigation" icon={NavIcon} label="Autonomous Nav" />
          <SidebarLink to="/admin/sensors" icon={Radio} label="Telemetry Sensors" />
          <SidebarLink to="/admin/connection" icon={Wifi} label="Robot Link" />
          <SidebarLink to="/admin/logs" icon={ScrollText} label="System Logs" />
          <SidebarLink to="/admin/tutorials" icon={Video} label="Video Guides" />
          <SidebarLink to="/admin/settings" icon={SettingsIcon} label="Settings" />
          <SidebarLink to="/admin/api-docs" icon={ScrollText} label="API Docs" />
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 p-3 w-full rounded-xl text-red-400 hover:bg-red-950/40 hover:text-red-300 border border-transparent hover:border-red-800/50 transition-all text-xs font-bold"
          >
            <LogOut size={16} /> <span>Disconnect Pilot</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Cockpit Top Bar */}
        <div className="h-16 bg-slate-950/70 backdrop-blur-xl border-b border-white/10 flex items-center px-6 justify-between shadow-lg z-10">
          {/* Left: Trim Switcher & Video Guides & Game Button */}
          <div className="flex items-center gap-3">
            <CarTrimSelector />

            <Link
              to="/admin/simulator-game"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/30 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Gamepad2 size={14} /> 🎮 Play Pagani Sim
            </Link>

            <Link
              to="/admin/tutorials"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-300 border border-purple-600/40 hover:bg-purple-600/30 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Video size={14} /> ▶ Video Guides
            </Link>
          </div>

          {/* Right: Simulation & Hardware Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-mono">
              <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: config.primaryColor }} />
              <span className="text-gray-300">SIMULATION ENGINE:</span>
              <span className="font-bold" style={{ color: config.primaryColor }}>ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Dynamic Route View */}
        <div className="flex-1 p-6 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            <Route path="/simulator-game" element={<PaganiSimulatorGame />} />
            <Route path="/map" element={<div className="h-[calc(100vh-8rem)] rounded-2xl overflow-hidden glass-panel border border-white/10"><MapCanvas /></div>} />
            <Route path="/mapping" element={<Mapping />} />
            <Route path="/control" element={<div className="max-w-md space-y-4"><ManualControl /><EmergencyStop /></div>} />
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
