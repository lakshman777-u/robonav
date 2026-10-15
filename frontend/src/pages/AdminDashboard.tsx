import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { LayoutDashboard, Map as MapIcon, Scan, Gamepad2, MapPin, Navigation as NavIcon, Radio, Wifi, ScrollText, Settings as SettingsIcon, LogOut, Video, Cpu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { CarTrimSelector } from '../components/CarTrimSelector';
import { CockpitGauges } from '../components/CockpitGauges';
import { MapCanvas } from '../components/MapCanvas';
import { LiveCamera } from '../components/LiveCamera';
import { HardwareIndicators } from '../components/HardwareIndicators';
import { RobotStatus } from '../components/RobotStatus';
import { ManualControl } from '../components/ManualControl';
import { EmergencyStop } from '../components/EmergencyStop';
import { DestinationList } from '../components/DestinationList';
import { NavigationPanel } from '../components/NavigationPanel';
import { AutonomousNavigationPanel } from '../components/AutonomousNavigationPanel';
import { Mapping } from './Mapping';
import { Navigation } from './Navigation';
import { Settings } from './Settings';
import { Sensors } from './Sensors';
import { RobotConnection } from './RobotConnection';
import { ApiDocs } from './ApiDocs';
import { VideoTutorials } from './VideoTutorials';
import { PaganiSimulatorGame } from './PaganiSimulatorGame';
import { SystemLog } from '../components/SystemLog';
import { LidarSignalsHUD } from '../components/LidarSignalsHUD';

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
    {/* Hardware Link Indicators */}
    <HardwareIndicators />

    {/* Side-by-Side Live Camera & Live 2D Map (Requirements #11, #13, #14, #42) */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left: Live Camera View */}
      <div className="h-[480px] rounded-2xl overflow-hidden">
        <LiveCamera />
      </div>

      {/* Right: Live 2D SLAM Map (Fixed World Frame, Dynamic LiDAR Angle) */}
      <div className="h-[480px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl glass-panel relative">
        <MapCanvas />
      </div>
    </div>

    {/* Live LiDAR Signals Suite & Real-time Optical Waveform Scanner */}
    <LidarSignalsHUD />

    {/* Autonomous Room Navigation & Waypoint Dispatch (1-Click Flags 1-4 & Point-to-Point) */}
    <AutonomousNavigationPanel />

    {/* House Simulation Quick Launch Banner */}
    <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-slate-950/80 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
          <Gamepad2 size={22} />
        </div>
        <div>
          <div className="text-sm font-black text-white tracking-wide flex items-center gap-2">
            <span>PAGANI ARCHITECTURAL HOUSE SIMULATOR</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono font-bold">
              3 PAGANI TRIMS • 5 ROOMS
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Test autonomous trail navigation in the 5-room floor plan with Zen Garden, living room, and master suite.
          </p>
        </div>
      </div>

      <Link
        to="/admin/simulator-game"
        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-black font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95 flex items-center gap-2"
      >
        <Gamepad2 size={16} /> Launch House Simulator
      </Link>
    </div>

    {/* Cockpit Gauges & Controls */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="lg:col-span-2">
        <CockpitGauges />
      </div>

      <div className="flex flex-col gap-4">
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
  const { robotStatus } = useRobotStatus();

  if (!isAdmin) return <Navigate to="/user" replace />;

  const isBridgeConnected = Boolean(robotStatus?.bridge?.active);
  const isBridgeStreaming = isBridgeConnected && Boolean((robotStatus?.bridge?.scans_published || 0) > 0 || (robotStatus?.bridge?.scan_hz || 0) > 0 || robotStatus?.hardware?.udp_bridge === 'STREAMING');
  const bridgeHz = robotStatus?.bridge?.scan_hz ? robotStatus.bridge.scan_hz.toFixed(1) : '10.0';
  const lidarRxBytes = robotStatus?.bridge?.esp32_lidar_rx_bytes ?? 0;

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
          <SidebarLink to="/admin/simulator-game" icon={Gamepad2} label="🎮 House Simulator (3 Trims)" />
          <SidebarLink to="/admin/map" icon={MapIcon} label="2D Live Map" />
          <SidebarLink to="/admin/mapping" icon={Scan} label="Live 2D Mapping" />
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

          {/* Right: Real-time Hardware & UDP Bridge Telemetry */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono transition-all ${
              isBridgeStreaming 
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]' 
                : isBridgeConnected
                  ? 'bg-sky-950/60 border-sky-500/50 text-sky-300 shadow-[0_0_8px_rgba(14,165,233,0.2)]'
                  : 'bg-slate-900 border-white/10 text-gray-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isBridgeStreaming 
                  ? 'bg-cyan-400 animate-ping' 
                  : isBridgeConnected 
                    ? 'bg-sky-400' 
                    : 'bg-gray-500'
              }`} />
              <span className="font-bold">ESP32 DEVKIT:</span>
              <span className={
                isBridgeStreaming 
                  ? 'text-cyan-300 font-black' 
                  : isBridgeConnected 
                    ? 'text-sky-400 font-bold' 
                    : 'text-gray-400'
              }>
                {isBridgeStreaming ? 'STREAMING' : isBridgeConnected ? 'ONLINE (WIFI OK)' : 'STANDBY'}
              </span>
            </div>

            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono transition-all ${
              isBridgeStreaming 
                ? 'bg-purple-950/60 border-purple-500/50 text-purple-300 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                : isBridgeConnected
                  ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-900 border-white/10 text-gray-500'
            }`}>
              <span>UDP BRIDGE:</span>
              <span className={`font-bold ${isBridgeStreaming ? 'text-purple-300' : isBridgeConnected ? 'text-indigo-300' : 'text-gray-400'}`}>
                {isBridgeStreaming ? `${bridgeHz} HZ` : isBridgeConnected ? 'PORT 4210' : '10.0 HZ (IDLE)'}
              </span>
            </div>

            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono transition-all ${
              isBridgeStreaming 
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                : isBridgeConnected
                  ? lidarRxBytes <= 1
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                    : 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                  : 'bg-slate-900 border-white/10 text-gray-500'
            }`}>
              <span>YDLIDAR X2:</span>
              <span className={`font-bold ${
                isBridgeStreaming 
                  ? 'text-emerald-400' 
                  : isBridgeConnected 
                    ? lidarRxBytes <= 1
                      ? 'text-amber-400'
                      : 'text-blue-400'
                    : 'text-gray-400'
              }`}>
                {isBridgeStreaming 
                  ? 'ACTIVE' 
                  : isBridgeConnected 
                    ? lidarRxBytes <= 1
                      ? 'NO DATA (CHECK MOTOR / RX)'
                      : 'CONNECTING...'
                    : 'READY'}
              </span>
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
            <Route path="/navigation" element={<div className="max-w-5xl flex gap-4"><div className="flex-1"><Navigation /></div><div className="w-80"><NavigationPanel /></div></div>} />
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
