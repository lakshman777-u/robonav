import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Scan, Play, Square, Trash2, Download, HardDrive, 
  Layers, RefreshCw, Cpu, AlertTriangle, ArrowUp, ArrowDown, 
  ArrowLeft, ArrowRight, PauseCircle, CheckCircle2, X, Compass, MapPin,
  Snowflake, RotateCcw, FilePlus, Flag, Crosshair, Pause, Save, Gamepad2
} from 'lucide-react';
import { MapCanvas } from '../components/MapCanvas';
import { LidarPolarView } from '../components/LidarPolarView';
import { AutonomousNavigationPanel } from '../components/AutonomousNavigationPanel';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';
import { 
  startMapping, pauseMapping, finalizeMap, manualSaveMap, stopMapping, clearMap, getMaps, 
  setRoomFlag, deleteRoomFlag,
  loadSavedMap, deleteMap, deleteAllMaps, getLidarStatus, startLidar, stopLidar 
} from '../services/api';
import { resetOccupancyCanvas } from '../utils/mapRenderer';
import toast from 'react-hot-toast';

export const Mapping = () => {
  const { robotStatus, mapData, sendCommand, destinations, reloadDestinations } = useRobotStatus();
  const { config } = useCarTrim();

  const [isMapping, setIsMapping] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [activeLocationName, setActiveLocationName] = useState('Location 1');
  const [savedMaps, setSavedMaps] = useState<any[]>([]);
  const [lidarStatus, setLidarStatus] = useState<any>(null);
  const [driveSpeed, setDriveSpeed] = useState(0.40);
  const [loadingAction, setLoadingAction] = useState(false);
  const [flagPlacementMode, setFlagPlacementMode] = useState<number | null>(null);
  const [manualMapName, setManualMapName] = useState('');

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

  // Room Flag helper
  const getFlagDestination = (flagNum: number) => {
    if (!destinations) return null;
    return destinations.find((d: any) => {
      if (d.dest_id === `FLAG-${flagNum}`) return true;
      if (d.name && (new RegExp(`flag\\s*${flagNum}`, 'i').test(d.name) || new RegExp(`room\\s*${flagNum}`, 'i').test(d.name))) return true;
      return false;
    });
  };

  const handleFixFlagAtRobot = async (flagNum: number) => {
    const rx = Number((robotStatus?.position?.x ?? 0.0).toFixed(2));
    const ry = Number((robotStatus?.position?.y ?? 0.0).toFixed(2));
    setLoadingAction(true);
    try {
      await setRoomFlag(flagNum, rx, ry, `Room ${flagNum}`);
      await reloadDestinations();
      toast.success(`🚩 Flag ${flagNum} (Room ${flagNum}) fixed at Robot coordinate (${rx}, ${ry})m!`);
    } catch (err) {
      toast.error(`Failed to set Flag ${flagNum}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStartPickFlagOnMap = (flagNum: number) => {
    setFlagPlacementMode(flagNum);
    toast(`Click anywhere on 2D map to fix Flag ${flagNum} (Room ${flagNum})`, { icon: '🚩' });
  };

  const handleFlagPlacedOnCanvas = async (flagNum: number, x: number, y: number) => {
    setFlagPlacementMode(null);
    const rx = Number(x.toFixed(2));
    const ry = Number(y.toFixed(2));
    setLoadingAction(true);
    try {
      await setRoomFlag(flagNum, rx, ry, `Room ${flagNum}`);
      await reloadDestinations();
      toast.success(`🚩 Flag ${flagNum} (Room ${flagNum}) placed at (${rx}, ${ry})m!`);
    } catch (err) {
      toast.error(`Failed to place Flag ${flagNum}`);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteFlag = async (flagNum: number) => {
    setLoadingAction(true);
    try {
      await deleteRoomFlag(flagNum);
      await reloadDestinations();
      toast.success(`Cleared Flag ${flagNum} (Room ${flagNum})`);
    } catch (err) {
      toast.error(`Failed to clear Flag ${flagNum}`);
    } finally {
      setLoadingAction(false);
    }
  };

  // STOP / FREEZE mapping without erasing data
  const handleStopFreeze = async () => {
    setLoadingAction(true);
    try {
      await pauseMapping();
      setIsMapping(false);
      setIsFrozen(true);
      toast.success(`⏸ Map Frozen! All scanned rooms and walls preserved right where they are.`, { duration: 4000 });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to freeze map');
    } finally {
      setLoadingAction(false);
    }
  };

  // 2. MANUAL SAVE MAP: Allows user to manually save anytime with custom name
  const handleOpenFreezeSaveModal = () => {
    setSaveAsName(activeLocationName || 'Building Map');
    setShowFreezeSaveModal(true);
  };

  const handleManualSaveSnapshot = async (customName?: string) => {
    const finalName = (customName || saveAsName || activeLocationName || 'Building Map').trim();
    setShowFreezeSaveModal(false);
    setLoadingAction(true);
    try {
      await manualSaveMap(finalName);
      setActiveLocationName(finalName);
      toast.success(`💾 Manually saved "${finalName}" to laptop server (maps/) & database!`, { duration: 5000 });
      fetchMapsAndLidar();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save map');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleConfirmFreezeAndSave = async () => {
    const finalName = saveAsName.trim() || activeLocationName || 'Building Map';
    setShowFreezeSaveModal(false);
    setLoadingAction(true);

    try {
      await finalizeMap(finalName);
      setIsMapping(false);
      setIsFrozen(true);
      setActiveLocationName(finalName);
      toast.success(`💾 Finalized & Saved "${finalName}" 2D map to laptop server (maps/) & database!`, { duration: 5000 });
      fetchMapsAndLidar();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to finalize and save map');
    } finally {
      setLoadingAction(false);
    }
  };

  // 3. RESET 2D SCREEN: Immediately resets canvas and odometry to (0,0) fresh
  const handleResetReconstruct = async () => {
    setLoadingAction(true);
    try {
      if (isMapping) {
        await pauseMapping();
        setIsMapping(false);
      }
      setIsFrozen(false);
      resetOccupancyCanvas();
      await clearMap();
      toast.success('🔄 2D Map & Screen reset to (0,0)! Canvas cleared.');
    } catch (e) {
      toast.error('Failed to reset map');
    } finally {
      setLoadingAction(false);
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
        resetOccupancyCanvas();
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

      {/* Manual Save 2D Map Modal Dialog */}
      {showFreezeSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950/95 border border-cyan-500/40 rounded-3xl w-full max-w-md p-6 relative shadow-[0_0_50px_rgba(6,182,212,0.25)] font-mono">
            <button
              onClick={() => setShowFreezeSaveModal(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white bg-slate-900 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-2 text-cyan-400">
              <Save size={22} className="text-cyan-400" />
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Manual Save 2D Map
              </h3>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Enter a custom name to manually save the current 2D map directly to your laptop server (maps/) and database:
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase tracking-widest block mb-1">
                  CUSTOM MAP NAME / LOCATION
                </label>
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManualSaveSnapshot()}
                  autoFocus
                  placeholder="e.g. My Apartment, Location 1, Living Room"
                  className="w-full bg-slate-900 border border-cyan-500/50 rounded-xl px-4 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  onClick={() => setShowFreezeSaveModal(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleManualSaveSnapshot()}
                  className="flex-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5"
                  title="Save current map snapshot to server without stopping scanning"
                >
                  <Save size={14} />
                  <span>Save Snapshot</span>
                </button>
                <button
                  onClick={handleConfirmFreezeAndSave}
                  className="flex-1 w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5"
                  title="Finalize map, freeze, and save to server"
                >
                  <HardDrive size={14} />
                  <span>Save & Finish</span>
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

        {/* Master Action Controls: Start / Stop (Freeze) / End Map / Reset / Delete */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          {/* Button 1: Start 2D Mapping */}
          {isMapping ? (
            <div className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-emerald-900/30 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>▶ MAPPING ACTIVE</span>
            </div>
          ) : (
            <button
              onClick={handleOpenStartModal}
              disabled={loadingAction}
              className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border border-emerald-400/50 shadow-emerald-900/40"
              title="Start continuous 2D room mapping"
            >
              <Play size={15} fill="white" />
              <span>START MAPPING</span>
            </button>
          )}

          {/* Button 2: Stop / Freeze Map */}
          <button
            onClick={handleStopFreeze}
            disabled={loadingAction || !isMapping}
            className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 border shadow-lg ${
              isMapping 
                ? 'bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white border-cyan-400 shadow-cyan-900/40' 
                : 'bg-slate-900/60 border-white/10 text-gray-500 cursor-not-allowed'
            }`}
            title="Freeze mapping right where it is, keeping all scanned areas preserved"
          >
            <Pause size={15} />
            <span>STOP / FREEZE</span>
          </button>

          {/* Button 3: Manual Save Map */}
          <button
            onClick={handleOpenFreezeSaveModal}
            disabled={loadingAction}
            className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border border-purple-400/40 shadow-purple-900/40"
            title="Manually save 2D map with custom name to laptop server (maps/) and database"
          >
            <Save size={15} />
            <span>MANUAL SAVE</span>
          </button>

          {/* Button 4: Reset 2D Screen */}
          <button
            onClick={handleResetReconstruct}
            disabled={loadingAction}
            className="px-4 py-2.5 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-500/50 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Immediately clear canvas & reset 2D mapping screen and odometry to (0,0)"
          >
            <RotateCcw size={15} className="text-amber-400" />
            <span>RESET 2D SCREEN</span>
          </button>

          {/* Button 5: Delete All (Fresh Start) */}
          <button
            onClick={handleDeleteAll}
            disabled={loadingAction}
            className="px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Delete all saved maps and start fresh"
          >
            <Trash2 size={15} className="text-red-400" />
            <span>DELETE ALL</span>
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

          {/* Launch House Simulator Game */}
          <Link
            to="/admin/simulator-game"
            className="px-3.5 py-2.5 rounded-xl bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            title="Launch 5-Room Pagani House Simulator Game"
          >
            <Gamepad2 size={15} />
            <span className="hidden sm:inline">Play Pagani Sim</span>
          </Link>
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

      {/* Room Identification Flags Bar (Flags 1, 2, 3, 4) */}
      <div className="glass-panel p-4 rounded-3xl border border-white/10 shadow-xl space-y-3 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-cyan-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Room Identification Flags (Flags 1 — 4)
            </h3>
            <span className="text-[10px] text-gray-400 hidden md:inline">
              • Fix flag at robot's live coordinate while traveling between rooms, or pick manually on map
            </span>
          </div>
          {flagPlacementMode && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-cyan-300 font-bold animate-pulse">
                Click map to place Flag {flagPlacementMode}
              </span>
              <button
                onClick={() => setFlagPlacementMode(null)}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-300 text-[10px]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { num: 1, name: 'Room 1', color: 'emerald', hex: '#10b981', border: 'border-emerald-500/40', bg: 'bg-emerald-950/40' },
            { num: 2, name: 'Room 2', color: 'cyan', hex: '#06b6d4', border: 'border-cyan-500/40', bg: 'bg-cyan-950/40' },
            { num: 3, name: 'Room 3', color: 'purple', hex: '#a855f7', border: 'border-purple-500/40', bg: 'bg-purple-950/40' },
            { num: 4, name: 'Room 4', color: 'amber', hex: '#f59e0b', border: 'border-amber-500/40', bg: 'bg-amber-950/40' },
          ].map(({ num, name, hex, border, bg }) => {
            const dest = getFlagDestination(num);
            const isPlaced = Boolean(dest);
            const isAiming = flagPlacementMode === num;

            return (
              <div
                key={num}
                className={`p-3 rounded-2xl border transition-all ${bg} ${
                  isAiming ? 'ring-2 ring-cyan-400 border-cyan-400 animate-pulse' : border
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-lg flex items-center justify-center font-black text-[11px] text-white shadow"
                      style={{ backgroundColor: hex }}
                    >
                      {num}
                    </span>
                    <span className="font-bold text-white text-xs tracking-wider">{name}</span>
                  </div>
                  {isPlaced && dest ? (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
                        ({dest.x.toFixed(1)}, {dest.y.toFixed(1)})m
                      </span>
                      <button
                        onClick={() => handleDeleteFlag(num)}
                        className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/50"
                        title={`Clear Flag ${num}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 font-medium">Not Set</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => handleFixFlagAtRobot(num)}
                    disabled={loadingAction}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white text-[10px] font-bold border border-white/10 hover:border-white/30 flex items-center justify-center gap-1 transition-all"
                    title={`Fix Flag ${num} at Robot's current pose (${(robotStatus?.position?.x ?? 0).toFixed(2)}, ${(robotStatus?.position?.y ?? 0).toFixed(2)})m`}
                  >
                    <Compass size={12} style={{ color: hex }} />
                    <span>Fix at Robot</span>
                  </button>

                  <button
                    onClick={() => handleStartPickFlagOnMap(num)}
                    disabled={loadingAction}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border flex items-center justify-center gap-1 transition-all ${
                      isAiming
                        ? 'bg-cyan-500 text-white border-cyan-400'
                        : 'bg-slate-900/90 hover:bg-slate-800 text-gray-300 border-white/10 hover:border-white/30'
                    }`}
                    title={`Pick Flag ${num} location manually by clicking on the 2D map`}
                  >
                    <Crosshair size={12} style={{ color: hex }} />
                    <span>Pick on Map</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Autonomous Room Navigation & Dispatch Panel */}
      <AutonomousNavigationPanel />

      {/* Quick Manual Save & Screen Reset Bar */}
      <div className="glass-panel p-3.5 rounded-2xl border border-cyan-500/30 bg-slate-950/70 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-white">
          <Save size={16} className="text-cyan-400" />
          <span className="font-black uppercase tracking-wider">MANUAL SAVE 2D MAP:</span>
          <span className="text-gray-400 text-[11px] hidden md:inline">Type custom name & save directly to laptop server anytime</span>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={manualMapName}
            onChange={(e) => setManualMapName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (manualMapName.trim() || activeLocationName)) {
                handleManualSaveSnapshot(manualMapName.trim() || activeLocationName);
                setManualMapName('');
              }
            }}
            placeholder={`e.g. ${activeLocationName || 'My Apartment'}`}
            className="bg-slate-900 border border-white/20 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-cyan-400 flex-1 sm:w-64"
          />
          <button
            onClick={() => {
              handleManualSaveSnapshot(manualMapName.trim() || activeLocationName);
              setManualMapName('');
            }}
            disabled={loadingAction}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow transition-all whitespace-nowrap"
          >
            <Save size={13} />
            <span>SAVE MAP</span>
          </button>
          <button
            onClick={handleResetReconstruct}
            disabled={loadingAction}
            className="px-3 py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center gap-1 transition-all whitespace-nowrap"
            title="Instantly clear 2D canvas and reset robot coordinate to (0,0)"
          >
            <RotateCcw size={13} className="text-amber-400" />
            <span>RESET SCREEN</span>
          </button>
        </div>
      </div>

      {/* 2. Main Studio Grid: 2D Canvas (Left/Center) + Telemetry & Controls (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols): High-Resolution 2D SLAM Canvas */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[620px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl glass-panel relative">
            <MapCanvas 
              flagPlacementMode={flagPlacementMode}
              onFlagPlaced={handleFlagPlacedOnCanvas}
              onCancelFlagPlacement={() => setFlagPlacementMode(null)}
            />
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
                <div className="font-bold text-cyan-400">600 × 600 cells</div>
              </div>
              <div className="bg-slate-950/60 p-2 rounded-xl border border-white/5">
                <div className="text-gray-400">EXPLORATION SPAN</div>
                <div className="font-bold text-white">30.0m × 30.0m Building</div>
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
                  className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded font-bold text-[10px] uppercase shadow flex items-center gap-1"
                >
                  <Save size={11} />
                  <span>Manual Save</span>
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
