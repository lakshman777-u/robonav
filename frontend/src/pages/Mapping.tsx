import { useState, useEffect } from 'react';
import { 
  Scan, Play, Square, Trash2, Download, HardDrive, 
  Layers, RefreshCw, Cpu, AlertTriangle, ArrowUp, ArrowDown, 
  ArrowLeft, ArrowRight, PauseCircle, CheckCircle2, X, Compass, MapPin,
  Snowflake, RotateCcw, FilePlus
} from 'lucide-react';
import { MapCanvas } from '../components/MapCanvas';
import { LidarPolarView } from '../components/LidarPolarView';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { 
  startMapping, stopMapping, clearMap, getMaps, 
  loadSavedMap, deleteMap, deleteAllMaps, getLidarStatus, startLidar, stopLidar 
} from '../services/api';
import toast from 'react-hot-toast';

export const Mapping = () => {
  const { robotStatus, mapData, sendCommand } = useRobotStatus();
  const { config } = useCarTrim();

  const [isMapping, setIsMapping] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [activeLocationName, setActiveLocationName] = useState('Location 1');
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [lidarStatus, setLidarStatus] = useState<any>(null);
  const [driveSpeed, setDriveSpeed] = useState(0.40);
  const [loadingAction, setLoadingAction] = useState(false);

  // Name prompt modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [inputLocationName, setInputLocationName] = useState('Location 1');

  // Freeze & Save As modal state
  const [showFreezeSaveModal, setShowFreezeSaveModal] = useState(false);
  const [saveAsName, setSaveAsName] = useState('Location 1');

  // Check robot state
  useEffect(() => {
    if (robotStatus?.state === 'MAPPING') {
      setIsMapping(true);
      setIsFrozen(false);
    } else if (robotStatus?.state === 'MAP_READY') {
      setIsMapping(false);
      setIsFrozen(true);
    } else if (robotStatus?.state === 'IDLE') {
      setIsMapping(false);
    }
  }, [robotStatus?.state]);

  // Fetch saved maps and lidar status
  const fetchMapsAndLidar = async () => {
    try {
      const mapsRes = await getMaps();
      if (mapsRes.data) {
        setSavedMaps(mapsRes.data);
      }
    } catch (e) {
      console.warn('Could not fetch saved maps', e);
    }

    try {
      const lidarRes = await getLidarStatus();
      if (lidarRes.data) setLidarStatus(lidarRes.data);
    } catch (e) {
      console.warn('Could not fetch lidar status', e);
    }
  };

  useEffect(() => {
    fetchMapsAndLidar();
    const interval = setInterval(fetchMapsAndLidar, 2500);
    return () => clearInterval(interval);
  }, []);

  // Calculate default next location name (e.g. Location 1, Location 2...)
  const getNextDefaultName = () => {
    const count = savedMaps.length + 1;
    return `Location ${count}`;
  };

  // 1. START: Open prompt modal when user clicks "Start 2D Scanning"
  const handleOpenStartModal = () => {
    const defaultName = getNextDefaultName();
    setInputLocationName(defaultName);
    setShowNameModal(true);
  };

  // Confirms name and starts 2D LiDAR scanning
  const handleConfirmStartMapping = async () => {
    const finalName = inputLocationName.trim() || getNextDefaultName();
    setShowNameModal(false);
    setLoadingAction(true);
    setActiveLocationName(finalName);
    setIsFrozen(false);

    try {
      await startMapping(finalName);
      setIsMapping(true);
      toast.success(`Started 2D Live Mapping for "${finalName}"! Odometry tracking wall-to-wall.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to start mapping');
    } finally {
      setLoadingAction(false);
    }
  };

  // 2. FREEZE & SAVE: Freezes current scan and saves to server
  const handleOpenFreezeSaveModal = () => {
    setSaveAsName(activeLocationName);
    setShowFreezeSaveModal(true);
  };

  const handleConfirmFreezeAndSave = async () => {
    const finalName = saveAsName.trim() || activeLocationName;
    setShowFreezeSaveModal(false);
    setLoadingAction(true);

    try {
      await stopMapping(finalName);
      setIsMapping(false);
      setIsFrozen(true);
      setActiveLocationName(finalName);
      toast.success(`Frozen & Saved "${finalName}" 2D map to web page & server!`, { duration: 5000 });
      fetchMapsAndLidar();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to freeze and save map');
    } finally {
      setLoadingAction(false);
    }
  };

  // 3. RESET (RECONSTRUCT): Clears live canvas and resets odometry to (0,0) to reconstruct fresh
  const handleResetReconstruct = async () => {
    if (window.confirm('Reset & Reconstruct: Clear live 2D map and reset location to (0,0) to reconstruct the map fresh from here? (Saved maps in library are kept).')) {
      try {
        if (isMapping) {
          await stopMapping();
          setIsMapping(false);
        }
        setIsFrozen(false);
        await clearMap();
        toast.success('2D Map reset to (0,0). Ready to reconstruct fresh!');
      } catch (e) {
        toast.error('Failed to reset map');
      }
    }
  };

  // 4. DELETE (FRESH START): Wipes all saved maps and resets canvas for a completely fresh beginning
  const handleDeleteAll = async () => {
    if (window.confirm('Delete All: Are you sure you want to delete ALL saved maps and reset for a completely fresh beginning?')) {
      try {
        if (isMapping) {
          await stopMapping();
          setIsMapping(false);
        }
        setIsFrozen(false);
        await deleteAllMaps();
        toast.success('All mappings wiped clean. Ready for a new fresh beginning!');
        fetchMapsAndLidar();
      } catch (e) {
        toast.error('Failed to wipe mappings');
      }
    }
  };

  // 5. Delete individual map
  const handleDeleteSavedMap = async (id: number, name: string) => {
    if (window.confirm(`Permanently delete 2D map "${name}" from server & web page?`)) {
      try {
        await deleteMap(id);
        toast.success(`Deleted "${name}"`);
        fetchMapsAndLidar();
      } catch (e) {
        toast.error('Failed to delete map');
      }
    }
  };

  // 6. Load saved map
  const handleLoadSavedMap = async (id: number, name: string) => {
    try {
      await loadSavedMap(id);
      setActiveLocationName(name);
      setIsFrozen(true);
      setIsMapping(false);
      toast.success(`Loaded "${name}" into 2D viewer.`);
    } catch (e) {
      toast.error('Failed to load map');
    }
  };

  // 7. Toggle LiDAR Hardware Driver
  const handleToggleLidarDriver = async () => {
    setLoadingAction(true);
    try {
      if (lidarStatus?.driver_running) {
        await stopLidar();
        toast.success('YDLIDAR X2 driver stopped.');
      } else {
        await startLidar(false);
        toast.success('YDLIDAR X2 direct driver connected on USB port!');
      }
      setTimeout(fetchMapsAndLidar, 1000);
    } catch (e) {
      toast.error('Failed to toggle LiDAR driver');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleExportPng = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      toast.error('Canvas not found');
      return;
    }
    const link = document.createElement('a');
    link.download = `${activeLocationName.replace(/\s+/g, '_')}_2D_Map.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Exported 2D map snapshot as PNG!');
  };

  // Manual drive
  const move = (cmd: string) => {
    sendCommand(cmd, { speed: driveSpeed });
  };

  const isHardwareStreaming = Boolean(lidarStatus?.is_streaming || (robotStatus?.bridge?.scans_published || 0) > 0);

  return (
    <div className="space-y-5 pb-8 relative">
      {/* Name Input Modal Dialog (Start Mapping) */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950/95 border border-cyan-500/40 rounded-3xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(6,182,212,0.25)] font-mono">
            <button
              onClick={() => setShowNameModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white bg-slate-900 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Compass size={22} className="animate-spin-slow" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Start Live 2D Room Mapping
              </h3>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Enter a location name. As you travel from room to room, LiDAR will track your location wall-to-wall:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">
                  LOCATION / ROOM NAME
                </label>
                <input
                  type="text"
                  value={inputLocationName}
                  onChange={(e) => setInputLocationName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmStartMapping()}
                  autoFocus
                  placeholder="e.g. Location 1, Living Room, Hallway, Apartment"
                  className="w-full bg-slate-900 border border-cyan-500/50 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowNameModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmStartMapping}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Play size={14} fill="white" />
                  <span>Start Mapping</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Freeze & Save As Modal Dialog */}
      {showFreezeSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950/95 border border-blue-500/40 rounded-3xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(59,130,246,0.25)] font-mono">
            <button
              onClick={() => setShowFreezeSaveModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white bg-slate-900 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2 text-blue-400">
              <Snowflake size={22} className="text-cyan-400 animate-spin-slow" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Freeze & Save 2D Map
              </h3>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Freeze the live scan and save this multi-room map to your laptop server:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">
                  SAVE AS (MAP NAME)
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmFreezeAndSave()}
                  autoFocus
                  placeholder="e.g. Apartment Multi-Room, Floor 1"
                  className="w-full bg-slate-900 border border-blue-500/50 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowFreezeSaveModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmFreezeAndSave}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5"
                >
                  <HardDrive size={14} />
                  <span>Freeze & Save Map</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Top Supercar Title Banner */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute inset-0 bg-carbon-pattern opacity-20 pointer-events-none" />

        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-black uppercase tracking-wider"
              style={{ backgroundColor: `${config.primaryColor}20`, color: config.primaryColor }}
            >
              LIVE 2D MAPPING & SCANNING STUDIO
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border ${
              isHardwareStreaming 
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' 
                : 'bg-slate-900 border-white/10 text-gray-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isHardwareStreaming ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
              {isHardwareStreaming ? `LIDAR ACTIVE (${lidarStatus?.scan_hz?.toFixed(1) || '16.0'} HZ)` : 'LIDAR STANDBY'}
            </span>
            {isMapping ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 flex items-center gap-1 animate-pulse">
                <RefreshCw size={11} className="animate-spin" />
                MAPPING: {activeLocationName}
              </span>
            ) : isFrozen ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-blue-500/20 text-blue-300 border border-blue-500/50 flex items-center gap-1">
                <Snowflake size={11} />
                FROZEN & SAVED: {activeLocationName}
              </span>
            ) : null}
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Scan size={26} style={{ color: config.primaryColor }} />
            <span>Live 2D Mapping & Multi-Room SLAM Studio</span>
          </h2>
          <p className="text-xs text-gray-400">
            Real-time LiDAR odometry tracks your movement from room to room, creating a seamless multi-room apartment floor plan.
          </p>
        </div>

        {/* Master Action Controls: Start / Freeze & Save / Reset / Delete */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          {/* Button 1: Start 2D Scanning */}
          {isMapping ? (
            <div className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-emerald-900/30 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SCANNING ACTIVE</span>
            </div>
          ) : (
            <button
              onClick={handleOpenStartModal}
              disabled={loadingAction}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-400/50 shadow-cyan-900/40"
              title="Start lively 2D scanning and location tracking"
            >
              <Play size={15} fill="white" />
              <span>▶ START 2D SCANNING</span>
            </button>
          )}

          {/* Button 2: Freeze & Save / Save As */}
          <button
            onClick={handleOpenFreezeSaveModal}
            disabled={loadingAction}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border shadow-lg ${
              isMapping 
                ? 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white border-blue-400 shadow-blue-900/40 animate-pulse' 
                : (isFrozen 
                    ? 'bg-indigo-950/80 border-indigo-500/50 text-indigo-300' 
                    : 'bg-slate-900 border-white/10 text-gray-300 hover:bg-slate-800')
            }`}
            title="Freeze current scan and save map to laptop server"
          >
            <Snowflake size={15} />
            <span>{isFrozen ? '❄️ FROZEN & SAVED' : '❄️ FREEZE & SAVE'}</span>
          </button>

          {/* Button 3: Reset / Reconstruct */}
          <button
            onClick={handleResetReconstruct}
            disabled={loadingAction}
            className="px-4 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/50 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Clear canvas & reset location to (0,0) to reconstruct map fresh without deleting saved library"
          >
            <RotateCcw size={15} className="text-amber-400" />
            <span>RESET (RECONSTRUCT)</span>
          </button>

          {/* Button 4: Delete All / Fresh Start */}
          <button
            onClick={handleDeleteAll}
            disabled={loadingAction}
            className="px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Delete all mappings and reset for a completely fresh beginning"
          >
            <Trash2 size={15} className="text-red-400" />
            <span>DELETE (FRESH START)</span>
          </button>

          {/* Toggle LiDAR Driver Hardware */}
          <button
            onClick={handleToggleLidarDriver}
            disabled={loadingAction}
            className={`px-3 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-1.5 border shadow-lg ${
              lidarStatus?.driver_running
                ? 'bg-slate-900 border-white/10 text-gray-300 hover:bg-slate-800'
                : 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60'
            }`}
            title="Toggle background USB LiDAR sensor"
          >
            <Cpu size={14} />
            <span className="hidden sm:inline">{lidarStatus?.driver_running ? 'LiDAR ON' : 'Start LiDAR'}</span>
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-gray-300 border border-white/10 text-xs font-mono font-bold transition-all shadow-md"
            title="Download PNG image of 2D map"
          >
            <Download size={15} className="text-cyan-400" />
          </button>
        </div>
      </div>

      {/* Live Mapping / Odometry Status Banner */}
      <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/30 bg-slate-950/80 shadow-[0_0_20px_rgba(6,182,212,0.1)] flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isMapping ? 'bg-cyan-400' : 'bg-gray-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${isMapping ? 'bg-cyan-500' : 'bg-gray-500'}`}></span>
          </span>
          <span className="text-white font-bold">
            {isMapping ? 'LIVE 2D SCANNING:' : (isFrozen ? 'MAP FROZEN & SAVED:' : 'MAPPER STANDBY:')}{' '}
            <span className="text-cyan-300 font-black uppercase">"{activeLocationName}"</span>
          </span>
          <span className="text-gray-400 text-[11px] hidden lg:inline">
            • Odometry tracks LiDAR location wall-to-wall as you travel between rooms
          </span>
        </div>

        {/* Live LiDAR Coordinates Telemetry */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 flex items-center gap-2 text-[11px]">
            <Compass size={13} className="text-cyan-400" />
            <span className="text-gray-400">POSE:</span>
            <span className="text-cyan-300 font-bold font-mono">
              X: {(robotStatus?.position?.x ?? 0).toFixed(2)}m
            </span>
            <span className="text-cyan-300 font-bold font-mono">
              Y: {(robotStatus?.position?.y ?? 0).toFixed(2)}m
            </span>
            <span className="text-cyan-300 font-bold font-mono">
              {(robotStatus?.orientation ?? 0).toFixed(0)}°
            </span>
          </div>

          <span className="text-emerald-400 font-bold bg-emerald-950/60 px-2 py-1 rounded border border-emerald-500/40 text-[10px]">
            {lidarStatus?.scan_hz?.toFixed(1) || '16.0'} HZ STREAM
          </span>
        </div>
      </div>

      {/* 2. Main Studio Grid: 2D Canvas (Left/Center) + Telemetry & Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols): High-Resolution 2D SLAM Canvas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[620px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl glass-panel relative">
            <MapCanvas />
          </div>

          {/* Quick Manual Teleop Bar for driving while mapping */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 text-gray-300">
              <span className="font-bold text-white uppercase tracking-wider">CHASSIS DRIVE:</span>
              <span className="text-gray-400 hidden sm:inline">Use W/A/S/D or buttons below to steer robot</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">SPEED:</span>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={driveSpeed}
                onChange={(e) => setDriveSpeed(parseFloat(e.target.value))}
                className="w-24 accent-cyan-400"
              />
              <span className="text-cyan-400 font-bold">{Math.round(driveSpeed * 100)}%</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onMouseDown={() => move('FORWARD')}
                onMouseUp={() => move('STOP')}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-white active:bg-cyan-600 transition-colors"
                title="Drive Forward (W)"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onMouseDown={() => move('LEFT')}
                onMouseUp={() => move('STOP')}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-white active:bg-cyan-600 transition-colors"
                title="Turn Left (A)"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => move('STOP')}
                className="p-2 rounded-lg bg-red-950/80 hover:bg-red-900/80 border border-red-500/50 text-red-300 transition-colors"
                title="Stop Motors (Space)"
              >
                <PauseCircle size={16} />
              </button>
              <button
                onMouseDown={() => move('RIGHT')}
                onMouseUp={() => move('STOP')}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-white active:bg-cyan-600 transition-colors"
                title="Turn Right (D)"
              >
                <ArrowRight size={16} />
              </button>
              <button
                onMouseDown={() => move('REVERSE')}
                onMouseUp={() => move('STOP')}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-white active:bg-cyan-600 transition-colors"
                title="Drive Reverse (S)"
              >
                <ArrowDown size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Live 360° Polar Radar Scanner & Session Controls */}
        <div className="space-y-5">
          {/* 360° Polar Radar Component */}
          <LidarPolarView maxRangeMeters={6.0} />

          {/* Mapping Session Config Box */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-4 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h4 className="text-white font-bold flex items-center gap-1.5 uppercase">
                <HardDrive size={15} className="text-cyan-400" /> Current 2D Map State
              </h4>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isMapping ? 'bg-cyan-500/20 text-cyan-300 animate-pulse' : 'bg-slate-800 text-gray-400'
              }`}>
                {isMapping ? 'SCANNING ACTIVE' : 'IDLE / SAVED'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">ACTIVE LOCATION</div>
              <div className="text-white font-black text-sm bg-slate-950/60 p-2.5 rounded-xl border border-white/5 flex items-center gap-2">
                <MapPin size={16} className="text-cyan-400" />
                <span>{activeLocationName}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5">
                <div className="text-gray-400">RESOLUTION</div>
                <div className="font-bold text-white">0.05m (5 cm / cell)</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5">
                <div className="text-gray-400">GRID SIZE</div>
                <div className="font-bold text-cyan-400">400 × 300 cells</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5">
                <div className="text-gray-400">EXPLORATION SPAN</div>
                <div className="font-bold text-white">20.0m × 15.0m</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5">
                <div className="text-gray-400">SERVER STORAGE</div>
                <div className="font-bold text-emerald-400">Laptop: maps/*.json</div>
              </div>
            </div>

            {isMapping && (
              <div className="bg-cyan-950/40 p-3 rounded-xl border border-cyan-500/30 text-[11px] text-cyan-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-cyan-400 animate-spin" />
                  <span>LiDAR is mapping room boundaries...</span>
                </div>
                <button
                  onClick={handleOpenFreezeSaveModal}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded font-bold text-[10px] uppercase shadow"
                >
                  Freeze & Save
                </button>
              </div>
            )}
          </div>

          {/* Saved Maps Database Library */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 shadow-xl space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <h4 className="text-white font-bold flex items-center gap-1.5 uppercase">
                <Layers size={15} className="text-purple-400" /> Saved Locations Library
              </h4>
              <span className="text-[10px] text-gray-400">{savedMaps.length} locations</span>
            </div>

            {savedMaps.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-[11px]">
                No maps saved yet. Click "Start 2D Mapping" above to create Location 1!
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {savedMaps.map((m) => (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl bg-slate-950/70 border border-white/5 flex items-center justify-between gap-2 hover:border-cyan-500/30 transition-colors"
                  >
                    <div className="truncate">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <MapPin size={13} className="text-purple-400 flex-shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="text-[9px] text-gray-400 pl-5">
                        {m.width}×{m.height} | {m.status || 'ready'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleLoadSavedMap(m.id, m.name)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold transition-all"
                        title="Load map into 2D viewer"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleDeleteSavedMap(m.id, m.name)}
                        className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 hover:text-red-300 border border-red-500/30 transition-colors"
                        title="Delete map"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
