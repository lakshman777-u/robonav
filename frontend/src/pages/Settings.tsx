import { useState } from 'react';
import { toggleSimulation, toggleDemoTime } from '../services/api';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { Cpu, Wifi, FastForward, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { ApiKeyManager } from '../components/ApiKeyManager';

export const Settings = () => {
  const { simulationMode, setSimulationMode } = useRobotStatus();
  const [demo, setDemo] = useState(false);

  const handleModeChange = async (sim: boolean) => {
    try {
      await toggleSimulation(sim);
      setSimulationMode(sim);
      toast.success(sim ? 'Switched to SIMULATION MODE' : 'Switched to REAL ROBOT MODE');
    } catch (e) {
      toast.error('Failed to update system mode');
    }
  };

  const handleDemo = async () => {
    try {
      await toggleDemoTime(!demo);
      setDemo(!demo);
      toast.success(!demo ? 'Demo time acceleration enabled (10x)' : 'Normal real-time mode restored');
    } catch (e) {
      toast.error('Failed to toggle demo time');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-black tracking-wider uppercase text-white mb-1">
          System Architecture & Operating Modes
        </h2>
        <p className="text-xs text-gray-400 font-mono">
          Configure computational mode, simulated sensors, and demo time compression for the PC + ESP32-CAM architecture.
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Real Robot Mode */}
        <div
          onClick={() => handleModeChange(false)}
          className={`glass-panel p-5 rounded-2xl border cursor-pointer transition-all ${
            !simulationMode
              ? 'border-green-500/60 bg-green-950/20 shadow-lg shadow-green-500/10'
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-green-500/20 text-green-400 border border-green-500/30">
                <Wifi size={20} />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                REAL ROBOT MODE
              </h3>
            </div>
            {!simulationMode && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/30">
                <CheckCircle2 size={12} /> ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono leading-relaxed mb-4">
            Connects to physical **ESP32-CAM hardware** via Wi-Fi. Streams real camera frames, ultrasonic echoes, and drives hardware motors via PWM/DIR.
          </p>
          <div className="text-[11px] font-mono text-gray-400 space-y-1">
            <div className="text-green-300 font-bold">✓ Zero fake data</div>
            <div>✓ Actual ESP32-CAM telemetry</div>
            <div>✓ Failsafe collision shutdown</div>
          </div>
        </div>

        {/* Simulation Mode */}
        <div
          onClick={() => handleModeChange(true)}
          className={`glass-panel p-5 rounded-2xl border cursor-pointer transition-all ${
            simulationMode
              ? 'border-cyan-500/60 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
              : 'border-white/10 hover:border-white/20'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Cpu size={20} />
              </div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                SIMULATION MODE
              </h3>
            </div>
            {simulationMode && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                <CheckCircle2 size={12} /> ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono leading-relaxed mb-4">
            Runs the **20m x 15m virtual SLAM office simulator** and synthetic camera viewpoint. Test indoor navigation without physical hardware.
          </p>
          <div className="text-[11px] font-mono text-gray-400 space-y-1">
            <div className="text-cyan-300 font-bold">✓ 26-node topological graph</div>
            <div>✓ Raycasting LiDAR sweep</div>
            <div>✓ Synthetic ESP32-CAM POV</div>
          </div>
        </div>
      </div>

      {/* Demo Time Compression Setting */}
      <div className="glass-panel p-5 rounded-2xl border border-white/10 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm font-bold text-white flex items-center gap-2">
            <FastForward size={16} className="text-amber-400" />
            <span>Accelerated Demo Time (10x Compression)</span>
          </div>
          <div className="text-xs text-gray-400 font-mono">
            Compresses 5-minute wait countdown timer down to 30 seconds for quick demonstrations.
          </div>
        </div>

        <button
          onClick={handleDemo}
          className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all border ${
            demo
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-900 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          {demo ? '10x ACTIVE' : 'NORMAL (1x)'}
        </button>
      </div>

      {/* Embedded API Key Vault & Hardware Pairing */}
      <div className="pt-2">
        <ApiKeyManager robotId="ESP32CAM-001" />
      </div>
    </div>
  );
};
