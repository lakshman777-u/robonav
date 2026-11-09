import React, { useState, useEffect } from 'react';
import { Compass, Navigation2, MapPin, Zap, AlertTriangle, ShieldCheck, Flag, Clock, ArrowRight, Gauge } from 'lucide-react';
import { MapCanvas } from '../components/MapCanvas';
import { DirectionalRobotEyes } from '../components/DirectionalRobotEyes';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useCarTrim } from '../context/CarTrimContext';

export const LiveRobotTracking: React.FC = () => {
  const { robotStatus, emergencyStop } = useRobotStatus();
  const { config } = useCarTrim();
  const [boostActive, setBoostActive] = useState(false);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [destinations, setDestinations] = useState<any[]>([]);

  useEffect(() => {
    if (robotStatus?.speed_control?.boost_active !== undefined) {
      setBoostActive(robotStatus.speed_control.boost_active);
    }
  }, [robotStatus?.speed_control]);

  // Fetch 4 destinations
  useEffect(() => {
    fetch('/api/destinations')
      .then((res) => res.json())
      .then((data) => setDestinations(data))
      .catch((err) => console.error('Failed to load destinations:', err));
  }, []);

  const toggleBoost = async () => {
    const nextBoost = !boostActive;
    setBoostActive(nextBoost);
    try {
      await fetch('/api/speed/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextBoost ? 'BOOST' : 'TURTLE' }),
      });
    } catch (e) {
      console.error('Failed to toggle speed mode:', e);
    }
  };

  const dispatchGoal = async (dest: any) => {
    setSelectedDest(dest.id || dest.name);
    try {
      await fetch('/api/navigation/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: dest.id,
          name: dest.name,
          x: dest.x,
          y: dest.y,
        }),
      });
    } catch (e) {
      console.error('Failed to dispatch navigation goal:', e);
    }
  };

  const posX = robotStatus?.position?.x ?? 0.0;
  const posY = robotStatus?.position?.y ?? 0.0;
  const orientationDeg = robotStatus?.orientation ?? 0.0;
  const headingRad = (orientationDeg * Math.PI) / 180.0;
  const currentDirection = robotStatus?.direction || robotStatus?.speed_control?.current_direction || 'STOPPED';
  const currentExpression = robotStatus?.oled_expression || 'HAPPY';
  const navStatus = robotStatus?.navigation_status || 'IDLE';

  // Format compass cardinal direction
  const getCardinal = (deg: number) => {
    const d = (deg % 360 + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(d / 45) % 8];
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-1">
      {/* Top Banner */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Navigation2 size={22} className="rotate-45" />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wide flex items-center gap-2">
              <span>LIVE ROBOT LOCATION TRACKING</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">
                ROS 2 LOCALIZATION + NAV2
              </span>
            </h1>
            <p className="text-xs text-gray-400 font-mono">
              Real-Time Occupancy Map, Trajectory History, Compass Rose, and 4-Destination Dispatch
            </p>
          </div>
        </div>

        {/* Speed & Emergency Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleBoost}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95 ${
              boostActive
                ? 'bg-amber-500 text-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                : 'bg-slate-900/80 text-gray-200 border-cyan-500/40 hover:border-cyan-300'
            }`}
          >
            <Zap size={15} className={boostActive ? 'fill-black' : 'text-cyan-400'} />
            <span>{boostActive ? '⚡ BOOST ACTIVE (~1 cm/s)' : '🐢 TURTLE MODE (SLOW)'}</span>
          </button>

          <button
            onClick={emergencyStop}
            className="px-3.5 py-1.5 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-lg active:scale-95"
          >
            <AlertTriangle size={15} />
            <span>STOP</span>
          </button>
        </div>
      </div>

      {/* Main Grid: 2D SLAM Tracking Map (Center) + Right Telemetry Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-5 min-h-[520px]">
        {/* Center: Live 2D SLAM Map (3 Cols) */}
        <div className="lg:col-span-3 rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 glass-panel min-h-[460px]">
          <MapCanvas />
        </div>

        {/* Right Sidebar: Location, Compass, 4 Destinations, and Directional Eyes */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Directional Eyes Mini Card */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col items-center justify-center">
            <DirectionalRobotEyes
              expression={currentExpression}
              direction={currentDirection}
              speedMode={boostActive ? 'BOOST' : 'TURTLE'}
              size="sm"
              showLabel={true}
              showOledBezel={true}
            />
          </div>

          {/* Real-Time Pose & Heading Card */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-400 uppercase">
              <span className="flex items-center gap-1.5 text-white">
                <Compass size={16} className="text-cyan-400" /> Robot Pose & Heading
              </span>
              <span className="text-cyan-400">{getCardinal(orientationDeg)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-slate-950/70 border border-white/5">
                <div className="text-[10px] text-gray-400 font-mono">X (m)</div>
                <div className="text-xs font-black text-white font-mono">{posX.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-white/5">
                <div className="text-[10px] text-gray-400 font-mono">Y (m)</div>
                <div className="text-xs font-black text-white font-mono">{posY.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded-xl bg-slate-950/70 border border-white/5">
                <div className="text-[10px] text-gray-400 font-mono">Yaw (θ)</div>
                <div className="text-xs font-black text-cyan-400 font-mono">{orientationDeg.toFixed(1)}°</div>
              </div>
            </div>

            {/* Compass Rose Widget */}
            <div className="flex items-center justify-center py-2">
              <div className="relative w-24 h-24 rounded-full border-2 border-white/10 bg-slate-950/80 flex items-center justify-center shadow-inner">
                {/* Cardinal markers */}
                <span className="absolute top-1 text-[9px] font-black font-mono text-cyan-400">N</span>
                <span className="absolute bottom-1 text-[9px] font-black font-mono text-gray-400">S</span>
                <span className="absolute right-1 text-[9px] font-black font-mono text-gray-400">E</span>
                <span className="absolute left-1 text-[9px] font-black font-mono text-gray-400">W</span>

                {/* Rotating needle */}
                <div
                  className="w-1.5 h-16 relative transition-transform duration-200"
                  style={{ transform: `rotate(${orientationDeg}deg)` }}
                >
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[24px] border-b-cyan-400 mx-auto" />
                  <div className="w-1.5 h-1.5 rounded-full bg-white mx-auto my-0.5" />
                  <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[24px] border-t-red-500 mx-auto" />
                </div>
              </div>
            </div>
          </div>

          {/* 4 Destinations Quick Dispatch */}
          <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-gray-400 uppercase">
              <span className="flex items-center gap-1.5 text-white">
                <Flag size={15} style={{ color: config.primaryColor }} /> 4 Destinations
              </span>
              <span className="text-[10px] text-cyan-400">NAV2 ROUTING</span>
            </div>

            <div className="space-y-1.5">
              {(destinations.length > 0
                ? destinations
                : [
                    { id: '1', name: 'Destination A (Docking)', x: 0.5, y: 0.5 },
                    { id: '2', name: 'Destination B (Charging)', x: 2.0, y: 1.0 },
                    { id: '3', name: 'Destination C (Inspection)', x: 3.5, y: 2.2 },
                    { id: '4', name: 'Destination D (Warehouse)', x: 1.2, y: 3.0 },
                  ]
              ).map((dest, i) => (
                <button
                  key={dest.id || i}
                  onClick={() => dispatchGoal(dest)}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedDest === (dest.id || dest.name)
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-white/5 text-gray-300 hover:border-cyan-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className={selectedDest === (dest.id || dest.name) ? 'text-cyan-400' : 'text-gray-400'} />
                    <div>
                      <div className="text-xs font-bold">{dest.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        ({dest.x.toFixed(1)}, {dest.y.toFixed(1)})
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={14} className="text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveRobotTracking;
